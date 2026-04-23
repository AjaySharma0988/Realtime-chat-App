import { useCallStore } from "../store/useCallStore";
import { useEffect, useRef, useState } from "react";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, RotateCcw,
  MessageSquare, Phone,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useChatStore } from "../store/useChatStore";

// ── "Call Ended" screen ───────────────────────────────────────────────────────
const CallEndedScreen = ({ peerInfo, callType, onClose }) => {
  const navigate = useNavigate();
  const { setSelectedUser, users } = useChatStore();

  const goToChat = () => {
    const user = users.find((u) => u._id === peerInfo._id) ?? peerInfo;
    setSelectedUser(user);
    onClose();
    navigate("/");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: "#0B141A" }}
    >
      {/* Avatar */}
      <div className="mb-5">
        <div
          className="size-28 rounded-full overflow-hidden border-4"
          style={{ borderColor: "#2A3942" }}
        >
          <img
            src={peerInfo?.profilePic || "/avatar.png"}
            alt={peerInfo?.fullName}
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Name & status */}
      <h2 className="text-2xl font-semibold mb-2" style={{ color: "#E9EDEF" }}>
        {peerInfo?.fullName || "Unknown"}
      </h2>
      <p className="text-sm mb-10" style={{ color: "#8696A0" }}>Call ended</p>

      {/* Action buttons */}
      <div className="flex items-center gap-10">
        {/* Message */}
        <button onClick={goToChat} className="flex flex-col items-center gap-2">
          <div
            className="size-14 rounded-full flex items-center justify-center transition-colors hover:opacity-80"
            style={{ background: "#2A3942" }}
          >
            <MessageSquare className="size-6 text-white" />
          </div>
          <span className="text-xs" style={{ color: "#8696A0" }}>Message</span>
        </button>

        {/* Call again */}
        <button onClick={onClose} className="flex flex-col items-center gap-2">
          <div
            className="size-14 rounded-full flex items-center justify-center transition-colors hover:opacity-80"
            style={{ background: "#00A884" }}
          >
            {callType === "video"
              ? <Video className="size-6 text-white" />
              : <Phone className="size-6 text-white" />
            }
          </div>
          <span className="text-xs" style={{ color: "#8696A0" }}>Call again</span>
        </button>

        {/* Close */}
        <button onClick={onClose} className="flex flex-col items-center gap-2">
          <div
            className="size-14 rounded-full flex items-center justify-center transition-colors hover:opacity-80"
            style={{ background: "#2A3942" }}
          >
            <PhoneOff className="size-6 text-white" />
          </div>
          <span className="text-xs" style={{ color: "#8696A0" }}>Close</span>
        </button>
      </div>
    </div>
  );
};

// ── Active call ───────────────────────────────────────────────────────────────
const CallInterface = () => {
  const {
    activeCall,
    endedCall,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    toggleMute,
    toggleCamera,
    endCall,
    dismissEndedCall,
  } = useCallStore();

  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const [duration, setDuration] = useState(0);

  // Attach local stream to local video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Attach remote stream to both video and hidden audio elements
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Call duration timer — resets for each new call
  useEffect(() => {
    setDuration(0);
    const timer = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, [activeCall?.with]);

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // ── Show "call ended" screen ──────────────────────────────────────────────
  if (endedCall && !activeCall) {
    return (
      <CallEndedScreen
        peerInfo={endedCall.peerInfo}
        callType={endedCall.callType}
        onClose={dismissEndedCall}
      />
    );
  }

  if (!activeCall) return null;

  const isVideo  = activeCall.callType === "video";
  const peerInfo = activeCall.callerInfo;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "#0B141A" }}
    >
      {/* ── Hidden audio element for remote stream (always present) ────── */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: "none" }} />

      {/* ── Video area ─────────────────────────────────────────────────── */}
      {isVideo ? (
        <div className="relative flex-1 bg-black">
          {/* Remote video (full screen) */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />

          {/* Local video (Picture-in-Picture) */}
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute top-4 right-4 w-32 h-48 md:w-40 md:h-56 object-cover rounded-xl border-2"
            style={{ borderColor: "#00A884" }}
          />

          {/* Peer name + timer overlay */}
          <div className="absolute top-4 left-4 flex flex-col gap-1">
            <span className="text-white font-semibold text-lg drop-shadow">
              {peerInfo?.fullName || "Unknown"}
            </span>
            <span className="text-sm" style={{ color: "#8696A0" }}>
              {formatDuration(duration)}
            </span>
          </div>
        </div>
      ) : (
        /* ── Audio call UI ────────────────────────────────────────────── */
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <div
            className="size-32 rounded-full overflow-hidden border-4"
            style={{ borderColor: "#00A884" }}
          >
            <img
              src={peerInfo?.profilePic || "/avatar.png"}
              alt={peerInfo?.fullName}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-semibold" style={{ color: "#E9EDEF" }}>
              {peerInfo?.fullName || "Unknown"}
            </h2>
            <p className="mt-1" style={{ color: "#8696A0" }}>
              {formatDuration(duration)}
            </p>
          </div>

          {/* Animated equalizer bars */}
          <div className="flex items-end gap-1 h-8">
            {[3, 6, 4, 8, 5, 7, 3, 6].map((h, i) => (
              <div
                key={i}
                className="w-1.5 rounded-full"
                style={{
                  backgroundColor: "#00A884",
                  height: `${h * 3}px`,
                  animation: `pulse 1s ease-in-out ${i * 0.1}s infinite alternate`,
                  opacity: isMuted ? 0.2 : 1,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Controls bar ──────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-center gap-5 py-6 px-4"
        style={{ background: "#1F2C34" }}
      >
        {/* Mute */}
        <button
          onClick={toggleMute}
          title={isMuted ? "Unmute" : "Mute"}
          className="flex flex-col items-center gap-1"
        >
          <div
            className="size-14 rounded-full flex items-center justify-center transition-colors"
            style={{ background: isMuted ? "#EF4444" : "#2A3942" }}
          >
            {isMuted ? (
              <MicOff className="size-6 text-white" />
            ) : (
              <Mic className="size-6 text-white" />
            )}
          </div>
          <span className="text-[11px]" style={{ color: "#8696A0" }}>
            {isMuted ? "Unmute" : "Mute"}
          </span>
        </button>

        {/* Camera toggle (video calls only) */}
        {isVideo && (
          <button onClick={toggleCamera} title="Toggle camera" className="flex flex-col items-center gap-1">
            <div
              className="size-14 rounded-full flex items-center justify-center transition-colors"
              style={{ background: isCameraOff ? "#EF4444" : "#2A3942" }}
            >
              {isCameraOff ? (
                <VideoOff className="size-6 text-white" />
              ) : (
                <Video className="size-6 text-white" />
              )}
            </div>
            <span className="text-[11px]" style={{ color: "#8696A0" }}>Camera</span>
          </button>
        )}

        {/* End call */}
        <button onClick={endCall} title="End call" className="flex flex-col items-center gap-1">
          <div className="size-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors">
            <PhoneOff className="size-6 text-white" />
          </div>
          <span className="text-[11px]" style={{ color: "#8696A0" }}>End</span>
        </button>

        {/* Flip camera (video calls only) */}
        {isVideo && (
          <button className="flex flex-col items-center gap-1">
            <div
              className="size-14 rounded-full flex items-center justify-center"
              style={{ background: "#2A3942" }}
            >
              <RotateCcw className="size-6 text-white" />
            </div>
            <span className="text-[11px]" style={{ color: "#8696A0" }}>Flip</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default CallInterface;
