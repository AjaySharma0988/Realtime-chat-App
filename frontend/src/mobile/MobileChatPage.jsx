import { useEffect, useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useCallStore } from "../store/useCallStore";
import {
  ArrowLeft, MoreVertical, Video, Phone, Paperclip, Smile, Mic, Send,
  Image as ImageIcon, Camera, MapPin, User, FileText, BarChart2, Calendar,
  Sparkles, X, Trash2, Search,
  Info, BellOff, Timer, Heart, Bookmark, Flag, Ban, Eraser, CheckSquare,
} from "lucide-react";
import { MessageBubble } from "../components/MessageBubble";
import MessageSkeleton from "../components/skeletons/MessageSkeleton";
import MobileDropdownMenu from "../components/mobile/MobileDropdownMenu";
import { navigateMobile } from "./MobileLayout";
import toast from "react-hot-toast";

const MobileChatPage = () => {
  const { messages, getMessages, isMessagesLoading, selectedUser, setSelectedUser, subscribeToMessages, unsubscribeFromMessages, sendMessage } = useChatStore();
  const { authUser, onlineUsers } = useAuthStore();
  const { startCall } = useCallStore();
  
  const [text, setText] = useState("");
  const [showAttachment, setShowAttachment] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef(null);
  const messageEndRef = useRef(null);
  const menuRef = useRef(null);

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

  useEffect(() => {
    if (messageEndRef.current && messages?.length) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() && !imagePreview) return;
    
    try {
      await sendMessage({
        text: text.trim(),
        image: imagePreview,
      });
      setText("");
      setImagePreview(null);
      setShowAttachment(false);
    } catch (error) {
      toast.error("Failed to send message");
    }
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

      {/* Messages */}
      <div 
        className="flex-1 overflow-y-auto px-4 py-4 space-y-2"
        style={{ 
          backgroundImage: `url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")`,
          backgroundSize: '400px',
          backgroundRepeat: 'repeat',
          backgroundColor: 'var(--wa-chat-bg)'
        }}
      >
        <div className="absolute inset-0 bg-base-100/40 pointer-events-none" />
        <div className="relative z-10">
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
                   />
                 </div>
               );
            })
          )}
        </div>
      </div>

      {/* Input Section */}
      <div className="p-2 bg-transparent flex flex-col gap-2 relative z-20">
        {imagePreview && (
          <div className="p-4 bg-base-300 rounded-2xl border border-base-content/10 animate-in slide-in-from-bottom-2">
            <div className="relative inline-block">
              <img src={imagePreview} alt="" className="h-40 w-auto rounded-xl object-cover" />
              <button onClick={() => setImagePreview(null)} className="absolute -top-2 -right-2 bg-error text-error-content rounded-full p-1 shadow-lg">
                <X className="size-4" />
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex items-end gap-2">
          <div className="flex-1 bg-base-300 rounded-[24px] flex items-center px-2 py-1 min-h-[48px] border border-base-content/10">
            <button type="button" className="p-2 text-base-content/50">
              <Smile className="size-6" />
            </button>
            <input 
              placeholder="Message"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="flex-1 bg-transparent border-none focus:ring-0 text-base-content py-2 px-1 text-[16px] outline-none"
            />
            <button type="button" onClick={() => setShowAttachment(!showAttachment)} className="p-2 text-base-content/50 transition-transform active:scale-90">
              <Paperclip className={`size-6 ${showAttachment ? "text-primary rotate-45" : ""}`} />
            </button>
            {!text.trim() && !imagePreview && (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-base-content/50">
                <Camera className="size-6" />
              </button>
            )}
          </div>
          <button 
            type="submit" 
            className={`size-12 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg transition-all active:scale-90 ${text.trim() || imagePreview ? 'bg-primary' : 'bg-[#00a884]'}`}
          >
            {text.trim() || imagePreview ? (
              <Send className="size-6 text-white" />
            ) : (
              <Mic className="size-6 text-white" />
            )}
          </button>
        </form>
      </div>

      <input type="file" hidden ref={fileInputRef} onChange={handleImageChange} accept="image/*" />

      {/* Attachment Panel (Bottom Sheet) */}
      {showAttachment && (
        <div className="fixed inset-x-0 bottom-20 mx-4 bg-base-300 rounded-3xl p-6 shadow-2xl border border-base-content/10 animate-in slide-in-from-bottom-10 duration-300 z-[70]">
          <div className="grid grid-cols-4 gap-y-8 gap-x-4">
            <AttachmentItem onClick={() => fileInputRef.current?.click()} icon={ImageIcon} label="Gallery" color="bg-[#bf59cf]" />
            <AttachmentItem icon={Camera} label="Camera" color="bg-[#ff2e74]" />
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
