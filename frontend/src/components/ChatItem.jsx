import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useStatusStore } from "../store/useStatusStore";
import { Check, CheckCheck, FileText, Image, Mic, Phone } from "lucide-react";
import { useState, useEffect } from "react";
import StatusAvatar from "./StatusAvatar";

const MenuItem = ({ label, danger }) => (
  <div
    className={`px-4 py-2 text-sm cursor-pointer hover:bg-white/10 ${
      danger ? "text-red-400" : ""
    }`}
  >
    {label}
  </div>
);

export const formatChatTime = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0 && now.getDate() === date.getDate()) {
    // Today: show time (e.g. 10:45 AM)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays < 2) {
    return "Yesterday";
  } else if (diffDays < 7) {
    // Show day of week
    return date.toLocaleDateString([], { weekday: 'long' });
  } else {
    // Show short date
    return date.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: '2-digit' });
  }
};

const ChatItem = ({ user, isSelected }) => {
  const { setSelectedUser } = useChatStore();
  const { onlineUsers, authUser } = useAuthStore();
  const { getStatusCount, setViewingUserId } = useStatusStore();
  
  const [menu, setMenu] = useState({ visible: false, x: 0, y: 0, chat: null });

  useEffect(() => {
    const close = () => setMenu((m) => ({ ...m, visible: false }));
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close, { capture: true });
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close, { capture: true });
    };
  }, []);

  const handleRightClick = (e, chat) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent menu overflow
    const x = Math.min(e.clientX, window.innerWidth - 240);
    const y = Math.min(e.clientY, window.innerHeight - 300);

    setMenu({
      visible: true,
      x,
      y,
      chat,
    });
  };

  const isOnline = onlineUsers.includes(user._id);
  const statusCount = getStatusCount(user._id);

  // Determine last message preview
  const lastMsg = user.lastMessage;
  let previewText = "";
  let PreviewIcon = null;

  if (lastMsg) {
    if (lastMsg.type === "call") {
      PreviewIcon = Phone;
      previewText = lastMsg.callType === "video" ? "Video call" : "Voice call";
    } else if (lastMsg.image) {
      PreviewIcon = Image;
      previewText = "Photo";
    } else if (lastMsg.audio) {
      PreviewIcon = Mic;
      previewText = "Audio";
    } else {
      previewText = lastMsg.text;
    }
  }

  // Ticks logic
  const isMyMessage = lastMsg?.senderId === authUser?._id;
  
  return (
    <>
      <button
        onContextMenu={(e) => handleRightClick(e, user)}
        onClick={() => setSelectedUser(user)}
        className={`w-full flex items-center gap-4 px-3 py-3 transition-colors select-none text-left
          ${isSelected ? "bg-base-300" : "hover:bg-base-200"}`}
      >
      {/* Avatar with Status Ring */}
      <StatusAvatar 
        user={user} 
        statusCount={statusCount} 
        isOnline={isOnline}
        onClick={(uid) => setViewingUserId(uid)}
      />


      {/* Details */}
      <div className="flex flex-col flex-1 min-w-0 border-b border-base-300/[0.4] pb-2 pr-1 pt-1 h-full">
        {/* Top Row: Name and Time */}
        <div className="flex items-center justify-between w-full mb-0.5">
          <span className="font-semibold text-[15px] truncate text-base-content leading-tight">
            {user.fullName}
          </span>
          <span className={`text-xs ml-2 flex-shrink-0 font-medium ${user.unreadCount ? "text-success" : "text-base-content/60"}`}>
            {formatChatTime(lastMsg?.createdAt)}
          </span>
        </div>

        {/* Bottom Row: Preview and Badge */}
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1 min-w-0 text-[13px] text-base-content/60">
            {/* Tick status */}
            {isMyMessage && (
              <span className="flex-shrink-0 mt-0.5">
                {lastMsg.status === "seen" ? (
                  <CheckCheck className="size-4 text-info" />
                ) : lastMsg.status === "delivered" ? (
                  <CheckCheck className="size-4 opacity-60" />
                ) : (
                  <Check className="size-4 opacity-60" />
                )}
              </span>
            )}
            
            {/* Content Icon */}
            {PreviewIcon && <PreviewIcon className="size-3.5 flex-shrink-0" />}
            
            <span className="truncate">
              {previewText || user.about || "Tap to chat"}
            </span>
          </div>

          {/* Unread Badge */}
          {user.unreadCount > 0 && (
            <div className="flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full bg-success text-success-content text-[11px] font-bold ml-2">
              {user.unreadCount}
            </div>
          )}
        </div>
      </div>
    </button>

    {menu.visible && (
      <div
        className="fixed z-[200] bg-[#202C33] text-white rounded-lg shadow-xl py-2 w-[220px]"
        style={{ top: menu.y, left: menu.x }}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
      >
        <MenuItem label="Archive chat" />
        <MenuItem label="Mute notifications" />
        <MenuItem label="Unpin chat" />
        <MenuItem label="Mark as unread" />
        <MenuItem label="Remove from favourites" />
        <MenuItem label="Close chat" />
        <MenuItem label="Change list" />
        <hr className="border-white/10 my-1" />
        <MenuItem label="Clear chat" />
        <MenuItem label="Exit group" danger />
      </div>
    )}
    </>
  );
};

export default ChatItem;
