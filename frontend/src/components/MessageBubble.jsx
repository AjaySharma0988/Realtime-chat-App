import { Check, CheckCheck, Mic, Video, Phone, Clock, RotateCw, Ban } from "lucide-react";
import { formatMessageTime } from "../lib/utils";

// ── Search highlight ─────────────────────────────────────────────────────────
const HighlightText = ({ text, query }) => {
  if (!query?.trim() || !text) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  const lower = query.toLowerCase();
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === lower
          ? <mark key={i} className="bg-yellow-300 text-zinc-900 rounded-sm px-0.5">{part}</mark>
          : part
      )}
    </>
  );
};

// ── Reply quote ─────────────────────────────────────────────────────────────
const ReplyQuote = ({ replyTo, onScrollTo }) => {
  if (!replyTo?.messageId) return null;
  const msgId = replyTo.messageId?.toString?.() ?? replyTo.messageId;
  return (
    <div
      className="bg-black/5 dark:bg-white/5 border-l-[3px] border-[oklch(var(--p))] rounded p-2 mb-1.5 cursor-pointer"
      onClick={(e) => { e.stopPropagation(); onScrollTo(msgId); }}
    >
      <p className="text-[11px] font-bold text-[oklch(var(--p))] mb-0.5 leading-tight">
        {replyTo.senderName || "Unknown"}
      </p>
      <p className="text-[12px] opacity-70 overflow-hidden text-ellipsis whitespace-nowrap leading-tight">
        {replyTo.image ? "📷 Photo" : replyTo.text || "This message was deleted"}
      </p>
    </div>
  );
};

