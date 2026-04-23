import { useRef, useState, useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { Image, Send, X, Paperclip, FileText, Mic, Trash2, CornerUpLeft } from "lucide-react";
import toast from "react-hot-toast";

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

const MessageInput = ({ replyToMsg, onCancelReply }) => {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

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
    <div className="px-4 pb-4 pt-3 bg-base-200 flex-shrink-0 relative">
      {replyToMsg && <ReplyStrip message={replyToMsg} onCancel={onCancelReply} />}

      {imagePreview && (
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
        <div className="relative flex-shrink-0">
          <button type="button" onClick={() => setShowAttachMenu((v) => !v)} className="p-2 rounded-full hover:bg-base-300 transition-colors">
            <Paperclip className="size-5 text-base-content/60" />
          </button>
          {showAttachMenu && (
            <div className="absolute bottom-12 left-0 bg-base-300 rounded-xl shadow-2xl overflow-hidden w-48 z-20 border border-base-200">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-base-200 transition-colors text-left text-base-content">
                <div className="size-8 rounded-full bg-purple-500 flex items-center justify-center"><Image className="size-4 text-white" /></div>
                Photos & Videos
              </button>
              <button type="button" onClick={() => { toast("Document sharing coming soon!", { icon: "📄" }); setShowAttachMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-base-200 transition-colors text-left text-base-content">
                <div className="size-8 rounded-full bg-blue-500 flex items-center justify-center"><FileText className="size-4 text-white" /></div>
                Document
              </button>
            </div>
          )}
        </div>

        <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageChange} />

        <div className="flex-1 bg-base-300 rounded-2xl px-4 flex items-center gap-2" onClick={() => setShowAttachMenu(false)}>
          <input
            type="text"
            className="flex-1 py-2.5 bg-transparent text-sm text-base-content placeholder:text-base-content/40 outline-none"
            placeholder="Type a message"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <div className="flex-shrink-0">
          {text.trim() || imagePreview ? (
            <button type="submit" className="size-10 rounded-full bg-primary flex items-center justify-center hover:opacity-90 transition-all duration-150">
              <Send className="size-4 text-primary-content" />
            </button>
          ) : (
            <button type="button" onClick={startRecording} className="size-10 rounded-full hover:bg-base-300 flex items-center justify-center transition-all duration-150">
              <Mic className="size-5 text-base-content/60" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default MessageInput;
