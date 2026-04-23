import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download } from "lucide-react";
import { useEffect, useCallback, useState } from "react";

/**
 * Full-screen image viewer — WhatsApp Web style.
 *
 * Props:
 *  images        string[]  — ordered list of image URLs to browse
 *  initialIndex  number    — which image to open first
 *  onClose       () => void
 */
const ImageViewer = ({ images, initialIndex = 0, onClose }) => {
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const current = images[index];

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % images.length);
    setZoom(1);
  }, [images.length]);

  const goPrev = useCallback(() => {
    setIndex((i) => (i - 1 + images.length) % images.length);
    setZoom(1);
  }, [images.length]);

  // Keyboard: ESC closes, arrows navigate, +/- zoom
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(z + 0.5, 4));
      if (e.key === "-") setZoom((z) => Math.max(z - 0.5, 0.5));
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

  // Close when clicking the dark backdrop (not the image itself)
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col"
      style={{ background: "rgba(11, 20, 26, 0.97)" }}
    >
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 py-3"
        style={{ background: "#1F2C34" }}
      >
        {/* Counter */}
        <span className="text-sm font-medium" style={{ color: "#8696A0" }}>
          {index + 1} / {images.length}
        </span>

        {/* Controls */}
        <div className="flex items-center gap-1">
          <button
            title="Zoom out (−)"
            onClick={() => setZoom((z) => Math.max(z - 0.5, 0.5))}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <ZoomOut className="size-5" style={{ color: "#8696A0" }} />
          </button>
          <span className="text-xs px-2" style={{ color: "#8696A0" }}>
            {Math.round(zoom * 100)}%
          </span>
          <button
            title="Zoom in (+)"
            onClick={() => setZoom((z) => Math.min(z + 0.5, 4))}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <ZoomIn className="size-5" style={{ color: "#8696A0" }} />
          </button>

          {/* Download */}
          <a
            href={current}
            download
            target="_blank"
            rel="noreferrer"
            title="Download"
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <Download className="size-5" style={{ color: "#8696A0" }} />
          </a>

          {/* Close */}
          <button
            title="Close (Esc)"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="size-5" style={{ color: "#E9EDEF" }} />
          </button>
        </div>
      </div>

      {/* ── Main image ───────────────────────────────────────────────────── */}
      <div
        className="flex-1 flex items-center justify-center relative overflow-hidden select-none"
        onClick={handleBackdrop}
      >
        {/* Prev */}
        {images.length > 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-4 z-10 p-2 rounded-full transition-colors hover:bg-white/10"
            title="Previous (←)"
          >
            <ChevronLeft className="size-9 text-white" />
          </button>
        )}

        {/* Image */}
        <img
          key={index}  /* re-mounts on index change for fade-in */
          src={current}
          alt={`Image ${index + 1} of ${images.length}`}
          draggable={false}
          style={{
            transform: `scale(${zoom})`,
            transition: "transform 0.2s ease",
            maxWidth: "80vw",
            maxHeight: "78vh",
            objectFit: "contain",
            borderRadius: "6px",
            cursor: zoom > 1 ? "zoom-out" : "zoom-in",
            animation: "wa-pop-in 0.15s ease-out",
          }}
          onClick={(e) => {
            e.stopPropagation();
            setZoom((z) => (z > 1 ? 1 : 2)); // toggle zoom on click
          }}
        />

        {/* Next */}
        {images.length > 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-4 z-10 p-2 rounded-full transition-colors hover:bg-white/10"
            title="Next (→)"
          >
            <ChevronRight className="size-9 text-white" />
          </button>
        )}
      </div>

      {/* ── Thumbnail strip (only if more than 1 image) ──────────────────── */}
      {images.length > 1 && (
        <div
          className="flex-shrink-0 flex items-center gap-2 px-4 py-3 overflow-x-auto"
          style={{ background: "#0B141A" }}
        >
          {images.map((src, i) => (
            <button
              key={i}
              onClick={() => { setIndex(i); setZoom(1); }}
              className="flex-shrink-0 rounded-lg overflow-hidden transition-all duration-150"
              style={{
                width: "56px",
                height: "56px",
                outline: i === index ? "2px solid #00A884" : "2px solid transparent",
                filter: i === index ? "none" : "brightness(0.45)",
              }}
            >
              <img src={src} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageViewer;
