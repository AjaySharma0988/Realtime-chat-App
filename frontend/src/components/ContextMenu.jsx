import { useEffect, useRef, useState } from "react";
import {
  Reply, Copy, CheckSquare, Forward, Download,
  Trash2, X, Pencil,
} from "lucide-react";

const CHAT_ITEMS = [
  { icon: CheckSquare, label: "Select messages", action: "select" },
  { icon: X,           label: "Close chat",      action: "close"  },
];

// ContextMenu now accepts isOwnMessage so "Edit" only shows for the sender
const ContextMenu = ({ x, y, type, isOwnMessage, onClose, onAction }) => {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x, y });

  // Build message items dynamically based on ownership
  const MESSAGE_ITEMS = [
    { icon: Reply,       label: "Reply",           action: "reply"    },
    { icon: Copy,        label: "Copy",            action: "copy"     },
    isOwnMessage && { icon: Pencil, label: "Edit message", action: "edit" },
    { icon: CheckSquare, label: "Select message",  action: "select"   },
    { icon: Forward,     label: "Forward",         action: "forward"  },
    { icon: Download,    label: "Download",        action: "download" },
    null,
    { icon: Trash2, label: "Delete for me", action: "delete", danger: true },
    isOwnMessage && { icon: Trash2, label: "Delete for everyone", action: "delete_everyone", danger: true },
  ].filter(Boolean);

  // Adjust so the menu never overflows the viewport
  useEffect(() => {
    if (!ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    setPos({
      x: Math.min(x, window.innerWidth  - width  - 8),
      y: Math.min(y, window.innerHeight - height - 8),
    });
  }, [x, y]);

  // Close on outside click or ESC
  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown",   onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown",   onKey);
    };
  }, [onClose]);

  const items = type === "message" ? MESSAGE_ITEMS : CHAT_ITEMS;

  return (
    <div
      ref={ref}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
      className="fixed z-[200] min-w-[190px] rounded-xl shadow-2xl bg-base-200 border border-base-300 py-1 overflow-hidden"
      style={{ left: pos.x, top: pos.y, animation: "wa-pop-in 0.1s ease-out" }}
    >
      {items.map((item, i) => {
        if (!item) return <div key={i} className="border-t border-base-300 my-1" />;
        const Icon = item.icon;
        return (
          <button
            key={item.action}
            onClick={() => { onAction(item.action); onClose(); }}
            className={`
              w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors
              ${item.danger
                ? "text-error hover:bg-error/10"
                : "text-base-content hover:bg-base-300"}
            `}
          >
            <Icon className="size-4 flex-shrink-0 opacity-70" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
};

export default ContextMenu;
