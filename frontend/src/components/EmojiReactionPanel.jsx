import React, { useEffect, useRef } from "react";
import { ALL_EMOJIS } from "../constants/emojis";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

/**
 * EmojiReactionPanel — A premium reaction menu with quick-slots and a full picker.
 * Reuses the emoji data from Watch Party.
 */
const EmojiReactionPanel = ({ onSelect, onClose, isOpen, isSent }) => {
  const panelRef = useRef(null);
  const [showFullPicker, setShowFullPicker] = React.useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      if (!isOpen) setShowFullPicker(false); // Reset when closing
    };
  }, [isOpen, onClose]);

  // Reset full picker state when the panel is opened
  useEffect(() => {
    if (isOpen) setShowFullPicker(false);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      ref={panelRef}
      className={`absolute z-[1000] ${
        isSent ? "right-0" : "left-0"
      } bottom-full mb-2`}
    >
      {/* FULL PICKER (Pop-up above the quick bar) */}
      {showFullPicker && (
        <div className="absolute bottom-[calc(100%+8px)] left-0 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="bg-[#1F2C34] border border-white/10 rounded-3xl shadow-2xl p-3 w-[320px] max-h-[300px] overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-6 gap-1">
              {ALL_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(emoji);
                    onClose();
                  }}
                  className="size-11 flex items-center justify-center text-2xl hover:bg-white/10 rounded-xl transition-all hover:scale-125 active:scale-90"
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div className="mt-2 py-1 text-[10px] text-zinc-500 text-center uppercase tracking-widest font-bold opacity-40">
              Select Emoji
            </div>
          </div>
          {/* Arrow pointing down to the quick bar */}
          <div className="absolute -bottom-1.5 left-6 size-3 bg-[#1F2C34] rotate-45 border-r border-b border-white/10" />
        </div>
      )}

      {/* QUICK REACTION BAR (Always visible base) */}
      <div className="bg-[#1F2C34]/95 backdrop-blur-md border border-white/10 rounded-full shadow-2xl p-1.5 flex items-center gap-1 select-none animate-in fade-in slide-in-from-bottom-2">
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(emoji);
              onClose();
            }}
            className="size-10 flex items-center justify-center text-2xl hover:bg-white/10 rounded-full transition-all hover:scale-125 active:scale-90"
          >
            {emoji}
          </button>
        ))}
        
        {/* PLUS BUTTON */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowFullPicker(!showFullPicker);
          }}
          className={`size-9 flex items-center justify-center text-zinc-400 hover:bg-white/10 hover:text-white rounded-full transition-all ml-1 ${
            showFullPicker ? "bg-primary text-white rotate-45" : "bg-white/5"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="size-5">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
      
      {/* Bottom arrow for the quick bar */}
      <div className={`absolute -bottom-1 size-3 bg-[#1F2C34]/95 rotate-45 border-r border-b border-white/10 ${
        isSent ? "right-4" : "left-4"
      }`} />
    </div>
  );
};

export default EmojiReactionPanel;
