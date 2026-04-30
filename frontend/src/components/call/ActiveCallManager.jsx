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
import { ICE_SERVERS } from "../../constants/webrtc";
import CallWindow from "./CallWindow";

const BASE_URL =
  import.meta.env.MODE === "development" ? "http://localhost:5001" : "/";

// ── ICE / STUN / TURN configuration moved to constants/webrtc.js ─────────────

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

  // ── Helper: Wait for ICE gathering ─────────────────────────────────────────
  const waitForIce = (pc) => new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve();
    const check = () => { if (pc.iceGatheringState === "complete") { pc.removeEventListener("icegatheringstatechange", check); resolve(); } };
    pc.addEventListener("icegatheringstatechange", check);
    setTimeout(resolve, 2000); // Max 2s wait
  });

  // ── ICE drain ──────────────────────────────────────────────────────
  // CRITICAL: set remoteReady = true FIRST so the ice-candidate handler
  // can add directly. Then drain the buffer.
  const drainIce = useCallback(async () => {
    if (!pcRef.current || !pcRef.current.remoteDescription) return;

    // Mark remote ready BEFORE draining so concurrent candidates are added directly
    remoteReady.current = true;

    const candidates = [...icePending.current];
    icePending.current = [];

    if (candidates.length > 0) {
      console.log(`[ICE Manager] Draining ${candidates.length} buffered candidates`);
      for (const c of candidates) {
        try {
          if (c && pcRef.current?.remoteDescription) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(c));
          }
        } catch (e) {
          if (!e.message?.includes("The ICE candidate could not be added")) {
            console.warn("[ICE Manager] Drain error:", e.message);
          }
        }
      }
    }
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
      if (candidate && peerId) {
        console.log("[WebRTC Manager] ICE sent");
        sock.emit("ice-candidate", { to: peerId, candidate });
      } else {
        console.log("[WebRTC Manager] ICE gathering complete");
      }
    };

    pc.ontrack = (e) => {
      const rs = e.streams?.[0] ?? new MediaStream([e.track]);
      setRS(rs);
    };

    let discoTimer = null;
    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      console.log("ICE STATE:", s);
      if (s === "connected" || s === "completed") {
        clearTimeout(discoTimer);
        iceRestartCnt.current = 0;
        
        // ✅ FORCE UI TRANSITION
        markCallActive();
        console.log("CALL STATUS: connected (ICE)");

        clearInterval(timerRef.current);

        // Boost audio (WhatsApp-level quality)
        try {
          const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
          if (sender) {
            const params = sender.getParameters();
            if (!params.encodings?.length) params.encodings = [{}];
            // Step 4: Enhance Opus codec (WhatsApp quality)
            params.encodings[0].maxBitrate = 64000;
            params.encodings[0].priority = "high";
            params.encodings[0].networkPriority = "high";
            sender.setParameters(params).catch(() => { });
            console.log("[WebRTC] Audio optimized: 64kbps, high priority");
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

    pc.onicegatheringstatechange = () => {
      console.log("[WebRTC Manager] ICE gathering state:", pc.iceGatheringState);
    };

    return pc;
  }, [peerId, attemptIceRestart, markCallActive]);

  // ── Get user media ───────────────────────────────────────────────────────────
  const getMedia = useCallback(async () => {
    let stream = null;
    let reqAudio = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,

      // Step 1: Optimized constraints for WhatsApp-level clarity
      channelCount: 1,
      sampleRate: 48000,
      sampleSize: 16
    };
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
          stream = await navigator.mediaDevices.getUserMedia({ audio: reqAudio, video: false });
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

    // Verify and optimize audio track settings (STEP 2)
    const audioTrack = stream?.getAudioTracks()[0];
    if (audioTrack) {
      if ("contentHint" in audioTrack) {
        audioTrack.contentHint = "speech";
      }
      console.log("[WebRTC] Audio Track Settings (Optimized):", audioTrack.getSettings());
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

    // Prioritize Opus codec in SDP
    if (typeof RTCRtpSender !== "undefined" && RTCRtpSender.getCapabilities) {
      const codecs = RTCRtpSender.getCapabilities("audio")?.codecs;
      if (codecs) {
        const opusCodecs = codecs.filter(c => c.mimeType.toLowerCase() === "audio/opus");
        if (opusCodecs.length > 0) {
          pc.getTransceivers().forEach(t => {
            if (t.sender && t.sender.track && t.sender.track.kind === "audio" && t.setCodecPreferences) {
              try { t.setCodecPreferences(opusCodecs); console.log("[WebRTC] Prioritized Opus codec"); } catch(e) {}
            }
          });
        }
      }
    }

    if (stream.getAudioTracks().length === 0) {
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }
    if (callType === 'video' && stream.getVideoTracks().length === 0) {
      pc.addTransceiver('video', { direction: 'recvonly' });
    }

    console.log("[WebRTC Manager] Caller creating offer");
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    console.log("[WebRTC Manager] Offer sent");
    sock.emit("call-user", {
      to: peerId, offer: pc.localDescription, callType,
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
    
    if (earlyIce.length) {
      console.log("[WebRTC Manager] Adding early ICE candidates to queue:", earlyIce.length);
      icePending.current.push(...earlyIce);
    }
    
    const pc = buildPC(sock);
    pcRef.current = pc;
    
    if (stream.getTracks().length > 0) {
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    }

    // Prioritize Opus codec in SDP
    if (typeof RTCRtpSender !== "undefined" && RTCRtpSender.getCapabilities) {
      const codecs = RTCRtpSender.getCapabilities("audio")?.codecs;
      if (codecs) {
        const opusCodecs = codecs.filter(c => c.mimeType.toLowerCase() === "audio/opus");
        if (opusCodecs.length > 0) {
          pc.getTransceivers().forEach(t => {
            if (t.sender && t.sender.track && t.sender.track.kind === "audio" && t.setCodecPreferences) {
              try { t.setCodecPreferences(opusCodecs); console.log("[WebRTC] Prioritized Opus codec"); } catch(e) {}
            }
          });
        }
      }
    }
    
    // Receiver transceivers
    if (!stream.getAudioTracks().length) pc.addTransceiver("audio", { direction: "recvonly" });
    if (callType === "video" && !stream.getVideoTracks().length) pc.addTransceiver("video", { direction: "recvonly" });

    console.log("[WebRTC Manager] Receiver setting remote description");
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    console.log("[WebRTC Manager] Offer received & set");
    await drainIce();
    
    console.log("[WebRTC Manager] Receiver creating answer");
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    console.log("[WebRTC Manager] Answer sent");
    sock.emit("call-accepted", { to: peerId, answer: pc.localDescription });
  }, [getMedia, buildPC, drainIce, peerId, callType]);

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
      console.log("[WebRTC Manager] Answer received");
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        console.log("[WebRTC Manager] Answer received & set");
        await drainIce();

        // DO NOT force markCallActive() here.
        // ICE has NOT completed yet. The ICE state machine (oniceconnectionstatechange)
        // will call markCallActive() when state = "connected" or "completed".
        console.log("[WebRTC Manager] Waiting for ICE to complete...");

      } catch (e) { console.warn("[WebRTC Manager] answer error:", e.message); }
    });

    sock.on("ice-candidate", async ({ candidate }) => {
      if (!candidate || cleanedUp.current) return;
      console.log("[WebRTC Manager] ICE received");

      if (remoteReady.current && pcRef.current?.remoteDescription) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          console.log("[WebRTC Manager] ICE candidate added");
        } catch (e) {
          if (!e.message?.includes("The ICE candidate could not be added")) {
            console.warn("[WebRTC Manager] addIceCandidate error:", e.message);
          }
        }
      } else {
        console.log("[WebRTC Manager] ICE candidate queued");
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
