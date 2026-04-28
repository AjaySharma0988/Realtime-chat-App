import { useEffect, useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useCallStore } from "../store/useCallStore";
import { useThemeStore } from "../store/useThemeStore";
import {
  ArrowLeft, MoreVertical, Video, Phone, Paperclip, Smile, Mic, Send,
  Image as ImageIcon, Camera, MapPin, User, FileText, BarChart2, Calendar,
  Sparkles, X, Trash2, Search,
  Info, BellOff, Timer, Heart, Bookmark, Flag, Ban, Eraser, CheckSquare,
  ChevronDown, Reply, Forward, Copy, Star, Plus,
} from "lucide-react";
import { MessageBubble } from "../components/MessageBubble";
import MessageSkeleton from "../components/skeletons/MessageSkeleton";
import MobileDropdownMenu from "../components/mobile/MobileDropdownMenu";
import EmojiPicker from "../components/EmojiPicker";
import EmojiReactionPanel from "../components/EmojiReactionPanel";
import CameraOverlay from "../components/CameraOverlay";
import { navigateMobile } from "./MobileLayout";
import toast from "react-hot-toast";

const MobileChatPage = () => {
  const { messages, getMessages, isMessagesLoading, isFetchingMore, hasMore, loadMoreMessages, selectedUser, setSelectedUser, subscribeToMessages, unsubscribeFromMessages, sendMessage } = useChatStore();
  const { authUser, onlineUsers } = useAuthStore();
  const { startCall } = useCallStore();
  const { chatPattern, customBgImage } = useThemeStore();
  
  const [text, setText] = useState("");
  const [showAttachment, setShowAttachment] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraImage, setCameraImage] = useState(null);
  const fileInputRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const messageEndRef = useRef(null);
  const menuRef = useRef(null);
  const prevScrollHeightRef = useRef(0);
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [showReactionUI, setShowReactionUI] = useState(false);
  const [replyToMsg, setReplyToMsg] = useState(null);
  const longPressTimer = useRef(null);
  const inputRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (selectedUser?._id) {
      getMessages(selectedUser._id);
      subscribeToMessages();
    }
    return () => unsubscribeFromMessages();
  }, [selectedUser?._id, getMessages, subscribeToMessages, unsubscribeFromMessages]);

  // Handle scroll (Pagination + Scroll Button)
  const handleScroll = async (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop === 0 && hasMore && !isFetchingMore && messages.length > 0) {
      prevScrollHeightRef.current = scrollHeight;
      await loadMoreMessages(selectedUser._id);
    }

    // Scroll Button: Show if not at bottom
    const isAtBottom = scrollHeight - scrollTop <= clientHeight + 150;
    setShowScrollButton(!isAtBottom);
  };

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  // Maintain scroll position when messages are prepended
  useEffect(() => {
    if (isFetchingMore) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    if (prevScrollHeightRef.current > 0) {
      // We just loaded older messages, maintain scroll position
      const scrollDiff = container.scrollHeight - prevScrollHeightRef.current;
      container.scrollTop = scrollDiff;
      prevScrollHeightRef.current = 0;
    } else {
      // If it's a new message (appended at bottom), auto-scroll only if at bottom or if I sent it
      const lastMessage = messages[messages.length - 1];
      const isMyMessage = lastMessage?.senderId === authUser._id;
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 150;
      
      if (isAtBottom || isMyMessage) {
        messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
        setShowScrollButton(false);
      } else {
        setShowScrollButton(true);
      }
    }
  }, [messages, isFetchingMore]);

  // Initial load auto-scroll
  useEffect(() => {
    if (!isMessagesLoading && messages.length > 0 && !prevScrollHeightRef.current) {
      messageEndRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [isMessagesLoading, selectedUser._id]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const finalImage = cameraImage || imagePreview;
    if (!text.trim() && !finalImage) return;
    
    const msg = { 
      text: text.trim(), 
      image: finalImage,
      replyTo: replyToMsg ? {
        messageId: replyToMsg._id,
        text: replyToMsg.text,
        senderName: replyToMsg.senderId === authUser._id ? "You" : selectedUser.fullName,
        image: replyToMsg.image
      } : null
    };
    
    setText("");
    setImagePreview(null);
    setCameraImage(null);
    setIsCameraOpen(false);
    setShowAttachment(false);
    setReplyToMsg(null);

    try {
      await sendMessage(msg);
    } catch (error) {
      toast.error("Failed to send message");
    }
  };

  const handleLongPress = (message) => {
    if (showReactionUI || selectedMessages.length > 0) return;
    longPressTimer.current = setTimeout(() => {
      setSelectedMessages([message]);
      setShowReactionUI(true);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 600);
  };

  const handleReleasePress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const handleSwipeReply = (message) => {
    if (selectedMessages.length > 0) return;
    setReplyToMsg(message);
    if (navigator.vibrate) navigator.vibrate(40);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleMessageClick = (message) => {
    if (selectedMessages.length > 0) {
      // Always hide reaction UI when continuing selection
      setShowReactionUI(false);
      
      const isAlreadySelected = selectedMessages.some(m => m._id === message._id);
      if (isAlreadySelected) {
        setSelectedMessages(prev => prev.filter(m => m._id !== message._id));
      } else {
        setSelectedMessages(prev => [...prev, message]);
      }
    }
  };

  const handleReaction = async (emoji) => {
    if (selectedMessages.length !== 1) return;
    const msg = selectedMessages[0];
    try {
      await useChatStore.getState().reactToMessage(msg._id, emoji);
      setSelectedMessages([]);
      setShowReactionUI(false);
    } catch (error) {
      toast.error("Failed to react");
    }
  };

  const handleAction = async (action) => {
    if (selectedMessages.length === 0) return;
    
    switch (action) {
      case "reply":
        if (selectedMessages.length === 1) setReplyToMsg(selectedMessages[0]);
        break;
      case "copy":
        const combinedText = selectedMessages
          .map(m => m.text)
          .filter(Boolean)
          .join("\n");
        if (combinedText) {
          navigator.clipboard.writeText(combinedText);
          toast.success("Copied!");
        }
        break;
      case "delete":
        const ids = selectedMessages.map(m => m._id);
        await useChatStore.getState().bulkDeleteMessages(ids, false);
        break;
      case "forward":
        toast("Forwarding multiple messages not yet implemented", { icon: "ℹ️" });
        break;
      case "star":
        toast("Starred successfully", { icon: "⭐" });
        break;
    }
    setSelectedMessages([]);
    setShowReactionUI(false);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
    setShowAttachment(false);
  };

  if (!selectedUser) return null;

  // EXACT same menuItems array as desktop ChatHeader.jsx
  const menuItems = [
    { icon: Info,        label: "Contact info",          action: () => navigateMobile.fn?.("profile") },
    { icon: Search,      label: "Search",                action: null },
    { icon: CheckSquare, label: "Select messages",       action: null },
    { icon: BellOff,     label: "Mute notifications",    action: null },
    { icon: Timer,       label: "Disappearing messages", action: null },
    { icon: Heart,       label: "Add to favourites",     action: null },
    { icon: Bookmark,    label: "Add to list",           action: null },
    { icon: X,           label: "Close chat",            action: () => setSelectedUser(null) },
    null,
    { icon: Flag,        label: "Report",                action: null },
    { icon: Ban,         label: "Block",                 action: null },
    { icon: Eraser,      label: "Clear chat",            action: null,  danger: true },
    { icon: Trash2,      label: "Delete chat",           action: null,  danger: true },
  ];

  return (
    <div className="fixed inset-0 z-[60] bg-base-100 flex flex-col md:hidden w-full h-[100dvh]">
      {/* Header */}
      <div className="h-16 bg-base-300 flex items-center px-2 gap-1 border-b border-base-content/10">
        <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-base-content/10 rounded-full text-base-content">
          <ArrowLeft className="size-6" />
        </button>
        <div 
          className="flex flex-1 items-center gap-3 min-w-0 cursor-pointer active:opacity-80"
          onClick={() => navigateMobile.fn && navigateMobile.fn("profile")}
        >
          <img
            src={selectedUser.profilePic || "/avatar.png"}
            alt=""
            className="size-10 rounded-full object-cover"
          />
          <div className="min-w-0">
            <h1 className="font-bold text-base-content truncate">{selectedUser.fullName}</h1>
            <p className={`text-xs font-medium ${onlineUsers.includes(selectedUser._id) ? 'text-success' : 'text-base-content/50'}`}>
              {onlineUsers.includes(selectedUser._id) ? 'online' : 'offline'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => startCall(selectedUser, "video")} className="p-3 hover:bg-base-content/10 rounded-full text-base-content/70">
            <Video className="size-5" />
          </button>
          <button onClick={() => startCall(selectedUser, "audio")} className="p-3 hover:bg-base-content/10 rounded-full text-base-content/70">
            <Phone className="size-5" />
          </button>
          <div className="relative" ref={menuRef}>
            <button 
              onClick={() => setMenuOpen(!menuOpen)}
              className={`p-3 hover:bg-base-content/10 rounded-full text-base-content/70 transition-colors ${menuOpen ? 'bg-base-content/10' : ''}`}
            >
              <MoreVertical className="size-5" />
            </button>
            <MobileDropdownMenu 
              isOpen={menuOpen} 
              onClose={() => setMenuOpen(false)}
              menuItems={menuItems}
            />
          </div>
        </div>
      </div>

      {/* Main Content Area (Background + Messages + Input) */}
      <div 
        className="flex-1 flex flex-col relative overflow-hidden bg-base-100"
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
                ? `url("/patterns/whatsapp.png")` 
                : `url('/patterns/${chatPattern}.svg')`,
              backgroundSize: chatPattern === 'whatsapp' ? '400px' : 'auto',
              backgroundRepeat: 'repeat',
            }}
          />
        )}

        {/* Messages or Camera */}
        {isCameraOpen ? (
          <CameraOverlay 
            onClose={() => { setIsCameraOpen(false); setCameraImage(null); }}
            cameraImage={cameraImage}
            onCapture={(img) => setCameraImage(img)}
            onRetake={() => setCameraImage(null)}
          />
        ) : (
          <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-2 relative z-10"
          >
            {/* Pagination Loader */}
            {isFetchingMore && (
              <div className="flex justify-center py-2">
                <span className="loading loading-spinner loading-sm text-primary/60"></span>
              </div>
            )}
            
            {isMessagesLoading ? (
              <MessageSkeleton />
            ) : (
              messages.map((message, idx) => {
                 const isSent = message.senderId === authUser._id;
                 return (
                    <div key={message._id} ref={idx === messages.length - 1 ? messageEndRef : null}>
                      <MessageBubble 
                        message={message} 
                        isSent={isSent} 
                        selectedUser={selectedUser}
                        isSelected={selectedMessages.some(m => m._id === message._id)}
                        isSelectMode={selectedMessages.length > 0}
                        onLongPress={handleLongPress}
                        onReleasePress={handleReleasePress}
                        onToggleSelect={() => handleMessageClick(message)}
                        onSwipeReply={handleSwipeReply}
                        onOpenMobileReaction={(msg) => {
                          setSelectedMessages([msg]);
                          setShowReactionUI(true);
                        }}
                      />
                    </div>
                 );
              })
            )}
          </div>
        )}

        {/* Scroll to Bottom Button */}
        {showScrollButton && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-32 left-1/2 -translate-x-1/2 size-11 rounded-full bg-[#202c33] text-white shadow-xl border border-white/10 flex items-center justify-center hover:bg-[#2a3942] transition-all z-50 animate-in fade-in zoom-in slide-in-from-bottom-4 duration-200"
            aria-label="Scroll to bottom"
          >
            <ChevronDown className="size-6" />
          </button>
        )}

      {/* Input Section */}
      {(!isCameraOpen || cameraImage) && (
        <div className={`p-2 flex flex-col relative z-20 transition-colors ${isCameraOpen && cameraImage ? 'bg-[#0B141A]' : 'bg-transparent'}`}>
          {/* Integrated Reply Preview */}
          {replyToMsg && (
            <div className="mx-2 mb-2 bg-white/5 rounded-xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center gap-3 p-3 border-l-4 border-[#25D366] bg-black/20">
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-[#25D366] mb-0.5">
                    {replyToMsg.senderId === authUser._id ? "You" : selectedUser.fullName}
                  </p>
                  <p className="text-[13px] text-white/80 truncate">
                    {replyToMsg.image ? "📷 Photo" : replyToMsg.text}
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => setReplyToMsg(null)} 
                  className="p-1 rounded-full hover:bg-white/10 text-white/40"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          )}

          {imagePreview && (
            <div className="p-4 bg-base-300 rounded-2xl border border-base-content/10 mb-2">
            <div className="relative inline-block">
              <img src={imagePreview} alt="" className="h-40 w-auto rounded-xl object-cover" />
              <button onClick={() => setImagePreview(null)} className="absolute -top-2 -right-2 bg-error text-error-content rounded-full p-1 shadow-lg">
                <X className="size-4" />
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex items-end gap-2">
          <div className="flex-1 bg-base-300 rounded-[24px] flex items-center px-2 py-1 min-h-[48px] border border-base-content/10 relative">
            <button 
              type="button" 
              className={`p-2 transition-colors ${showEmoji ? "text-primary" : "text-base-content/50"}`}
              onClick={() => {
                setShowEmoji(!showEmoji);
                setShowAttachment(false);
              }}
            >
              <Smile className="size-6" />
            </button>
            <EmojiPicker 
              isOpen={showEmoji} 
              onClose={() => setShowEmoji(false)} 
              onSelect={(emoji) => setText(prev => prev + emoji)} 
            />
            <input 
              ref={inputRef}
              placeholder="Message"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="flex-1 bg-transparent border-none focus:ring-0 text-base-content py-2 px-1 text-[16px] outline-none"
            />
            <button type="button" onClick={() => setShowAttachment(!showAttachment)} className="p-2 text-base-content/50 transition-transform active:scale-90">
              <Paperclip className={`size-6 ${showAttachment ? "text-primary rotate-45" : ""}`} />
            </button>
            {!text.trim() && !imagePreview && !cameraImage && (
              <button type="button" onClick={() => setIsCameraOpen(true)} className="p-2 text-base-content/50">
                <Camera className="size-6" />
              </button>
            )}
          </div>
          <button 
            type="submit" 
            className={`size-12 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg transition-all active:scale-90 ${text.trim() || imagePreview || cameraImage ? 'bg-primary' : 'bg-[#00a884]'}`}
          >
            {text.trim() || imagePreview || cameraImage ? (
              <Send className="size-6 text-white" />
            ) : (
              <Mic className="size-6 text-white" />
            )}
          </button>
        </form>
      </div>
      )}
      </div>

      <input type="file" hidden ref={fileInputRef} onChange={handleImageChange} accept="image/*" />

      {/* Attachment Panel (Bottom Sheet) */}
      {showAttachment && (
        <div className="fixed inset-x-0 bottom-20 mx-4 bg-base-300 rounded-3xl p-6 shadow-2xl border border-base-content/10 animate-in slide-in-from-bottom-10 duration-300 z-[70]">
          <div className="grid grid-cols-4 gap-y-8 gap-x-4">
            <AttachmentItem onClick={() => fileInputRef.current?.click()} icon={ImageIcon} label="Gallery" color="bg-[#bf59cf]" />
            <AttachmentItem onClick={() => { setIsCameraOpen(true); setShowAttachment(false); }} icon={Camera} label="Camera" color="bg-[#ff2e74]" />
            <AttachmentItem icon={MapPin} label="Location" color="bg-[#1fa855]" />
            <AttachmentItem icon={User} label="Contact" color="bg-[#007bfc]" />
            <AttachmentItem icon={FileText} label="Document" color="bg-[#7f66ff]" />
            <AttachmentItem icon={Mic} label="Audio" color="bg-[#ff8c00]" />
            <AttachmentItem icon={BarChart2} label="Poll" color="bg-[#00bfa5]" />
            <AttachmentItem icon={Sparkles} label="AI Images" color="bg-[#00d4fa]" />
          </div>
        </div>
      )}

      {/* Backdrop for attachment */}
      {showAttachment && (
        <div 
          className="fixed inset-0 bg-black/20 z-[65]" 
          onClick={() => setShowAttachment(false)}
        />
      )}

      {/* Mobile Reaction Overlay */}
      <ReactionOverlay 
        isOpen={selectedMessages.length > 0}
        onClose={() => { setSelectedMessages([]); setShowReactionUI(false); }}
        onReact={handleReaction}
        onAction={handleAction}
        selectedCount={selectedMessages.length}
        showEmojiPanel={showReactionUI && selectedMessages.length === 1}
      />
    </div>
  );
};

// ── Mobile Overlays ─────────────────────────────────────────────────────────

const ReactionOverlay = ({ isOpen, onClose, onReact, selectedCount, onAction, showEmojiPanel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] animate-in fade-in duration-200 pointer-events-none">
      {/* Dimmed Background - pointer-events-none to allow selecting other messages */}
      <div className="absolute inset-0 bg-black/10 pointer-events-none" />
      
      {/* Top Action Bar */}
      <div className="absolute top-0 inset-x-0 h-16 bg-[#111b21] flex items-center justify-between px-6 z-10 shadow-lg animate-in slide-in-from-top duration-300 pointer-events-auto">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="text-white/70 active:scale-90 transition-transform">
            <ArrowLeft className="size-6" />
          </button>
          <span className="text-white font-bold text-lg">{selectedCount}</span>
        </div>
        <div className="flex items-center gap-6 text-white/90">
          {selectedCount === 1 && (
            <button onClick={() => onAction("reply")} className="active:scale-90 transition-transform"><Reply className="size-6" /></button>
          )}
          <button onClick={() => onAction("star")} className="active:scale-90 transition-transform"><Star className="size-6" /></button>
          <button onClick={() => onAction("copy")} className="active:scale-90 transition-transform"><Copy className="size-6" /></button>
          <button onClick={() => onAction("forward")} className="active:scale-90 transition-transform"><Forward className="size-6" /></button>
          <button onClick={() => onAction("delete")} className="text-error active:scale-90 transition-transform"><Trash2 className="size-6" /></button>
        </div>
      </div>

      {/* Emoji Panel (Centered) - Only shown for first selection */}
      {showEmojiPanel && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full px-4 flex justify-center z-20 pointer-events-auto">
          <EmojiReactionPanel 
            isOpen={true}
            onClose={() => {}} // Controlled by overlay
            onSelect={onReact}
            isSent={false}
            showArrow={false}
            className="relative scale-110"
          />
        </div>
      )}
    </div>
  );
};

const AttachmentItem = ({ icon: Icon, label, color, onClick }) => (
  <button onClick={onClick} className="flex flex-col items-center gap-2 group">
    <div className={`size-14 ${color} text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform group-hover:brightness-110`}>
      <Icon className="size-6" />
    </div>
    <span className="text-[11px] text-base-content/70 font-medium">{label}</span>
  </button>
);

export default MobileChatPage;