export const MessageBubble = ({
  message,
  selectedUser,
  isSent,
  isMatch,
  isCurrentMatch,
  isHighlighted,
  isSelected,
  isEditing,
  isSelectMode,
  searchQuery,
  editStateText,
  setEditStateText,
  onSaveEdit,
  onCancelEdit,
  onToggleSelect,
  onContextMenu,
  onLongPress,
  onReleasePress,
  onScrollToReply,
  onImageClick,
  onRetryMessage
}) => {
  return (
    <div
      className={`flex items-start gap-2 px-[4%] py-[2px] transition-colors ${isSent ? "flex-row-reverse" : "flex-row"
        } ${isSelected ? "bg-primary/10" : isHighlighted ? "bg-base-300/60" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        if (isSelectMode) onToggleSelect(message._id);
      }}
      onContextMenu={(e) => onContextMenu(e, message)}
      onMouseDown={() => onLongPress(message)}
      onMouseUp={onReleasePress}
      onMouseLeave={onReleasePress}
    >
      {/* Checkbox (if in selection mode) */}
      {isSelectMode && (
        <div className={`mt-2 size-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSelected ? "bg-primary border-primary" : "border-base-content/30"
          }`}>
          {isSelected && <div className="size-2.5 rounded-full bg-white" />}
        </div>
      )}

      {/* Avatar (Incoming only) */}
      {!isSent && (
        <img
          src={selectedUser.profilePic || "/avatar.png"}
          alt=""
          className="size-7 rounded-full object-cover mt-1 flex-shrink-0"
        />
      )}

      {/* ── BUBBLE CONTAINER ──────────────────────────── */}
      <div
        className={`relative flex flex-col max-w-[65%] shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] transition-all ${isCurrentMatch ? "ring-2 ring-primary ring-offset-1" : isMatch ? "ring-1 ring-primary/40" : ""
          }`}
        style={{
          background: isSent ? "var(--bubble-sent-bg)" : "var(--bubble-received-bg)",
          color: isSent ? "var(--bubble-sent-text)" : "var(--bubble-received-text)",
          borderTopRightRadius: isSent ? "2px" : "12px",
          borderTopLeftRadius: isSent ? "12px" : "2px",
          borderBottomRightRadius: "12px",
          borderBottomLeftRadius: "12px",
          padding: "4px 8px"
        }}
      >
        <ReplyQuote replyTo={message.replyTo} onScrollTo={onScrollToReply} />

        {/* IMAGE */}
        {message.image && (
          <div className="relative mt-0.5">
            <img
              src={message.image}
              alt="attachment"
              onClick={(e) => { e.stopPropagation(); onImageClick(message.image); }}
              className="rounded-lg w-full max-w-[240px] cursor-pointer hover:opacity-95 transition-opacity"
            />
          </div>
        )}

        {/* AUDIO */}
        {message.audio && (
          <div className="flex items-center gap-2 py-1 min-w-[200px] mt-1">
            <button className="p-2 rounded-full flex-shrink-0 opacity-80 hover:opacity-100 bg-base-content/10">
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M8 5v14l11-7z"></path>
              </svg>
            </button>
            <div className="flex-1 h-8 rounded bg-base-content/10 relative overflow-hidden flex items-center px-2">
              <div className="w-full h-1 bg-base-content/20 rounded-full overflow-hidden">
                <div className="w-0 h-full bg-base-content/80"></div>
              </div>
            </div>
            <div className="w-[42px] h-[42px] rounded-full overflow-hidden flex-shrink-0 bg-base-300">
              <img src={isSent ? "/avatar.png" : (selectedUser?.profilePic || "/avatar.png")} className="w-full h-full object-cover" />
            </div>
          </div>
        )}

        {/* CALL */}
        {message.type === "call" && (
          <div className="flex items-center gap-3 py-1 pr-6 pb-3">
            <div className={`p-2.5 rounded-full flex-shrink-0 ${(!isSent && (message.callStatus === "missed" || message.callStatus === "rejected"))
                ? "text-error bg-error/10"
                : "opacity-90 bg-base-content/10"
              }`}>
              {message.callType === "video" ? <Video className="size-5" /> : <Phone className="size-5" />}
            </div>
            <div className="flex flex-col">
              <span className="font-medium text-[15px]">{message.callType === "video" ? "Video call" : "Voice call"}</span>
              <span className={`text-[13px] mt-0.5 ${(!isSent && (message.callStatus === "missed" || message.callStatus === "rejected"))
                  ? "text-error opacity-90 font-medium"
                  : "opacity-70"
                }`}>
                {message.callStatus === "missed"
                  ? (isSent ? "No answer" : "Missed")
                  : message.callStatus === "rejected"
                    ? "Declined"
                    : (message.callDuration && message.callDuration > 0
                      ? (message.callDuration < 60 ? `${message.callDuration}s` : `${Math.floor(message.callDuration / 60)}m ${message.callDuration % 60}s`)
                      : "Ended")
                }
              </span>
            </div>
          </div>
        )}

        {/* TEXT / EDITING */}
        {isEditing ? (
          <div className="flex items-center gap-1.5 min-w-[160px] pb-1 mt-1">
            <input
              autoFocus
              value={editStateText}
              onChange={(e) => setEditStateText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSaveEdit(); }
                if (e.key === "Escape") onCancelEdit();
              }}
              className="flex-1 bg-transparent border-b border-black/20 dark:border-white/20 outline-none text-[14.2px] py-0.5"
              style={{ color: "inherit" }}
            />
          </div>
        ) : message.isDeletedForEveryone ? (
          <div className="text-[14.2px] pt-[2px] leading-relaxed break-words pr-12 pb-3 opacity-60 italic flex items-center gap-1.5 mt-1">
            <Ban className="size-[15px]" />
            This message was deleted
          </div>
        ) : (
          message.text && (
            <div className="text-[14.2px] pt-[2px] leading-relaxed break-words whitespace-pre-wrap pr-12 pb-3">
              <HighlightText text={message.text} query={searchQuery} />
              {message.isEdited && (
                <span className="text-[10px] opacity-50 ml-1 italic">(edited)</span>
              )}
            </div>
          )
        )}

        <div
          className="absolute bottom-1 right-2 flex items-center justify-end gap-[3px] text-[11px]"
          style={{ color: "var(--bubble-meta-color, #8696A0)" }}
        >
          <span>{formatMessageTime(message.createdAt)}</span>
          {isSent && (
            <div 
              className={`flex-shrink-0 pb-[1px] ${message.status === "failed" ? "cursor-pointer pointer-events-auto" : ""}`}
              onClick={(e) => {
                if (message.status === "failed") {
                  e.stopPropagation();
                  onRetryMessage?.(message);
                }
              }}
            >
              {message.status === "failed" ? (
                <RotateCw className="size-[12px] text-error hover:rotate-180 transition-transform" />
              ) : message.status === "pending" ? (
                <Clock className="size-[12px] opacity-60" />
              ) : message.status === "seen" ? (
                <CheckCheck className="size-[14px] text-info" />
              ) : message.status === "delivered" ? (
                <CheckCheck className="size-[14px] opacity-60" />
              ) : (
                <Check className="size-[14px] opacity-60" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
