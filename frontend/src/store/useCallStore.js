import { create } from "zustand";
import { ICE_SERVERS } from "../constants/webrtc";

let ringtoneAudio = null;

const playRingtone = () => {
  if (!ringtoneAudio) {
    ringtoneAudio = new Audio("/ringtone.mp3");
    ringtoneAudio.loop = true;
  }
  ringtoneAudio.play().catch(() => console.warn("Autoplay blocked"));
};

const stopRingtone = () => {
  if (ringtoneAudio) {
    ringtoneAudio.pause();
    ringtoneAudio.currentTime = 0;
  }
};

// ─── ICE / STUN — Moved to central constants/webrtc.js ──────────────────────

let peerConnection = null;

// ICE candidates can arrive BEFORE setRemoteDescription is called on the caller
// side (race between "call-accepted-by-peer" and "ice-candidate" events).
// We buffer them and drain once the remote description is set.
let pendingIceCandidates = [];
let remoteDescriptionSet = false;

const drainPendingCandidates = async () => {
  if (!peerConnection) return;
  remoteDescriptionSet = true;
  console.log(`[Store] Draining ${pendingIceCandidates.length} pending ICE candidates`);
  for (const candidate of pendingIceCandidates) {
    try {
      if (candidate && peerConnection.remoteDescription) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log("[Store] Added pending ICE candidate");
      }
    } catch (e) {
      console.warn("[Store] Drained ICE candidate error:", e.message);
    }
  }
  pendingIceCandidates = [];
};

const resetIceState = () => {
  pendingIceCandidates = [];
  remoteDescriptionSet = false;
};

const createPeerConnection = (onIceCandidate, onRemoteStream) => {
  const pc = new RTCPeerConnection(ICE_SERVERS);

  pc.onicecandidate = (event) => {
    if (event.candidate) onIceCandidate(event.candidate);
  };

  pc.ontrack = (event) => {
    if (event.streams?.[0]) onRemoteStream(event.streams[0]);
  };

  pc.oniceconnectionstatechange = () => {
    console.log("[WebRTC] ICE state:", pc.iceConnectionState);
    if (pc.iceConnectionState === "failed") {
      console.warn("[WebRTC] ICE Connection Failed - Consider ICE Restart");
    }
  };

  pc.onicegatheringstatechange = () => {
    console.log("[WebRTC] ICE Gathering state:", pc.iceGatheringState);
  };

  pc.onconnectionstatechange = () => {
    console.log("[WebRTC] Connection state:", pc.connectionState);
  };

  return pc;
};

// ── Helper: post a call log message via REST ─────────────────────────────────
const _postCallLog = async (peerId, callType, callStatus, callDuration) => {
  try {
    const { axiosInstance } = await import("../lib/axios");
    const res = await axiosInstance.post(`/messages/send/${peerId}`, {
      type: "call",
      callType,
      callStatus,
      callDuration,
    });
    // Optimistically add to local messages list if that chat is open
    const { useChatStore } = await import("./useChatStore");
    const { selectedUser, messages } = useChatStore.getState();
    if (selectedUser?._id === peerId) {
      useChatStore.setState({ messages: [...messages, res.data] });
    }
  } catch (err) {
    console.error("Failed to save call log:", err);
  }
};

// ── Module-level call window ref (NOT in Zustand — avoids re-renders) ─────────────
let _callWin = null;

// Opens a single popup window; focuses it if already open.
const openCallPopup = (url) => {
  if (_callWin && !_callWin.closed) {
    _callWin.location.href = url; // Reuse window but force route update for the new WebRTC variables!
    _callWin.focus();
    return _callWin;
  }
  _callWin = window.open(
    url,
    "ChattyCall",
    "width=1000,height=700,resizable=yes,toolbar=no,menubar=no"
  );
  return _callWin;
};

// Exported helper so UI components can focus the call popup
export const focusCallWindow = () => {
  try { if (_callWin && !_callWin.closed) _callWin.focus(); }
  catch { }
};

