import { X, Edit3, Search, Video, Phone, Star, Bell, Timer, Lock, Shield, Trash2, Ban, Flag } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useCallStore } from "../store/useCallStore";
import { useEffect } from "react";
import { getProfilePicUrl } from "../lib/utils";

const ContactInfoPanel = ({ onClose }) => {
  const { selectedUser, messages } = useChatStore();
  const { onlineUsers } = useAuthStore();
  const { startCall } = useCallStore();

  const isOnline = onlineUsers.includes(selectedUser._id);
  const sharedImages = messages.filter((m) => m.image).map((m) => m.image);

  // Close on ESC key
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const actionBtns = [
    { icon: Search, label: "Search", onClick: null, disabled: false },
    { icon: Video, label: "Video", onClick: () => startCall(selectedUser, "video"), disabled: !isOnline },
    { icon: Phone, label: "Voice", onClick: () => startCall(selectedUser, "audio"), disabled: !isOnline },
  ];

  const settingRows = [
    { icon: Star, label: "Starred messages", sub: null, color: "text-yellow-500", bg: "bg-yellow-500/10" },
    { icon: Bell, label: "Notification settings", sub: null, color: "text-primary", bg: "bg-primary/10" },
    { icon: Timer, label: "Disappearing messages", sub: "Off", color: "text-primary", bg: "bg-primary/10" },
    { icon: Lock, label: "Encryption", sub: "Messages are end-to-end encrypted. Click to verify.", color: "text-primary", bg: "bg-primary/10" },
  ];

  const dangerRows = [
    { icon: Ban, label: `Block ${selectedUser.fullName}`, color: "text-error" },
    { icon: Flag, label: `Report ${selectedUser.fullName}`, color: "text-error" },
    { icon: Trash2, label: "Clear chat", color: "text-error" },
    { icon: Trash2, label: "Delete chat", color: "text-error" },
  ];

  return (
    // Slides in from the right — the `slideInRight` animation is defined in index.css
    <div
      className="w-80 lg:w-96 h-full flex flex-col border-l border-base-300 bg-base-100 flex-shrink-0 overflow-hidden"
      style={{ animation: "slideInRight 0.22s cubic-bezier(0.4,0,0.2,1)" }}
    >
      {/* ── Panel header ─────────────────────────────────────────────── */}
      <div className="h-14 px-4 bg-base-200 border-b border-base-300 flex items-center gap-3 flex-shrink-0">
        <button onClick={onClose} className="p-2 rounded-full hover:bg-base-300 transition-colors">
          <X className="size-5 text-base-content/60" />
        </button>
        <h2 className="flex-1 font-semibold text-base-content">Contact info</h2>
        <button className="p-2 rounded-full hover:bg-base-300 transition-colors" title="Edit">
          <Edit3 className="size-4 text-base-content/60" />
        </button>
      </div>

      {/* ── Scrollable content ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* Profile image + name ------------------------------------------------- */}
        <div className="flex flex-col items-center py-6 px-4 border-b border-base-300 bg-base-100">
          <div className="relative mb-3">
            <img
              src={getProfilePicUrl(selectedUser)}
              alt={selectedUser.fullName}
              className="size-32 rounded-full object-cover ring-4 ring-primary/20 shadow-lg"
            />
            {isOnline && (
              <span className="absolute bottom-2 right-2 size-4 rounded-full bg-success border-2 border-base-100" />
            )}
          </div>
          <h3 className="text-xl font-bold text-base-content text-center leading-tight">
            {selectedUser.fullName}
          </h3>
          <p className={`text-sm mt-1 ${isOnline ? "text-success" : "text-base-content/50"}`}>
            {isOnline ? "● online" : "offline"}
          </p>
        </div>

        {/* Action buttons ------------------------------------------------------ */}
        <div className="grid grid-cols-3 gap-3 p-4 border-b border-base-300">
          {actionBtns.map(({ icon: Icon, label, onClick, disabled }) => (
            <button
              key={label}
              onClick={onClick}
              disabled={disabled}
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-base-200 hover:bg-base-300 transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
            >
              <Icon className="size-5 text-primary" />
              <span className="text-xs text-base-content/70 font-medium">{label}</span>
            </button>
          ))}
        </div>

        {/* About -------------------------------------------------------------- */}
        <div className="px-4 py-4 border-b border-base-300">
          <p className="text-xs text-base-content/50 mb-1.5 font-medium uppercase tracking-wide">About</p>
          <p className="text-sm text-base-content">{selectedUser.about || "Hey there! I'm using Chatty."}</p>
        </div>

        {/* Shared media -------------------------------------------------------- */}
        {sharedImages.length > 0 && (
          <div className="px-4 py-4 border-b border-base-300">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-base-content">Media, links and docs</span>
              <span className="text-xs text-primary font-medium">{sharedImages.length} →</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {sharedImages.slice(0, 5).map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt=""
                  className="size-[72px] rounded-lg object-cover flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                />
              ))}
            </div>
          </div>
        )}

        {/* Settings rows ------------------------------------------------------- */}
        <div className="border-b border-base-300">
          {settingRows.map(({ icon: Icon, label, sub, color, bg }) => (
            <button
              key={label}
              className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-base-200 transition-colors"
            >
              <div className={`size-10 rounded-full ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`size-5 ${color}`} />
              </div>
              <div className="text-left min-w-0">
                <p className="text-sm text-base-content">{label}</p>
                {sub && <p className="text-xs text-base-content/50 mt-0.5 truncate">{sub}</p>}
              </div>
            </button>
          ))}
        </div>

        {/* Danger zone --------------------------------------------------------- */}
        <div className="p-3">
          {dangerRows.map(({ icon: Icon, label, color }) => (
            <button
              key={label}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-error/5 transition-colors ${color}`}
            >
              <Icon className="size-4 flex-shrink-0" />
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ContactInfoPanel;
