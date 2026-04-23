/**
 * CallPage — runs in the popup window.
 *
 * Stability fixes for 30-60s disconnect:
 *  1. TURN servers added (free open-relay + Google STUN)
 *  2. ICE restart on "disconnected"/"failed" (up to 3 attempts before giving up)
 *  3. Socket keep-alive heartbeat every 15s
 *  4. Socket reconnection enabled (call continues even if signaling blips)
 *  5. Track-ended monitoring
 *  6. Correct ICE state machine: "disconnected" is TRANSIENT, only "failed" triggers restart
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Shield, MessageSquare, Wifi, WifiOff,
  MoreVertical, Hand, Smile, UserPlus, MonitorPlay
} from "lucide-react";

import "./callWindow.css";

const BASE_URL = import.meta.env.MODE === "development" ? "http://localhost:5001" : "/";

// ── ICE / STUN / TURN configuration ─────────────────────────────────────────
// Free open-relay TURN (openrelay.metered.ca) — no sign-up needed.
// Replace with Twilio / Xirsys / your own Coturn in production for guaranteed uptime.
const ICE_SERVERS = {
  iceServers: [
    // Google STUN — multiple for redundancy
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    // Free TURN relay — handles symmetric NAT, firewalls, etc.
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
  iceTransportPolicy: "all", // try direct/STUN first, fall back to TURN
  bundlePolicy: "max-bundle",
  rtcpMuxPolicy: "require",
};

const MAX_ICE_RESTARTS = 3;

const fmtTime = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

// ── Module singletons per popup context ──────────────────────────────────────
let _bc = null;
const getBc = () => {
  if (!_bc) { try { _bc = new BroadcastChannel("chatty_call_channel"); } catch { _bc = null; } }
  return _bc;
};
let _socketSetup = false;

// ─────────────────────────────────────────────────────────────────────────────

const CallPage = () => {
  const [params] = useSearchParams();
  const callType = params.get("callType") || "audio";
  const peerId = params.get("peerId") || "";
  const peerName = params.get("peerName") || "Unknown";
  const peerPic = params.get("peerPic") || "/avatar.png";
  const isCaller = params.get("isCaller") === "true";
  const userId = params.get("userId") || "";

  const [status, setStatus] = useState(isCaller ? "calling" : "connecting");
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(callType === "audio");
  const [duration, setDuration] = useState(0);
  const [peerCameraOff, setPeerCameraOff] = useState(callType === "audio");
  const [peerMuted, setPeerMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [netStatus, setNetStatus] = useState("good"); // "good" | "poor" | "reconnecting"
  const [wasConnected, setWasConnected] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);

  // UI-only states
  const [hasEverEnabledVideo, setHasEverEnabledVideo] = useState(callType === "video");
  const [peerHasEverEnabledVideo, setPeerHasEverEnabledVideo] = useState(callType === "video");
  const [isSwapped, setIsSwapped] = useState(false);
  const [localFit, setLocalFit] = useState("cover");
  const [remoteFit, setRemoteFit] = useState("cover");
  const [menuOpen, setMenuOpen] = useState(null);
  
  // Real-time UI states
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  const [localDevice] = useState(isMobile ? "mobile" : "desktop");
  const [remoteDevice, setRemoteDevice] = useState("desktop");
  
  // Real-time UI states
  const [handState, setHandState] = useState({ localRaised: false, remoteRaised: false });
  const [emojis, setEmojis] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const localVidRef = useRef(null);
  const remoteVidRef = useRef(null);
  const remoteAudRef = useRef(null);
  const pcRef = useRef(null);
  const sockRef = useRef(null);
  const localStream = useRef(null);
  const icePending = useRef([]);
  const remoteReady = useRef(false);
  const timerRef = useRef(null);
  const heartbeatRef = useRef(null);
  const iceRestartCountRef = useRef(0);
  const cleanedUp = useRef(false);

  // ── Hand Raise & Emoji Controls ──────────────────────────────────────────
  const triggerEmojiAnimation = useCallback((isRemote, emoji) => {
    const newId = Math.random().toString(36).substring(7);
    const xOffset = `${Math.floor(Math.random() * 40 - 20)}px`;
    setEmojis(prev => [...prev, { id: newId, emoji, isRemote, xOffset }]);
    setTimeout(() => {
      setEmojis(prev => prev.filter(e => e.id !== newId));
    }, 2000);
  }, []);

  const toggleHandRaise = () => {
    setHandState(prev => {
      const next = !prev.localRaised;
      if (sockRef.current?.connected) {
        sockRef.current.emit("call:handRaise", { callId: peerId, userId, raised: next });
      }
      return { ...prev, localRaised: next };
    });
  };

  const handleEmojiSelect = (emoji) => {
    setShowEmojiPicker(false);
    triggerEmojiAnimation(false, emoji);
    if (sockRef.current?.connected) {
      sockRef.current.emit("call:emoji", { callId: peerId, userId, emoji });
    }
  };

  // ── ICE drain ────────────────────────────────────────────────────────────
  const drainIce = useCallback(async () => {
    remoteReady.current = true;
    for (const c of icePending.current) {
      try { await pcRef.current?.addIceCandidate(new RTCIceCandidate(c)); }
      catch (e) { console.warn("[ICE drain]", e.message); }
    }
    icePending.current = [];
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  const cleanup = useCallback((notifyPeer = true) => {
    if (cleanedUp.current) return;
    cleanedUp.current = true;
    _socketSetup = false;

    clearInterval(timerRef.current);
    clearInterval(heartbeatRef.current);
    localStream.current?.getTracks().forEach((t) => t.stop());

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

    if (notifyPeer && sockRef.current?.connected) {
      sockRef.current.emit("end-call", { to: peerId });
      sockRef.current.emit("call:end", { to: peerId, reason: "ended" });
    }
    if (sockRef.current) {
      sockRef.current.removeAllListeners();
      sockRef.current.disconnect();
      sockRef.current = null;
    }

    // Capture the most accurate status to tell the main window how the call ended
    setStatus((currentStatus) => {
      getBc()?.postMessage({ type: "CALL_ENDED", finalStatus: currentStatus });
      return "ended";
    });
  }, [peerId]);

  // ── Start heartbeat (keep socket alive, detect silent drops) ─────────────
  const startHeartbeat = useCallback((sock) => {
    clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(() => {
      if (sock.connected) {
        sock.emit("call:ping", { to: peerId });
      } else {
        console.warn("[Heartbeat] socket not connected");
      }
    }, 15_000);
  }, [peerId]);

  // ── Attempt ICE restart ───────────────────────────────────────────────────
  const attemptIceRestart = useCallback(() => {
    if (!pcRef.current || cleanedUp.current) return;
    if (iceRestartCountRef.current >= MAX_ICE_RESTARTS) {
      console.error("[ICE] Max restarts reached — ending call");
      setErrorMsg("Connection lost after multiple retries.");
      cleanup(false);
      return;
    }
    iceRestartCountRef.current += 1;
    console.log(`[ICE] Restart attempt ${iceRestartCountRef.current}/${MAX_ICE_RESTARTS}`);
    setNetStatus("reconnecting");
    try { pcRef.current.restartIce(); }
    catch (e) { console.error("[ICE] restartIce failed:", e); }
  }, [cleanup]);

  // ── Build RTCPeerConnection ───────────────────────────────────────────────
  const buildPC = useCallback((sock) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) sock.emit("ice-candidate", { to: peerId, candidate });
    };

    pc.ontrack = (e) => {
      const rs = e.streams?.[0] ?? new MediaStream([e.track]);
      setRemoteStream(rs);

      if (remoteAudRef.current && remoteAudRef.current.srcObject !== rs) remoteAudRef.current.srcObject = rs;
      if (remoteVidRef.current && remoteVidRef.current.srcObject !== rs) remoteVidRef.current.srcObject = rs;
      const hasVideo = rs.getVideoTracks().some((t) => t.enabled && t.readyState === "live");
      setPeerCameraOff(!hasVideo);
      
      if (hasVideo) setPeerHasEverEnabledVideo(true);

      // Monitor for unexpected track ending
      e.track.onended = () => {
        console.warn("[Track] Remote track ended unexpectedly:", e.track.kind);
      };
    };

    // ── ICE state machine ──────────────────────────────────────────────────
    // "disconnected" → transient (5s grace period then restart)
    // "failed"       → restart immediately (up to MAX_ICE_RESTARTS)
    // "connected"    → reset restart counter, mark active
    let disconnectTimer = null;

    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      console.log("[ICE state]", s);

      if (s === "connected" || s === "completed") {
        clearTimeout(disconnectTimer);
        iceRestartCountRef.current = 0;
        setNetStatus("good");
        setStatus("active");
        setWasConnected(true);
        clearInterval(timerRef.current);
        timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);

        // ── Boost audio quality once connected ─────────────────────────────────
        // Set 128 kbps audio bitrate for WhatsApp-grade voice quality
        try {
          const audioSender = pc.getSenders().find((s) => s.track?.kind === "audio");
          if (audioSender) {
            const params = audioSender.getParameters();
            if (!params.encodings || params.encodings.length === 0) {
              params.encodings = [{}];
            }
            params.encodings[0].maxBitrate = 128_000; // 128 kbps
            params.encodings[0].priority = "high";
            params.encodings[0].networkPriority = "high";
            audioSender.setParameters(params).catch(() => { });
          }
        } catch { /* setParameters not supported in all browsers */ }
      }

      if (s === "disconnected") {
        // Give it 5 seconds before acting — often self-heals
        setNetStatus("poor");
        disconnectTimer = setTimeout(() => {
          if (pcRef.current?.iceConnectionState === "disconnected") {
            console.log("[ICE] Still disconnected after 5s — restarting");
            attemptIceRestart();
          }
        }, 5_000);
      }

      if (s === "failed") {
        clearTimeout(disconnectTimer);
        attemptIceRestart();
      }
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      console.log("[Connection state]", s);
      if (s === "failed") attemptIceRestart();
      if (s === "connected") {
        setStatus("active");
        setWasConnected(true);
      }
      // "closed" means the other side closed the PC — don't end call here,
      // socket "call-ended" handles that
    };

    pc.onicegatheringstatechange = () => {
      console.log("[ICE gathering]", pc.iceGatheringState);
    };

    return pc;
  }, [peerId, attemptIceRestart]);

  // ── Get user media ────────────────────────────────────────────────────────
  const getMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video",
      });
      localStream.current = stream;
      if (localVidRef.current && localVidRef.current.srcObject !== stream) {
        localVidRef.current.srcObject = stream;
      }

      // Monitor local tracks
      stream.getTracks().forEach((track) => {
        track.onended = () => console.warn("[Track] Local track ended:", track.kind);
      });
      return stream;
    } catch (err) {
      const msg =
        err.name === "NotAllowedError" ? "Camera/microphone access denied." :
          err.name === "NotFoundError" ? "No camera/microphone found." :
            `Media error: ${err.message}`;
      setErrorMsg(msg);
      setStatus("ended");
      return null;
    }
  };

  // ── Caller flow ───────────────────────────────────────────────────────────
  const startCallerFlow = useCallback(async (sock) => {
    const stream = await getMedia();
    if (!stream || cleanedUp.current) return;

    const pc = buildPC(sock);
    pcRef.current = pc;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      setStatus("calling");
      sock.emit("call-user", {
        to: peerId,
        offer,
        callType,
        callerInfo: { _id: userId, fullName: peerName, profilePic: peerPic }
      });
    } catch (err) {
      console.error("[Caller] offer error:", err);
      setErrorMsg("Failed to create call offer.");
      cleanup(false);
    }
  }, [peerId, callType, userId, buildPC, cleanup]); // eslint-disable-line

  // ── Receiver flow ─────────────────────────────────────────────────────────
  const startReceiverFlow = useCallback(async (sock, offer, earlyIce = []) => {
    const stream = await getMedia();
    if (!stream || cleanedUp.current) return;

    if (earlyIce && earlyIce.length) {
      icePending.current.push(...earlyIce);
    }

    const pc = buildPC(sock);
    pcRef.current = pc;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await drainIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sock.emit("call-accepted", { to: peerId, answer });
      setStatus("connecting");
    } catch (err) {
      console.error("[Receiver] answer error:", err);
      setErrorMsg("Failed to accept call.");
      cleanup(false);
    }
  }, [peerId, buildPC, drainIce, cleanup]); // eslint-disable-line

  // ── Main setup effect ─────────────────────────────────────────────────────
  useEffect(() => {
    if (_socketSetup) return;
    _socketSetup = true;

    const sock = io(BASE_URL, {
      query: { userId },
      // ── Reconnection: socket blip does NOT end the call ─────────────────
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 8_000,
      // ── Keep-alive at transport level ───────────────────────────────────
      transports: ["websocket"],
      upgrade: false, // stay on WebSocket
    });
    sockRef.current = sock;

    sock.on("connect", () => {
      console.log("[Popup socket] connected:", sock.id);
      startHeartbeat(sock);

      // Tell other peer what our device orientation is, using reliable socket relay
      sock.emit("call:deviceInfo", { callId: peerId, device: localDevice });

      if (isCaller) {
        // Tell main window to cancel its 30-second no-answer timer immediately.
        // The popup has taken over signaling — main window must NOT kill us.
        getBc()?.postMessage({ type: "POPUP_TOOK_OVER" });
        startCallerFlow(sock);
      } else {
        getBc()?.postMessage({ type: "POPUP_READY" });
      }
    });

    sock.on("reconnect", (attempt) => {
      console.log("[Popup socket] reconnected after", attempt, "attempt(s)");
      // Re-register user with server after socket reconnect
      sock.emit("re-register");
    });

    sock.on("disconnect", (reason) => {
      console.warn("[Popup socket] disconnected:", reason);
      // Socket disconnect does NOT end call — WebRTC is P2P, still live.
      // Only end if it was a server-side forced disconnect.
      if (reason === "io server disconnect") {
        console.error("[Socket] Server force-disconnected.");
        // Don't end call — try to reconnect naturally
      }
    });

    // Caller: peer accepted
    sock.on("call-accepted-by-peer", async ({ answer }) => {
      if (!pcRef.current || cleanedUp.current) return;
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        await drainIce();
        setStatus("connecting");
        // Tell main window the call was accepted — clears outgoingCall state
        getBc()?.postMessage({ type: "CALL_ACCEPTED" });
      } catch (e) { console.error("[answer]", e); }
    });

    // ICE from peer
    sock.on("ice-candidate", async ({ candidate }) => {
      if (!candidate || !pcRef.current || cleanedUp.current) return;
      if (remoteReady.current) {
        try { await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)); }
        catch (e) { console.warn("[ICE add]", e.message); }
      } else {
        icePending.current.push(candidate);
      }
    });

    // Peer-initiated events
    sock.on("call-ended", () => { if (!cleanedUp.current) cleanup(false); });
    sock.on("call-rejected", () => { setStatus("rejected"); cleanup(false); });
    sock.on("call-timeout", () => { setStatus("timeout"); cleanup(false); });
    sock.on("call:pong", () => { /* heartbeat ack — socket is alive */ });

    // ── Reaction syncing (Hand Raise & Emoji) ────────
    sock.on("call:handRaise", ({ userId: senderId, raised }) => {
      setHandState(prev => ({ ...prev, remoteRaised: raised }));
    });

    sock.on("call:emoji", ({ userId: senderId, emoji }) => {
      triggerEmojiAnimation(true, emoji);
    });
    
    sock.on("call:deviceInfo", ({ device }) => {
      // remote UI will re-render aspect ratio based on hardware device origin
      setRemoteDevice(device);
    });

    sock.on("call:mediaStatus", ({ isMuted: remoteMuted, isCameraOff: remoteCameraOff }) => {
      setPeerMuted(remoteMuted);
      setPeerCameraOff(remoteCameraOff);
      if (!remoteCameraOff) setPeerHasEverEnabledVideo(true);
    });

    // ── WebRTC Renegotiation Handlers ─────────────────
    sock.on("call:renegotiate", async ({ offer }) => {
      try {
        if (!pcRef.current || cleanedUp.current) return;
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);

        sock.emit("call:renegotiate:answer", {
          callId: peerId,
          answer
        });
      } catch (err) {
        console.error("[Renegotiate] Offer handle error:", err);
      }
    });

    sock.on("call:renegotiate:answer", async ({ answer }) => {
      try {
        if (!pcRef.current || cleanedUp.current) return;
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (err) {
        console.error("[Renegotiate] Answer handle error:", err);
      }
    });

    // When the receiver acknowledges they got the offer
    sock.on("call-ringing", () => {
      setStatus((prev) => {
        if (prev === "calling") return "ringing";
        return prev;
      });
    });

    sock.on("call-user-offline", () => {
      // Just keep status as "calling" to allow the 120s loop to try finding them
      // Do NOT end call or run cleanup.
      console.log("[Call] User is perfectly offline, waiting for them...");
    });

    sock.on("connect_error", (err) => {
      console.error("[Socket connect error]", err.message);
    });

    const bc = getBc();
    if (bc) {
      bc.onmessage = (e) => {
        if (!isCaller && e.data?.type === "INCOMING_CALL" && e.data.offer && !cleanedUp.current) {
          startReceiverFlow(sock, e.data.offer, e.data.iceCandidates || []);
        }
        if (e.data?.type === "FORWARD_ICE_CANDIDATE" && e.data.candidate && !cleanedUp.current) {
          if (remoteReady.current) {
            try { pcRef.current?.addIceCandidate(new RTCIceCandidate(e.data.candidate)); } catch { }
          } else {
            icePending.current.push(e.data.candidate);
          }
        }
        if (e.data?.type === "FORCE_TIMEOUT" && !cleanedUp.current) {
          setStatus("timeout");
          cleanup(false);
        }
      };
    }

    // Real cleanup on window close
    const handlePageHide = () => {
      if (!cleanedUp.current) cleanup(true);
    };
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Smart End Screen & Auto Close ────────────────────────────────────────
  useEffect(() => {
    const isEndedState = ["ended", "rejected", "timeout"].includes(status);
    if (!isEndedState) return;

    // RULE 1: If the call successfully connected and ended normally -> NO end screen for anyone. Close window instantly.
    if (wasConnected) {
      window.close();
      return;
    }

    // RULE 2: If the call failed to connect (missed/rejected), the Receiver should NOT see anything -> Close window instantly.
    if (!isCaller) {
      window.close();
      return;
    }

    // RULE 3: If the call failed to connect AND we are the Caller -> Show End Screen so they can see "Declined" or "No answer".
    const closeTimer = setTimeout(() => {
      window.close();
    }, 40000);

    return () => clearTimeout(closeTimer);
  }, [status, isCaller, wasConnected]);

  const toggleMic = () => {
    const track = localStream.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsMuted(!track.enabled);

    if (sockRef.current?.connected) {
      sockRef.current.emit("call:mediaStatus", {
        callId: peerId,
        isMuted: !track.enabled,
        isCameraOff
      });
    }
  };

  const toggleCamera = async () => {
    if (!localStream.current) return;
    let track = localStream.current.getVideoTracks()[0];

    // If audio call dynamically upgrading to video call for the first time
    if (!track) {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        track = videoStream.getVideoTracks()[0];
        localStream.current.addTrack(track);

        if (pcRef.current) {
          pcRef.current.addTrack(track, localStream.current);
          
          // ── TRIGGER RENEGOTIATION ────────────────────────────
          const offer = await pcRef.current.createOffer();
          await pcRef.current.setLocalDescription(offer);
          
          if (sockRef.current?.connected) {
            sockRef.current.emit("call:renegotiate", {
              callId: peerId,
              offer
            });
          }
        }

        if (localVidRef.current && localVidRef.current.srcObject !== localStream.current) {
          localVidRef.current.srcObject = localStream.current;
        }

        setIsCameraOff(false);
        setHasEverEnabledVideo(true);

        if (sockRef.current?.connected) {
          sockRef.current.emit("call:mediaStatus", {
            callId: peerId,
            isMuted,
            isCameraOff: false
          });
        }
        return;
      } catch (err) {
        console.error("Failed to enable dynamic video:", err);
        return;
      }
    }

    const nextCamEnabled = !track.enabled;
    track.enabled = nextCamEnabled;
    setIsCameraOff(!nextCamEnabled);
    if (nextCamEnabled) setHasEverEnabledVideo(true);

    if (sockRef.current?.connected) {
      sockRef.current.emit("call:mediaStatus", {
        callId: peerId,
        isMuted,
        isCameraOff: !nextCamEnabled
      });
    }
  };

  const isEnded = ["ended", "rejected", "timeout"].includes(status);
  const isActive = status === "active";
  const isWaiting = ["ringing", "connecting"].includes(status);

  // ── Call ended screen ─────────────────────────────────────────────────────
  if (isEnded) {
    const label =
      status === "rejected" ? "Call declined" :
        status === "timeout" ? "No answer" : "Call ended";
    return (
      <div className="h-screen bg-[#0B141A] flex flex-col items-center justify-center gap-6 text-white select-none">
        <img src={peerPic} alt={peerName}
          onError={(e) => { e.target.src = "/avatar.png"; }}
          className="size-28 rounded-full object-cover border-4 border-white/10 shadow-2xl" />
        <div className="text-center space-y-1">
          <p className="text-2xl font-semibold">{peerName}</p>
          <p className="text-sm text-[#8696A0]">{label}</p>
          {errorMsg && <p className="text-xs text-red-400 mt-1">{errorMsg}</p>}
        </div>
        <div className="flex items-end gap-8 mt-6">
          <button onClick={() => { getBc()?.postMessage({ type: "NAVIGATE_CHAT" }); window.close(); }}
            className="flex flex-col items-center gap-1.5 group">
            <div className="size-14 rounded-full bg-white/10 group-hover:bg-white/20 flex items-center justify-center transition-colors">
              <MessageSquare className="size-5" />
            </div>
            <span className="text-xs text-[#8696A0]">Message</span>
          </button>

          <button onClick={() => {
            getBc()?.postMessage({ type: "CALL_AGAIN", peerId, callType });
            window.close();
          }}
            className="flex flex-col items-center gap-1.5 group">
            <div className="size-14 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-colors shadow-lg">
              {callType === "video" ? <Video className="size-5" /> : <Mic className="size-5" />}
            </div>
            <span className="text-[11px] text-[#8696A0]">Call again</span>
          </button>

          <button onClick={() => window.close()}
            className="flex flex-col items-center gap-1.5 group">
            <div className="size-14 rounded-full bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center transition-colors">
              <span className="text-lg text-red-400 font-light">✕</span>
            </div>
            <span className="text-xs text-[#8696A0]">Close</span>
          </button>
        </div>
      </div>
    );
  }

  // ── Active call UI ────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-[#0B141A] flex flex-col overflow-hidden text-white select-none z-[99999] wa-call-window font-sans">
      {/* Top bar */}
      <header className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-4 bg-gradient-to-b from-black/60 to-transparent pointer-events-none transition-opacity">
        <div className="space-y-0.5 z-50">
          <p className="text-base font-semibold leading-none drop-shadow-md">{peerName}</p>
          <div className="flex items-center gap-1 text-[11px] text-[#8696A0] drop-shadow-md">
            <Shield className="size-3" /> End-to-end encrypted
          </div>
        </div>

        {/* Network quality indicator */}
        <div className="flex items-center gap-3 z-50 pointer-events-auto">
          {netStatus === "poor" && (
            <div className="flex items-center gap-1 text-[10px] text-yellow-400 bg-black/40 px-2 py-1 rounded-full">
              <WifiOff className="size-3" /> Poor connection
            </div>
          )}
          {netStatus === "reconnecting" && (
            <div className="flex items-center gap-1 text-[10px] text-orange-400 bg-black/40 px-2 py-1 rounded-full animate-pulse">
              <Wifi className="size-3" /> Reconnecting…
            </div>
          )}
          {isActive && (
            <span className="text-sm font-mono text-white/90 tabular-nums drop-shadow-md bg-black/20 px-3 py-1 rounded-full backdrop-blur-sm">
              {fmtTime(duration)}
            </span>
          )}
        </div>
      </header>

      {/* Main area */}
      <div className="relative w-full h-full flex-1 bg-[#0B141A]">
        {/* REMOTE VIDEO ACTS AS MAIN OR PIP */}
        <div 
          onClick={isSwapped ? () => setIsSwapped(false) : undefined}
          className={!isSwapped ? "video-main group relative" : "video-pip group relative"}
        >
          <video 
            ref={remoteVidRef} 
            autoPlay 
            playsInline
            className={`w-full h-full transition-opacity duration-300 pointer-events-none ${!peerCameraOff ? "opacity-100" : "opacity-0"}`} 
            style={{
              objectFit: remoteFit,
              aspectRatio: remoteDevice === "mobile" ? "9/16" : "16/9"
            }}
          />
          
          {/* Peer camera-off state */}
          {isActive && peerCameraOff && (
            <div className={`absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0B141A]/90 gap-3 
                            ${!isSwapped ? 'text-base' : 'text-xs'}`}>
              <img src={peerPic} alt={peerName}
                onError={(e) => { e.target.src = "/avatar.png"; }}
                className={`${!isSwapped ? 'size-24' : 'size-12'} rounded-full object-cover border-[3px] border-[#1F2C34]`} />
              {!isSwapped && peerHasEverEnabledVideo && (
                 <p className="text-sm text-[#8696A0]">{peerName}&apos;s camera is off</p>
              )}
            </div>
          )}

          {/* Status indicators for peer */}
          {isActive && (
             <div className={!isSwapped ? "status-icon-main" : "status-icon-pip"}>
                {peerMuted && <MicOff className={!isSwapped ? "size-5 text-red-400" : "size-4 text-red-400"} />}
                {peerHasEverEnabledVideo && peerCameraOff && <VideoOff className={!isSwapped ? "size-5 text-red-400" : "size-4 text-red-400"} />}
             </div>
          )}

          {/* OVERLAY FOR REMOTE INTERACTIONS */}
          <div className="overlay-layer">
            <div className={`hand-icon ${handState.remoteRaised ? 'active' : ''}`}>✋</div>
            {emojis.filter(e => e.isRemote).map(e => (
              <div key={e.id} className="emoji-float" style={{ '--x-offset': e.xOffset }}>{e.emoji}</div>
            ))}
          </div>

          {/* 3-dot menu for remote video */}
          {true && (
            <div className="absolute top-3 left-3 z-[999] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
               <button onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === 'remote' ? null : 'remote'); }}
                       className="p-1.5 bg-black/40 hover:bg-black/60 rounded backdrop-blur-md transition-colors text-white shadow-lg">
                  <MoreVertical className="size-5" />
               </button>
               {menuOpen === 'remote' && (
                 <div className="absolute top-full left-0 mt-2 py-1 w-36 bg-[#2A3942] border border-white/10 rounded-lg shadow-2xl overflow-hidden backdrop-blur-xl">
                    <button onClick={(e) => { e.stopPropagation(); setRemoteFit('contain'); setMenuOpen(null); }} className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 flex items-center justify-between">
                       Fit {remoteFit === 'contain' && <span className="text-[#00A884]">✓</span>}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setRemoteFit('cover'); setMenuOpen(null); }} className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 flex items-center justify-between">
                       Fill {remoteFit === 'cover' && <span className="text-[#00A884]">✓</span>}
                    </button>
                 </div>
               )}
            </div>
          )}
        </div>

        {/* LOCAL VIDEO ACTS AS MAIN OR PIP */}
        {true && (
          <div 
            onClick={!isSwapped ? () => setIsSwapped(true) : undefined}
            className={isSwapped ? "video-main group relative" : "video-pip group relative"}
          >
            <video
              ref={localVidRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full transition-opacity duration-300 pointer-events-none transform -scale-x-100 ${!isCameraOff ? "opacity-100" : "opacity-0"}`}
              style={{
                objectFit: localFit,
                aspectRatio: localDevice === "mobile" ? "9/16" : "16/9"
              }}
            />
            
            {/* Local camera-off state */}
            {hasEverEnabledVideo && isCameraOff && (
               <div className="absolute inset-0 flex items-center justify-center bg-[#2A3942]">
                 <VideoOff className={`${isSwapped ? 'size-12' : 'size-6'} text-[#8696A0]`} />
               </div>
            )}
            
            <div className={isSwapped ? "status-icon-main" : "status-icon-pip"}>
               {isMuted && <MicOff className={isSwapped ? "size-5 text-red-400" : "size-4 text-red-400"} />}
               {hasEverEnabledVideo && isCameraOff && <VideoOff className={isSwapped ? "size-5 text-red-400" : "size-4 text-red-400"} />}
            </div>

            {/* OVERLAY FOR LOCAL INTERACTIONS */}
            <div className="overlay-layer">
              <div className={`hand-icon ${handState.localRaised ? 'active' : ''}`}>✋</div>
              {emojis.filter(e => !e.isRemote).map(e => (
                <div key={e.id} className="emoji-float" style={{ '--x-offset': e.xOffset }}>{e.emoji}</div>
              ))}
            </div>

            {/* 3-dot menu for local video */}
            <div className="absolute top-3 left-3 z-[999] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
               <button onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === 'local' ? null : 'local'); }}
                       className="p-1.5 bg-black/40 hover:bg-black/60 rounded backdrop-blur-md transition-colors text-white shadow-lg">
                  <MoreVertical className="size-5" />
               </button>
               {menuOpen === 'local' && (
                 <div className="absolute top-full left-0 mt-2 py-1 w-36 bg-[#2A3942] border border-white/10 rounded-lg shadow-2xl overflow-hidden backdrop-blur-xl">
                    <button onClick={(e) => { e.stopPropagation(); setLocalFit('contain'); setMenuOpen(null); }} className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 flex items-center justify-between">
                       Fit {localFit === 'contain' && <span className="text-[#00A884]">✓</span>}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setLocalFit('cover'); setMenuOpen(null); }} className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 flex items-center justify-between">
                       Fill {localFit === 'cover' && <span className="text-[#00A884]">✓</span>}
                    </button>
                 </div>
               )}
            </div>
          </div>
        )}

        {/* Overlay (connecting state or audio-only calls) */}
        {status !== "active" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 z-40 bg-[#0B141A]">
            <img src={peerPic} alt={peerName}
              onError={(e) => { e.target.src = "/avatar.png"; }}
              className="relative z-10 size-32 rounded-full object-cover border-4 border-white/10 shadow-2xl" />
            <div className="relative z-10 text-center">
              <p className="text-2xl font-semibold mb-1">{peerName}</p>
              <p className="text-[#8696A0] text-sm animate-pulse">
                {status === "calling" ? "Calling…" :
                  status === "ringing" ? "Ringing…" :
                    status === "connecting" ? "Connecting…" : ""}
              </p>
            </div>
          </div>
        )}



        <audio ref={remoteAudRef} autoPlay playsInline style={{ display: "none" }} />
      </div>

      {/* Bottom controls */}
      <footer className="absolute bottom-6 left-0 right-0 z-50 px-4 sm:px-12 flex justify-center w-full pointer-events-none">
        {/* Container for Desktop vs Mobile layout */}
        <div className="flex flex-col flex-wrap sm:flex-row items-center justify-between w-full max-w-5xl pointer-events-auto gap-4 sm:gap-0">
          
          {/* LEFT (Mic + Camera) */}
          <div className="flex items-center gap-3">
            <button onClick={toggleMic} className={`wa-control-btn ${isMuted ? 'off' : ''}`}>
               {isMuted ? <MicOff className="size-5.5" /> : <Mic className="size-5.5" />}
            </button>
            <button onClick={toggleCamera} className={`wa-control-btn ${isCameraOff ? 'off' : ''}`}>
               {isCameraOff ? <VideoOff className="size-5.5" /> : <Video className="size-5.5" />}
            </button>
          </div>

          {/* CENTER (Features) */}
          <div className="relative flex items-center justify-center">
            {/* Emoji Picker Popup */}
            <div className={`emoji-picker-panel ${showEmojiPicker ? 'active' : ''}`}>
              {['👍', '❤️', '😂', '😮', '😢', '👏', '🔥'].map(emoji => (
                <div key={emoji} className="emoji-btn" onClick={() => handleEmojiSelect(emoji)}>
                  {emoji}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-1 sm:gap-2 bg-[#1F2C34]/90 backdrop-blur-xl px-2 sm:px-4 py-2 rounded-full border border-white/5 shadow-2xl">
              <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="wa-center-btn relative group">
                <Smile className="size-5.5 text-white/80 group-hover:text-white" />
              </button>
              <button onClick={toggleHandRaise} className={`wa-center-btn ${handState.localRaised ? 'bg-white/20 text-white' : 'text-white/80 hover:text-white'}`}>
                <Hand className={`size-5.5 ${handState.localRaised ? 'text-[#00A884]' : ''}`} />
              </button>
              <button className="wa-center-btn group">
              <MonitorPlay className="size-5.5 text-white/80 group-hover:text-white" />
            </button>
            <button className="wa-center-btn group">
              <UserPlus className="size-5.5 text-white/80 group-hover:text-white" />
            </button>
            <button onClick={() => { getBc()?.postMessage({ type: "NAVIGATE_CHAT" }); }} className="wa-center-btn text-white/80 hover:text-white group">
              <MessageSquare className="size-5.5" />
            </button>
          </div>
          </div>

          {/* RIGHT (End call) */}
          <div className="flex items-center justify-end max-sm:justify-center">
            <button onClick={() => cleanup(true)} className="wa-end-btn">
              <PhoneOff className="size-7" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default CallPage;