export const useCallStore = create((set, get) => ({
  incomingCall: null,    // { from, offer, callType, callerInfo }
  outgoingCall: null,    // { to: userObject, callType }
  activeCall: null,      // { with: userId, callType, callerInfo }
  endedCall: null,       // { peerInfo, callType } — shown on "Call ended" screen
  localStream: null,
  remoteStream: null,
  isMuted: false,
  isCameraOff: false,
  callStartTime: null,   // Date.now() when both sides are connected
  _callTimeoutId: null,  // clearTimeout ref for 30s no-answer timer
  isCaller: false,       // tracks if THIS user originated the call
  callHistory: [],
  isFetchingHistory: false,
  selectedCallPeer: null,

  setSelectedCallPeer: (user) => set({ selectedCallPeer: user }),

  markCallActive: () => {
    const { outgoingCall, incomingCall, activeCall } = get();
    if (activeCall) return;

    if (outgoingCall) {
      set({
        activeCall: {
          with: outgoingCall.to?._id,
          callType: outgoingCall.callType,
          callerInfo: outgoingCall.to,
        },
        callStartTime: Date.now(),
        outgoingCall: null,
        _callTimeoutId: null,
      });
      stopRingtone();
    } else if (incomingCall) {
      set({
        activeCall: {
          with: incomingCall.from,
          callType: incomingCall.callType,
          callerInfo: incomingCall.callerInfo,
        },
        callStartTime: Date.now(),
        incomingCall: null,
        _callTimeoutId: null,
      });
      stopRingtone();
    } else {
      // If neither but we are forcing active (e.g. from a broadcast)
      set({ callStartTime: Date.now() });
    }
  },

  fetchCallHistory: async () => {
    set({ isFetchingHistory: true });
    try {
      const { axiosInstance } = await import("../lib/axios");
      const res = await axiosInstance.get("/calls");
      set({ callHistory: res.data });
    } catch (error) {
      console.error("Failed to fetch call history:", error);
    } finally {
      set({ isFetchingHistory: false });
    }
  },

  clearCallHistory: async () => {
    try {
      const { axiosInstance } = await import("../lib/axios");
      await axiosInstance.delete("/calls");
      set({ callHistory: [] });
    } catch (error) {
      console.error("Failed to clear call history:", error);
    }
  },

  // ── Full cleanup ─────────────────────────────────────────────────────────
  cleanup: (closeWindow = true) => {
    const { localStream, _callTimeoutId } = get();
    if (localStream) localStream.getTracks().forEach((t) => t.stop());
    if (peerConnection) { peerConnection.close(); peerConnection = null; }
    clearTimeout(_callTimeoutId);
    resetIceState();
    stopRingtone();
    if (closeWindow) {
      try { if (_callWin && !_callWin.closed) _callWin.close(); } catch { }
      _callWin = null;
    }
    set({
      incomingCall: null, outgoingCall: null, activeCall: null,
      localStream: null, remoteStream: null,
      isMuted: false, isCameraOff: false,
      callStartTime: null, _callTimeoutId: null,
      isCaller: false,
    });
  },

  // ── Dismiss call-ended screen ────────────────────────────────────────────
  dismissEndedCall: () => set({ endedCall: null }),

  // ── Caller: initiate call — opens popup window ──────────────────────────
  startCall: async (user, callType) => {
    const { useAuthStore } = await import("./useAuthStore");
    const socket = useAuthStore.getState().socket;
    const authUser = useAuthStore.getState().authUser;
    if (!socket || !authUser) return;

    const { activeCall, outgoingCall, incomingCall } = get();
    if (activeCall || outgoingCall || incomingCall) return;
    if (_callWin && !_callWin.closed) { _callWin.focus(); return; }

    set({ outgoingCall: { to: user, callType }, isCaller: true });

    const params = new URLSearchParams({
      callType, peerId: user._id, peerName: user.fullName,
      peerPic: user.profilePic || "/avatar.png", isCaller: "true", userId: authUser._id,
    });

    const popup = openCallPopup(`/call?${params.toString()}`);
    if (!popup) {
      alert("Popup blocked! Please allow popups for this site in your browser settings.");
      set({ outgoingCall: null, isCaller: false });
      return;
    }

    const timeoutId = setTimeout(async () => {
      const { outgoingCall, isCaller } = get();
      if (!outgoingCall) return;
      if (isCaller) _postCallLog(user._id, callType, "missed", 0);
      socket.emit("call:end", { to: user._id, reason: "timeout" });

      const bc = new BroadcastChannel("chatty_call_channel");
      bc.postMessage({ type: "FORCE_TIMEOUT" });
      setTimeout(() => bc.close(), 1000);

      get().cleanup(false);
    }, 60_000);

    set({ _callTimeoutId: timeoutId });
  },

  // ── Receiver: accept incoming call — opens popup ────────────────────────
  acceptCall: async () => {
    const { incomingCall, _callTimeoutId } = get();
    if (!incomingCall) return;
    clearTimeout(_callTimeoutId);

    const { useAuthStore } = await import("./useAuthStore");
    const authUser = useAuthStore.getState().authUser;
    if (!authUser) return;

    const savedOffer = incomingCall.offer;
    const params = new URLSearchParams({
      callType: incomingCall.callType, peerId: incomingCall.from,
      peerName: incomingCall.callerInfo?.fullName || "Caller",
      peerPic: incomingCall.callerInfo?.profilePic || "/avatar.png",
      isCaller: "false", userId: authUser._id,
      isGroupCall: incomingCall.isGroupCall ? "true" : "false",
    });

    set({
      incomingCall: null,
      activeCall: { with: incomingCall.from, callType: incomingCall.callType, callerInfo: incomingCall.callerInfo },
      isCaller: false
    });

    const popup = openCallPopup(`/call?${params.toString()}`);
    if (!popup) {
      alert("Popup blocked! Please allow popups for this site.");
      get().cleanup();
      return;
    }

    const bc = new BroadcastChannel("chatty_call_channel");
    let offerSent = false;
    const sendOffer = () => {
      if (offerSent) return;
      offerSent = true;
      const { pendingIceQueue } = get();
      bc.postMessage({ type: "INCOMING_CALL", offer: savedOffer, iceCandidates: pendingIceQueue || [], isGroupCall: incomingCall.isGroupCall });
      set({ pendingIceQueue: [] });
      setTimeout(() => { try { bc.close(); } catch { } }, 30_000);
    };
    bc.onmessage = (e) => { if (e.data.type === "POPUP_READY") sendOffer(); };
    setTimeout(sendOffer, 5_000);
  },

  // ── Receiver: reject incoming call ──────────────────────────────────────
  rejectCall: async () => {
    const { incomingCall } = get();
    if (!incomingCall) return;

    const { useAuthStore } = await import("./useAuthStore");
    const socket = useAuthStore.getState().socket;
    if (socket) {
        if (incomingCall.isGroupCall) {
           socket.emit("call:group-user-left", { callId: incomingCall.callId, userId: get().authUser?._id });
        } else {
           socket.emit("call-rejected", { to: incomingCall.from });
        }
    }

    // Explicitly doing NO REST call here. The caller's handleCallRejected logs it.
    get().cleanup();
  },

  // ── Either party: end active/outgoing call ───────────────────────────────
  endCall: async () => {
    const { activeCall, outgoingCall, callStartTime, isCaller } = get();
    const targetId = activeCall?.with ?? outgoingCall?.to?._id;
    const callType = activeCall?.callType ?? outgoingCall?.callType;
    const peerInfo = activeCall?.callerInfo ?? outgoingCall?.to;

    const { useAuthStore } = await import("./useAuthStore");
    const socket = useAuthStore.getState().socket;
    if (socket && targetId) socket.emit("call:end", { to: targetId, reason: "ended" });

    const duration = (callStartTime && activeCall) ? Math.floor((Date.now() - callStartTime) / 1000) : 0;

    if (activeCall && peerInfo) set({ endedCall: { peerInfo, callType } });

    // ONLY the Caller commits the log to correct the Left/Right layout behavior
    if (isCaller && targetId && callType && activeCall) {
      // Intentionally decoupled from awaiting to unblock UI
      _postCallLog(targetId, callType, "completed", duration);
    }

    get().cleanup(false);
  },

  // ── Toggle mute / camera ────────────────────────────────────────────────
  toggleMute: () => {
    const { localStream, isMuted } = get();
    localStream?.getAudioTracks().forEach((t) => { t.enabled = isMuted; });
    set({ isMuted: !isMuted });
  },
  toggleCamera: () => {
    const { localStream, isCameraOff } = get();
    localStream?.getVideoTracks().forEach((t) => { t.enabled = isCameraOff; });
    set({ isCameraOff: !isCameraOff });
  },

  // ── Socket event handlers (wired in useAuthStore.connectSocket) ─────────
  handleIncomingCall: (data) => {
    const { activeCall, outgoingCall, incomingCall } = get();
    if (activeCall || outgoingCall || (incomingCall && incomingCall.from !== data.from)) {
      import("./useAuthStore").then(({ useAuthStore }) => {
        const socket = useAuthStore.getState().socket;
        if (socket) socket.emit("call-rejected", { to: data.from });
      });
      return;
    }

    playRingtone();
    set({ incomingCall: data, isCaller: false });

    // Wire back to peer that it has reached the client and is ringing
    import("./useAuthStore").then(({ useAuthStore }) => {
      const socket = useAuthStore.getState().socket;
      if (socket) socket.emit("call-ringing", { to: data.from });
    });
  },

  handleCallAcceptedByPeer: async ({ answer }) => {
    clearTimeout(get()._callTimeoutId);
    stopRingtone();
    const { outgoingCall } = get();
    if (!outgoingCall) return;
    set({
      activeCall: {
        with: outgoingCall?.to?._id,
        callType: outgoingCall?.callType,
        callerInfo: outgoingCall?.to,
      },
      callStartTime: Date.now(),
      outgoingCall: null,
      _callTimeoutId: null,
    });
  },

  pendingIceQueue: [], // Zustand state for early ICE routing

  handleIceCandidate: async ({ candidate }) => {
    if (!candidate) return;
    const { popupOpen } = get();
    // Re-route dynamically received early ICE properties into the popup natively
    try {
      const bc = new BroadcastChannel("chatty_call_channel");
      bc.postMessage({ type: "FORWARD_ICE_CANDIDATE", candidate });
      setTimeout(() => bc.close(), 1000);
    } catch { /* ignore */ }

    // Buffer locally in case the UI is still prompting the user and the popup channel hasn't instantiated
    set((state) => ({ pendingIceQueue: [...(state.pendingIceQueue || []), candidate] }));
  },

  handleCallRejected: async () => {
    // Rely on popup to process this and send CALL_ENDED
    // Just clear main window state so UI cleans up securely
    clearTimeout(get()._callTimeoutId);
    get().cleanup(false);
  },

  handleCallEnded: ({ reason } = {}) => {
    // If peer ends call abruptly via socket, the popup handles logging via CALL_ENDED broadcast.
    get().cleanup(false);
  },

  handleCallTimeout: () => {
    get().cleanup(false); // Does not force close modal, lets popup handle itself if active
  },

  handleUserOffline: async () => {
    // Valid offline handling
    const { isCaller, outgoingCall } = get();
    const user = outgoingCall?.to;
    const callType = outgoingCall?.callType;
    if (isCaller && user && callType) {
      await _postCallLog(user._id, callType, "missed", 0);
    }
    get().cleanup(false);
  },

  // ── BroadcastChannel listener (init from App.jsx once) ───────────────────
  initBroadcastListener: () => {
    try {
      const bc = new BroadcastChannel("chatty_call_channel");
      bc.onmessage = async (e) => {
        const type = e.data?.type;

        if (type === "POPUP_TOOK_OVER") {
          // Do NOT clear timeout here! The 60-second limit must be strictly enforced.
        }

        if (type === "CALL_AGAIN") {
          import("./useChatStore").then(({ useChatStore }) => {
            const user = useChatStore.getState().users.find((u) => u._id === e.data.peerId);
            if (user) {
              get().startCall(user, e.data.callType);
            }
          });
          return;
        }

        if (type === "CALL_ACCEPTED") {
          const { outgoingCall } = get();
          if (outgoingCall) {
            set({
              activeCall: {
                with: outgoingCall.to?._id,
                callType: outgoingCall.callType,
                callerInfo: outgoingCall.to,
              },
              callStartTime: Date.now(),
              outgoingCall: null,
            });
          } else {
            set({ callStartTime: Date.now() });
          }
        }

        if (type === "CALL_ENDED") {
          // Popup signaled end (meaning peer hung up inside popup, or we hung up inside popup).
          const { isCaller, activeCall, outgoingCall, callStartTime } = get();

          if (isCaller) {
            if (activeCall?.with && activeCall?.callType) {
              const duration = callStartTime ? Math.floor((Date.now() - callStartTime) / 1000) : 0;
              _postCallLog(activeCall.with, activeCall.callType, "completed", Math.max(duration, 0));
            } else if (outgoingCall?.to && outgoingCall?.callType) {
              // We hung up before they answered!
              const logStatus = e.data.finalStatus === "rejected" ? "rejected" : "missed";
              _postCallLog(outgoingCall.to._id, outgoingCall.callType, logStatus, 0);
            }
          }

          get().cleanup(false);
          try {
            const { useAuthStore } = await import("./useAuthStore");
            const socket = useAuthStore.getState().socket;
            if (socket?.connected) socket.emit("re-register");
          } catch { /* ignore */ }
        }
      };
      return () => bc.close();
    } catch {
      return () => { };
    }
  },
}));
