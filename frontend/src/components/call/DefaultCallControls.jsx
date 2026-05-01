/**
 * DefaultCallControls — Premium WhatsApp-style bottom bar for Normal / Video call mode.
 *
 * Layout mirrors the reference design:
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  [📷 ▾]  [🎙 ▾]      [😊][✋][📺][👥][💬]       [📵]    │
 *   │  ←Left pill group→  ←─── Centre icons ───→   ←End pill→   │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Rules:
 *  • ALL styles are inline — zero interference with .wp-* or .wa-* classes
 *  • WatchPartyControls is NOT touched
 *  • All existing props/handlers are preserved
 */
import { useState } from "react";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  MessageSquare, Hand, Smile, UserPlus, MonitorPlay, ChevronDown,
} from "lucide-react";

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "👏", "🔥"];

// ── Design tokens (only used here) ──────────────────────────────────────────
const T = {
  bg:          "var(--fallback-b1,oklch(var(--b1)))",
  surface:     "var(--fallback-b3,oklch(var(--b3)))",
  surfaceHov:  "#38505D",
  menuBg:      "#2a3942", // Darker WhatsApp-style surface
  border:      "rgba(255,255,255,0.06)",
  textMain:    "#e9edef", // Soft white
  textMuted:   "#8696a0", // Grey from reference image
  activeGreen: "#00a884", // WhatsApp green
  endRed:      "#EF4444",
  endRedHov:   "#DC2626",
};

// ── Tiny reusable hooks / helpers ────────────────────────────────────────────
function usePillMenu() {
  const [open, setOpen] = useState(false);
  const toggle = (closeOther) => { if (closeOther) closeOther(false); setOpen(v => !v); };
  return [open, setOpen, toggle];
}

// ── Camera pill ──────────────────────────────────────────────────────────────
// ── Camera pill (with Device Selection) ──────────────────────────────────────
function CameraControl({ 
  isCameraOff, 
  toggleCamera, 
  videoInputDevices, 
  selectedCamera, 
  switchCamera 
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div style={{ position: "relative", display: "flex", borderRadius: 999, background: T.surface, overflow: "visible" }}>

      {/* Main icon button */}
      <button
        onClick={toggleCamera}
        title={isCameraOff ? "Turn camera on" : "Turn camera off"}
        style={STYLES.pillLeft}
      >
        {isCameraOff
          ? <VideoOff size={20} style={{ color: T.textMuted }} />
          : <Video    size={20} style={{ color: T.textMain }} />}
      </button>

      {/* Chevron */}
      <button
        onClick={() => setMenuOpen(v => !v)}
        style={STYLES.pillChevron}
        aria-label="Camera options"
      >
        <ChevronDown size={14} style={{ color: T.textMuted }} />
      </button>

      {/* Dropdown */}
      {menuOpen && (
        <div style={STYLES.dropdownMenu}>
          <div style={STYLES.dropdownLabel}>Camera</div>
          
          {videoInputDevices.length > 0 ? (
            videoInputDevices.map((d) => (
              <button
                key={d.deviceId}
                onClick={() => { switchCamera(d.deviceId); setMenuOpen(false); }}
                style={{
                  ...STYLES.dropdownItem,
                  color: (selectedCamera === d.deviceId || (selectedCamera === "default" && d.deviceId === "default")) ? T.activeGreen : T.textMain,
                  display: "flex",
                  alignItems: "center",
                  gap: 8
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div style={{ width: 14, display: "flex", justifyContent: "center" }}>
                  {(selectedCamera === d.deviceId || (selectedCamera === "default" && d.deviceId === "default")) && "✓"}
                </div>
                <span style={{ flex: 1, textAlign: "left" }}>{d.label || `Camera ${d.deviceId.slice(0, 5)}`}</span>
              </button>
            ))
          ) : (
            <div style={{ ...STYLES.dropdownItem, color: T.textMuted, fontSize: 12 }}>No cameras found</div>
          )}
          
          <div style={{ height: 4 }} />
        </div>
      )}
    </div>
  );
}

// ── Mic pill ─────────────────────────────────────────────────────────────────
// ── Mic pill (with Device Selection) ──────────────────────────────────────────
function MicControl({ 
  isMuted, 
  toggleMic, 
  audioInputDevices, 
  audioOutputDevices, 
  selectedMic, 
  selectedSpeaker, 
  switchMic, 
  switchSpeaker 
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div style={{ position: "relative", display: "flex", borderRadius: 999, background: T.surface, overflow: "visible" }}>

      <button
        onClick={toggleMic}
        title={isMuted ? "Unmute" : "Mute"}
        style={STYLES.pillLeft}
      >
        {isMuted
          ? <MicOff size={20} style={{ color: T.textMuted }} />
          : <Mic    size={20} style={{ color: T.textMain }} />}
      </button>

      <button
        onClick={() => setMenuOpen(v => !v)}
        style={STYLES.pillChevron}
        aria-label="Microphone options"
      >
        <ChevronDown size={14} style={{ color: T.textMuted }} />
      </button>

      {menuOpen && (
        <div style={STYLES.dropdownMenu}>
          {/* MICROPHONES SECTION */}
          <div style={STYLES.dropdownLabel}>Microphone</div>
          {audioInputDevices.length > 0 ? (
            audioInputDevices.map((d) => (
              <button
                key={d.deviceId}
                onClick={() => { switchMic(d.deviceId); setMenuOpen(false); }}
                style={STYLES.dropdownItem}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div style={{ width: 16, display: "flex", justifyContent: "center", fontSize: 14 }}>
                  {(selectedMic === d.deviceId || (selectedMic === "default" && d.deviceId === "default")) ? "✓" : ""}
                </div>
                <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {d.label || `Microphone ${d.deviceId.slice(0, 5)}`}
                </span>
              </button>
            ))
          ) : (
            <div style={{ ...STYLES.dropdownItem, color: T.textMuted, fontSize: 13 }}>No microphones found</div>
          )}

          {/* SPEAKERS SECTION */}
          {audioOutputDevices.length > 0 && (
            <>
              <div style={{ height: 8 }} />
              <div style={STYLES.dropdownLabel}>Speakers</div>
              {audioOutputDevices.map((d) => (
                <button
                  key={d.deviceId}
                  onClick={() => { switchSpeaker(d.deviceId); setMenuOpen(false); }}
                  style={STYLES.dropdownItem}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{ width: 16, display: "flex", justifyContent: "center", fontSize: 14 }}>
                    {(selectedSpeaker === d.deviceId || (selectedSpeaker === "default" && d.deviceId === "default")) ? "✓" : ""}
                  </div>
                  <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {d.label || `Speaker ${d.deviceId.slice(0, 5)}`}
                  </span>
                </button>
              ))}
            </>
          )}

          <div style={{ height: 4 }} />
        </div>
      )}
    </div>
  );
}

// ── Emoji picker popup ────────────────────────────────────────────────────────
function EmojiPickerPopup({ show, onSelect }) {
  if (!show) return null;
  return (
    <div className="emoji-panel" style={STYLES.emojiPopup}>
      {EMOJIS.map(emoji => (
        <span
          key={emoji}
          onClick={() => onSelect(emoji)}
          style={STYLES.emojiItem}
          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.3)"}
          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
        >
          {emoji}
        </span>
      ))}
    </div>
  );
}

