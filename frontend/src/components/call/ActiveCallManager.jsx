/**
 * ActiveCallManager.jsx
 *
 * Owns the full WebRTC lifecycle (peer connection, ICE, media streams)
 * and renders <CallWindow /> with a `nativeWebRTC` prop object containing
 * { localStream, remoteStream, toggleCamera, toggleMute }.
 *
 * This replaces the old popup-based CallPage.jsx.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useCallStore } from "../../store/useCallStore";
import { useAuthStore } from "../../store/useAuthStore";
import CallWindow from "./CallWindow";

const BASE_URL =
  import.meta.env.MODE === "development" ? "http://localhost:5001" : "/";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:80?transport=tcp",
        "turn:openrelay.metered.ca:443?transport=tcp",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
  iceTransportPolicy: "all",
  bundlePolicy: "max-bundle",
  rtcpMuxPolicy: "require",
};

const MAX_ICE_RESTARTS = 3;

export default function ActiveCallManager() {
  const {
    activeCall, outgoingCall, incomingCall,
    endCall, cleanup, markCallActive,
  } = useCallStore();

  const { authUser, socket: mainSocket } = useAuthStore();

  // ── Derive call info ────────────────────────────────────────────────────────
  const callInfo   = activeCall || outgoingCall;
  const callType   = callInfo?.callType ?? incomingCall?.callType ?? "audio";
  const peerId     = callInfo?.with ?? callInfo?.to?._id ?? incomingCall?.from;
  const targetInfo = callInfo?.callerInfo ?? callInfo?.to ?? incomingCall?.callerInfo;

  // ── Streams exposed to CallWindow ───────────────────────────────────────────
  const [localStream,  setLS]  = useState(null);
  const [remoteStream, setRS]  = useState(null);
  const [isMinimized,  setIsMinimized] = useState(false);

  // ── WebRTC / socket refs ────────────────────────────────────────────────────
  const pcRef         = useRef(null);
  const sockRef       = useRef(null);
  const icePending    = useRef([]);
  const remoteReady   = useRef(false);
  const timerRef      = useRef(null);
  const heartbeatRef  = useRef(null);
  const cleanedUp     = useRef(false);
  const iceRestartCnt = useRef(0);
  const localStreamR  = useRef(null);
  const callerFlag    = useRef(useCallStore.getState().isCaller);

  // ── ICE drain ──────────────────────────────────────────────────────────────
  const drainIce = useCallback(async () => {
    remoteReady.current = true;
    for (const c of icePending.current) {
      try { await pcRef.current?.addIceCandidate(new RTCIceCandidate(c)); }
      catch (e) { console.warn("[ICE drain]", e.message); }
    }
    icePending.current = [];
  }, []);

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  const doCleanup = useCallback((notifyPeer = true) => {
    if (cleanedUp.current) return;
    cleanedUp.current = true;

    clearInterval(timerRef.current);
    clearInterval(heartbeatRef.current);
    localStreamR.current?.getTracks().forEach((t) => t.stop());

    if (pcRef.current) {
      try {
        pcRef.current.onicecandidate = null;
        pcRef.current.ontrack = null;
        pcRef.current.oniceconnectionstatechange = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.close();
      } catch { }
      pcRef.current = null;
    }

    if (notifyPeer && peerId) {
      mainSocket?.emit("call:end", { to: peerId, reason: "ended" });
      mainSocket?.emit("end-call", { to: peerId });
    }

    if (sockRef.current) {
      sockRef.current.removeAllListeners();
      sockRef.current.disconnect();
      sockRef.current = null;
    }

    setLS(null);
    setRS(null);
    cleanup();
  }, [peerId, mainSocket, cleanup]);

  // ── ICE restart ──────────────────────────────────────────────────────────────
  const attemptIceRestart = useCallback(() => {
    if (!pcRef.current || cleanedUp.current) return;
    if (iceRestartCnt.current >= MAX_ICE_RESTARTS) { doCleanup(false); return; }
    iceRestartCnt.current += 1;
    try { pcRef.current.restartIce(); } catch { }
  }, [doCleanup]);

  // ── Build RTCPeerConnection ──────────────────────────────────────────────────
  const buildPC = useCallback((sock) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate && peerId) sock.emit("ice-candidate", { to: peerId, candidate });
    };

    pc.ontrack = (e) => {
      const rs = e.streams?.[0] ?? new MediaStream([e.track]);
      setRS(rs);
    };

    let discoTimer = null;
    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      console.log("ICE:", s);
      if (s === "connected" || s === "completed") {
        clearTimeout(discoTimer);
        iceRestartCnt.current = 0;
        
        // ✅ FORCE UI TRANSITION
        markCallActive();
        console.log("CALL STATUS: connected (ICE)");

        clearInterval(timerRef.current);

        // Boost audio
        try {
          const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
          if (sender) {
            const params = sender.getParameters();
            if (!params.encodings?.length) params.encodings = [{}];
            params.encodings[0].maxBitrate = 128_000;
            params.encodings[0].priority = "high";
            sender.setParameters(params).catch(() => { });
          }
        } catch { }
      }
      if (s === "disconnected") {
        discoTimer = setTimeout(() => {
          if (pcRef.current?.iceConnectionState === "disconnected") attemptIceRestart();
        }, 5_000);
      }
      if (s === "failed") { clearTimeout(discoTimer); attemptIceRestart(); }
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      console.log("STATE:", s);
      if (s === "failed") attemptIceRestart();
      if (s === "connected") {
        // ✅ FORCE UI TRANSITION
        markCallActive();
        console.log("CALL STATUS: connected (STATE)");
      }
    };

    return pc;
  }, [peerId, attemptIceRestart, markCallActive]);

  // ── Get user media ───────────────────────────────────────────────────────────
  const getMedia = useCallback(async () => {
    let stream = null;
    let reqAudio = true;
    let reqVideo = callType === "video";

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: reqAudio,
        video: reqVideo,
      });
    } catch (err) {
      console.warn("[Media] Initial media request failed:", err);
      
      if (reqVideo && !stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } catch (e2) {}
      }

      if (reqVideo && !stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        } catch (e3) {}
      }
      
      if (!stream) {
        console.warn("[Media] All fallbacks failed. Creating empty stream.");
        stream = new MediaStream();
      }
    }

    localStreamR.current = stream;
    setLS(stream);
    return stream;
  }, [callType]);

  // ── Caller flow ──────────────────────────────────────────────────────────────
  const startCallerFlow = useCallback(async (sock) => {
    const stream = await getMedia();
    if (!stream || cleanedUp.current) return;
    const pc = buildPC(sock);
    pcRef.current = pc;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    if (stream.getAudioTracks().length === 0) {
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }
    if (callType === 'video' && stream.getVideoTracks().length === 0) {
      pc.addTransceiver('video', { direction: 'recvonly' });
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sock.emit("call-user", {
      to: peerId, offer, callType,
      callerInfo: {
        _id: authUser?._id,
        fullName: authUser?.fullName,
        profilePic: authUser?.profilePic || "/avatar.png",
      },
    });
  }, [getMedia, buildPC, peerId, callType, authUser]);

  // ── Receiver flow ─────────────────────────────────────────────────────────────
  const startReceiverFlow = useCallback(async (sock, offer, earlyIce = []) => {
    const stream = await getMedia();
    if (!stream || cleanedUp.current) return;
    if (earlyIce.length) icePending.current.push(...earlyIce);
    const pc = buildPC(sock);
    pcRef.current = pc;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    await drainIce();
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    sock.emit("call-accepted", { to: peerId, answer });
  }, [getMedia, buildPC, drainIce, peerId]);

  // ── Heartbeat ──────────────────────────────────────────────────────────────
  const startHeartbeat = useCallback((sock) => {
    clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(() => {
      if (sock?.connected) sock.emit("call:ping", { to: peerId });
    }, 15_000);
  }, [peerId]);

  const flowStarted = useRef(false);

  // ── Main setup effect ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!peerId || !authUser?._id) return;

    const sock = io(BASE_URL, {
      query: { userId: authUser._id },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 8_000,
      transports: ["websocket"],
      upgrade: false,
    });
    sockRef.current = sock;

    sock.on("connect", () => {
      startHeartbeat(sock);
      if (!flowStarted.current) {
        flowStarted.current = true;
        if (callerFlag.current) {
          startCallerFlow(sock);
        } else {
          const offer   = useCallStore.getState().pendingOffer;
          const earlyIce = useCallStore.getState().pendingIceQueue || [];
          if (offer) startReceiverFlow(sock, offer, earlyIce);
        }
      }
    });

    sock.on("reconnect", () => sock.emit("re-register"));

    sock.on("call-accepted-by-peer", async ({ answer }) => {
      if (!pcRef.current || cleanedUp.current) return;
      console.log("ANSWER RECEIVED");
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        console.log("REMOTE DESC SET");
        await drainIce();

        // ✅ FORCE UI TRANSITION
        markCallActive();
        console.log("CALL STATUS: connected (FORCE)");

        // 🧩 SAFETY TIMEOUT (FINAL FALLBACK)
        setTimeout(() => {
          if (pcRef.current?.connectionState === "connected" || pcRef.current?.iceConnectionState === "connected") {
            markCallActive();
          }
        }, 2000);

      } catch (e) { console.warn("[answer]", e.message); }
    });

    sock.on("ice-candidate", async ({ candidate }) => {
      if (!candidate || cleanedUp.current) return;
      if (remoteReady.current) {
        try { await pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate)); }
        catch (e) { console.warn("[ICE add]", e.message); }
      } else {
        icePending.current.push(candidate);
      }
    });

    sock.on("call-ended",   () => { if (!cleanedUp.current) doCleanup(false); });
    sock.on("call-rejected",() => { doCleanup(false); });
    sock.on("call-timeout", () => { doCleanup(false); });
    sock.on("call:pong",    () => { /* heartbeat ack */ });

    return () => {
      if (!cleanedUp.current) doCleanup(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Watch store: if peer kills call via main socket → cleanup ───────────────
  const storeActive   = useCallStore((s) => s.activeCall);
  const storeOutgoing = useCallStore((s) => s.outgoingCall);
  useEffect(() => {
    if (!storeActive && !storeOutgoing) {
      if (!cleanedUp.current) doCleanup(false);
    }
  }, [storeActive, storeOutgoing]); // eslint-disable-line

  // ── Toggles exposed to CallWindow via nativeWebRTC prop ─────────────────────
  const toggleMute = useCallback(() => {
    const track = localStreamR.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; useCallStore.getState().toggleMute(); }
  }, []);

  const toggleCamera = useCallback(() => {
    const track = localStreamR.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; useCallStore.getState().toggleCamera(); }
  }, []);

  const handleEndCall = useCallback(() => {
    endCall();
    doCleanup(true);
  }, [endCall, doCleanup]);

  // ── Don't render if there's nothing to manage ────────────────────────────────
  if (!callInfo && !incomingCall) return null;

  // ── nativeWebRTC object — passed as single prop to CallWindow ───────────────
  const nativeWebRTC = {
    localStream,
    remoteStream,
    toggleMute,
    toggleCamera,
  };

  return (
    <CallWindow
      nativeWebRTC={nativeWebRTC}
      targetInfo={targetInfo}
      endCall={handleEndCall}
      setMinimized={setIsMinimized}
    />
  );
}
