/**
 * useWebRTC — production-grade WebRTC hook for call popup window.
 *
 * Responsibilities:
 *  1. Acquire local media (audio + video)
 *  2. Create RTCPeerConnection with ICE buffering
 *  3. Create / set offer/answer
 *  4. Handle ICE candidates (queued until remote description is set)
 *  5. Expose controls: mute, camera, end
 */

import { useCallback, useEffect, useRef, useState } from "react";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    }
  ],
};

export const useWebRTC = ({ socket, callType, peerId, isInitiator, initialOffer }) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [status, setStatus] = useState("initializing"); // initializing|connecting|active|ended|error
  const [errorMsg, setErrorMsg] = useState("");

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCandidates = useRef([]);
  const remoteDescSet = useRef(false);

  // ── Add buffered ICE candidates once remote description is set ────────────
  const drainCandidates = useCallback(async () => {
    remoteDescSet.current = true;
    for (const c of pendingCandidates.current) {
      try {
        await pcRef.current?.addIceCandidate(new RTCIceCandidate(c));
      } catch (e) {
        console.warn("[WebRTC] drainCandidates error:", e);
      }
    }
    pendingCandidates.current = [];
  }, []);

  // ── Handle incoming ICE candidate ─────────────────────────────────────────
  const handleRemoteIce = useCallback(async (candidate) => {
    if (!pcRef.current) return;
    if (pcRef.current.remoteDescription) {
      try { await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)); }
      catch (e) { console.warn("[WebRTC] addIceCandidate error:", e); }
    } else {
      pendingCandidates.current.push(candidate);
    }
  }, []);

  // ── Add answer from peer (caller side) ───────────────────────────────────
  const handleRemoteAnswer = useCallback(async (answer) => {
    if (!pcRef.current) return;
    await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
    await drainCandidates();
  }, [drainCandidates]);

  // ── Main initializer ─────────────────────────────────────────────────────
  const initialize = useCallback(async () => {
    if (!socket) return;
    setStatus("initializing");

    try {
      // 1. Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video",
      });
      setLocalStream(stream);
      localStreamRef.current = stream;

      // 2. Create peer connection
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      // Add local tracks
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      // Remote track → remote stream
      pc.ontrack = (e) => {
        if (e.streams?.[0]) setRemoteStream(e.streams[0]);
      };

      // ICE candidates → send to peer via socket
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit("ice-candidate", { to: peerId, candidate: e.candidate });
        }
      };

      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        if (s === "connected") setStatus("active");
        if (s === "failed") {
          console.warn("[WebRTC] Connection failed, attempting ICE restart");
          // Safely restart ICE if supported
          if (pc.restartIce) pc.restartIce();
          else setStatus("error");
        }
        if (s === "disconnected" || s === "closed") setStatus("ended");
      };

      pc.oniceconnectionstatechange = () => {
        const s = pc.iceConnectionState;
        if (s === "connected" || s === "completed") setStatus("active");
        if (s === "failed") {
          console.warn("[WebRTC] ICE Connection failed, attempting restart");
          if (pc.restartIce) pc.restartIce();
        }
        if (s === "disconnected" || s === "closed") setStatus("ended");
      };

      // Failsafe: if we restart ICE, we need to handle onnegotiationneeded
      pc.onnegotiationneeded = async () => {
        try {
          if (pc.signalingState !== "stable") return;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("call:renegotiate", { callId: peerId, offer });
        } catch (err) {
          console.warn("[WebRTC] Renegotiation error:", err);
        }
      };

      // 3. Offer/Answer flow
      if (isInitiator) {
        setStatus("connecting");
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("call-user", { to: peerId, offer, callType, callerInfo: null /* set by store */ });
      } else {
        // Receiver: set remote offer first
        if (initialOffer) {
          await pc.setRemoteDescription(new RTCSessionDescription(initialOffer));
          await drainCandidates();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("call-accepted", { to: peerId, answer });
          setStatus("connecting");
        }
      }
    } catch (err) {
      console.error("[WebRTC] init error:", err);
      setStatus("error");
      setErrorMsg(err.message);
    }
  }, [socket, callType, peerId, isInitiator, initialOffer, drainCandidates]);

  // Run on mount
  useEffect(() => {
    initialize();
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      pcRef.current?.close();
      pcRef.current = null;
      pendingCandidates.current = [];
      remoteDescSet.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Controls ──────────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  }, [localStream]);

  const toggleCamera = useCallback(() => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsCameraOff(!videoTrack.enabled);
    }
  }, [localStream]);

  const stopAll = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    setStatus("ended");
  }, []);

  return {
    localStream, remoteStream,
    isMuted, isCameraOff,
    status, errorMsg,
    toggleMute, toggleCamera, stopAll,
    handleRemoteIce, handleRemoteAnswer, drainCandidates,
  };
};