// ── Centre icon button ────────────────────────────────────────────────────────
function CentreBtn({ onClick, title, active, activeColor, className, children }) {
  const bg = active ? "rgba(255,255,255,0.15)" : "transparent";
  return (
    <button
      onClick={onClick}
      title={title}
      className={className}
      style={{ ...STYLES.centreBtn, background: bg, color: active && activeColor ? activeColor : T.textMain }}
      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.transform = "scale(1.1)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = bg; e.currentTarget.style.transform = "scale(1)"; }}
    >
      {children}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
const DefaultCallControls = ({
  isMuted,
  isCameraOff,
  handState,
  showEmojiPicker,
  isWatchParty,
  // Device Management Props
  audioInputDevices = [],
  audioOutputDevices = [],
  videoInputDevices = [],
  selectedMic = "default",
  selectedSpeaker = "default",
  selectedCamera = "default",
  switchMic,
  switchSpeaker,
  switchCamera,
  // handlers
  toggleMic,
  toggleCamera,
  toggleHandRaise,
  handleEmojiSelect,
  onToggleEmojiPicker,
  onToggleWatchParty,
  onAddPeople,
  onNavigateChat,
  onEndCall,
}) => {
  return (
    <div style={STYLES.root}>

      {/* ── LEFT: camera + mic ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <CameraControl 
          isCameraOff={isCameraOff} 
          toggleCamera={toggleCamera} 
          videoInputDevices={videoInputDevices}
          selectedCamera={selectedCamera}
          switchCamera={switchCamera}
        />
        <MicControl 
          isMuted={isMuted} 
          toggleMic={toggleMic} 
          audioInputDevices={audioInputDevices}
          audioOutputDevices={audioOutputDevices}
          selectedMic={selectedMic}
          selectedSpeaker={selectedSpeaker}
          switchMic={switchMic}
          switchSpeaker={switchSpeaker}
        />
      </div>

      {/* ── CENTRE: feature icons ── */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 4 }}>

        {/* Emoji picker popup — above the smile button */}
        <EmojiPickerPopup show={showEmojiPicker} onSelect={handleEmojiSelect} />

        <CentreBtn onClick={onToggleEmojiPicker}  title="Reactions"   active={showEmojiPicker} className="emoji-btn">
          <Smile size={20} />
        </CentreBtn>

        <CentreBtn onClick={toggleHandRaise} title={handState.localRaised ? "Lower hand" : "Raise hand"}
          active={handState.localRaised} activeColor={T.activeGreen}>
          <Hand size={20} />
        </CentreBtn>

        <CentreBtn onClick={onToggleWatchParty} title={isWatchParty ? "Exit Watch Party" : "Watch Party"}
          active={isWatchParty} activeColor="#1976d2">
          <MonitorPlay size={20} />
        </CentreBtn>

        <CentreBtn onClick={onAddPeople}       title="Add people">
          <UserPlus size={20} />
        </CentreBtn>

        <CentreBtn onClick={onNavigateChat}    title="Chat">
          <MessageSquare size={20} />
        </CentreBtn>
      </div>

      {/* ── RIGHT: end call pill ── */}
      <div>
        <button
          onClick={onEndCall}
          title="End call"
          style={STYLES.endBtn}
          onMouseEnter={e => { e.currentTarget.style.background = T.endRedHov; e.currentTarget.style.transform = "scale(1.05)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = T.endRed;    e.currentTarget.style.transform = "scale(1)"; }}
        >
          <PhoneOff size={22} />
        </button>
      </div>
    </div>
  );
};

// ── Styles object ─────────────────────────────────────────────────────────────
const STYLES = {
  root: {
    height: 64,
    background: T.bg,
    borderTop: `1px solid ${T.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 20px",
    width: "100%",
    boxSizing: "border-box",
    flexShrink: 0,
    position: "relative",
  },

  // pill buttons
  pillLeft: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 40,
    borderRadius: "999px 0 0 999px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "0 10px 0 14px",
    transition: "background 0.15s",
  },
  pillChevron: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 26,
    height: 40,
    borderRadius: "0 999px 999px 0",
    background: "transparent",
    border: "none",
    borderLeft: `1px solid ${T.border}`,
    cursor: "pointer",
    padding: "0 8px 0 4px",
    transition: "background 0.15s",
  },

  // dropdown menu
  dropdownMenu: {
    position: "absolute",
    bottom: "calc(100% + 12px)",
    left: 0,
    minWidth: 260, // Wider like the reference image
    background: T.menuBg,
    border: `1px solid ${T.border}`,
    borderRadius: 12,
    padding: "8px 0", // No side padding for full-width items
    boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
    zIndex: 9999,
    overflow: "hidden",
  },
  dropdownLabel: {
    fontSize: 12,
    fontWeight: 500,
    color: T.textMuted,
    padding: "6px 20px 8px", // Matches image spacing
    cursor: "default",
  },
  dropdownItem: {
    display: "flex",
    alignItems: "center",
    width: "100%",
    textAlign: "left",
    background: "transparent",
    border: "none",
    color: T.textMain,
    fontSize: 14,
    padding: "8px 20px", // More horizontal space
    cursor: "pointer",
    transition: "background 0.1s",
    gap: 12,
  },

  // emoji popup
  emojiPopup: {
    position: "absolute",
    bottom: "calc(100% + 14px)",
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(17,27,33,0.97)",
    backdropFilter: "blur(10px)",
    border: `1px solid ${T.border}`,
    borderRadius: 22,
    padding: "8px 14px",
    display: "flex",
    gap: 14,
    boxShadow: "0 6px 24px rgba(0,0,0,0.6)",
    zIndex: 200,
    pointerEvents: "auto",
  },
  emojiItem: {
    fontSize: 22,
    cursor: "pointer",
    display: "inline-block",
    transition: "transform 0.15s cubic-bezier(0.34,1.56,0.64,1)",
    userSelect: "none",
  },

  // centre icon buttons
  centreBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    borderRadius: "50%",
    border: "none",
    cursor: "pointer",
    transition: "background 0.15s, transform 0.15s",
    flexShrink: 0,
  },

  // end call
  endBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 58,
    height: 40,
    borderRadius: 999,
    background: T.endRed,
    border: "none",
    color: "white",
    cursor: "pointer",
    boxShadow: "0 4px 18px rgba(239,68,68,0.45)",
    transition: "background 0.2s, transform 0.2s",
  },
};

export default DefaultCallControls;
