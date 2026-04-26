/**
 * WatchPartyControls — Bottom control bar for Watch Party mode.
 *
 * Layout:
 *  ┌──────────────────────────────────────────┐
 *  │  [📷▾]  [🎙▾]  [🔴 End]               │  ← Row 1: same-size primary controls
 *  │  👍  ❤️  😂  😮  😢  ➕               │  ← Row 2: 5 customisable + add btn
 *  │  [😊] [✋] [📺] [👥] [💬]             │  ← Row 3: feature buttons
 *  └──────────────────────────────────────────┘
 *
 * Features:
 *  • 5 fixed emoji slots — drag any emoji from picker to replace a slot
 *  • ➕ opens a full scrollable emoji picker above the row
 *  • Total 6 items in Row 2 (5 emojis + 1 add button)
 *  • Unified 'wp-panel' glassmorphism across all 3 rows for harmony
 */
import { useState, useRef, useCallback, useEffect } from "react";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  MessageSquare, Hand, Smile, UserPlus, MonitorPlay
} from "lucide-react";

import { ALL_EMOJIS } from "../../constants/emojis";

const DEFAULT_SLOTS = ["👍", "❤️", "😂", "😮", "😢"];

const WatchPartyControls = ({
  isMuted,
  isCameraOff,
  handState,
  showEmojiPicker,     // controlled from CallPage
  toggleMic,
  toggleCamera,
  toggleHandRaise,
  handleEmojiSelect,   // fires FloatAnimation + socket emit
  onToggleEmojiPicker, // toggles the CallPage showEmojiPicker
  onToggleWatchParty,
  onAddPeople,
  onNavigateChat,
  onEndCall,
}) => {
  // ── Local state: customisable 5 emoji slots (persisted in localStorage) ────
  const [myEmojis, setMyEmojis] = useState(() => {
    try {
      const saved = localStorage.getItem("wp_emoji_slots");
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) && parsed.length === 5 ? parsed : DEFAULT_SLOTS;
    } catch {
      return DEFAULT_SLOTS;
    }
  });

  const [showFullPicker, setShowFullPicker] = useState(false);
  const draggedEmoji = useRef(null);

  // ── Outside Click Logic ─────────────────────────────────────────────────────
  useEffect(() => {
    const handleClick = (e) => {
      if (!e.target.closest(".wp-full-picker") && !e.target.closest(".wp-add-btn")) {
        setShowFullPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const saveSlots = useCallback((slots) => {
    setMyEmojis(slots);
    try { localStorage.setItem("wp_emoji_slots", JSON.stringify(slots)); } catch { }
  }, []);

  const handleDragStart = (emoji) => {
    draggedEmoji.current = emoji;
  };

  const handleDropOnSlot = useCallback((index, e) => {
    e.preventDefault();
    const emoji = e.dataTransfer.getData("emoji") || draggedEmoji.current;
    if (!emoji) return;
    const updated = [...myEmojis];
    updated[index] = emoji;
    saveSlots(updated);
    draggedEmoji.current = null;
  }, [myEmojis, saveSlots]);

  const handleDragOver = (e) => e.preventDefault();

  const togglePicker = () => {
    setShowFullPicker(prev => !prev);
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center w-full pointer-events-auto wp-controls-root relative" style={{ top: "22px" }}>

      {/* ── ROW 1: Primary controls ─────────── */}
      <div className="wp-panel1 wp-primary-row">
        <button
          onClick={toggleCamera}
          className={`wa-control-btn ${isCameraOff ? "off" : ""}`}
          title={isCameraOff ? "Turn camera on" : "Turn camera off"}
        >
          {isCameraOff ? <VideoOff className="size-5" /> : <Video className="size-5" />}
        </button>

        <button
          onClick={toggleMic}
          className={`wa-control-btn ${isMuted ? "off" : ""}`}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
        </button>

        <button onClick={onEndCall} className="wa-end-btn" title="End call">
          <PhoneOff className="size-6" />
        </button>
      </div>

      {/* ── ROW 2: 5 customisable emoji slots + ➕ (Popup anchored here) ─────── */}
      <div className="wp-pane wp-panel wp-reactions-row relative">
        {/* ── POP-UP FULL PICKER (Overlay Mode) ── */}
        {showFullPicker && (
          <div className="wp-full-picker-popup">
            <div className="wp-full-picker shadow-2xl">
              <div className="wp-full-picker-grid">
                {ALL_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    className="wp-picker-emoji emoji-btn"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("emoji", emoji);
                      handleDragStart(emoji);
                    }}
                    onClick={() => {
                      handleEmojiSelect(emoji);
                    }}
                    title={`Send ${emoji} or drag to a slot`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <p className="wp-picker-hint">Tap to react · Drag to replace a slot</p>
            </div>
          </div>
        )}

        {myEmojis.map((emoji, index) => (
          <button
            key={index}
            className="wp-reaction-btn emoji-btn"
            draggable={false}
            onDrop={(e) => handleDropOnSlot(index, e)}
            onDragOver={handleDragOver}
            onClick={() => handleEmojiSelect(emoji)}
            title={`${emoji} — drag a new emoji here to replace`}
          >
            <span className="wp-reaction-emoji">{emoji}</span>
          </button>
        ))}

        {/* ➕ Redesigned Add/Customise Button */}
        <button
          className={`wa-control-btn wp-add-btn ${showFullPicker ? "active" : ""}`}
          onClick={togglePicker}
          title="Customise reactions"
        >
          <span className="text-xl flex items-center justify-center">
            {showFullPicker ? "✕" : "+"}
          </span>
        </button>
      </div>

      {/* ── ROW 3: Feature buttons ────────────────────────── */}
      <div className="wp-panel wp-feature-row">
        <button
          onClick={onToggleEmojiPicker}
          className={`wa-center-btn emoji-btn relative group ${showEmojiPicker ? "bg-white/10" : ""}`}
          title="More reactions"
        >
          <Smile className="size-5 text-white/80 group-hover:text-white" />
        </button>

        <button
          onClick={toggleHandRaise}
          className={`wa-center-btn ${handState.localRaised ? "bg-white/20 text-white" : "text-white/80 hover:text-white"}`}
          title={handState.localRaised ? "Lower hand" : "Raise hand"}
        >
          <Hand className={`size-5 ${handState.localRaised ? "text-[var(--fallback-p,oklch(var(--p)))]" : ""}`} />
        </button>

        <button
          onClick={onToggleWatchParty}
          className="wa-center-btn bg-[#1976d2] text-white hover:bg-[#1565c0] transition-colors"
          title="Exit Watch Party"
        >
          <MonitorPlay className="size-5 text-white" />
        </button>

        <button onClick={onAddPeople} className="wa-center-btn group" title="Add people">
          <UserPlus className="size-5 text-white/80 group-hover:text-white" />
        </button>

        <button onClick={onNavigateChat} className="wa-center-btn text-white/80 hover:text-white group" title="Open chat">
          <MessageSquare className="size-5" />
        </button>
      </div>
    </div>
  );
};

export default WatchPartyControls;
