import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, Star, Forward, ArrowLeft } from "lucide-react";
import { useEffect, useCallback, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { formatMessageTime } from "../lib/utils";

/**
 * Full-screen media viewer — WhatsApp Web style.
 * Uses createPortal to escape any parent CSS containment.
 *
 * Props:
 *  messages      array     — ordered list of message objects containing images
 *  initialIndex  number    — which message to open first
 *  onClose       () => void
 *  onForward     (msg) => void
 */
const MediaViewer = ({ messages, initialIndex = 0, onClose, onForward }) => {
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0 });

  const currentMsg = messages[index];
  const currentUrl = currentMsg?.image;
  const isSingle = messages.length <= 1;

  const goNext = useCallback(() => {
    if (isSingle) return;
    setIndex((i) => (i + 1) % messages.length);
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, [messages.length, isSingle]);

  const goPrev = useCallback(() => {
    if (isSingle) return;
    setIndex((i) => (i - 1 + messages.length) % messages.length);
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, [messages.length, isSingle]);

  // Keyboard: ESC closes, arrows navigate
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(z + 0.5, 4));
      if (e.key === "-") setZoom((z) => Math.max(z - 0.5, 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goNext, goPrev]);

  // Lock body scroll while viewer is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleWheel = (e) => {
    if (e.deltaY < 0) {
      setZoom(z => Math.min(z + 0.25, 4));
    } else {
      setZoom(z => {
        const newZ = Math.max(z - 0.25, 1);
        if (newZ === 1) setPosition({ x: 0, y: 0 }); // reset center when zoomed completely out
        return newZ;
      });
    }
  };

  const handleMouseDown = (e) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e) => {
    if (!isDragging || zoom <= 1) return;
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (!currentMsg) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex flex-col bg-[#0b141a]/98 select-none backdrop-blur-[2px]"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 text-white bg-transparent h-[60px] z-[100000]">
        
        {/* Left: Back + Sender Info */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <img 
               src={currentMsg.senderPic || "/avatar.png"} 
               className="size-10 rounded-full object-cover" 
               alt="avatar" 
            />
            <div className="flex flex-col justify-center">
              <span className="text-[16px] leading-[21px] font-semibold text-[#e9edef]">
                 {currentMsg._senderName || (currentMsg.senderId ? "Contact" : "You")}
              </span>
              <span className="text-[13px] leading-[20px] text-[#8696a0]">
                 {formatMessageTime(currentMsg.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-6">
          {/* Zoom Controls */}
          {zoom > 1 && (
             <button onClick={() => { setZoom(1); setPosition({x:0, y:0}); }} title="Reset Zoom" className="text-[#aebac1] hover:text-[#e9edef] transition-colors">
               <ZoomOut className="size-6 cursor-pointer" />
             </button>
          )}

          <button className="text-[#aebac1] hover:text-[#e9edef] transition-colors" title="Star">
             <Star className="size-6 cursor-pointer" />
          </button>

          <button onClick={() => onForward?.([currentMsg])} className="text-[#aebac1] hover:text-[#e9edef] transition-colors" title="Forward">
             <Forward className="size-6 cursor-pointer" />
          </button>

          <a
            href={currentUrl}
            download="image.jpg"
            target="_blank"
            rel="noreferrer"
            title="Download"
            className="text-[#aebac1] hover:text-[#e9edef] transition-colors"
          >
            <Download className="size-6 cursor-pointer" />
          </a>

          <button onClick={onClose} className="text-[#aebac1] hover:text-[#e9edef] transition-colors ml-2" title="Close">
            <X className="size-6 cursor-pointer" />
          </button>
        </div>
      </div>

      {/* ── Main image ───────────────────────────────────────────────────── */}
      <div
        className="flex-1 flex flex-col items-center justify-center relative overflow-hidden"
        onClick={handleBackdrop}
        onWheel={handleWheel}
      >
        {/* Prev Arrow */}
        {!isSingle && (
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-6 z-10 p-[10px] rounded-full bg-[#111b21]/70 hover:bg-[#111b21]/90 transition-colors"
          >
            <ChevronLeft className="size-6 text-[#e9edef]" />
          </button>
        )}

        {/* Image Container */}
        <div className="flex-1 w-full flex items-center justify-center relative overflow-hidden" onClick={handleBackdrop}>
           <img
             key={index}
             src={currentUrl}
             alt="Fullscreen View"
             draggable={false}
             className="max-h-[85vh] max-w-[90vw] object-contain mx-auto"
             style={{
               transform: `scale(${zoom}) translate(${position.x/zoom}px, ${position.y/zoom}px)`,
               transition: isDragging ? "none" : "transform 0.2s cubic-bezier(0.1, 0.9, 0.2, 1)",
               cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "zoom-in",
               animation: "wa-pop-in 0.2s ease-out",
             }}
             onClick={(e) => {
               e.stopPropagation();
               if (zoom === 1) setZoom(2);
             }}
             onMouseDown={handleMouseDown}
             onMouseMove={handleMouseMove}
             onMouseUp={handleMouseUp}
           />
        </div>

        {/* Next Arrow */}
        {!isSingle && (
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-6 z-10 p-[10px] rounded-full bg-[#111b21]/70 hover:bg-[#111b21]/90 transition-colors"
          >
            <ChevronRight className="size-6 text-[#e9edef]" />
          </button>
        )}

        {/* Caption */}
        {currentMsg.text && (
          <div className="absolute bottom-[20px] w-full flex justify-center z-20 pointer-events-none">
            <div className="text-[#e9edef] text-[15px] px-4 py-2 font-normal max-w-2xl text-center pointer-events-auto filter drop-shadow-md">
              {currentMsg.text}
            </div>
          </div>
        )}
      </div>

      {/* ── Thumbnail strip (only if more than 1 image) ──────────────────── */}
      {!isSingle && (
        <div className="flex-shrink-0 flex justify-center items-center gap-[6px] px-4 py-3 pb-[30px] overflow-x-auto bg-transparent z-[100000]">
          {messages.map((msg, i) => (
            <button
              key={msg._id}
              onClick={() => { setIndex(i); setZoom(1); setPosition({x:0, y:0}); }}
              className="flex-shrink-0 relative w-[48px] h-[48px] overflow-hidden"
            >
              <img 
                 src={msg.image} 
                 alt="" 
                 className={`w-full h-full object-cover transition-all duration-200 ${
                   i === index ? "border-[3px] border-[#25d366] opacity-100" : "opacity-40 hover:opacity-100"
                 }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  );
};

export default MediaViewer;
