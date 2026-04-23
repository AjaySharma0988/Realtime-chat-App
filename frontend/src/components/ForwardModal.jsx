import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Send, Search, Check } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";

const ForwardModal = ({ messages, onClose }) => {
  const { users } = useChatStore();
  const [selectedChats, setSelectedChats] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSending, setIsSending] = useState(false);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter((u) => u.fullName.toLowerCase().includes(q));
  }, [users, searchQuery]);

  const toggleChat = (chatId) => {
    setSelectedChats((prev) =>
      prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [...prev, chatId]
    );
  };

  const handleForward = async () => {
    if (selectedChats.length === 0) return;
    setIsSending(true);
    try {
      // Send sequential distinct requests (or parallel based on your API capability)
      const promises = [];
      for (const userId of selectedChats) {
        for (const msg of messages) {
          if (msg.text) promises.push(axiosInstance.post(`/messages/send/${userId}`, { text: msg.text }));
          if (msg.image) promises.push(axiosInstance.post(`/messages/send/${userId}`, { image: msg.image }));
        }
      }
      await Promise.all(promises);
      toast.success(`Forwarded to ${selectedChats.length} chat${selectedChats.length > 1 ? "s" : ""}`);
      onClose();
    } catch {
      toast.error("Failed to forward messages");
    } finally {
      setIsSending(false);
    }
  };

  const previewMsg = messages[0];

  return createPortal(
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/70 backdrop-blur-sm select-none">
      <div
        className="w-full max-w-[420px] h-[80vh] min-h-[500px] max-h-[700px] bg-[#111b21] rounded-[16px] shadow-2xl flex flex-col relative overflow-hidden"
        style={{ animation: "wa-pop-in 0.2s cubic-bezier(0.1, 0.9, 0.2, 1)" }}
      >
        {/* ── HEADER ── */}
        <div className="flex items-center gap-6 px-6 py-4 bg-[#111b21]">
          <button onClick={onClose} className="text-[#aebac1] hover:text-[#d1d7db] transition-colors">
            <X className="size-6" />
          </button>
          <h2 className="text-[18px] font-medium text-[#e9edef]">Forward message to</h2>
        </div>

        {/* ── SEARCH BAR ── */}
        <div className="px-4 pb-2 border-b border-[#222d34]">
          <div className="flex items-center gap-3 bg-[#202c33] rounded-[8px] px-4 py-1.5 border-b-[2px] border-transparent focus-within:border-[#00a884] transition-all">
            <Search className="size-4 text-[#8696a0]" />
            <input
              type="text"
              placeholder="Search name or number"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent outline-none text-[#d1d7db] text-[15px] placeholder:text-[#8696a0] py-1"
            />
          </div>
        </div>

        {/* ── CHAT LIST ── */}
        <div className="flex-1 overflow-y-auto px-2 py-2 wa-scrollbar">
          {/* My Status (Static mock matching WhatsApp structural feel) */}
          {!searchQuery && (
            <div className="flex items-center gap-4 p-2 hover:bg-[#202c33] rounded-lg cursor-not-allowed opacity-60">
              <div className="size-5 rounded-[4px] border-2 border-[#8696a0] flex-shrink-0" />
              <div className="size-12 rounded-full bg-[#00a884] flex items-center justify-center flex-shrink-0">
                <div className="size-6 rounded-full border-2 border-white border-dashed" />
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-[#e9edef] text-[16px]">My status</span>
                <span className="text-[13px] text-[#8696a0]">My contacts</span>
              </div>
            </div>
          )}

          {!searchQuery && <div className="text-[#00a884] text-[14px] font-medium px-4 py-3">Recent chats</div>}

          {filteredUsers.length === 0 ? (
            <div className="text-center text-[#8696a0] py-10 text-[14px]">No contacts found</div>
          ) : (
            filteredUsers.map((user) => {
              const checked = selectedChats.includes(user._id);
              return (
                <div
                  key={user._id}
                  onClick={() => toggleChat(user._id)}
                  className="flex items-center gap-4 p-2 hover:bg-[#202c33] rounded-lg cursor-pointer transition-colors"
                >
                  <label className="relative flex items-center justify-center size-5 ml-1 flex-shrink-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      readOnly
                      className="peer sr-only"
                    />
                    <div className="size-full rounded-[4px] border-2 border-[#8696a0] peer-checked:bg-[#00a884] peer-checked:border-[#00a884] transition-colors flex items-center justify-center">
                       {checked && <Check className="size-3 text-black stroke-[3]" />}
                    </div>
                  </label>

                  <img src={user.profilePic || "/avatar.png"} alt="" className="size-12 rounded-full object-cover flex-shrink-0" />

                  <div className="flex flex-col flex-1 truncate bottom-border pb-3 pt-2 border-b border-[#222d34]">
                    <span className="font-normal text-[#e9edef] text-[16px] truncate">
                      {user.fullName} {user._id === users[0]?._id ? "" : ""}
                    </span>
                    <span className="text-[13px] text-[#8696a0] truncate mt-0.5">
                      Contact
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── BOTTOM PREVIEW BAR ── */}
        <div className="bg-[#202c33] p-3 flex items-center gap-3 relative shadow-[0_-2px_10px_rgba(0,0,0,0.2)]">
          {previewMsg?.image ? (
            <div className="relative size-12 rounded-[6px] overflow-hidden flex-shrink-0 border border-white/10">
              <img src={previewMsg.image} className="size-full object-cover" />
            </div>
          ) : previewMsg?.text ? (
            <div className="size-12 rounded-[6px] bg-[#00a884]/20 flex items-center justify-center flex-shrink-0 border border-[#00a884]/30">
              <span className="text-[#00a884] text-[10px] uppercase font-bold">Text</span>
            </div>
          ) : null}

          <div className="flex flex-col flex-1 truncate">
            {previewMsg?.image && <span className="text-[13px] text-[#8696a0] flex items-center gap-1">Photo</span>}
            <span className="text-[14px] text-[#e9edef] truncate">
              {previewMsg?.text || (previewMsg?.image && "Photo") || "Message"} {messages.length > 1 && `(+${messages.length - 1} more)`}
            </span>
          </div>

          <button onClick={onClose} className="p-2 ml-1 text-[#8696a0] hover:text-[#d1d7db] transition-colors">
            <X className="size-5" />
          </button>
        </div>

         {/* ── FLOATING SEND BUTTON ── */}
         <div className={`absolute bottom-[76px] right-6 transition-all duration-300 transform ${
            selectedChats.length > 0 ? "scale-100 opacity-100" : "scale-50 opacity-0 pointer-events-none"
         }`}>
           <button
             onClick={handleForward}
             disabled={isSending}
             className="size-14 rounded-full bg-[#00a884] flex items-center justify-center shadow-xl hover:bg-[#06cf9c] transition-colors disabled:opacity-50"
           >
             {isSending ? (
               <div className="size-5 border-2 border-base-100 border-t-transparent rounded-full animate-spin" />
             ) : (
               <Send className="size-6 text-white ml-1" />
             )}
           </button>
         </div>

      </div>
    </div>,
    document.body
  );
};

export default ForwardModal;
