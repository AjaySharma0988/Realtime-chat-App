import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useThemeStore } from "../store/useThemeStore";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import MediaViewer from "./MediaViewer";
import ContactInfoPanel from "./ContactInfoPanel";
import ContextMenu from "./ContextMenu";
import SelectActionBar from "./SelectActionBar";
import ForwardModal from "./ForwardModal";
import { MessageBubble } from "./MessageBubble";
import CameraOverlay from "./CameraOverlay";

import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";
import {
  Mic, Search, ChevronUp, ChevronDown, X, AlertTriangle,
  Phone, Video, Check, CheckCheck,
} from "lucide-react";
import toast from "react-hot-toast";

// ── Search highlight ─────────────────────────────────────────────────────────
const HighlightText = ({ text, query }) => {
  if (!query.trim() || !text) return <>{text}</>;
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
    <div className="reply-quote" onClick={(e) => { e.stopPropagation(); onScrollTo(msgId); }}>
      <p style={{ fontSize: "11px", fontWeight: 700, color: "oklch(var(--p))", marginBottom: "2px", lineHeight: 1 }}>
        {replyTo.senderName || "Unknown"}
      </p>
      <p style={{ fontSize: "12px", opacity: 0.7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.3 }}>
        {replyTo.image ? "📷 Photo" : replyTo.text || "This message was deleted"}
      </p>
    </div>
  );
};

// ── Date grouping function ────────────────────────────────────────────────────
const formatWhatsAppDate = (dateString) => {
  const d = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date(d);
  targetDate.setHours(0, 0, 0, 0);

  const diffDays = Math.round((today - targetDate) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) {
    return d.toLocaleDateString("en-US", { weekday: "long" });
  }
  return d.toLocaleDateString("en-GB"); // DD/MM/YYYY
};

