import React, { useEffect, useRef } from "react";
import { ALL_EMOJIS } from "../constants/emojis";

/**
 * EmojiPicker — A premium emoji picker for the message input field.
 */
const EmojiPicker = ({ onSelect, onClose, isOpen }) => {
  const pickerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      // Don't close if clicking the trigger button (handled by the parent)
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      ref={pickerRef}
      className="absolute bottom-full mb-4 left-0 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-200"
    >
      <div className="bg-[#233138] border border-white/10 rounded-2xl shadow-2xl p-3 w-[320px] max-h-[350px] overflow-hidden flex flex-col">
        <div className="text-[11px] text-zinc-500 font-bold uppercase tracking-widest mb-3 px-1 opacity-60">
          Emojis
        </div>
        
        <div className="grid grid-cols-7 gap-1 overflow-y-auto custom-scrollbar pr-1">
          {ALL_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(emoji);
              }}
              className="size-10 flex items-center justify-center text-2xl hover:bg-white/5 rounded-xl transition-all hover:scale-125 active:scale-95"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
      
      {/* Decorative arrow pointing to the Smile button */}
      <div className="absolute -bottom-1.5 left-[56px] size-3 bg-[#233138] rotate-45 border-r border-b border-white/10" />
    </div>
  );
};

export default EmojiPicker;
