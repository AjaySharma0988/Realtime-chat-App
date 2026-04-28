import { useState, useRef, useEffect, useCallback } from "react";
import {
  X, Phone, Video, Search, MoreVertical, Info,
  BellOff, Timer, Heart, Bookmark, Flag, Ban,
  Trash2, CheckSquare, Eraser, ChevronDown,
} from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useCallStore } from "../store/useCallStore";
import toast from "react-hot-toast";
import { getProfilePicUrl } from "../lib/utils";

const CALL_DEBOUNCE_MS = 1500;

// ── Tiny CSS tooltip (300ms hover delay, no library needed) ────────────────
const Tip = ({ label, children }) => (
  <div className="relative group/tip">
    {children}
    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-neutral rounded-md whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity delay-300 z-50 shadow-lg">
      {label}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-neutral" />
    </div>
  </div>
);

const ChatHeader = ({ onOpenContactPanel, onSearchToggle, isSearchOpen, onDeleteChat }) => {
  const { selectedUser, setSelectedUser } = useChatStore();
  const { onlineUsers } = useAuthStore();
  const { startCall, activeCall, outgoingCall, incomingCall } = useCallStore();

  const [showMenu, setShowMenu] = useState(false);
  const [showCallDrop, setShowCallDrop] = useState(false);
  const [ripplePos, setRipplePos] = useState(null);

  const menuRef = useRef(null);
  const callRef = useRef(null);
  const debouncing = useRef(false);

  const isOnline = onlineUsers.includes(selectedUser._id);
  const alreadyInCall = !!(activeCall || outgoingCall || incomingCall);
  // Block the button only while already in a call.
  // Offline users: still allow click — server emits `call-user-offline` with a toast.
  const callDisabled = alreadyInCall;

  // Close dropdowns on outside click
  useEffect(() => {
    const h = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
      if (callRef.current && !callRef.current.contains(e.target)) setShowCallDrop(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ESC closes everything
  useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") { setShowMenu(false); setShowCallDrop(false); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // Debounced call initiator — guards duplicate calls while one is in progress
  const initiateCall = useCallback((type) => {
    if (debouncing.current || alreadyInCall) return;
    debouncing.current = true;
    setTimeout(() => { debouncing.current = false; }, CALL_DEBOUNCE_MS);
    setShowCallDrop(false);
    startCall(selectedUser, type);
  }, [selectedUser, startCall, alreadyInCall]);

  // Click ripple on call button
  const handleCallClick = (e, type) => {
    const r = e.currentTarget.getBoundingClientRect();
    setRipplePos({ x: e.clientX - r.left, y: e.clientY - r.top });
    setTimeout(() => setRipplePos(null), 600);
    initiateCall(type);
  };

  // Menu items — Delete chat is wired to onDeleteChat prop
  const menuItems = [
    { icon: Info, label: "Contact info", action: () => onOpenContactPanel?.() },
    { icon: Search, label: "Search", action: () => onSearchToggle?.() },
    { icon: CheckSquare, label: "Select messages", action: null },
    { icon: BellOff, label: "Mute notifications", action: null },
    { icon: Timer, label: "Disappearing messages", action: null },
    { icon: Heart, label: "Add to favourites", action: null },
    { icon: Bookmark, label: "Add to list", action: null },
    { icon: X, label: "Close chat", action: () => setSelectedUser(null) },
    null,
    { icon: Flag, label: "Report", action: null },
    { icon: Ban, label: "Block", action: null },
    { icon: Eraser, label: "Clear chat", action: null, danger: true },
    { icon: Trash2, label: "Delete chat", action: () => onDeleteChat?.(), danger: true },
  ];

  return (
    /* ── ALIGNMENT: flex row, items vertically centred, space-between ── */
    <div className="h-14 px-4 bg-base-200 border-b border-base-300 flex items-center justify-between flex-shrink-0 gap-2">

      {/* ── LEFT: Avatar + Name + Status ────────────────────────────────── */}
      <button
        onClick={() => onOpenContactPanel?.()}
        className="flex items-center gap-3 hover:opacity-80 transition-opacity min-w-0 flex-1 text-left"
      >
        {/* Avatar with real-time online dot */}
        <div className="relative flex-shrink-0">
          <img
            src={getProfilePicUrl(selectedUser)}
            alt={selectedUser.fullName}
            className="size-9 rounded-full object-cover"
          />
          <span
            className={`
              absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-base-200 transition-colors duration-300
              ${isOnline ? "bg-success" : "bg-base-content/20"}
            `}
          />
        </div>

        {/* Name + status — truncated so it never overflows */}
        <div className="min-w-0 leading-tight">
          <p className="font-semibold text-sm text-base-content truncate">
            {selectedUser.fullName}
          </p>
          <p className={`text-xs ${isOnline ? "text-success" : "text-base-content/45"}`}>
            {isOnline ? "online" : "offline"}
          </p>
        </div>
      </button>

      {/* ── RIGHT: Icons group — equal gap, all vertically centred ──────── */}
      <div className="flex items-center gap-1 flex-shrink-0">

        {/* ── WhatsApp-style "📹 Call ▾" compound button ─────────────────
            • Main area → video call immediately
            • ▾ arrow  → dropdown to choose voice OR video
        ────────────────────────────────────────────────────────────────── */}
        <div className="relative" ref={callRef}>
          <div
            className={`
              flex items-center rounded-lg border border-base-300 overflow-visible
              ${callDisabled ? "opacity-40 cursor-not-allowed" : ""}
            `}
          >
            {/* Main click = video call */}
            <Tip label={callDisabled ? "Already in a call" : isOnline ? "Start video call" : "Start video call (user may be offline)"}>
              <button
                disabled={callDisabled}
                onClick={(e) => handleCallClick(e, "video")}
                className="relative flex items-center gap-1.5 pl-3 pr-2 py-1.5 hover:bg-base-300 rounded-l-lg transition-colors overflow-hidden disabled:pointer-events-none"
              >
                {/* Ripple */}
                {ripplePos && (
                  <span
                    className="absolute rounded-full bg-primary/25 pointer-events-none"
                    style={{ left: ripplePos.x - 16, top: ripplePos.y - 16, width: 32, height: 32, animation: "ripple 0.6s ease-out forwards" }}
                  />
                )}
                <Video className="size-4 text-base-content/60 flex-shrink-0" />
                <span className="text-xs font-medium text-base-content/70 hidden sm:block">Call</span>
              </button>
            </Tip>

            {/* Dropdown arrow */}
            <Tip label="More call options">
              <button
                disabled={callDisabled}
                onClick={() => setShowCallDrop((v) => !v)}
                className="px-1.5 py-1.5 hover:bg-base-300 rounded-r-lg border-l border-base-300 transition-colors disabled:pointer-events-none"
              >
                <ChevronDown className={`size-3.5 text-base-content/50 transition-transform ${showCallDrop ? "rotate-180" : ""}`} />
              </button>
            </Tip>
          </div>

          {/* Call type dropdown */}
          {showCallDrop && (
            <div className="absolute right-0 top-11 w-56 rounded-xl shadow-2xl bg-base-200 border border-base-300 overflow-hidden z-50" style={{ animation: "wa-pop-in 0.12s ease-out" }}>
              <button onClick={() => initiateCall("audio")} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-base-300 transition-colors text-left">
                <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0"><Phone className="size-4 text-primary" /></div>
                <div><p className="text-sm font-medium text-base-content">Voice call</p><p className="text-xs text-base-content/50">Microphone only</p></div>
              </button>
              <div className="border-t border-base-300" />
              <button onClick={() => initiateCall("video")} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-base-300 transition-colors text-left">
                <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0"><Video className="size-4 text-primary" /></div>
                <div><p className="text-sm font-medium text-base-content">Video call</p><p className="text-xs text-base-content/50">Camera + microphone</p></div>
              </button>
            </div>
          )}
        </div>

        {/* ── Search ─────────────────────────────────────────────────────── */}
        <Tip label="Search messages">
          <button
            onClick={() => onSearchToggle?.()}
            className={`p-2 rounded-full transition-colors ${isSearchOpen ? "bg-primary/15 text-primary" : "hover:bg-base-300 text-base-content/60"}`}
          >
            <Search className="size-5" />
          </button>
        </Tip>

        {/* ── Three-dot menu ──────────────────────────────────────────────── */}
        <div className="relative" ref={menuRef}>
          <Tip label="More options">
            <button
              onClick={() => setShowMenu((v) => !v)}
              className={`p-2 rounded-full transition-colors ${showMenu ? "bg-base-300" : "hover:bg-base-300 text-base-content/60"}`}
            >
              <MoreVertical className="size-5" />
            </button>
          </Tip>

          {showMenu && (
            <div className="absolute right-0 top-11 w-60 rounded-xl shadow-2xl bg-base-200 border border-base-300 overflow-hidden z-50" style={{ animation: "wa-pop-in 0.12s ease-out" }}>
              {menuItems.map((item, idx) => {
                if (item === null) return <div key={`d-${idx}`} className="border-t border-base-300 my-1" />;
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={() => { setShowMenu(false); item.action?.(); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors ${item.danger ? "text-error hover:bg-error/10" : "text-base-content hover:bg-base-300"}`}
                  >
                    <Icon className="size-4 flex-shrink-0 opacity-70" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;
