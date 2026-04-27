import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Trash2, Eye, ChevronLeft, ChevronRight, Music, Volume2, VolumeX } from "lucide-react";
import { markStatusViewed, deleteStatusById, getStatusViewers } from "../lib/statusService";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useStatusStore } from "../store/useStatusStore";
import MessageInput from "./MessageInput";
import toast from "react-hot-toast";

/**
 * StatusViewer — fullscreen overlay viewer with progress bar, reused chat input, and music.
 */
const IMAGE_DURATION = 5000; // ms

const StatusViewer = ({ statuses: propsStatuses, onClose, onDeleted }) => {
  const { authUser } = useAuthStore();
  const { sendMessage } = useChatStore();
  const { getUserStatuses, viewingUserId } = useStatusStore();

  // Determine which statuses to show
  const statuses = propsStatuses || (viewingUserId ? getUserStatuses(viewingUserId) : []);
  
  const [currentIdx, setCurrentIdx] = useState(0);
  const [progress, setProgress]     = useState(0);       // 0–100
  const [paused, setPaused]         = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isMuted, setIsMuted]       = useState(false);

  // Feature: View Tracking
  const [viewers, setViewers]       = useState([]);
  const [showViewers, setShowViewers] = useState(false);
  const { socket }                  = useAuthStore();

  const timerRef    = useRef(null);   // setInterval id
  const startRef    = useRef(null);   // timestamp when current slide started
  const elapsedRef  = useRef(0);      // ms already consumed (for pause/resume)
  const videoRef    = useRef(null);   // <video> element
  const audioRef    = useRef(null);   // <audio> element for music

  const current = statuses[currentIdx];
  const isOwner = current && authUser?._id === (current.userId?._id || current.userId);

  // ── Mark viewed ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!current) return;
    markStatusViewed(current._id);
    
    // Fetch initial viewers if owner
    if (isOwner) {
      getStatusViewers(current._id).then(setViewers).catch(() => setViewers([]));
    } else {
      setViewers([]);
    }
  }, [current?._id, isOwner]); // eslint-disable-line

  // ── Real-time View Updates ──────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !isOwner) return;

    const handleStatusView = async (data) => {
      if (data.statusId === current?._id) {
        // Refetch or append if we want to be exact
        getStatusViewers(current._id).then(setViewers).catch(() => {});
      }
    };

    socket.on("status:view", handleStatusView);
    return () => socket.off("status:view", handleStatusView);
  }, [socket, isOwner, current?._id]);

  // ── Duration helper ──────────────────────────────────────────────────────
  const getDuration = useCallback(() => {
    if (current?.mediaType === "video" && videoRef.current?.duration) {
      return videoRef.current.duration * 1000;
    }
    return IMAGE_DURATION;
  }, [current]);

  // ── Start/restart the progress timer ─────────────────────────────────────
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    elapsedRef.current = 0;
    startRef.current   = Date.now();

    timerRef.current = setInterval(() => {
      if (!startRef.current) return;
      const total   = getDuration();
      const elapsed = elapsedRef.current + (Date.now() - startRef.current);
      const pct     = Math.min((elapsed / total) * 100, 100);
      setProgress(pct);

      if (pct >= 100) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setCurrentIdx((prev) => {
          if (prev + 1 < statuses.length) return prev + 1;
          onClose?.();
          return prev;
        });
      }
    }, 50);
  }, [getDuration, statuses.length, onClose]);

  // ── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => {
    setProgress(0);
    elapsedRef.current = 0;
    if (!paused) startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIdx, statuses.length]); // eslint-disable-line

  // ── Sync Playback States ──────────────────────────────────────────────────
  useEffect(() => {
    if (!current) return;
    
    if (paused) {
      if (startRef.current) {
        elapsedRef.current += Date.now() - startRef.current;
        startRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      videoRef.current?.pause();
      audioRef.current?.pause();
    } else {
      startRef.current = Date.now();
      startTimer();
      videoRef.current?.play().catch(() => {});
      if (current.music?.url) {
        audioRef.current?.play().catch(() => {});
      }
    }
  }, [paused, currentIdx, current?.music?.url]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      if (current?.music?.url && !paused) {
        console.log("[StatusViewer] Playing music:", current.music.url);
        audioRef.current.src = current.music.url;
        audioRef.current.play().catch(() => {});
      }
    }
  }, [currentIdx]); // Only on index change

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  const goNext = () => {
    if (currentIdx + 1 < statuses.length) setCurrentIdx((p) => p + 1);
    else onClose?.();
  };

  const goPrev = () => {
    if (currentIdx > 0) setCurrentIdx((p) => p - 1);
  };

  const handleDelete = async () => {
    console.log("[StatusViewer] Attempting delete for status:", current?._id);
    try {
      await deleteStatusById(current._id);
      toast.success("Status deleted");
      
      // Update local state immediately
      onDeleted?.(current._id);
      
      if (statuses.length <= 1) {
        onClose?.();
      } else {
        // Shift to previous or next slide
        if (currentIdx >= statuses.length - 1) {
          setCurrentIdx(statuses.length - 2);
        }
      }
      setConfirmDelete(false);
    } catch (err) {
      console.error("[StatusViewer] Delete failed:", err);
      toast.error("Could not delete status");
      setConfirmDelete(false);
    }
  };

  const handleReply = async ({ text, image }) => {
    const messagePayload = {
      text: text,
      image: image,
      type: "status-reply",
      receiverId: current.userId?._id || current.userId,
      statusRef: {
        statusId: current._id,
        mediaUrl: current.mediaUrl,
        mediaType: current.mediaType,
        caption: current.caption,
        userId: current.userId?._id || current.userId, // Ensure owner ID is preserved
      }
    };

    console.log("[StatusViewer] Sending reply:", messagePayload);

    try {
      await sendMessage(messagePayload);
      toast.success("Reply sent!");
      setPaused(false);
    } catch (error) {
      console.error("[StatusViewer] Reply failed:", error);
      toast.error("Failed to send reply");
    }
  };

  if (!current) return null;

  const user = current.userId;
  const displayName = user?.fullName || "Unknown";
  const avatar      = user?.profilePic || "/avatar.png";

  const S = {
    overlay: {
      position: "fixed",
      inset: 0,
      zIndex: 10000,
      background: "#000",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      userSelect: "none",
    },
    topGradient: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: "140px",
      background: "linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)",
      zIndex: 5,
      pointerEvents: "none",
    },
    bottomGradient: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: "200px",
      background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)",
      zIndex: 5,
      pointerEvents: "none",
    },
    progressRow: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      display: "flex",
      gap: "4px",
      padding: "12px 12px 0",
      zIndex: 10,
    },
    trackBg: {
      flex: 1,
      height: "2px",
      borderRadius: "999px",
      background: "rgba(255,255,255,0.25)",
      overflow: "hidden",
    },
    fill: (pct) => ({
      height: "100%",
      width: `${pct}%`,
      background: "#fff",
      borderRadius: "999px",
      transition: "width 50ms linear",
    }),
    header: {
      position: "absolute",
      top: "26px",
      left: 0,
      right: 0,
      display: "flex",
      alignItems: "center",
      padding: "0 16px",
      gap: "12px",
      zIndex: 10,
    },
    mediaWrapper: {
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
    },
    replyContainer: {
      position: "absolute",
      bottom: "10px",
      left: 0,
      right: 0,
      zIndex: 20,
    },
    musicBadge: {
      position: "absolute",
      top: "80px",
      left: "16px",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      background: "rgba(0,0,0,0.4)",
      padding: "6px 12px",
      borderRadius: "20px",
      color: "#fff",
      fontSize: "0.8rem",
      zIndex: 10,
      backdropFilter: "blur(4px)",
      maxWidth: "240px",
    },
    navBtn: {
      position: "absolute",
      top: "50%",
      transform: "translateY(-50%)",
      background: "rgba(255,255,255,0.1)",
      border: "none",
      borderRadius: "50%",
      width: "50px",
      height: "50px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      cursor: "pointer",
      zIndex: 30,
      transition: "all 0.2s ease",
      backdropFilter: "blur(12px)",
      boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
    },
    confirmBox: {
      position: "fixed",
      top: "12%",
      left: "0",
      right: "0",
      zIndex: 12000,
      display: "flex",
      justifyContent: "center",
      alignItems: "flex-start",
      pointerEvents: "none",
    },
  };

  const viewerContent = (
    <div style={S.overlay} onContextMenu={(e) => e.preventDefault()}>
      <div style={S.topGradient} />
      <div style={S.bottomGradient} />
      
      {/* ── Progress segments ─────────────────────────────────────────── */}
      <div style={S.progressRow}>
        {statuses.map((_, i) => (
          <div key={i} style={S.trackBg}>
            <div style={S.fill(i < currentIdx ? 100 : i === currentIdx ? progress : 0)} />
          </div>
        ))}
      </div>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div style={S.header}>
        <img
          src={avatar}
          alt={displayName}
          style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", border: "1.5px solid rgba(255,255,255,0.8)" }}
        />
        <div style={{ flex: 1 }}>
          <p style={{ color: "#fff", fontWeight: 700, fontSize: "0.9rem", letterSpacing: "0.01em" }}>
            {displayName}
          </p>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem", marginTop: "1px" }}>
            {timeAgo(current.createdAt)}
          </p>
        </div>

        <button onClick={() => setIsMuted(!isMuted)} className="p-2 text-white/80 hover:text-white transition-colors">
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>

        {isOwner && (
          <button 
            onClick={() => { setPaused(true); setShowViewers(true); }}
            style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.1)", padding: "4px 10px", borderRadius: "12px" }}
            className="hover:bg-white/20 transition-all active:scale-95"
          >
            <Eye size={14} />
            {viewers?.length ?? 0}
          </button>
        )}

        {isOwner && (
          <button onClick={() => { setPaused(true); setConfirmDelete(true); }} className="hover:bg-white/10 p-2 rounded-full transition-colors text-error">
            <Trash2 size={20} />
          </button>
        )}

        <button onClick={onClose} className="hover:bg-white/10 p-2 rounded-full transition-colors text-white">
          <X size={24} />
        </button>
      </div>

      {/* ── Hidden Audio Engine ────────────────────────────────────────── */}
      <audio 
        ref={audioRef} 
        loop 
        muted={isMuted} 
        style={{ display: "none" }}
        preload="auto"
      />

      {/* ── Music Badge ───────────────────────────────────────────────── */}
      {current.music && (
        <div style={S.musicBadge}>
          <Music size={14} className="animate-pulse text-primary" />
          <marquee scrollamount="3" style={{ flex: 1 }}>{current.music.title || "Unknown Track"}</marquee>
        </div>
      )}

      {/* ── Media ─────────────────────────────────────────────────────── */}
      <div style={S.mediaWrapper} onClick={() => setPaused((p) => !p)}>
        {current.mediaType === "video" ? (
          <video
            ref={videoRef}
            src={current.mediaUrl}
            autoPlay
            playsInline
            muted={isMuted}
            onLoadedMetadata={() => { if (!paused) startTimer(); }}
            style={{ maxHeight: "100vh", maxWidth: "100vw", objectFit: "contain" }}
          />
        ) : (
          <img
            src={current.mediaUrl}
            alt="Status"
            style={{ maxHeight: "100vh", maxWidth: "100vw", objectFit: "contain" }}
          />
        )}
      </div>

      {current.caption && (
        <div className="absolute bottom-[100px] left-0 right-0 text-center px-8 z-10 pointer-events-none">
          <p className="text-white text-base font-medium drop-shadow-2xl bg-black/20 backdrop-blur-sm inline-block px-4 py-2 rounded-xl">
            {current.caption}
          </p>
        </div>
      )}

      {/* ── Unified Reply Bar (Reusing Chat Input) ────────────────────── */}
      {!isOwner && (
        <div style={S.replyContainer}>
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
          <MessageInput 
            isOverlayMode={true} 
            isTransparent={true}
            hideAttachment={true}
            onSend={handleReply}
          />
        </div>
      )}

      {/* ── Nav ───────────────────────────────────────────────────────── */}
      {currentIdx > 0 && (
        <button 
          onClick={(e) => { e.stopPropagation(); goPrev(); }} 
          style={{ ...S.navBtn, left: "24px" }}
          className="hover:bg-white/20 active:scale-90 transition-all group/nav"
        >
          <ChevronLeft size={32} strokeWidth={2.5} className="group-hover/nav:-translate-x-0.5 transition-transform" />
        </button>
      )}
      {currentIdx < statuses.length - 1 && (
        <button 
          onClick={(e) => { e.stopPropagation(); goNext(); }} 
          style={{ ...S.navBtn, right: "24px" }}
          className="hover:bg-white/20 active:scale-90 transition-all group/nav"
        >
          <ChevronRight size={32} strokeWidth={2.5} className="group-hover/nav:translate-x-0.5 transition-transform" />
        </button>
      )}

      {/* ── Confirm Delete ────────────────────────────────────────────── */}
      {confirmDelete && (
        <div style={S.confirmBox} onClick={(e) => e.stopPropagation()}>
          <div className="bg-base-300 p-6 rounded-3xl max-w-sm w-[90%] text-center shadow-2xl border border-base-content/10 pointer-events-auto animate-in fade-in zoom-in duration-200">
            <div className="size-16 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} className="text-error" />
            </div>
            <h3 className="text-xl font-bold mb-2">Delete Status?</h3>
            <p className="text-base-content/60 text-sm mb-6">This will remove your status for everyone. You can't undo this.</p>
            <div className="flex gap-3">
              <button onClick={() => { setConfirmDelete(false); setPaused(false); }} className="btn btn-ghost flex-1 rounded-2xl">Cancel</button>
              <button onClick={handleDelete} className="btn btn-error flex-1 rounded-2xl">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Viewers List Modal ─────────────────────────────────────────── */}
      {showViewers && (
        <div 
          className="fixed inset-0 z-[11000] bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center"
          onClick={() => { setShowViewers(false); setPaused(false); }}
        >
          <div 
            className="bg-[#1c1c1e] w-full sm:max-w-md max-h-[70vh] rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-lg font-bold">Seen by {viewers.length}</h3>
              <button onClick={() => { setShowViewers(false); setPaused(false); }} className="p-2 hover:bg-white/5 rounded-full">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
              {viewers.length > 0 ? (
                viewers.map((v, i) => (
                  <div key={v._id || i} className="flex items-center gap-4 p-3 hover:bg-white/5 rounded-2xl transition-colors">
                    <img 
                      src={v.userId?.profilePic || "/avatar.png"} 
                      className="size-12 rounded-full object-cover border border-white/10" 
                      alt={v.userId?.fullName}
                    />
                    <div className="flex-1">
                      <p className="font-bold text-sm">{v.userId?.fullName || "Deleted User"}</p>
                      <p className="text-xs text-white/40">{timeAgo(v.viewedAt)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center text-white/30">
                  <Eye size={48} className="mx-auto mb-4 opacity-10" />
                  <p>No views yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(viewerContent, document.body);
};

const timeAgo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m    = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export default StatusViewer;
