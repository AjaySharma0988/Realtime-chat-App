import React from "react";
import { useAuthStore } from "../store/useAuthStore";

/**
 * MessageReactions — Displays emojis people have reacted with.
 */
const MessageReactions = ({ reactions, onReact, isSent, onOpenPicker }) => {
  if (!reactions || reactions.length === 0) return null;

  const { authUser } = useAuthStore();

  // Group reactions by emoji
  const grouped = reactions.reduce((acc, curr) => {
    acc[curr.emoji] = (acc[curr.emoji] || 0) + 1;
    return acc;
  }, {});

  const emojiKeys = Object.keys(grouped);
  const totalCount = reactions.length;

  return (
    <div 
      className={`absolute -bottom-4 z-10 transition-all hover:scale-110 cursor-pointer select-none ${
        isSent ? "right-2" : "left-2"
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onOpenPicker?.();
      }}
    >
      <div className={`
        flex items-center justify-center bg-[#1F2C34] border border-white/10 shadow-lg 
        ${totalCount === 1 ? "size-7 rounded-full" : "h-7 px-2 rounded-full gap-1"}
      `}>
        <div className="flex -space-x-1">
          {emojiKeys.slice(0, 3).map((emoji) => (
            <span key={emoji} className="text-[15px] leading-none drop-shadow-sm">
              {emoji}
            </span>
          ))}
        </div>
        
        {totalCount > 1 && (
          <span className="text-[10px] font-bold text-zinc-400 pr-0.5">
            {totalCount}
          </span>
        )}
      </div>
    </div>
  );
};

export default MessageReactions;
