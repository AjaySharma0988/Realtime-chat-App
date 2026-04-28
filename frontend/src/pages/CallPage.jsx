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
import { useChatStore } from "../store/useChatStore";
import { io } from "socket.io-client";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Shield, MessageSquare, Wifi, WifiOff,
  MoreVertical, Hand, Smile, UserPlus, MonitorPlay, File, ListPlus, Play, Plus, Settings
} from "lucide-react";

import "./callWindow.css";
import DefaultCallControls from "../components/call/DefaultCallControls";
import WatchPartyControls from "../components/call/WatchPartyControls";
import WatchPartyContainer from "../components/call/WatchPartyContainer";
import { THEMES } from "../constants";
import { useThemeStore } from "../store/useThemeStore";
import { ICE_SERVERS } from "../constants/webrtc";

const BASE_URL = import.meta.env.MODE === "development" ? "http://localhost:5001" : "/";

// ── ICE / STUN / TURN configuration moved to constants/webrtc.js ─────────────

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
  const [remoteCameraStream, setRemoteCameraStream] = useState(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);

  // UI-only states
  const [hasEverEnabledVideo, setHasEverEnabledVideo] = useState(callType === "video");
  const [peerHasEverEnabledVideo, setPeerHasEverEnabledVideo] = useState(callType === "video");
  const [isSwapped, setIsSwapped] = useState(false);
  const [localFit, setLocalFit] = useState("contain");
  const [remoteFit, setRemoteFit] = useState("contain");
  const [menuOpen, setMenuOpen] = useState(null);
  const { callTheme, setCallTheme } = useThemeStore();

  // Real-time UI states
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  const [localDevice] = useState(isMobile ? "mobile" : "desktop");
  const [remoteDevice, setRemoteDevice] = useState("desktop");

  // Real-time UI states
  const [handState, setHandState] = useState({ localRaised: false, remoteRaised: false });
  const [emojis, setEmojis] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const isConnectingUI = status === "calling" || status === "ringing" || status === "connecting";

  // 📐 Smart PiP Dimensions (Responsive & State-based)
  const getPipDimensions = () => {
    const w = window.innerWidth;
    let baseWidthRatio = 0.25; // Default (768-1200px)
    if (w < 768) baseWidthRatio = 0.35;
    else if (w > 1200) baseWidthRatio = 0.22;

    const stateMultiplier = (status === "active") ? 1.0 : 0.82; // Larger during active call
    const width = Math.min(w * baseWidthRatio * stateMultiplier, w * 0.4);
    const height = width * (9 / 16);
    return { width, height };
  };

  const { width: pipW, height: pipH } = getPipDimensions();

  // Draggable PiP state
  const [pipPos, setPipPos] = useState({ x: window.innerWidth - pipW - 20, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0 });

  // Handle Snap & Constraints
  const getConstrainedPos = (x, y, w, h) => {
    const maxX = window.innerWidth - w - 20;
    const minX = 20;
    const minY = 80; // Below header
    const maxY = window.innerHeight - 140 - h; // Above controls (approx 140px)

    return {
      x: Math.max(minX, Math.min(x, maxX)),
      y: Math.max(minY, Math.min(y, maxY))
    };
  };

  // Reset/Responsive Position
  useEffect(() => {
    const { width: currentW } = getPipDimensions();
    if (status === "active") {
      setPipPos({ x: window.innerWidth - currentW - 20, y: 80 });
    }
  }, [status]);

  useEffect(() => {
    const handleResize = () => {
      const { width: newW, height: newH } = getPipDimensions();
      setPipPos(prev => {
        const isOnRight = prev.x > window.innerWidth / 2 - newW / 2;
        const snapX = isOnRight ? window.innerWidth - newW - 20 : 20;
        return getConstrainedPos(snapX, prev.y, newW, newH);
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [status]);

  const handleMouseDown = (e) => {
    if (isConnectingUI) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragOffset.current = { x: e.clientX, y: e.clientY };
    e.stopPropagation();
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragOffset.current.x;
      const dy = e.clientY - dragOffset.current.y;

      setPipPos(prev => {
        const nextX = prev.x + dx;
        const nextY = prev.y + dy;
        // Apply loose constraints while dragging
        return { x: nextX, y: nextY };
      });

      dragOffset.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = (e) => {
      if (isDragging) {
        const dist = Math.sqrt(Math.pow(e.clientX - dragStart.current.x, 2) + Math.pow(e.clientY - dragStart.current.y, 2));
        if (dist < 5) {
          setIsSwapped(prev => !prev);
        } else {
          // Snap logic on release
          const { width: currentW, height: currentH } = getPipDimensions();
          const isLeft = e.clientX < window.innerWidth / 2;
          const snapX = isLeft ? 20 : window.innerWidth - currentW - 20;
          setPipPos(prev => getConstrainedPos(snapX, prev.y, currentW, currentH));
        }
        setIsDragging(false);
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, status]);

  // 🧩 PART 1: CREATE SEPARATE STATE

  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRemoteScreenSharing, setIsRemoteScreenSharing] = useState(false);

  // Close emoji panel when clicking outside it
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest(".emoji-panel") && !e.target.closest(".emoji-btn")) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Group Mesh State ───────────────────────────
  const groupPcsRef = useRef({});
  const [groupParticipants, setGroupParticipants] = useState([]);
  const [isWatchParty, setIsWatchParty] = useState(false);
  const [activeFeature, setActiveFeature] = useState("home");
  const [toast, setToast] = useState({ show: false, message: "" });
  const [playlist, setPlaylist] = useState([
  ]);

  const showToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: "" }), 3000);
  };
  const [wpUrl, setWpUrl] = useState("");
  const [videoSrc, setVideoSrc] = useState(null);
  const [mediaType, setMediaType] = useState("video");
  const [showAddPeople, setShowAddPeople] = useState(false);
  const [selectedGroupUsers, setSelectedGroupUsers] = useState([]);
  const chatUsers = useChatStore(state => state.users);
  const initUsers = useChatStore(state => state.getUsers);

  useEffect(() => {
    if (showAddPeople && chatUsers.length === 0) initUsers();
  }, [showAddPeople, chatUsers.length, initUsers]);

  useEffect(() => {
    console.log("WatchParty State:", isWatchParty);
  }, [isWatchParty]);

  // ── 🧠 CORE MEDIA STATE HELPERS (Safe Design) ──
  const loadMedia = useCallback((item) => {
    sockRef.current?.emit("media:load", {
      source: item.url,
      type: item.type,
      timestamp: 0,
      sender: userId,
      autoPlay: true
    });

    setVideoSrc(item.url);
    setMediaType(item.type);
    setActiveFeature("player");
    setIsPlaying(true);
  }, [userId]);

  const emitMediaAction = useCallback((data) => {
    if (isRemoteActionRef.current) return;
    sockRef.current?.emit("media:sync", {
      action: data.action,
      time: data.time || 0,
      sender: userId
    });
  }, [userId]);

  const emitMediaSync = useCallback(() => {
    // 🧩 TASK 8 — SYNC BUTTON EMIT
    sockRef.current?.emit("media:sync", {
      action: "SYNC_REQUEST",
      sender: userId
    });
  }, [userId]);

  const localVidRef = useRef(null);
  const remoteVidRef = useRef(null);
  const remoteAudRef = useRef(null);
  const pcRef = useRef(null);
  const screenPCRef = useRef(null);
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
    // NOTE: panel stays open intentionally — user can send multiple reactions
    triggerEmojiAnimation(false, emoji);
    if (sockRef.current?.connected) {
      sockRef.current.emit("call:emoji", { callId: peerId, userId, emoji });
    }
  };

  // ── ICE drain ────────────────────────────────────────────────────────────
  // Called immediately after setRemoteDescription() on BOTH sides.
  // CRITICAL: set remoteReady = true FIRST so the live ice-candidate handler
  // knows it can add directly. Then drain the buffer.
  const drainIce = useCallback(async () => {
    if (!pcRef.current || !pcRef.current.remoteDescription) return;

    // Mark remote ready BEFORE draining so concurrent ice-candidate events
    // that arrive during the async drain loop are added directly, not re-queued.
    remoteReady.current = true;

    // Atomically grab and clear the current queue
    const candidates = [...icePending.current];
    icePending.current = [];

    if (candidates.length > 0) {
      console.log(`[ICE] Draining ${candidates.length} buffered candidates`);
      for (const c of candidates) {
        try {
          if (c && pcRef.current?.remoteDescription) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(c));
          }
        } catch (e) {
          // Ignore benign "candidate cannot be added" errors — these happen
          // when the candidate is for an m-line that doesn't exist locally.
          if (!e.message?.includes("The ICE candidate could not be added")) {
            console.warn("[ICE] Drain error:", e.message);
          }
        }
      }
    }
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  const cleanup = useCallback((notifyPeer = true) => {
    if (cleanedUp.current) return;
    cleanedUp.current = true;
    _socketSetup = false;

    clearInterval(timerRef.current);
    clearInterval(heartbeatRef.current);
    localStream.current?.getTracks().forEach((t) => t.stop());

    Object.values(groupPcsRef.current).forEach(pc => {
      try { pc.close(); } catch { }
    });
    groupPcsRef.current = {};
    setGroupParticipants([]);


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

  // ── Helper: Wait for ICE gathering ─────────────────────────────────────────
  const waitForIce = (pc) => new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve();
    const check = () => { if (pc.iceGatheringState === "complete") { pc.removeEventListener("icegatheringstatechange", check); resolve(); } };
    pc.addEventListener("icegatheringstatechange", check);
    setTimeout(resolve, 2000); // Max 2s wait for initial candidates
  });

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
      if (candidate) {
        console.log("[WebRTC] ICE sent");
        sock.emit("ice-candidate", { to: peerId, candidate });
      } else {
        console.log("[WebRTC] ICE gathering complete for this PC");
      }
    };

    // ── Track handler — critical for video/audio flow ─────────────────────
    // BUG FIX: Do NOT use "prev || stream" guard — audio tracks arrive before
    // video tracks. The guard would silently drop the video track (black screen).
    // Instead, always update the stream reference to pick up all tracks.
    pc.ontrack = (event) => {
      const stream = event.streams?.[0] ?? new MediaStream([event.track]);
      const track = event.track;
      const label = track.label?.toLowerCase() ?? "";

      const isScreen =
        label.includes("screen") ||
        label.includes("display") ||
        track.contentHint === "detail";

      console.log(`[Track] Received: kind=${track.kind} label="${label}" isScreen=${isScreen}`);

      if (isScreen) {
        console.log("📺 Screen stream received");
        setRemoteScreenStream(stream);
        setIsRemoteScreenSharing(true);
        track.onended = () => {
          setRemoteScreenStream(null);
          setIsRemoteScreenSharing(false);
        };
      } else {
        console.log(`📹 Camera ${track.kind} track received`);

        // Always update the camera stream so all tracks (audio + video) are captured.
        // Using a functional update ensures the latest stream with all tracks is used.
        setRemoteCameraStream(stream);

        if (track.kind === "video") {
          const hasVideo = stream.getVideoTracks().some((t) => t.enabled && t.readyState === "live");
          setPeerCameraOff(!hasVideo);
          if (hasVideo) setPeerHasEverEnabledVideo(true);
        }

        // Monitor for unexpected track ending
        track.onended = () => {
          console.warn("[Track] Remote track ended:", track.kind);
        };
      }
    };

    // ── ICE state machine ──────────────────────────────────────────────────
    // "disconnected" → transient (5s grace period then restart)
    // "failed"       → restart immediately (up to MAX_ICE_RESTARTS)
    // "connected"    → reset restart counter, mark active
    let disconnectTimer = null;

    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      console.log("ICE STATE:", s);

      if (s === "connected" || s === "completed") {
        clearTimeout(disconnectTimer);
        iceRestartCountRef.current = 0;
        setNetStatus("good");
        
        // ✅ FORCE UI TRANSITION
        setStatus("active");
        console.log("CALL STATUS: active (ICE)");

        setWasConnected(true);
        clearInterval(timerRef.current);
        timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);

        // ── Boost audio quality once connected ─────────────────────────────────
        try {
          const audioSender = pc.getSenders().find((s) => s.track?.kind === "audio");
          if (audioSender) {
            const params = audioSender.getParameters();
            if (!params.encodings || params.encodings.length === 0) {
              params.encodings = [{}];
            }
            params.encodings[0].maxBitrate = 128_000;
            params.encodings[0].priority = "high";
            params.encodings[0].networkPriority = "high";
            audioSender.setParameters(params).catch(() => { });
          }
        } catch { }
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
      console.log("STATE:", s);
      if (s === "failed") attemptIceRestart();
      if (s === "connected") {
        // ✅ FORCE UI TRANSITION
        setStatus("active");
        console.log("CALL STATUS: active (STATE)");
        setWasConnected(true);
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log("[WebRTC] ICE gathering state:", pc.iceGatheringState);
      if (pc.iceGatheringState === "complete") {
        console.log("[WebRTC] ICE gathering complete. All candidates collected.");
      }
    };

    return pc;
  }, [peerId, attemptIceRestart]);

  // ── Build Group RTCPeerConnection ──────────────────────────────────────────
  const buildGroupPC = useCallback((targetId, sock) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) sock.emit("call:group:ice", { to: targetId, from: userId, candidate });
    };
    pc.ontrack = (e) => {
      const rs = e.streams?.[0] ?? new MediaStream([e.track]);
      const hasVideo = rs.getVideoTracks().some((t) => t.enabled && t.readyState === "live");

      const targetUser = chatUsers.find(u => u._id === targetId) || { fullName: "Unknown Participant" };

      setGroupParticipants(prev => {
        const existing = prev.find(p => p.id === targetId);
        if (existing) {
          return prev.map(p => p.id === targetId ? { ...p, stream: rs, cameraOff: !hasVideo } : p);
        }
        return [...prev, { id: targetId, name: targetUser.fullName, stream: rs, cameraOff: !hasVideo, muted: false }];
      });
    };
    if (localStream.current) {
      localStream.current.getTracks().forEach(t => pc.addTrack(t, localStream.current));
    }
    return pc;
  }, [userId, chatUsers]);

  // ── Get user media ────────────────────────────────────────────────────────
  const getMedia = async () => {
    let stream = null;
    let reqAudio = true;
    let reqVideo = callType === "video" ? {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      aspectRatio: 16 / 9,
      facingMode: "user"
    } : false;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: reqAudio,
        video: reqVideo,
      });
    } catch (err) {
      console.warn("[Media] Initial getUserMedia failed:", err.name, err.message);

      // Fallback 1: Try audio only if it was a video call
      if (reqVideo && !stream) {
        try {
          console.log("[Media] Falling back to audio only");
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          setIsCameraOff(true);
        } catch (err2) {
          console.warn("[Media] Audio-only fallback failed:", err2.name);
        }
      }

      // Fallback 2: Try video only if audio failed
      if (reqVideo && !stream) {
        try {
          console.log("[Media] Falling back to video only");
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: reqVideo
          });
          setIsMuted(true);
        } catch (err3) {
          console.warn("[Media] Video-only fallback failed:", err3.name);
        }
      }

      // Fallback 3: Create empty stream if all else fails
      if (!stream) {
        console.warn("[Media] All fallbacks failed. Proceeding with empty stream.");
        stream = new MediaStream();
        setIsMuted(true);
        setIsCameraOff(true);
      }
    }

    localStream.current = stream;
    if (localVidRef.current && localVidRef.current.srcObject !== stream) {
      localVidRef.current.srcObject = stream;
    }

    // Monitor local tracks
    stream.getTracks().forEach((track) => {
      track.onended = () => console.warn("[Track] Local track ended:", track.kind);
    });
    return stream;
  };

  // ── Caller flow ───────────────────────────────────────────────────────────
  const startCallerFlow = useCallback(async (sock) => {
    const stream = await getMedia();
    if (!stream || cleanedUp.current) return;

    const pc = buildPC(sock);
    pcRef.current = pc;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    // Ensure we can receive media even if we don't send any
    if (stream.getAudioTracks().length === 0) {
      pc.addTransceiver("audio", { direction: "recvonly" });
    }
    if (callType === "video" && stream.getVideoTracks().length === 0) {
      pc.addTransceiver("video", { direction: "recvonly" });
    }

    try {
      console.log("[WebRTC] Caller creating offer");
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      console.log("[WebRTC] Offer sent");
      sock.emit("call-user", {
        to: peerId,
        offer: pc.localDescription, // Use description AFTER gathering
        callType,
        callerInfo: { _id: userId, fullName: peerName, profilePic: peerPic }
      });
    } catch (err) {
      console.error("[WebRTC] Caller offer error:", err);
      setErrorMsg("Failed to create call offer: " + err.message);
      cleanup(false);
    }
  }, [peerId, callType, userId, buildPC, cleanup, peerName, peerPic]);

  // ── Receiver flow ─────────────────────────────────────────────────────────
  const startReceiverFlow = useCallback(async (sock, offer, earlyIce = []) => {
    const stream = await getMedia();
    if (!stream || cleanedUp.current) return;

    if (earlyIce && earlyIce.length) {
      icePending.current.push(...earlyIce);
    }

    const pc = buildPC(sock);
    pcRef.current = pc;
    
    // Add tracks or transceivers to ensure media flow
    if (stream.getTracks().length > 0) {
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    }
    
    // Receiver transceivers to ensure we can receive even if we don't send
    if (!stream.getAudioTracks().length) pc.addTransceiver("audio", { direction: "recvonly" });
    if (callType === "video" && !stream.getVideoTracks().length) pc.addTransceiver("video", { direction: "recvonly" });

    try {
      console.log("[WebRTC] Receiver setting remote description (Offer)");
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      console.log("[WebRTC] Offer received & set");
      await drainIce();
      
      console.log("[WebRTC] Receiver creating answer");
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      console.log("[WebRTC] Answer sent");
      sock.emit("call-accepted", { to: peerId, answer: pc.localDescription });
      setStatus("connecting");
    } catch (err) {
      console.error("[WebRTC] Receiver flow error:", err);
      setErrorMsg("Failed to accept call: " + err.message);
      cleanup(false);
    }
  }, [peerId, buildPC, drainIce, cleanup, callType]);

  const flowStarted = useRef(false);

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

      if (!flowStarted.current) {
        flowStarted.current = true;
        if (isCaller) {
          // Tell main window to cancel its 30-second no-answer timer immediately.
          // The popup has taken over signaling — main window must NOT kill us.
          getBc()?.postMessage({ type: "POPUP_TOOK_OVER" });
          startCallerFlow(sock);
        } else {
          getBc()?.postMessage({ type: "POPUP_READY" });
        }
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
      console.log("[WebRTC] Answer received");
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        console.log("[WebRTC] Answer received & set");
        await drainIce();

        // DO NOT force status = "active" here.
        // ICE negotiation has NOT completed yet — the P2P path is not established.
        // The ICE state machine (oniceconnectionstatechange) will set "active"
        // when state reaches "connected" or "completed".
        // Forcing active here = caller UI says connected but receiver is still "checking".
        console.log("[WebRTC] Waiting for ICE to complete...");

        // Tell main window the call was accepted — clears outgoingCall spinner
        getBc()?.postMessage({ type: "CALL_ACCEPTED" });

      } catch (e) { console.error("[WebRTC] Answer handling error:", e); }
    });

    // ICE from peer
    sock.on("ice-candidate", async ({ candidate }) => {
      if (!candidate || cleanedUp.current) return;
      console.log("[WebRTC] ICE received");

      if (remoteReady.current && pcRef.current?.remoteDescription) {
        // Remote description is set — add candidate immediately
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          console.log("[WebRTC] ICE candidate added");
        } catch (e) {
          if (!e.message?.includes("The ICE candidate could not be added")) {
            console.warn("[WebRTC] addIceCandidate error:", e.message);
          }
        }
      } else {
        // Remote description not set yet — queue for drainIce()
        console.log("[WebRTC] ICE candidate queued (remote desc not ready)");
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


    sock.on("call:watchPartyToggle", ({ enabled }) => {
      setIsWatchParty(enabled);
    });

    sock.on("wp:start", ({ url }) => {
      console.log("[CallPage] WP Start received:", url);
      setIsWatchParty(true);
      setActiveFeature("player");
      setVideoSrc(url);
      setMediaType("video");
    });

    sock.on("wp:stop", () => {
      console.log("[CallPage] WP Stop received");
      setActiveFeature("home");
    });

    sock.on("call:mediaStatus", ({ isMuted: remoteMuted, isCameraOff: remoteCameraOff }) => {
      setPeerMuted(remoteMuted);
      setPeerCameraOff(remoteCameraOff);
      if (!remoteCameraOff) setPeerHasEverEnabledVideo(true);
    });

    // 🧩 SIGNAL EVENTS
    sock.on("screen:start", () => {
      console.log("REMOTE SCREEN START SIGNAL RECEIVED");
      setIsRemoteScreenSharing(true);
    });

    sock.on("screen:stop", () => {
      console.log("REMOTE SCREEN STOP SIGNAL RECEIVED");
      setIsRemoteScreenSharing(false);
      setRemoteScreenStream(null);
      if (screenPCRef.current) {
        screenPCRef.current.close();
        screenPCRef.current = null;
      }
    });

    // 🧩 PART 3: RECEIVE OFFER (REMOTE USER)
    sock.on("screen:offer", async ({ offer }) => {
      console.log("📺 SCREEN OFFER RECEIVED");
      const screenPC = new RTCPeerConnection(ICE_SERVERS);
      screenPCRef.current = screenPC;

      screenPC.ontrack = (event) => {
        console.log("📺 SCREEN TRACK RECEIVED");
        const stream = event.streams[0] || new MediaStream([event.track]);
        setRemoteScreenStream(stream);
        setIsRemoteScreenSharing(true);
      };

      screenPC.onicecandidate = (e) => {
        if (e.candidate) {
          sock.emit("screen:ice", { to: peerId, candidate: e.candidate });
        }
      };

      await screenPC.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await screenPC.createAnswer();
      await screenPC.setLocalDescription(answer);

      sock.emit("screen:answer", { to: peerId, answer });
    });

    // 🧩 PART 4: HANDLE ANSWER (SENDER)
    sock.on("screen:answer", async ({ answer }) => {
      console.log("📺 SCREEN ANSWER RECEIVED");
      if (screenPCRef.current) {
        await screenPCRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    // 🧩 PART 5: HANDLE ICE (BOTH SIDES)
    sock.on("screen:ice", async ({ candidate }) => {
      try {
        if (screenPCRef.current) {
          await screenPCRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error("Screen ICE error:", err);
      }
    });

    // ── Group Mesh Network Exchange ─────────────────────────────────────────
    sock.on("call:group:offer", async ({ from, offer }) => {
      try {
        const pc = buildGroupPC(from, sock);
        groupPcsRef.current[from] = pc;
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sock.emit("call:group:answer", { to: from, from: userId, answer });
      } catch (err) { console.error("Mesh offer error:", err); }
    });

    sock.on("call:group:answer", async ({ from, answer }) => {
      try {
        const pc = groupPcsRef.current[from];
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (err) { console.error("Mesh answer error:", err); }
    });

    sock.on("call:group:ice", async ({ from, candidate }) => {
      try {
        const pc = groupPcsRef.current[from];
        if (pc && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) { console.warn("Mesh ICE error:", err); }
    });

    sock.on("call:incomingGroup", async ({ callId, from }) => {
      console.log("Receiving call from group member:", from);
      if (groupPcsRef.current[from]) return; // already connected
      try {
        const pc = buildGroupPC(from, sock);
        groupPcsRef.current[from] = pc;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sock.emit("call:group:offer", { to: from, from: userId, offer });
      } catch (err) { console.error("Group inbound init error:", err); }
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

  const toggleMic = async () => {
    if (!localStream.current) return;
    const currentTrack = localStream.current.getAudioTracks()[0];
    const willMute = !isMuted;

    try {
      if (willMute) {
        // MUTING: Stop track to release hardware resource
        if (currentTrack) {
          currentTrack.enabled = false;
          currentTrack.stop();
        }
        setIsMuted(true);
      } else {
        // UNMUTING: Re-acquire hardware resource
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const newTrack = stream.getAudioTracks()[0];

        if (currentTrack) {
          localStream.current.removeTrack(currentTrack);
        }
        localStream.current.addTrack(newTrack);

        // Update PeerConnection if active
        if (pcRef.current) {
          const sender = pcRef.current.getSenders().find(s => s.track?.kind === "audio");
          if (sender) {
            await sender.replaceTrack(newTrack);
          }
        }
        setIsMuted(false);
      }

      // Sync state to peer
      if (sockRef.current?.connected) {
        sockRef.current.emit("call:mediaStatus", {
          callId: peerId,
          isMuted: willMute,
          isCameraOff
        });
      }
    } catch (err) {
      console.error("[Mic Resource] Toggle failed:", err);
    }
  };

  const toggleCamera = async () => {
    if (!localStream.current) return;
    const currentTrack = localStream.current.getVideoTracks()[0];
    const willCameraOff = !isCameraOff;

    try {
      if (willCameraOff) {
        // TURNING OFF: Stop hardware track to release camera resource (light off)
        if (currentTrack) {
          currentTrack.enabled = false;
          currentTrack.stop();
        }
        setIsCameraOff(true);

        if (sockRef.current?.connected) {
          sockRef.current.emit("call:mediaStatus", {
            callId: peerId,
            isMuted,
            isCameraOff: true
          });
        }
      } else {
        // TURNING ON: Re-acquire camera resource
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            aspectRatio: 16 / 9,
            facingMode: "user"
          }
        });
        const newTrack = videoStream.getVideoTracks()[0];

        if (currentTrack) {
          localStream.current.removeTrack(currentTrack);
        }
        localStream.current.addTrack(newTrack);

        // Update PeerConnection
        if (pcRef.current) {
          const sender = pcRef.current.getSenders().find(s => s.track?.kind === "video");
          if (sender) {
            // Smoothly swap track if sender exists
            await sender.replaceTrack(newTrack);
          } else {
            // First time adding video (Audio -> Video upgrade)
            pcRef.current.addTrack(newTrack, localStream.current);
            const offer = await pcRef.current.createOffer();
            await pcRef.current.setLocalDescription(offer);
            if (sockRef.current?.connected) {
              sockRef.current.emit("call:renegotiate", { callId: peerId, offer });
            }
          }
        }

        // Update local preview
        if (localVidRef.current) {
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
      }
    } catch (err) {
      console.error("[Camera Resource] Toggle failed:", err);
    }
  };

  // 🧩 PART 2: START SCREEN SHARE (LOCAL)
  async function startScreenShare() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      setScreenStream(stream);
      setIsScreenSharing(true);

      const screenPC = new RTCPeerConnection(ICE_SERVERS);
      screenPCRef.current = screenPC;

      // add tracks
      stream.getTracks().forEach(track => {
        screenPC.addTrack(track, stream);
      });

      // ICE
      screenPC.onicecandidate = (e) => {
        if (e.candidate) {
          sockRef.current.emit("screen:ice", { to: peerId, candidate: e.candidate });
        }
      };

      // create offer
      const offer = await screenPC.createOffer();
      await screenPC.setLocalDescription(offer);

      sockRef.current.emit("screen:offer", { to: peerId, offer });

      stream.getVideoTracks()[0].onended = stopScreenShare;

      // Signal start to other side
      sockRef.current.emit("screen:start", { callId: peerId });
    } catch (err) {
      console.error("Screen share error:", err);
    }
  }

  // 🧩 PART 6: STOP SCREEN SHARE
  function stopScreenShare() {
    if (screenStream) {
      screenStream.getTracks().forEach(t => t.stop());
    }

    if (screenPCRef.current) {
      screenPCRef.current.close();
      screenPCRef.current = null;
    }

    setScreenStream(null);
    setIsScreenSharing(false);

    if (sockRef.current?.connected) {
      sockRef.current.emit("screen:stop", { callId: peerId });
    }
  }

  // 🧩 PART 2: FIX CAMERA BINDING
  useEffect(() => {
    if (remoteCameraStream) {
      if (remoteVidRef.current && remoteVidRef.current.srcObject !== remoteCameraStream) {
        remoteVidRef.current.srcObject = remoteCameraStream;
      }
      if (remoteAudRef.current && remoteAudRef.current.srcObject !== remoteCameraStream) {
        remoteAudRef.current.srcObject = remoteCameraStream;
      }
    }
  }, [remoteCameraStream]);

  const isEnded = ["ended", "rejected", "timeout"].includes(status);
  const isActive = status === "active";
  const isWaiting = ["ringing", "connecting"].includes(status);

  // ── Call ended screen ─────────────────────────────────────────────────────
  if (isEnded) {
    const label =
      status === "rejected" ? "Call declined" :
        status === "timeout" ? "No answer" : "Call ended";
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center text-white select-none relative overflow-hidden" style={{ background: "linear-gradient(135deg, var(--fallback-b1,oklch(var(--b1))) 0%, var(--fallback-b2,oklch(var(--b2))) 100%)" }} data-theme={callTheme}>

        {/* Subtle background glow behind avatar */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-[var(--fallback-p,oklch(var(--p)))]/10 rounded-full blur-[90px] pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center" style={{ animation: "fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}>
          <style>{`
            @keyframes fadeUp {
              0% { opacity: 0; transform: translateY(20px) scale(0.95); }
              100% { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>

          {/* Avatar with multiple concentric rings for premium feel */}
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-full border border-[var(--fallback-p,oklch(var(--p)))]/30 animate-pulse opacity-40" style={{ transform: "scale(1.15)" }} />
            <div className="absolute inset-0 rounded-full border border-[var(--fallback-p,oklch(var(--p)))]/20 animate-pulse opacity-30" style={{ transform: "scale(1.3)", animationDelay: "200ms" }} />

            <div className="p-2.5 rounded-full bg-[var(--fallback-b1,oklch(var(--b1)))]/80 backdrop-blur-md border border-white/5 shadow-[0_10px_40px_rgba(0,0,0,0.5)] relative z-10">
              <img src={peerPic} alt={peerName}
                onError={(e) => { e.target.src = "/avatar.png"; }}
                className="size-32 rounded-full object-cover border-2 border-white/10" />
            </div>
          </div>

          <div className="text-center space-y-3 mb-12">
            <h2 className="text-[28px] font-bold tracking-tight text-[var(--fallback-bc,oklch(var(--bc)))] drop-shadow-md">{peerName}</h2>
            <div className="inline-flex items-center justify-center bg-white/5 border border-white/10 backdrop-blur-md px-4 py-1.5 rounded-full shadow-sm">
              <span className="text-[13px] font-medium text-[oklch(var(--bc) / 0.6)] shimmer-text">{label}</span>
            </div>
            {errorMsg && (
              <div className="mt-4">
                <p className="text-xs text-[#EF4444] bg-[#EF4444]/10 px-3 py-1.5 rounded-full border border-[#EF4444]/20 inline-block">
                  {errorMsg}
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-8">
            <button onClick={() => { getBc()?.postMessage({ type: "NAVIGATE_CHAT" }); window.close(); }}
              className="flex flex-col items-center gap-2 group transition-all hover:-translate-y-1">
              <div className="size-14 rounded-full bg-[var(--fallback-b3,oklch(var(--b3)))]/90 group-hover:bg-[#38505D] flex items-center justify-center border border-white/5 backdrop-blur-md shadow-lg transition-colors">
                <MessageSquare className="size-[22px] text-[var(--fallback-bc,oklch(var(--bc)))]" />
              </div>
              <span className="text-[12px] font-medium text-[oklch(var(--bc) / 0.6)] group-hover:text-[var(--fallback-bc,oklch(var(--bc)))] transition-colors">Message</span>
            </button>

            <button onClick={() => {
              getBc()?.postMessage({ type: "CALL_AGAIN", peerId, callType });
              window.close();
            }}
              className="flex flex-col items-center gap-2 group transition-all hover:-translate-y-1 scale-110 mx-2">
              <div className="size-[60px] rounded-full bg-[var(--fallback-p,oklch(var(--p)))] group-hover:bg-[var(--fallback-pf,oklch(var(--pf)))] flex items-center justify-center shadow-[0_4px_24px_rgba(0,168,132,0.45)] transition-all">
                {callType === "video" ? <Video className="size-6 text-white" /> : <Mic className="size-6 text-white" />}
              </div>
              <span className="text-[12px] font-semibold text-[var(--fallback-bc,oklch(var(--bc)))]">Call again</span>
            </button>

            <button onClick={() => window.close()}
              className="flex flex-col items-center gap-2 group transition-all hover:-translate-y-1">
              <div className="size-14 rounded-full bg-[#EF4444]/15 group-hover:bg-[#EF4444]/25 flex items-center justify-center border border-[#EF4444]/20 backdrop-blur-md shadow-lg transition-colors">
                <span className="text-2xl text-[#EF4444] font-light leading-none mb-[2px]">✕</span>
              </div>
              <span className="text-[12px] font-medium text-[oklch(var(--bc) / 0.6)] group-hover:text-[#EF4444] transition-colors">Close</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Active call UI ────────────────────────────────────────────────────────
  return (
    <>

      <div className="fixed inset-0 bg-black flex overflow-hidden text-white select-none z-[99999] wa-call-window font-sans" data-theme={callTheme}>

        {/* ── CENTRAL SPLIT VIEW ── */}
        {/* MEDIA SYSTEM (LEFT) */}
        <div
          className={`transition-all duration-500 ease-in-out overflow-hidden flex flex-col bg-[var(--fallback-b1,oklch(var(--b1)))] z-10 ${isWatchParty ? "opacity-100 border-r-[1px] border-white/5" : "opacity-0 border-none"}`}
          style={{ width: isWatchParty ? "75%" : "0%", minWidth: isWatchParty ? "75%" : "0%" }}
        >
          {/* HEADER */}
          <div className="h-16 shrink-0 border-b border-[var(--fallback-b3,oklch(var(--b3)))]/50 shadow-sm pointer-events-auto relative">
            <MediaPanel
              activeFeature={activeFeature}
              setActiveFeature={setActiveFeature}
              showToast={showToast}
              playlist={playlist}
              setPlaylist={setPlaylist}
              socket={sockRef.current}
              callId={peerId}
              videoSrc={videoSrc}
              setVideoSrc={setVideoSrc}
              mediaType={mediaType}
              setMediaType={setMediaType}
            />
          </div>

          {/* PLAYER REGION OVERLAY */}
          <div className="flex-1 relative flex flex-col overflow-hidden bg-black">
            {isWatchParty && (
              <WatchPartyContainer
                socket={sockRef.current}
                callId={peerId}
                activeFeature={activeFeature}
                setActiveFeature={setActiveFeature}
                remoteVidRef={remoteVidRef}
                peerName={peerName}
                // PASSED MEDIA PROPS
                videoSrc={videoSrc}
                setVideoSrc={setVideoSrc}
                mediaType={mediaType}
                setMediaType={setMediaType}
                userId={userId}
                setIsWatchParty={setIsWatchParty}
                // PASSED SCREEN PROPS
                screenStream={screenStream}
                remoteScreenStream={remoteScreenStream}
                isScreenSharing={isScreenSharing}
                isRemoteScreenSharing={isRemoteScreenSharing}
                startScreenShare={startScreenShare}
                stopScreenShare={stopScreenShare}
              />
            )}
          </div>
        </div>
        {/* CALL SYSTEM (RIGHT 25% or 100%) */}
        <div
          className={`transition-all duration-500 ease-in-out relative flex flex-col bg-[var(--fallback-b2,oklch(var(--b2)))] ${isWatchParty ? "shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-20" : ""}`}
          style={{ width: isWatchParty ? "25%" : "100%", minWidth: isWatchParty ? "25%" : "100%" }}
        >
          <div className={`absolute inset-0 flex flex-col overflow-hidden mx-[10px] ${isWatchParty ? "watch-party-active" : ""}`}>

            {/* ── TOP BAR ───────────────────────────────────────────────────────────── */}
            {isWatchParty ? (
              <header className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-4 bg-gradient-to-b from-black/60 to-transparent pointer-events-none transition-opacity">
                <div
                  className="watch-party-header z-50 pointer-events-auto shimmer-text"
                  onClick={() => setActiveFeature("home")}
                >
                  WATCH PARTY
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
                      <Wifi className="size-3" /> <span className="shimmer-text">Reconnecting…</span>
                    </div>
                  )}
                  {isActive && (
                    <span className="text-sm font-mono text-white/90 tabular-nums drop-shadow-md bg-black/20 px-3 py-1 rounded-full backdrop-blur-sm">
                      {fmtTime(duration)}
                    </span>
                  )}
                </div>
              </header>
            ) : (
              <div className="absolute top-0 w-full px-6 h-[60px] flex items-center justify-between text-white bg-gradient-to-b from-black/80 to-transparent z-50">
                {/* LEFT: Peer Info */}
                <div className="flex items-center gap-3 w-[200px] pointer-events-auto">
                  <img
                    src={peerPic}
                    onError={(e) => { e.target.src = "/avatar.png"; }}
                    className="size-9 rounded-full object-cover border border-white/20 shadow-md"
                    alt={peerName}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold truncate leading-tight">{peerName}</span>
                    {netStatus !== "good" && (
                      <span className={`text-[10px] flex items-center gap-1 ${netStatus === 'poor' ? 'text-yellow-400' : 'text-orange-400 animate-pulse'}`}>
                        {netStatus === 'poor' ? <WifiOff size={10} /> : <Wifi size={10} />}
                        {netStatus === 'poor' ? 'Poor' : 'Reconnecting'}
                      </span>
                    )}
                  </div>
                </div>

                {/* CENTER: Encryption Label */}
                <div className="text-center flex-1 flex flex-col items-center justify-center pointer-events-none">
                  <div className="px-3 py-1 rounded-full bg-black/20 backdrop-blur-md border border-white/5 flex items-center gap-2">
                    <Shield size={12} className="text-[var(--fallback-p,oklch(var(--p)))]" />
                    <p className="text-[10px] uppercase tracking-widest font-bold opacity-80">
                      End-to-end encrypted
                    </p>
                  </div>
                </div>

                {/* RIGHT: Timer & Menu */}
                <div className="flex items-center gap-4 w-[200px] justify-end pointer-events-auto">
                  {isActive && (
                    <span className="text-sm font-medium tabular-nums bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm border border-white/10">
                      {fmtTime(duration)}
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === 'top' ? null : 'top'); }}
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all hover:scale-105 relative"
                  >
                    <Settings className="size-5" />
                    {menuOpen === 'top' && (
                      <div className="absolute top-full right-0 mt-3 py-1.5 w-64 bg-[var(--fallback-b3,oklch(var(--b3)))] border border-white/10 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl pointer-events-auto ring-1 ring-black/50">
                        <div className="px-4 py-2 text-[10px] text-[oklch(var(--bc) / 0.6)] uppercase font-bold tracking-wider border-b border-white/5 mb-1">Theme</div>
                        <div className="px-3 py-2 grid grid-cols-5 gap-2 max-h-40 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                          {THEMES.map((t) => (
                            <button
                              key={t}
                              title={t}
                              onClick={(e) => { e.stopPropagation(); setCallTheme(t); }}
                              className={`w-full aspect-square rounded-md overflow-hidden relative border transition-all ${callTheme === t ? "border-[var(--fallback-p,oklch(var(--p)))] ring-1 ring-[var(--fallback-p,oklch(var(--p)))]" : "border-white/10 hover:border-white/30"}`}
                              data-theme={t}
                            >
                              <div className="absolute inset-0 bg-base-100 grid grid-cols-2 gap-[1px] p-[2px]">
                                <div className="rounded-sm bg-primary" />
                                <div className="rounded-sm bg-secondary" />
                                <div className="rounded-sm bg-accent" />
                                <div className="rounded-sm bg-neutral" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </button>
                </div>
              </div>
            )}

            <div
              className={`w-full flex-1 flex items-center justify-center bg-[var(--fallback-b2,oklch(var(--b2)))] ${!isWatchParty ? 'px-6' : ''}`}
              style={!isWatchParty ? { background: "linear-gradient(135deg, var(--fallback-b2,oklch(var(--b2))) 0%, var(--fallback-b1,oklch(var(--b1))) 100%)", overflow: "hidden" } : {}}
            >
              <div className={!isWatchParty ? "w-[92%] h-[88%] max-w-[1400px] rounded-2xl overflow-hidden relative" : "relative w-full h-full flex flex-col"}>

                {/* REMOTE VIDEO ACTS AS MAIN OR PIP */}
                <div
                  onMouseDown={isSwapped ? handleMouseDown : undefined}
                  className={!isSwapped ? "video-main group relative" : "video-pip group relative"}
                  style={(isSwapped && !isWatchParty) ? (
                    isConnectingUI ? {
                      position: 'fixed',
                      left: '50%',
                      top: '68%',
                      transform: 'translate(-50%, -50%)',
                      width: pipW,
                      height: pipH,
                      zIndex: 100,
                      borderRadius: 16,
                      border: "2px solid rgba(255,255,255,0.2)",
                      boxShadow: "0 20px 50px rgba(0,0,0,0.8)",
                      overflow: "hidden",
                      pointerEvents: "none"
                    } : {
                      position: 'fixed',
                      left: pipPos.x,
                      top: pipPos.y,
                      width: pipW,
                      height: pipH,
                      zIndex: 9999,
                      borderRadius: 12,
                      border: "2px solid rgba(255,255,255,0.12)",
                      boxShadow: isDragging ? "0 25px 60px rgba(0,0,0,0.9)" : "0 10px 40px rgba(0,0,0,0.8)",
                      cursor: isDragging ? 'grabbing' : 'grab',
                      scale: isDragging ? 1.02 : 1,
                      transition: isDragging ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      overflow: "hidden"
                    }
                  ) : {}}
                >
                  <video
                    ref={remoteVidRef}
                    autoPlay
                    playsInline
                    className={`w-full h-full transition-opacity duration-300 pointer-events-none ${!peerCameraOff ? "opacity-100" : "opacity-0"}`}
                    style={{
                      objectFit: remoteFit,
                      aspectRatio: "16/9"
                    }}
                  />

                  {/* Peer camera-off state */}
                  {isActive && peerCameraOff && (
                    <>
                      {/* Watch Party / Shared Layout Notice */}
                      {isWatchParty ? (
                        <div className={`absolute inset-0 z-10 flex flex-col items-center justify-center bg-[var(--fallback-b2,oklch(var(--b2)))]/90 gap-3 
                                    ${!isSwapped ? 'text-base' : 'text-xs'}`}>
                          <img src={peerPic} alt={peerName}
                            onError={(e) => { e.target.src = "/avatar.png"; }}
                            className={`${!isSwapped ? 'size-24' : 'size-12'} rounded-full object-cover border-[3px] border-[var(--fallback-n,oklch(var(--n)))]`} />
                          {!isSwapped && peerHasEverEnabledVideo && (
                            <p className="text-sm text-[oklch(var(--bc) / 0.6)]">{peerName}&apos;s camera is off</p>
                          )}
                        </div>
                      ) : (
                        /* Premium Pill-style Notice for Video Call Mode (Main view only) */
                        !isSwapped && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--fallback-b2,oklch(var(--b2)))]">
                            <img src={peerPic} alt={peerName}
                              onError={(e) => { e.target.src = "/avatar.png"; }}
                              className="size-32 rounded-full object-cover border-4 border-white/10 shadow-2xl mb-4" />
                            <div style={{
                              background: "rgba(0,0,0,0.6)",
                              backdropFilter: "blur(8px)",
                              borderRadius: 20,
                              padding: "6px 14px",
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              color: "var(--fallback-bc,oklch(var(--bc)))",
                              fontSize: 13,
                              whiteSpace: "nowrap",
                              zIndex: 60
                            }}>
                              <VideoOff size={14} style={{ color: "oklch(var(--bc) / 0.6)" }} />
                              {peerName}&apos;s camera is off
                            </div>
                          </div>
                        )
                      )}

                      {/* PIP Avatar Placeholder (when peer is in PIP and camera off) */}
                      {isSwapped && (
                        <div className="absolute inset-0 flex items-center justify-center bg-[var(--fallback-n,oklch(var(--n)))] pointer-events-none">
                          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#555", overflow: "hidden", border: "2px solid rgba(255,255,255,0.2)" }}>
                            <img src={peerPic} alt={peerName} onError={(e) => { e.target.src = "/avatar.png"; }} className="w-full h-full object-cover" />
                          </div>
                        </div>
                      )}
                    </>
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
                  {!isWatchParty && (
                    <div className="absolute top-3 left-3 z-[100] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
                      <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === 'remote' ? null : 'remote'); }}
                        className="p-1.5 bg-black/40 hover:bg-black/60 rounded-full backdrop-blur-md transition-colors text-white shadow-lg">
                        <MoreVertical className="size-5" />
                      </button>
                      {menuOpen === 'remote' && (
                        <div className="absolute top-full left-0 mt-2 py-1 w-36 bg-[var(--fallback-b3,oklch(var(--b3)))] border border-white/10 rounded-lg shadow-2xl overflow-hidden backdrop-blur-xl">
                          <button
                            onMouseDown={(e) => e.stopPropagation()}
                            onMouseUp={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); setRemoteFit('contain'); setMenuOpen(null); }}
                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 flex items-center justify-between font-medium">
                            Fit {remoteFit === 'contain' && <span className="text-[var(--fallback-p,oklch(var(--p)))]">✓</span>}
                          </button>
                          <button
                            onMouseDown={(e) => e.stopPropagation()}
                            onMouseUp={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); setRemoteFit('cover'); setMenuOpen(null); }}
                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 flex items-center justify-between font-medium">
                            Fill {remoteFit === 'cover' && <span className="text-[var(--fallback-p,oklch(var(--p)))]">✓</span>}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* LOCAL VIDEO ACTS AS MAIN OR PIP */}
                <div
                  onMouseDown={!isSwapped ? handleMouseDown : undefined}
                  className={isSwapped ? "video-main group relative" : "video-pip group relative"}
                  style={(!isSwapped && !isWatchParty) ? (
                    isConnectingUI ? {
                      position: 'fixed',
                      left: '50%',
                      top: '68%',
                      transform: 'translate(-50%, -50%)',
                      width: pipW,
                      height: pipH,
                      zIndex: 100,
                      borderRadius: 16,
                      border: "2px solid rgba(255,255,255,0.2)",
                      boxShadow: "0 20px 50px rgba(0,0,0,0.8)",
                      overflow: "hidden",
                      pointerEvents: "none"
                    } : {
                      position: 'fixed',
                      left: pipPos.x,
                      top: pipPos.y,
                      width: pipW,
                      height: pipH,
                      zIndex: 9999,
                      borderRadius: 12,
                      border: "2px solid rgba(255,255,255,0.12)",
                      boxShadow: isDragging ? "0 25px 60px rgba(0,0,0,0.9)" : "0 10px 40px rgba(0,0,0,0.8)",
                      cursor: isDragging ? 'grabbing' : 'grab',
                      scale: isDragging ? 1.02 : 1,
                      transition: isDragging ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      overflow: "hidden"
                    }
                  ) : {}}
                >

                  <video
                    ref={localVidRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full transition-opacity duration-300 pointer-events-none transform -scale-x-100 ${!isCameraOff ? "opacity-100" : "opacity-0"}`}
                    style={{
                      objectFit: localFit,
                      aspectRatio: "16/9"
                    }}
                  />

                  {/* Local camera-off state */}
                  {hasEverEnabledVideo && isCameraOff && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[var(--fallback-n,oklch(var(--n)))] pointer-events-none">
                      {isSwapped ? (
                        <div className="flex flex-col items-center gap-3">
                          <img src="/avatar.png" className="size-24 rounded-full border-4 border-white/10" alt="Self" />
                          <p className="text-sm text-[oklch(var(--bc) / 0.6)]">Your camera is off</p>
                        </div>
                      ) : (
                        /* PIP Avatar View */
                        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#555", overflow: "hidden", border: "2px solid rgba(255,255,255,0.2)" }}>
                          <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #666, #888)" }} />
                        </div>
                      )}
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
                  {!isWatchParty && (
                    <div className="absolute top-3 left-3 z-[100] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
                      <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === 'local' ? null : 'local'); }}
                        className="p-1.5 bg-black/40 hover:bg-black/60 rounded-full backdrop-blur-md transition-colors text-white shadow-lg">
                        <MoreVertical className="size-5" />
                      </button>
                      {menuOpen === 'local' && (
                        <div className="absolute top-full left-0 mt-2 py-1 w-36 bg-[var(--fallback-b3,oklch(var(--b3)))] border border-white/10 rounded-lg shadow-2xl overflow-hidden backdrop-blur-xl font-medium">
                          <button
                            onMouseDown={(e) => e.stopPropagation()}
                            onMouseUp={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); setLocalFit('contain'); setMenuOpen(null); }}
                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 flex items-center justify-between">
                            Fit {localFit === 'contain' && <span className="text-[var(--fallback-p,oklch(var(--p)))]">✓</span>}
                          </button>
                          <button
                            onMouseDown={(e) => e.stopPropagation()}
                            onMouseUp={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); setLocalFit('cover'); setMenuOpen(null); }}
                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 flex items-center justify-between">
                            Fill {localFit === 'cover' && <span className="text-[var(--fallback-p,oklch(var(--p)))]">✓</span>}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Overlay (connecting state or audio-only calls) */}
                {status !== "active" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--fallback-b2,oklch(var(--b2)))] z-40">
                    <div className="flex flex-col items-center gap-6 -mt-40">
                      <img src={peerPic} alt={peerName}
                        onError={(e) => { e.target.src = "/avatar.png"; }}
                        className="size-36 rounded-full object-cover border-4 border-white/10 shadow-2xl" />
                      <div className="text-center">
                        <p className="text-3xl font-bold mb-2 tracking-tight">{peerName}</p>
                        <div className="flex items-center justify-center gap-2 text-[oklch(var(--bc) / 0.6)] text-sm font-medium tracking-wide">
                          <span className="shimmer-text">
                            {status === "calling" ? "CALLING…" :
                              status === "ringing" ? "RINGING…" :
                                status === "connecting" ? "CONNECTING…" : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>



              <audio ref={remoteAudRef} autoPlay playsInline style={{ display: "none" }} />
            </div>





            {/* ── ADD PEOPLE PANEL ── */}
            {showAddPeople && (
              <div className="absolute top-0 right-0 h-full w-[340px] bg-[var(--fallback-b1,oklch(var(--b1)))] flex flex-col z-[999999] shadow-2xl transition-transform border-[rgba(255,255,255,0.1)] border-l">
                <div className="px-6 py-5 flex items-center justify-between">
                  <span className="text-white text-lg font-medium">Add people</span>
                  <div className="flex items-center gap-4">
                    <span className="text-[oklch(var(--bc) / 0.6)] text-sm">{selectedGroupUsers.length}/4</span>
                    <button onClick={() => setShowAddPeople(false)} className="text-[oklch(var(--bc) / 0.6)] hover:text-white transition-colors text-xl leading-none">✕</button>
                  </div>
                </div>

                <div className="px-4 pb-2">
                  <div className="bg-[var(--fallback-b3,oklch(var(--b3)))] px-4 py-2 rounded-lg flex items-center gap-3">
                    <svg viewBox="0 0 24 24" height="20" width="20" preserveAspectRatio="xMidYMid meet" className="text-[oklch(var(--bc) / 0.6)]" version="1.1" x="0px" y="0px" enableBackground="new 0 0 24 24"><path fill="currentColor" d="M15.009,13.805h-0.636l-0.22-0.219c0.781-0.911,1.256-2.092,1.256-3.386 c0-2.876-2.332-5.207-5.207-5.207c-2.876,0-5.208,2.331-5.208,5.207s2.331,5.208,5.208,5.208c1.293,0,2.474-0.474,3.385-1.255 l0.221,0.22v0.635l4.004,3.999l1.194-1.195L15.009,13.805z M10.201,13.805c-2.203,0-3.99-1.787-3.99-3.991 c0-2.203,1.787-3.99,3.99-3.99c2.204,0,3.99,1.787,3.99,3.99C14.191,12.017,12.405,13.805,10.201,13.805z"></path></svg>
                    <input type="text" placeholder="Search name or number" className="w-full bg-transparent text-sm text-[#D1D7DB] outline-none placeholder-[oklch(var(--bc) / 0.6)]" />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto mt-2">
                  <div className="px-5 py-3 text-[var(--fallback-p,oklch(var(--p)))] text-sm font-medium tracking-wide">Frequently contacted</div>
                  {chatUsers.filter(u => u._id !== userId && u._id !== peerId).slice(0, 2).map(u => {
                    const isSelected = selectedGroupUsers.includes(u._id);
                    return (
                      <label key={u._id} className="flex items-center gap-4 px-5 py-3 hover:bg-[var(--fallback-b3,oklch(var(--b3)))] cursor-pointer transition-colors relative group">
                        <img src={u.profilePic || "/avatar.png"} className="size-12 rounded-full object-cover" />
                        <span className="text-[var(--fallback-bc,oklch(var(--bc)))] text-base flex-1 line-clamp-1">{u.fullName}</span>
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 transition-colors ml-auto ${isSelected ? 'bg-[var(--fallback-p,oklch(var(--p)))] border-[var(--fallback-p,oklch(var(--p)))]' : 'border-[oklch(var(--bc) / 0.6)]'}`}>
                          {isSelected && <span className="text-white text-xs font-bold">✓</span>}
                        </div>
                        <input type="checkbox" className="hidden"
                          checked={isSelected}
                          onChange={() => {
                            if (!isSelected) {
                              if (groupParticipants.length + selectedGroupUsers.length >= 4) return;
                              setSelectedGroupUsers([...selectedGroupUsers, u._id]);
                            } else {
                              setSelectedGroupUsers(selectedGroupUsers.filter(id => id !== u._id));
                            }
                          }} />
                      </label>
                    );
                  })}

                  <div className="px-5 py-3 text-[var(--fallback-p,oklch(var(--p)))] text-sm font-medium tracking-wide border-t border-white/5 mt-2">All contacts</div>
                  {chatUsers.filter(u => u._id !== userId && u._id !== peerId).slice(2).map(u => {
                    const isSelected = selectedGroupUsers.includes(u._id);
                    return (
                      <label key={u._id} className="flex items-center gap-4 px-5 py-3 hover:bg-[var(--fallback-b3,oklch(var(--b3)))] cursor-pointer transition-colors relative group">
                        <img src={u.profilePic || "/avatar.png"} className="size-12 rounded-full object-cover" />
                        <span className="text-[var(--fallback-bc,oklch(var(--bc)))] text-base flex-1 line-clamp-1">{u.fullName}</span>
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 transition-colors ml-auto ${isSelected ? 'bg-[var(--fallback-p,oklch(var(--p)))] border-[var(--fallback-p,oklch(var(--p)))]' : 'border-[oklch(var(--bc) / 0.6)]'}`}>
                          {isSelected && <span className="text-white text-xs font-bold">✓</span>}
                        </div>
                        <input type="checkbox" className="hidden"
                          checked={isSelected}
                          onChange={() => {
                            if (!isSelected) {
                              if (groupParticipants.length + selectedGroupUsers.length >= 4) return;
                              setSelectedGroupUsers([...selectedGroupUsers, u._id]);
                            } else {
                              setSelectedGroupUsers(selectedGroupUsers.filter(id => id !== u._id));
                            }
                          }} />
                      </label>
                    );
                  })}
                </div>

                {selectedGroupUsers.length > 0 && (
                  <div className="p-4 bg-[var(--fallback-b1,oklch(var(--b1)))] flex justify-center">
                    <button
                      onClick={() => {
                        sockRef.current?.emit("call:addParticipants", {
                          callId: peerId,
                          from: userId,
                          users: selectedGroupUsers
                        });
                        setShowAddPeople(false);
                        setSelectedGroupUsers([]);
                      }}
                      className="w-14 h-14 bg-[var(--fallback-p,oklch(var(--p)))] hover:bg-[#029676] text-white rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95">
                      <svg viewBox="0 0 24 24" height="24" width="24" preserveAspectRatio="xMidYMid meet" version="1.1" x="0px" y="0px" enableBackground="new 0 0 24 24"><path fill="currentColor" d="M12,4l1.4,1.4L7.8,11H20v2H7.8l5.6,5.6L12,20l-8-8L12,4z" transform="rotate(180 12 12)"></path></svg>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── BOTTOM CONTROLS ─────────────────────────────────────────────────────── */}
            {/* Watch Party keeps the floating pill layout  */}
            {isWatchParty && (
              <footer className="absolute bottom-3 left-0 right-0 z-50 px-4 sm:px-12 flex justify-center w-full pointer-events-none">
                <WatchPartyControls
                  isMuted={isMuted}
                  isCameraOff={isCameraOff}
                  handState={handState}
                  showEmojiPicker={showEmojiPicker}
                  isWatchParty={isWatchParty}
                  toggleMic={toggleMic}
                  toggleCamera={toggleCamera}
                  toggleHandRaise={toggleHandRaise}
                  handleEmojiSelect={handleEmojiSelect}
                  onToggleEmojiPicker={() => setShowEmojiPicker(prev => !prev)}
                  onToggleWatchParty={() => {
                    const next = !isWatchParty;
                    setIsWatchParty(next);
                    sockRef.current?.emit("call:watchPartyToggle", { callId: peerId, enabled: next });
                  }}
                  onAddPeople={() => setShowAddPeople(true)}
                  onNavigateChat={() => getBc()?.postMessage({ type: "NAVIGATE_CHAT" })}
                  onEndCall={() => cleanup(true)}
                />
              </footer>
            )}

            {/* Video call gets its own full-width pinned bar (DefaultCallControls owns the bar design) */}
            {!isWatchParty && (
              <div className="absolute bottom-0 left-0 right-0 z-50">
                <DefaultCallControls
                  isMuted={isMuted}
                  isCameraOff={isCameraOff}
                  handState={handState}
                  showEmojiPicker={showEmojiPicker}
                  isWatchParty={isWatchParty}
                  toggleMic={toggleMic}
                  toggleCamera={toggleCamera}
                  toggleHandRaise={toggleHandRaise}
                  handleEmojiSelect={handleEmojiSelect}
                  onToggleEmojiPicker={() => setShowEmojiPicker(prev => !prev)}
                  onToggleWatchParty={() => {
                    const next = !isWatchParty;
                    setIsWatchParty(next);
                    sockRef.current?.emit("call:watchPartyToggle", { callId: peerId, enabled: next });
                  }}
                  onAddPeople={() => setShowAddPeople(true)}
                  onNavigateChat={() => getBc()?.postMessage({ type: "NAVIGATE_CHAT" })}
                  onEndCall={() => cleanup(true)}
                />
              </div>
            )}

            {/* Simple Toast Component */}
            {toast.show && (
              <div className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-[var(--fallback-p,oklch(var(--p)))] text-white px-6 py-2.5 rounded-full shadow-2xl z-[9999999] animate-bounce text-sm font-bold">
                {toast.message}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
// ── Media Panel Component (Renamed from WatchPartyTopBar) ───────────────────
const MediaPanel = ({ activeFeature, setActiveFeature, showToast, playlist, setPlaylist, socket, callId, videoSrc, setVideoSrc, mediaType, setMediaType }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const headerRef = useRef(null);
  const searchWrapperRef = useRef(null);

  const loadMedia = (item) => {
    setVideoSrc(item.url);
    setMediaType(item.type);
    setActiveFeature("player");
    setShowDropdown(false);
    setQuery("");
  };

  useEffect(() => {
    if (!headerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setIsCollapsed(entry.contentRect.width < 680);
      }
    });
    observer.observe(headerRef.current);
    return () => observer.disconnect();
  }, []);

  // Close popups on outside click
  useEffect(() => {
    const handleOutside = (e) => {
      if (!e.target.closest(".menu-anchor")) {
        setShowPopup(false);
      }
      if (!e.target.closest(".playlist-anchor")) {
        setShowPlaylist(false);
      }
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const buttons = [
    {
      label: "Screenshare",
      value: "screenshare",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
      class: "bg-[#1976d2] hover:bg-[#1565c0]",
    },
    {
      label: "VBrowser",
      value: "vbrowser",
      icon: <span className="border border-white/50 rounded-sm px-1 text-[9px] leading-tight font-bold">V</span>,
      class: "bg-[#2e7d32] hover:bg-[#1b5e20]",
    },
    {
      label: "File",
      value: "file",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
          <polyline points="13 2 13 9 20 9" />
        </svg>
      ),
      class: "bg-[#7b1fa2] hover:bg-[#6a1b9a]",
    },
    {
      label: "Playlist",
      value: "playlist",
      icon: <span className="bg-[#1976d2] text-white px-1.5 py-0.5 rounded-full text-[9px]">{playlist.length}</span>,
      class: "bg-white/10 hover:bg-white/20 text-[#D1D7DB]",
    },
  ];

  const handleAction = (val, label) => {
    if (val === "playlist") {
      setShowPlaylist(!showPlaylist);
      setShowPopup(false);
      return;
    }
    setActiveFeature(val);
    setShowPopup(false);
    setShowPlaylist(false);

    if (val === "vbrowser") {
      socket?.emit("vbrowser:start", { callId });
    }
  };

  // 🧩 TASK 2 — INPUT HANDLER
  const isYouTubeUrl = (url) => /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/i.test(url);
  const isDirectVideo = (url) => /\.(mp4|webm|ogg)$/i.test(url);

  async function handleSearch(value) {
    setQuery(value);
    if (!value.trim()) {
      setShowDropdown(false);
      return;
    }
    setLoading(true);
    setShowDropdown(true);

    let finalResults = [];

    if (isYouTubeUrl(value)) {
      finalResults = [{ type: "youtube", url: value, title: "YouTube Video" }];
    } else if (isDirectVideo(value)) {
      finalResults = [{ type: "video", url: value, title: "Direct Video" }];
    } else {
      // YouTube Search Mock (Priority 3)
      finalResults = [
        { type: "youtube", url: `https://www.youtube.com/results?search_query=${encodeURIComponent(value)}`, title: `Search YouTube for "${value}"` },
        { type: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "Rick Astley - Never Gonna Give You Up" },
      ];
    }

    setResults(finalResults);
    setLoading(false);
  }

  // 🧩 TASK 5 — PLAY NOW
  function playNow(item) {
    socket?.emit("media:play", {
      type: item.type,
      source: item.url,
      title: item.title,
      callId
    });

    loadMedia(item);
  }

  // 🧩 TASK 6 — ADD TO LIST
  function addToList(item) {
    const newItem = { ...item, id: Date.now() };
    setPlaylist(prev => {
      const newList = [...prev, newItem];
      if (prev.length === 0) {
        playNow(newItem);
      } else {
        showToast("Added to playlist");
      }
      return newList;
    });
    setShowDropdown(false);
    setQuery("");
  }

  return (
    <div ref={headerRef} className="media-panel h-full px-6 flex items-center">
      {/* ── LEFT SECTION ── */}
      <div className="flex items-center gap-2">
        {isCollapsed ? (
          <div className="menu-anchor">
            <button
              className="wp-burger-btn"
              onClick={() => setShowPopup(!showPopup)}
              title="Menu"
            >
              <MoreVertical className="size-5" />
            </button>

            {showPopup && (
              <div className="burger-popup shadow-2xl">
                {buttons.map((b) => (
                  <button
                    key={b.label}
                    className={`popup-item group ${activeFeature === b.value ? 'selected' : ''}`}
                    onClick={() => handleAction(b.value, b.label)}
                  >
                    <div className={`icon-box transition-colors ${b.class.split(" ")[0]}`}>
                      {b.icon}
                    </div>
                    <span>{b.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            {buttons.map((b) => {
              if (b.value === 'playlist') {
                return (
                  <div key={b.label} className="playlist-anchor">
                    <button
                      onClick={() => handleAction(b.value, b.label)}
                      className={`${b.class} playlist-btn-trigger text-white px-4 py-2 rounded shadow-md text-[13px] font-semibold flex items-center gap-2 transition-all ${activeFeature === b.value ? 'active-feature' : ''}`}
                    >
                      {b.icon}
                      {b.label}
                    </button>

                    {showPlaylist && (
                      <div className="playlist-popup shadow-2xl">
                        {playlist.length > 0 ? (
                          playlist.map((item) => (
                            <div key={item.id} className="playlist-item group">
                              <div className="thumb">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                                  <polyline points="13 2 13 9 20 9" />
                                </svg>
                              </div>
                              <div className="info">
                                <p className="title">{item.title}</p>
                                <span className="subtitle">{item.subtitle}</span>
                              </div>
                              <div className="actions">
                                <button className="play" title="Play Now">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                </button>
                                <button className="up" title="Move Up">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
                                </button>
                                <button className="delete" onClick={() => removeItem(item.id)} title="Delete">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="playlist-empty">
                            There are no items in the playlist.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <button
                  key={b.label}
                  onClick={() => handleAction(b.value, b.label)}
                  className={`${b.class} text-white px-4 py-2 rounded shadow-md text-[13px] font-semibold flex items-center gap-2 transition-all ${activeFeature === b.value ? 'active-feature' : ''}`}
                >
                  {b.icon}
                  {b.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── RIGHT SECTION: Search ── */}
      <div className="search-wrapper" ref={searchWrapperRef}>
        <div className="search-container ml-auto">
          <div className="search-icon">
            <svg viewBox="0 0 24 24" height="18" width="18" fill="currentColor">
              <path d="M15.009,13.805h-0.636l-0.22-0.219c0.781-0.911,1.256-2.092,1.256-3.386 c0-2.876-2.332-5.207-5.207-5.207c-2.876,0-5.208,2.331-5.208,5.207s2.331,5.208,5.208,5.208c1.293,0,2.474-0.474,3.385-1.255 l0.221,0.22v0.635l4.004,3.999l1.194-1.195L15.009,13.805z M10.201,13.805c-2.203,0-3.99-1.787-3.99-3.991 c0-2.203,1.787-3.99,3.99-3.99c2.204,0,3.99,1.787,3.99,3.99C14.191,12.017,12.405,13.805,10.201,13.805z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search YouTube or paste URL..."
            className="pointer-events-auto"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => {
              if (query.length > 0) setShowDropdown(true);
            }}
          />
        </div>

        {showDropdown && (
          <div className="search-dropdown shadow-2xl">
            {loading && <div className="p-4 text-center text-sm text-[oklch(var(--bc) / 0.6)]">Searching...</div>}

            {!loading && results.length === 0 && (
              <div className="p-4 text-center text-sm text-[oklch(var(--bc) / 0.6)]">No results found</div>
            )}

            {!loading && results.map((item, i) => (
              <div key={i} className="search-item">
                <div className="left">
                  <File className="size-4 text-[oklch(var(--bc) / 0.6)]" />
                  <span className="url-text">{item.title || item.url}</span>
                </div>
                <div className="actions flex items-center gap-2">
                  <button
                    className="play-now-btn"
                    title="Play Now"
                    onClick={() => playNow(item)}
                  >
                    <Play className="size-4 fill-white text-white" />
                  </button>
                  <button
                    className="add-to-list-btn"
                    title="Add to List"
                    onClick={() => addToList(item)}
                  >
                    <Plus className="size-4 text-white" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CallPage;
