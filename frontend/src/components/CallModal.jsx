import { useCallStore, focusCallWindow } from "../store/useCallStore";
import { Phone, PhoneOff, Video } from "lucide-react";
import { useEffect, useRef } from "react";

const CallModal = () => {
  const { incomingCall, outgoingCall, activeCall, acceptCall, rejectCall, endCall } = useCallStore();

  // ── "Return to call" mini-banner when popup is open ────────────────────
  if (!incomingCall && (outgoingCall || activeCall)) {
    const target = activeCall || outgoingCall;
    const peerName = target.callerInfo?.fullName || target.to?.fullName || "Call";

    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3
                      bg-[#1F2C34] border border-white/10 rounded-full px-5 py-2.5 shadow-2xl animate-bounce-once">
        <span className="size-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-sm font-medium text-white">
          {target.callType === "video" ? "📹" : "📞"} {peerName} · {activeCall ? "In call" : "Calling"}
        </span>
        <button
          onClick={() => focusCallWindow()}
          className="text-xs text-green-400 font-semibold hover:text-green-300 transition-colors"
        >
          Click to return
        </button>
        <button
          onClick={endCall}
          className="text-xs text-red-400 hover:text-red-300 transition-colors"
        >
          End
        </button>
      </div>
    );
  }

  if (!incomingCall) return null;
  // FATAL BUG GUARD: Never render the modal overlay inside the dedicated Call Popup Window router
  if (window.location.pathname === "/call") return null;

  const isIncoming = true;
  const callType = incomingCall.callType;
  const callerInfo = incomingCall.callerInfo;
  const isVideo = callType === "video";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: "rgba(11,20,26,0.92)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="rounded-3xl p-8 flex flex-col items-center gap-5 shadow-2xl w-[320px]"
        style={{
          background: "linear-gradient(160deg, #1F2C34 0%, #0D1B24 100%)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* ── Lock bar (like WhatsApp) ──────────────────────────────────── */}
        <div className="flex items-center gap-1.5 text-[11px] mb-1" style={{ color: "#8696A0" }}>
          <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
            <rect x="1" y="5" width="8" height="7" rx="1.5" stroke="#8696A0" strokeWidth="1.2" />
            <path d="M3 5V3.5a2 2 0 0 1 4 0V5" stroke="#8696A0" strokeWidth="1.2" />
          </svg>
          End-to-end encrypted
        </div>

        {/* ── Avatar + ripple ───────────────────────────────────────────── */}
        <div className="relative flex items-center justify-center my-2">
          {/* Ping rings */}
          {[1, 2].map((i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                inset: `${-i * 12}px`,
                border: "1.5px solid rgba(0,168,132,0.25)",
                animation: `ringPulse 2s ease-out ${i * 0.6}s infinite`,
              }}
            />
          ))}
          <div
            className="size-24 rounded-full overflow-hidden border-2 relative z-10"
            style={{ borderColor: "#00A884" }}
          >
            <img
              src={callerInfo?.profilePic || "/avatar.png"}
              alt={callerInfo?.fullName}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* ── Call type label ───────────────────────────────────────────── */}
        <div className="text-center">
          <p className="text-xs mb-1.5" style={{ color: "#8696A0" }}>
            {isIncoming ? "Incoming" : "Calling…"}&nbsp;
            {isVideo ? "Video" : "Voice"} Call
          </p>
          <h2 className="text-xl font-semibold" style={{ color: "#E9EDEF" }}>
            {callerInfo?.fullName || "Unknown Caller"}
          </h2>
        </div>

        {/* ── Animated dots ────────────────────────────────────────────── */}
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-1.5 rounded-full"
              style={{
                backgroundColor: "#00A884",
                animation: `dotBounce 1.4s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>

        {/* ── Action buttons ────────────────────────────────────────────── */}
        <div className={`flex gap-12 mt-2 ${isIncoming ? "justify-between w-full px-8" : "justify-center"}`}>
          {/* Decline / Cancel */}
          <button
            onClick={isIncoming ? rejectCall : endCall}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="size-16 rounded-full bg-red-500 group-hover:bg-red-600 flex items-center justify-center transition-all duration-150 shadow-lg">
              <PhoneOff className="size-7 text-white" />
            </div>
            <span className="text-xs" style={{ color: "#8696A0" }}>
              {isIncoming ? "Decline" : "Cancel"}
            </span>
          </button>

          {/* Accept — only shown for incoming calls */}
          {isIncoming && (
            <button onClick={acceptCall} className="flex flex-col items-center gap-2 group">
              <div
                className="size-16 rounded-full flex items-center justify-center transition-all duration-150 shadow-lg group-hover:opacity-80"
                style={{ backgroundColor: "#00A884" }}
              >
                {isVideo ? (
                  <Video className="size-7 text-white" />
                ) : (
                  <Phone className="size-7 text-white" />
                )}
              </div>
              <span className="text-xs" style={{ color: "#8696A0" }}>Accept</span>
            </button>
          )}
        </div>
      </div>

      {/* Inline keyframes for ring pulse and dot bounce */}
      <style>{`
        @keyframes ringPulse {
          0%   { opacity: 0.7; transform: scale(1); }
          70%  { opacity: 0;   transform: scale(1.35); }
          100% { opacity: 0;   transform: scale(1.35); }
        }
        @keyframes dotBounce {
          0%, 80%, 100% { transform: translateY(0);    opacity: 0.4; }
          40%            { transform: translateY(-6px); opacity: 1;   }
        }
      `}</style>
    </div>
  );
};

export default CallModal;