const ChatContainer = () => {
  const {
    messages, getMessages, isMessagesLoading,
    selectedUser, setSelectedUser, subscribeToMessages, unsubscribeFromMessages,
    deleteChat, bulkDeleteMessages, updateMessage,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const { chatPattern, customBgImage } = useThemeStore();

  const messageEndRef = useRef(null);
  const longPressRef = useRef(null);
  const editInputRef = useRef(null);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [viewerState, setViewerState] = useState(null);
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraImage, setCameraImage] = useState(null);

  // ── Search ──────────────────────────────────────────────────────────────────
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const searchInputRef = useRef(null);

  // ── Context menu ────────────────────────────────────────────────────────────
  const [contextMenu, setContextMenu] = useState(null);

  // ── Multi-select ────────────────────────────────────────────────────────────
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState(new Set());

  // ── Highlight ───────────────────────────────────────────────────────────────
  const [highlightedMsgId, setHighlightedMsgId] = useState(null);

  // ── Reply ───────────────────────────────────────────────────────────────────
  const [replyToMsg, setReplyToMsg] = useState(null);

  // ── Inline edit state ───────────────────────────────────────────────────────
  const [editingState, setEditingState] = useState(null); // { messageId, text }

  // ── Forward ─────────────────────────────────────────────────────────────────
  const [forwardMessages, setForwardMessages] = useState(null);

  // Reset all interaction state on contact switch
  useEffect(() => {
    setIsContactPanelOpen(false);
    setIsSearchOpen(false); setSearchQuery(""); setCurrentMatchIdx(0);
    setIsSelectMode(false); setSelectedMsgIds(new Set());
    setHighlightedMsgId(null); setReplyToMsg(null);
    setContextMenu(null); setForwardMessages(null);
    setEditingState(null);
    setIsCameraOpen(false);
    setCameraImage(null);
  }, [selectedUser._id]);

  useEffect(() => {
    getMessages(selectedUser._id);
    subscribeToMessages();
    return () => unsubscribeFromMessages();
  }, [selectedUser._id, getMessages, subscribeToMessages, unsubscribeFromMessages]);

  // Auto-scroll (skip while searching)
  useEffect(() => {
    if (!isSearchOpen && messageEndRef.current && messages?.length) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isSearchOpen]);

  // Focus search input on open
  useEffect(() => {
    if (isSearchOpen) setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [isSearchOpen]);

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingState) setTimeout(() => editInputRef.current?.focus(), 30);
  }, [editingState?.messageId]);

  useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") { setHighlightedMsgId(null); setContextMenu(null); setEditingState(null); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // ── Search helpers ──────────────────────────────────────────────────────────
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return messages.filter((m) => m.text?.toLowerCase().includes(q)).map((m) => m._id);
  }, [messages, searchQuery]);

  useEffect(() => {
    setCurrentMatchIdx(0);
    if (searchMatches.length > 0) scrollToMsg(searchMatches[0], false);
  }, [searchMatches]);

  const scrollToMsg = (id, smooth = true) => {
    document.querySelector(`[data-msg-id="${id}"]`)?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
  };

  // ── Reply scroll + 2s highlight ─────────────────────────────────────────────
  const scrollToMessage = useCallback((msgId) => {
    const id = msgId?.toString?.() ?? msgId;
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("msg-highlight");
    setTimeout(() => {
      el.classList.remove("msg-highlight");
      el.style.transition = "background-color 0.6s ease";
      el.style.backgroundColor = "";
    }, 2000);
  }, []);

  const goToMatch = (delta) => {
    if (!searchMatches.length) return;
    const next = (currentMatchIdx + delta + searchMatches.length) % searchMatches.length;
    setCurrentMatchIdx(next);
    scrollToMsg(searchMatches[next]);
  };
  const closeSearch = () => { setIsSearchOpen(false); setSearchQuery(""); setCurrentMatchIdx(0); };

  // ── Context menu ─────────────────────────────────────────────────────────────
  const handleMsgRightClick = useCallback((e, message) => {
    e.preventDefault(); e.stopPropagation();
    setHighlightedMsgId(message._id);
    const isOwn = message.senderId === authUser._id;
    setContextMenu({ x: e.clientX, y: e.clientY, type: "message", message, isOwnMessage: isOwn });
  }, [authUser._id]);

  const handleChatBgRightClick = useCallback((e) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type: "chat" });
  }, []);

  const handleMsgMouseDown = (msg) => {
    longPressRef.current = setTimeout(() => setHighlightedMsgId(msg._id), 500);
  };
  const clearLongPress = () => clearTimeout(longPressRef.current);

  const handleContextAction = (action) => {
    const msg = contextMenu?.message;
    switch (action) {
      case "reply":
        if (msg) setReplyToMsg({ ...msg, _senderName: msg.senderId === authUser._id ? "You" : selectedUser.fullName });
        break;
      case "copy":
        if (msg?.text) { navigator.clipboard.writeText(msg.text); toast.success("Copied!"); }
        break;
      case "edit":
        if (msg?.text) setEditingState({ messageId: msg._id, text: msg.text });
        break;
      case "select":
        setIsSelectMode(true);
        if (msg) setSelectedMsgIds(new Set([msg._id]));
        break;
      case "forward": if (msg) setForwardMessages([msg]); break;
      case "download": downloadMessages([msg].filter(Boolean)); break;
      case "delete": if (msg) bulkDeleteMessages([msg._id], false); break;
      case "delete_everyone": if (msg) bulkDeleteMessages([msg._id], true); break;
      case "close": setSelectedUser(null); break;
    }
  };

  // ── Inline edit save ─────────────────────────────────────────────────────────
  const handleSaveEdit = async () => {
    if (!editingState || !editingState.text.trim()) return;
    try {
      await updateMessage(editingState.messageId, editingState.text.trim());
      setEditingState(null);
    } catch {
      // error already toasted in store
    }
  };

  // ── Multi-select helpers ─────────────────────────────────────────────────────
  const toggleSelectMsg = (id) => {
    setSelectedMsgIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const exitSelectMode = () => { setIsSelectMode(false); setSelectedMsgIds(new Set()); };

  const handleBulkCopy = () => {
    const text = messages.filter((m) => selectedMsgIds.has(m._id) && m.text).map((m) => m.text).join("\n");
    if (text) { navigator.clipboard.writeText(text); toast.success("Copied!"); }
    else toast("No text messages selected", { icon: "ℹ️" });
  };
  const handleBulkDelete = async () => { if (!selectedMsgIds.size) return; await bulkDeleteMessages([...selectedMsgIds]); exitSelectMode(); };
  const handleBulkForward = () => { const sel = messages.filter((m) => selectedMsgIds.has(m._id)); if (sel.length) { setForwardMessages(sel); exitSelectMode(); } };

  const downloadMessages = (msgs) => {
    msgs.forEach((m) => {
      if (m.image) {
        const a = document.createElement("a");
        a.href = m.image; a.download = "image.jpg"; a.target = "_blank";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      }
    });
    const txt = msgs.filter((m) => m.text).map((m) => m.text).join("\n");
    if (txt) {
      const blob = new Blob([txt], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "messages.txt";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };
  const handleBulkDownload = () => downloadMessages(messages.filter((m) => selectedMsgIds.has(m._id)));

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    await deleteChat(selectedUser._id);
    setIsDeleting(false);
    setShowDeleteModal(false);
  };

  const allImageMessages = messages.filter((m) => m.image);
  const openImageViewer = (url) => {
    const idx = allImageMessages.findIndex(m => m.image === url);
    setViewerState({ messages: allImageMessages, initialIndex: Math.max(idx, 0) });
  };

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader onOpenContactPanel={() => setIsContactPanelOpen(true)} onSearchToggle={() => setIsSearchOpen((v) => !v)} isSearchOpen={isSearchOpen} onDeleteChat={() => setShowDeleteModal(true)} />
        <MessageSkeleton />
        <MessageInput replyToMsg={null} onCancelReply={() => { }} onOpenCamera={() => { setIsCameraOpen(true); setCameraImage(null); }} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden bg-base-100 min-w-0 relative">

        <ChatHeader
          onOpenContactPanel={() => setIsContactPanelOpen((v) => !v)}
          onSearchToggle={() => setIsSearchOpen((v) => !v)}
          isSearchOpen={isSearchOpen}
          onDeleteChat={() => setShowDeleteModal(true)}
        />

        {/* Search bar */}
        {isSearchOpen && (
          <div className="flex items-center gap-2 px-4 py-2 bg-base-200 border-b border-base-300 flex-shrink-0" style={{ animation: "wa-pop-in 0.15s ease-out" }}>
            <Search className="size-4 text-base-content/50 flex-shrink-0" />
            <input ref={searchInputRef} type="text" value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") goToMatch(e.shiftKey ? -1 : 1);
                if (e.key === "Escape") closeSearch();
                if (e.key === "ArrowUp") { e.preventDefault(); goToMatch(-1); }
                if (e.key === "ArrowDown") { e.preventDefault(); goToMatch(+1); }
              }}
              placeholder="Search messages…"
              className="flex-1 bg-transparent text-sm text-base-content placeholder:text-base-content/40 outline-none"
            />
            {searchQuery.trim() && (
              <>
                <span className="text-xs text-base-content/50 tabular-nums flex-shrink-0">
                  {searchMatches.length === 0 ? "No results" : `${currentMatchIdx + 1} / ${searchMatches.length}`}
                </span>
                <button onClick={() => goToMatch(-1)} disabled={!searchMatches.length} className="p-1 rounded hover:bg-base-300 disabled:opacity-30"><ChevronUp className="size-4 text-base-content/60" /></button>
                <button onClick={() => goToMatch(+1)} disabled={!searchMatches.length} className="p-1 rounded hover:bg-base-300 disabled:opacity-30"><ChevronDown className="size-4 text-base-content/60" /></button>
              </>
            )}
            <button onClick={closeSearch} className="p-1 rounded hover:bg-base-300"><X className="size-4 text-base-content/60" /></button>
          </div>
        )}

        {/* ── Main Content Area (Background + Camera/Messages + Input) ─────────────────────────────────────────── */}
        <div 
          className="flex-1 flex flex-col relative overflow-hidden bg-base-100"
          onContextMenu={handleChatBgRightClick}
          onClick={() => { setHighlightedMsgId(null); setContextMenu(null); }}
        >
          {/* ── Background Layers ── */}
          {!isCameraOpen && chatPattern === 'custom' && customBgImage && (
            <div 
              className="absolute inset-0 z-0 pointer-events-none opacity-[0.4] dark:opacity-[0.2]"
              style={{ 
                backgroundImage: `url(${customBgImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            />
          )}
          {!isCameraOpen && chatPattern !== 'custom' && (
            <div 
              className={`absolute inset-0 z-0 pointer-events-none ${chatPattern === 'whatsapp' ? 'opacity-[0.15] dark:invert' : 'opacity-[0.08]'}`}
              style={{ 
                backgroundImage: chatPattern === 'whatsapp' 
                  ? `url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")` 
                  : `url('/patterns/${chatPattern}.svg')`,
                backgroundSize: chatPattern === 'whatsapp' ? '400px' : 'auto',
                backgroundRepeat: 'repeat',
              }}
            />
          )}

          {isCameraOpen ? (
            <CameraOverlay 
              onClose={() => { setIsCameraOpen(false); setCameraImage(null); }}
              cameraImage={cameraImage}
              onCapture={(img) => setCameraImage(img)}
              onRetake={() => setCameraImage(null)}
            />
          ) : (
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 relative z-10">
              {messages.map((message, idx) => {
            const isSent = message.senderId === authUser._id;
            const isLast = idx === messages.length - 1;
            const isMatch = searchMatches.includes(message._id);
            const isCurrentMatch = isMatch && searchMatches[currentMatchIdx] === message._id;
            const isHighlighted = highlightedMsgId === message._id;
            const isSelected = selectedMsgIds.has(message._id);
            const isEditing = editingState?.messageId === message._id;

            // Date Grouping logic
            let showDateHeader = false;
            let dateLabel = "";
            if (idx === 0) {
              showDateHeader = true;
              dateLabel = formatWhatsAppDate(message.createdAt);
            } else {
              const prevDate = new Date(messages[idx - 1].createdAt).toDateString();
              const currDate = new Date(message.createdAt).toDateString();
              if (prevDate !== currDate) {
                showDateHeader = true;
                dateLabel = formatWhatsAppDate(message.createdAt);
              }
            }

            return (
              <div key={message._id}>
                {showDateHeader && (
                  <div className="flex justify-center my-3 relative z-0">
                    <span className="text-[12px] uppercase tracking-wide font-medium text-[#8696a0] bg-[#111b21] shadow-[0_1px_2px_rgba(0,0,0,0.15)] rounded-lg px-3 py-1">
                      {dateLabel}
                    </span>
                  </div>
                )}

                <div id={`msg-${message._id}`} data-msg-id={message._id} ref={isLast ? messageEndRef : null}>
                  <MessageBubble
                    message={message}
                    selectedUser={selectedUser}
                    isSent={isSent}
                    isMatch={isMatch}
                    isCurrentMatch={isCurrentMatch}
                    isHighlighted={isHighlighted}
                    isSelected={isSelected}
                    isEditing={isEditing}
                    isSelectMode={isSelectMode}
                    searchQuery={searchQuery}
                    editStateText={editingState?.text || ""}
                    setEditStateText={(text) => setEditingState({ ...editingState, text })}
                    onSaveEdit={handleSaveEdit}
                    onCancelEdit={() => setEditingState(null)}
                    onToggleSelect={toggleSelectMsg}
                    onContextMenu={handleMsgRightClick}
                    onLongPress={handleMsgMouseDown}
                    onReleasePress={clearLongPress}
                    onScrollToReply={scrollToMessage}
                    onImageClick={openImageViewer}
                  />
                </div>
              </div>
            );
          })}

          {isSearchOpen && searchQuery.trim() && !searchMatches.length && (
            <div className="flex flex-col items-center justify-center py-10 text-base-content/40">
              <Search className="size-8 mb-2" />
              <p className="text-sm">No messages found for "{searchQuery}"</p>
            </div>
          )}
          </div>
        )}

        {/* Deactivated account banner */}
        {selectedUser?.deletionScheduledAt && (
          <div className="mx-4 mb-4 p-4 rounded-2xl bg-error/5 border border-error/20 flex items-center gap-4 animate-in slide-in-from-bottom-2 duration-300">
            <div className="size-10 rounded-xl bg-error/10 flex items-center justify-center text-error flex-shrink-0">
              <AlertTriangle className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-base-content">Account Deactivated</p>
              <p className="text-xs text-base-content/50 leading-relaxed truncate sm:whitespace-normal">
                This account is currently deactivated. Your messages may not be received.
              </p>
            </div>
          </div>
        )}

        {/* Input or SelectActionBar */}
        {isSelectMode ? (
          <SelectActionBar count={selectedMsgIds.size} onCopy={handleBulkCopy} onDelete={handleBulkDelete} onForward={handleBulkForward} onDownload={handleBulkDownload} onClose={exitSelectMode} />
        ) : (
          (!isCameraOpen || cameraImage) && (
            <MessageInput 
              replyToMsg={replyToMsg} 
              onCancelReply={() => setReplyToMsg(null)} 
              onOpenCamera={() => { setIsCameraOpen(true); setCameraImage(null); }} 
              injectedImage={cameraImage}
              isOverlayMode={isCameraOpen && !!cameraImage}
              onSendComplete={() => { setIsCameraOpen(false); setCameraImage(null); }}
            />
          )
        )}
        </div>
      </div>

      {/* ── Overlays ───────────────────────────────────────────────────────── */}
      {isContactPanelOpen && <ContactInfoPanel onClose={() => setIsContactPanelOpen(false)} />}
      {viewerState && <MediaViewer messages={viewerState.messages} initialIndex={viewerState.initialIndex} onClose={() => setViewerState(null)} onForward={(msgs) => setForwardMessages(msgs)} />}
      {forwardMessages && <ForwardModal messages={forwardMessages} onClose={() => setForwardMessages(null)} />}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          type={contextMenu.type}
          isOwnMessage={contextMenu.isOwnMessage}
          onClose={() => setContextMenu(null)}
          onAction={handleContextAction}
        />
      )}

      {/* Delete chat modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-base-200 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl border border-base-300" style={{ animation: "wa-pop-in 0.18s ease-out" }}>
            <div className="flex justify-center mb-4">
              <div className="size-14 rounded-full bg-error/10 flex items-center justify-center">
                <AlertTriangle className="size-7 text-error" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-base-content text-center mb-1">Delete chat?</h3>
            <p className="text-sm text-base-content/60 text-center mb-6 leading-relaxed">
              All messages with <span className="font-medium text-base-content">{selectedUser.fullName}</span> will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)} disabled={isDeleting} className="flex-1 btn btn-ghost btn-sm">Cancel</button>
              <button onClick={handleConfirmDelete} disabled={isDeleting} className="flex-1 btn btn-error btn-sm">
                {isDeleting ? <span className="loading loading-spinner loading-xs" /> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatContainer;
