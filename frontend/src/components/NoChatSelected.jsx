import { Lock, MessageSquare } from "lucide-react";

const NoChatSelected = () => {
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center select-none relative overflow-hidden"
      style={{ background: "var(--wa-chat-bg, #0B141A)" }}
    >
      {/* ── Subtle dot-grid background pattern ──────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* ── Central content ──────────────────────────────────────────────── */}
      <div className="relative flex flex-col items-center gap-3 text-center px-6 max-w-sm">
        {/* Icon with glow */}
        <div className="relative mb-4">
          <div
            className="absolute inset-0 rounded-full blur-2xl scale-150 opacity-20"
            style={{ background: "#00A884" }}
          />
          <div
            className="relative size-28 rounded-full flex items-center justify-center shadow-2xl"
            style={{ background: "rgba(0,168,132,0.12)", border: "1px solid rgba(0,168,132,0.2)" }}
          >
            <MessageSquare size={52} style={{ color: "#00A884", opacity: 0.8 }} strokeWidth={1.5} />
          </div>
          {/* Badge */}
          <div
            className="absolute -bottom-1 -right-1 size-9 rounded-full flex items-center justify-center shadow-lg text-sm"
            style={{ background: "#00A884" }}
          >
            ✓
          </div>
        </div>

        {/* Heading */}
        <h2 className="text-2xl font-bold tracking-tight" style={{ color: "#E9EDEF" }}>
          Chatty for Web
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: "#8696A0" }}>
          Send and receive messages without keeping your phone online.
          <br />
          Use Chatty on up to 4 linked devices.
        </p>

        {/* Divider + encryption note */}
        <div
          className="flex items-center gap-2 mt-8 text-xs px-4 py-2 rounded-full"
          style={{ background: "rgba(255,255,255,0.04)", color: "#8696A0" }}
        >
          <Lock size={12} />
          <span>Your personal messages are end-to-end encrypted</span>
        </div>
      </div>
    </div>
  );
};

export default NoChatSelected;
