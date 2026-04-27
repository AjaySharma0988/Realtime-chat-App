import { useRef, useState, useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { Image, Send, X, Paperclip, FileText, Mic, Trash2, CornerUpLeft, Smile, Camera, Headphones, User, BarChart2, Calendar, Sticker } from "lucide-react";
import toast from "react-hot-toast";
import EmojiPicker from "./EmojiPicker";

const getSupportedMimeType = () => {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
};

const formatDuration = (secs) => {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

// ── Inline reply strip (shown above the text input) ───────────────────────────
const ReplyStrip = ({ message, onCancel }) => {
  const { authUser } = useAuthStore();
  const isSelf = message.senderId === authUser._id;
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-base-300/60 rounded-xl mb-2 border-l-4 border-primary">
      <CornerUpLeft className="size-4 text-primary flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-primary mb-0.5">
          {isSelf ? "Replying to yourself" : `Replying to ${message._senderName || "contact"}`}
        </p>
        <p className="text-xs text-base-content/60 truncate">
          {message.image ? "📷 Photo" : message.audio ? "🎤 Voice message" : message.text}
        </p>
      </div>
      <button type="button" onClick={onCancel} className="p-1 rounded-full hover:bg-base-300 transition-colors flex-shrink-0">
        <X className="size-4 text-base-content/50" />
      </button>
    </div>
  );
};

// ── Attachment Item Component ──────────────────────────────────────────────
const AttachmentItem = ({ icon: Icon, label, onClick, color }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center gap-4 px-4 py-3 text-[15px] hover:bg-white/5 transition-colors text-left text-zinc-200 group"
  >
    <Icon className={`size-5 ${color} transition-transform group-active:scale-90`} />
    <span className="font-medium">{label}</span>
  </button>
);

const MessageInput = ({ 
  replyToMsg, 
  onCancelReply, 
  onOpenCamera, 
  injectedImage, 
  onSendComplete, 
  isOverlayMode, 
  onSend,
  hideAttachment = false,
  isTransparent = false
}) => {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(injectedImage || null);

  useEffect(() => {
    setImagePreview(injectedImage || null);
  }, [injectedImage]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const fileInputRef     = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const streamRef        = useRef(null);
  const timerRef         = useRef(null);
  const isCancelledRef   = useRef(false);

  const { sendMessage } = useChatStore();

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === "recording") {
        isCancelledRef.current = true;
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Build the embedded replyTo snapshot ────────────────────────────────────
  const buildReplyTo = () => {
    if (!replyToMsg) return null;
    return {
      messageId:  replyToMsg._id,
      text:       replyToMsg.text       || null,
      senderName: replyToMsg._senderName || null,
      image:      replyToMsg.image      || null,
    };
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
    setShowAttachMenu(false);
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() && !imagePreview) return;
    
    // Hijack send if onSend is provided (for Status replies)
    if (onSend) {
      onSend({ text: text.trim(), image: imagePreview });
      setText("");
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const messagePayload = {
      text:    text.trim(),
      image:   imagePreview,
      replyTo: buildReplyTo(),
    };
    
    // Sync-clear UI state instantly to categorically eliminate duplicate submits
    setText("");
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onCancelReply?.();
    
    // Instantly close the camera overlay if active
    if (onSendComplete) onSendComplete();
    
    try {
      await sendMessage(messagePayload);
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      isCancelledRef.current = false;
      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (isCancelledRef.current) return;
        const blob   = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            await sendMessage({ audio: reader.result, replyTo: buildReplyTo() });
            onCancelReply?.();
          } catch { toast.error("Failed to send voice message"); }
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => setRecordingDuration((d) => d + 1), 1000);
      setTimeout(() => { if (mediaRecorderRef.current?.state === "recording") stopRecording(); }, 60_000);
    } catch {
      toast.error("Microphone access denied. Please allow microphone permission.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    clearInterval(timerRef.current);
    setIsRecording(false);
  };

  const cancelRecording = () => {
    isCancelledRef.current = true;
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    clearInterval(timerRef.current);
    setIsRecording(false);
    setRecordingDuration(0);
    toast("Recording cancelled", { icon: "🗑️" });
  };
  
  const handleEmojiSelect = (emoji) => {
    setText((prev) => prev + emoji);
  };

  if (isRecording) {
    return (
      <div className="px-4 pb-4 pt-3 bg-base-200 flex-shrink-0">
        <div className="flex items-center gap-3 bg-base-300 rounded-2xl px-4 py-3">
          <button type="button" onClick={cancelRecording} className="p-1.5 rounded-full hover:bg-error/20 transition-colors flex-shrink-0">
            <Trash2 className="size-5 text-error" />
          </button>
          <div className="flex-1 flex items-center gap-3">
            <div className="flex items-end gap-0.5 h-5">
              {[2, 5, 3, 7, 4, 6, 2, 5, 3, 6].map((h, i) => (
                <div key={i} className="w-1 rounded-full bg-error" style={{ height: `${h * 3}px`, animation: `pulse 0.7s ease-in-out ${i * 0.07}s infinite alternate` }} />
              ))}
            </div>
            <span className="text-sm font-mono text-error font-semibold tabular-nums">{formatDuration(recordingDuration)}</span>
          </div>
          <button type="button" onClick={stopRecording} className="size-10 rounded-full bg-primary flex items-center justify-center hover:opacity-90 transition-opacity flex-shrink-0">
            <Send className="size-4 text-primary-content" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`px-4 pb-4 pt-3 ${isTransparent ? 'bg-transparent' : (isOverlayMode ? 'bg-[#0B141A]' : 'bg-transparent')} flex-shrink-0 relative z-20 transition-colors duration-200`}>
      {replyToMsg && <ReplyStrip message={replyToMsg} onCancel={onCancelReply} />}

      {imagePreview && !isOverlayMode && (
        <div className="mb-2">
          <div className="relative inline-block">
            <img src={imagePreview} alt="Preview" className="w-20 h-20 object-cover rounded-xl border border-base-300" />
            <button onClick={removeImage} type="button" className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-error flex items-center justify-center">
              <X className="size-3 text-white" />
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="flex items-center gap-2">
        <div className={`flex-1 ${isTransparent ? 'bg-black/30 backdrop-blur-md' : 'bg-[#202C33]'} rounded-full flex items-center px-3 py-1.5 min-h-[52px] relative border border-white/5`}>
          {/* ATTACHMENT POPUP */}
          {showAttachMenu && (
            <div className="absolute bottom-full mb-4 left-0 bg-[#233138] rounded-2xl shadow-2xl overflow-hidden w-64 z-50 border border-white/10 animate-in slide-in-from-bottom-4">
              <div className="flex flex-col py-2">
                <AttachmentItem 
                  onClick={() => { fileInputRef.current?.click(); setShowAttachMenu(false); }} 
                  icon={FileText} label="Document" color="text-[#7f66ff]" 
                />
                <AttachmentItem 
                  onClick={() => { fileInputRef.current?.click(); setShowAttachMenu(false); }} 
                  icon={Image} label="Photos & videos" color="text-[#007bfc]" 
                />
                <AttachmentItem 
                  onClick={() => { 
                    if (onOpenCamera) onOpenCamera(); 
                    setShowAttachMenu(false); 
                  }} 
                  icon={Camera} label="Camera" color="text-[#ff2e74]" 
                />
                <AttachmentItem 
                  onClick={() => { toast("Audio sharing coming soon!"); setShowAttachMenu(false); }} 
                  icon={Headphones} label="Audio" color="text-[#ff8c00]" 
                />
                <AttachmentItem 
                  onClick={() => { toast("Contact sharing coming soon!"); setShowAttachMenu(false); }} 
                  icon={User} label="Contact" color="text-[#00a884]" 
                />
                <AttachmentItem 
                  onClick={() => { toast("Polls coming soon!"); setShowAttachMenu(false); }} 
                  icon={BarChart2} label="Poll" color="text-[#ffbc2e]" 
                />
                <AttachmentItem 
                  onClick={() => { toast("Events coming soon!"); setShowAttachMenu(false); }} 
                  icon={Calendar} label="Event" color="text-[#ff4500]" 
                />
                <AttachmentItem 
                  onClick={() => { toast("Sticker maker coming soon!"); setShowAttachMenu(false); }} 
                  icon={Sticker} label="New sticker" color="text-[#00bfa5]" 
                />
              </div>
            </div>
          )}

          {/* EMOJI PICKER POPUP */}
          <EmojiPicker 
            isOpen={showEmojiPicker} 
            onClose={() => setShowEmojiPicker(false)}
            onSelect={handleEmojiSelect}
          />

          {/* ATTACHMENT / PLUS BUTTON */}
          {!hideAttachment && (
            <button 
              type="button" 
              onClick={() => {
                setShowAttachMenu((v) => !v);
                setShowEmojiPicker(false);
              }} 
              className={`p-2 transition-all active:scale-90 ${showAttachMenu ? "text-primary rotate-45" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-6">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          )}

          {/* EMOJI BUTTON */}
          <button 
            type="button" 
            className={`p-2 transition-colors ${showEmojiPicker ? "text-primary" : "text-zinc-400 hover:text-zinc-200"}`}
            onClick={() => {
              setShowEmojiPicker(!showEmojiPicker);
              setShowAttachMenu(false);
            }}
          >
            <Smile className="size-6" />
          </button>

          {/* TEXT INPUT */}
          <input
            type="text"
            className="flex-1 py-2 bg-transparent text-[15px] text-zinc-100 placeholder:text-zinc-500 outline-none px-2"
            placeholder="Type a message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setShowAttachMenu(false)}
          />

          {/* MIC / SEND (Inside the bar) */}
          <div className="flex items-center pr-1">
            {text.trim() || imagePreview ? (
              <button 
                type="submit" 
                className="size-9 rounded-full bg-[#00a884] flex items-center justify-center hover:opacity-90 transition-all active:scale-90"
              >
                <Send className="size-4 text-black fill-black" style={{ transform: "rotate(-10deg)" }} />
              </button>
            ) : (
              <button 
                type="button" 
                onClick={startRecording} 
                className="p-2 text-zinc-400 hover:text-zinc-200 transition-all active:scale-90"
              >
                <Mic className="size-6" />
              </button>
            )}
          </div>
        </div>

        <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageChange} />
      </form>
    </div>
  );
};

export default MessageInput;
