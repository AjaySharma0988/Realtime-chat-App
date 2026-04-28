import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { uploadStatus } from "../lib/statusService";
import { useChatStore } from "../store/useChatStore";
import {
  X, Image as ImageIcon, Video, Send, Loader2, Music, Search, Check,
  Music2, Clock, Users, Type, Smile, Scissors, PenTool, Lock, ChevronRight,
  Play, Pause, Headphones, Globe
} from "lucide-react";

/**
 * StatusUpload — High-fidelity WhatsApp/Instagram style status creator.
 * Features: Music picker (tabs), Duration selector, Audience control, Toolbar.
 */
const StatusUpload = ({ onClose, onUploaded }) => {
  const { users } = useChatStore(); // For audience selection

  const [preview, setPreview] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [mediaB64, setMediaB64] = useState(null);
  const [caption, setCaption] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Feature 2: Duration (hours)
  const [duration, setDuration] = useState(24);
  const [showDurationMenu, setShowDurationMenu] = useState(false);

  // Feature 3: Music
  const [selectedMusic, setSelectedMusic] = useState(null);
  const [showMusicMenu, setShowMusicMenu] = useState(false);
  const [musicTab, setMusicTab] = useState("Suggested");
  const [musicSearchQuery, setMusicSearchQuery] = useState("");

  // Feature 5: Audience
  const [audience, setAudience] = useState({ type: "all", users: [] });
  const [showAudienceMenu, setShowAudienceMenu] = useState(false);
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");

  const [currentAudio, setCurrentAudio] = useState(null);
  const [playingId, setPlayingId] = useState(null);

  const fileInputRef = useRef(null);
  const audioInputRef = useRef(null);

  // Cleanup audio on unmount or menu close
  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = "";
      }
    };
  }, [currentAudio]);

  useEffect(() => {
    if (!showMusicMenu && currentAudio) {
      currentAudio.pause();
      setPlayingId(null);
    }
  }, [showMusicMenu]);

  const handleMusicPlay = (song, e) => {
    e?.stopPropagation();
    console.log("Playing song:", song.title);
    if (playingId === song.title) {
      currentAudio.pause();
      setPlayingId(null);
    } else {
      if (currentAudio) {
        currentAudio.pause();
      }
      const audio = new Audio(song.previewUrl || "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3");
      audio.play().catch(err => console.error("Audio playback failed", err));
      setCurrentAudio(audio);
      setPlayingId(song.title);
    }
  };

  const handleLocalMusicUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("audio/")) {
      toast.error("Only audio files are allowed");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Audio file too large (max 10 MB)");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const localSong = {
        title: file.name,
        artist: "Local Device",
        url: ev.target.result,
        previewUrl: ev.target.result,
        duration: "Local",
        thumbnail: "https://cdn-icons-png.flaticon.com/512/4340/4340223.png",
        isLocal: true
      };
      setSelectedMusic(localSong);
      setShowMusicMenu(false);
      toast.success("Local music attached");
    };
    reader.readAsDataURL(file);
  };

  const handleAddSong = (song, e) => {
    e?.stopPropagation();
    console.log("Attaching song:", song.title);
    setSelectedMusic(song);
    setShowMusicMenu(false);
    if (currentAudio) {
      currentAudio.pause();
      setPlayingId(null);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    console.log("Selected media file:", file.name, file.size);

    const isImg = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImg && !isVideo) {
      toast.error("Only image and video files are supported");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setPreview(ev.target.result);
      setMediaB64(ev.target.result);
      setMediaType(isImg ? "image" : "video");
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!mediaB64 || !mediaType) {
      toast.error("Please select a photo or video first");
      return;
    }

    console.log("Submitting status with:", { mediaType, caption, hasMusic: !!selectedMusic, duration });
    setIsUploading(true);
    try {
      const newStatus = await uploadStatus({
        media: mediaB64,
        mediaType,
        caption: caption.trim(),
        music: selectedMusic,
        expiryDuration: duration,
        audience
      });
      console.log("Upload success:", newStatus._id);
      toast.success("Status posted!");

      // Cleanup
      setPreview(null);
      setMediaB64(null);
      setCaption("");
      setSelectedMusic(null);

      onUploaded?.(newStatus);
      onClose?.();
    } catch (err) {
      console.error("Upload error:", err);
      toast.error(err?.response?.data?.error || "Upload failed. Check file size.");
    } finally {
      setIsUploading(false);
    }
  };

  const DURATION_OPTIONS = [
    { label: "6 hours", value: 6, locked: false },
    { label: "12 hours", value: 12, locked: false },
    { label: "24 hours", value: 24, locked: false },
    { label: "48 hours", value: 48, locked: false },
  ];

  const MUSIC_TABS = ["Suggested", "Mood", "Genre"];

  const mockSongs = [
    { title: "Saasein", artist: "Sohini Mishra", duration: "4:51", thumbnail: "https://i.pravatar.cc/100?u=1", previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
    { title: "Dil Ka Rishta", artist: "Nadeem-Shravan", duration: "5:04", thumbnail: "https://i.pravatar.cc/100?u=2", previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
    { title: "Happy Birthday", artist: "Vicky D Parekh", duration: "4:21", thumbnail: "https://i.pravatar.cc/100?u=3", previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" },
    { title: "Sitaare", artist: "Arijit Singh", duration: "4:00", thumbnail: "https://i.pravatar.cc/100?u=4", previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3" },
  ].filter(s => s.title.toLowerCase().includes(musicSearchQuery.toLowerCase()));

  const S = {
    overlay: {
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      background: "#000",
      display: "flex",
      flexDirection: "column",
      color: "#fff",
      fontFamily: "Inter, sans-serif",
    },
    topBar: {
      height: "60px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 16px",
      zIndex: 10,
    },
    mediaArea: {
      flex: 1,
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    bottomPanel: {
      padding: "20px 16px env(safe-area-inset-bottom, 20px)",
      background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)",
      display: "flex",
      flexDirection: "column",
      gap: "16px",
      zIndex: 10,
    },
    menuOverlay: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      background: "#1C1C1E",
      borderTopLeftRadius: "24px",
      borderTopRightRadius: "24px",
      padding: "24px",
      zIndex: 100,
      boxShadow: "0 -10px 40px rgba(0,0,0,0.5)",
      animation: "slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    }
  };

  const renderMusicPicker = () => (
    <div style={S.menuOverlay}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold">Choose Music</h3>
        <button onClick={() => setShowMusicMenu(false)} className="p-2"><X /></button>
      </div>

      <div className="relative mb-6 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18} />
          <input
            className="w-full bg-[#2C2C2E] rounded-xl py-3.5 pl-12 pr-4 text-sm outline-none focus:ring-2 ring-primary/50 transition-all"
            placeholder="Search artists or songs..."
            value={musicSearchQuery}
            onChange={(e) => setMusicSearchQuery(e.target.value)}
          />
        </div>
        <button
          onClick={() => audioInputRef.current?.click()}
          className="btn btn-square btn-primary rounded-xl shrink-0"
          title="Upload from device"
        >
          <Headphones size={20} />
        </button>
        <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={handleLocalMusicUpload} />
      </div>

      <div className="flex gap-4 mb-6 border-b border-white/5 pb-2">
        {MUSIC_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setMusicTab(tab)}
            className={`text-sm font-bold pb-2 px-1 transition-all ${musicTab === tab ? "text-primary border-b-2 border-primary" : "text-white/40"}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
        {mockSongs.map((song, i) => (
          <div
            key={i}
            onClick={(e) => handleMusicPlay(song, e)}
            className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 transition-colors group cursor-pointer"
          >
            <div className="size-14 rounded-xl overflow-hidden relative">
              <img src={song.thumbnail} className="w-full h-full object-cover" />
              <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${playingId === song.title ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                {playingId === song.title ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" />}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">{song.title}</p>
              <p className="text-xs text-white/50 truncate">{song.artist} • {song.duration}</p>
            </div>
            <button
              onClick={(e) => handleAddSong(song, e)}
              className="px-4 py-2 rounded-xl bg-primary/20 text-primary font-bold text-xs hover:bg-primary hover:text-white transition-all flex items-center gap-2"
            >
              <Music size={14} />
              Add
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderDurationPicker = () => (
    <div style={S.menuOverlay}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold">Story Duration</h3>
        <button onClick={() => setShowDurationMenu(false)} className="p-2"><X /></button>
      </div>
      <p className="text-sm text-white/50 mb-6">Choose how long the story will be visible to your contacts.</p>

      <div className="space-y-3">
        {DURATION_OPTIONS.map(opt => (
          <div
            key={opt.value}
            onClick={() => !opt.locked && setDuration(opt.value)}
            className={`flex items-center justify-between p-4 rounded-2xl transition-all cursor-pointer ${duration === opt.value ? "bg-primary/10 ring-1 ring-primary/50" : "bg-white/5 hover:bg-white/10"
              } ${opt.locked ? "opacity-50 grayscale" : ""}`}
          >
            <span className="font-bold">{opt.label}</span>
            {opt.locked ? <Lock size={16} /> : duration === opt.value ? <Check size={20} className="text-primary" /> : null}
          </div>
        ))}
      </div>
    </div>
  );

  const toggleAudienceUser = (userId) => {
    setAudience(prev => {
      const isSelected = prev.users.includes(userId);
      const newUsers = isSelected
        ? prev.users.filter(id => id !== userId)
        : [...prev.users, userId];
      return { ...prev, users: newUsers };
    });
  };

  const renderUserSelector = () => (
    <div className="absolute inset-0 z-[1000] bg-[#1c1c1e] flex flex-col animate-in slide-in-from-right duration-300">
      <div className="p-4 flex items-center gap-4 border-b border-white/5">
        <button onClick={() => setShowUserSelector(false)} className="p-2 hover:bg-white/5 rounded-full">
          <ChevronRight className="rotate-180" />
        </button>
        <div className="flex-1">
          <h3 className="font-bold">{audience.type === "include" ? "Share with..." : "Exclude from..."}</h3>
          <p className="text-xs text-white/40">{audience.users.length} selected</p>
        </div>
        <button onClick={() => setShowUserSelector(false)} className="text-primary font-bold px-4">DONE</button>
      </div>

      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18} />
          <input
            className="w-full bg-white/5 rounded-xl py-3 pl-12 pr-4 text-sm outline-none"
            placeholder="Search contacts..."
            value={userSearchQuery}
            onChange={(e) => setUserSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-6">
        {users
          .filter(u => u.fullName.toLowerCase().includes(userSearchQuery.toLowerCase()))
          .map(user => (
            <div
              key={user._id}
              onClick={() => toggleAudienceUser(user._id)}
              className="flex items-center gap-4 p-3 hover:bg-white/5 rounded-2xl cursor-pointer"
            >
              <img src={user.profilePic || "/avatar.png"} className="size-12 rounded-full object-cover border border-white/10" />
              <div className="flex-1 text-left">
                <p className="font-medium text-[15px]">{user.fullName}</p>
              </div>
              <div className={`size-6 rounded-full border-2 flex items-center justify-center transition-all ${audience.users.includes(user._id) ? 'bg-primary border-primary' : 'border-white/20'}`}>
                {audience.users.includes(user._id) && <Check size={14} strokeWidth={4} />}
              </div>
            </div>
          ))}
      </div>
    </div>
  );

  const renderAudiencePicker = () => (
    <div style={S.menuOverlay}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold">Choose Audience</h3>
        <button onClick={() => setShowAudienceMenu(false)} className="p-2"><X /></button>
      </div>

      <div className="space-y-3">
        {[
          { id: "all", label: "My contacts", icon: Globe, desc: "Everyone in your contact list" },
          { id: "exclude", label: "My contacts except...", icon: Users, desc: "Exclude specific people", sub: `${audience.users.length} excluded` },
          { id: "include", label: "Only share with...", icon: Lock, desc: "Select specific recipients", sub: `${audience.users.length} selected` },
        ].map(opt => (
          <div
            key={opt.id}
            onClick={() => {
              setAudience({ ...audience, type: opt.id });
              if (opt.id !== "all") setShowUserSelector(true);
            }}
            className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all ${audience.type === opt.id ? "bg-success/10 ring-1 ring-success/50" : "bg-white/5 hover:bg-white/10"
              }`}
          >
            <div className={`size-12 rounded-full flex items-center justify-center ${audience.type === opt.id ? "bg-success/20 text-success" : "bg-white/10 text-white/60"}`}>
              <opt.icon size={22} />
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold">{opt.label}</p>
              <p className="text-xs text-white/40">{opt.desc}</p>
              {(opt.id === audience.type && opt.id !== "all") && (
                <p className="text-[10px] text-success font-bold mt-1 uppercase tracking-wider">{opt.sub} • Edit ></p>
              )}
            </div>
            <div className={`size-6 rounded-full border-2 flex items-center justify-center transition-all ${audience.type === opt.id ? "border-success bg-success" : "border-white/20"}`}>
              {audience.type === opt.id && <Check size={14} strokeWidth={4} />}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => setShowAudienceMenu(false)}
        className="w-full btn btn-success mt-8 h-14 rounded-2xl font-black text-lg shadow-xl shadow-success/20"
      >
        Done
      </button>

      {showUserSelector && renderUserSelector()}
    </div>
  );

  const mainUI = (
    <div style={S.overlay} onContextMenu={e => e.preventDefault()}>
      {/* ── Top Bar (Editor Tools) ────────────────────────────────── */}
      <div style={S.topBar}>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X /></button>

        {selectedMusic && (
          <div className="flex-1 px-4 animate-in slide-in-from-left-4 duration-300">
            <div className="bg-primary/20 text-primary px-3 py-1.5 rounded-full flex items-center gap-2 max-w-[200px]">
              <Music2 size={14} className="animate-pulse" />
              <span className="text-xs font-bold truncate">{selectedMusic.title}</span>
              <X size={14} className="cursor-pointer hover:text-white" onClick={() => setSelectedMusic(null)} />
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={() => setShowMusicMenu(true)} className={`p-2.5 rounded-full transition-all ${selectedMusic ? "bg-primary text-white scale-110 shadow-lg shadow-primary/30" : "hover:bg-white/10"}`}><Music2 size={22} /></button>
          <button className="p-2.5 hover:bg-white/10 rounded-full transition-colors"><Scissors size={22} /></button>
          <button className="p-2.5 hover:bg-white/10 rounded-full transition-colors"><ImageIcon size={22} /></button>
          <button className="p-2.5 hover:bg-white/10 rounded-full transition-colors"><Type size={22} /></button>
          <button className="p-2.5 hover:bg-white/10 rounded-full transition-colors"><PenTool size={22} /></button>
        </div>
      </div>

      {/* ── Media Area ────────────────────────────────────────────── */}
      <div style={S.mediaArea} onClick={() => !preview && fileInputRef.current?.click()}>
        {preview ? (
          mediaType === "video" ? (
            <video src={preview} className="w-full h-full object-contain" autoPlay loop muted />
          ) : (
            <img src={preview} className="w-full h-full object-contain" alt="Status preview" />
          )
        ) : (
          <div className="flex flex-col items-center gap-6 animate-pulse">
            <div className="size-24 rounded-full bg-white/5 flex items-center justify-center border-2 border-dashed border-white/20">
              <ImageIcon size={40} className="text-white/20" />
            </div>
            <p className="text-white/40 font-bold uppercase tracking-widest text-sm">Tap to pick media</p>
          </div>
        )}

        {/* Caption Overlay Input */}
        {preview && (
          <div className="absolute bottom-[20%] left-0 right-0 px-8 text-center">
            <textarea
              className="bg-black/30 backdrop-blur-md border border-white/10 rounded-2xl w-full p-4 text-center text-lg font-medium outline-none placeholder:text-white/30 resize-none transition-all focus:bg-black/50"
              placeholder="Add a caption..."
              rows={2}
              value={caption}
              onChange={e => setCaption(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* ── Bottom Panel ─────────────────────────────────────────── */}
      <div style={S.bottomPanel}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => setShowAudienceMenu(true)}
              className="px-4 h-11 bg-white/10 hover:bg-white/20 rounded-full flex items-center gap-2 transition-all active:scale-95"
            >
              <Users size={18} />
              <span className="text-sm font-bold">{audience.type === 'all' ? 'Contacts' : 'Private'}</span>
            </button>
            <button
              onClick={() => setShowDurationMenu(true)}
              className="size-11 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all active:scale-95 relative"
            >
              <Clock size={18} />
              <span className="absolute -top-1 -right-1 size-5 bg-primary rounded-full flex items-center justify-center text-[10px] font-black">{duration}h</span>
            </button>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isUploading || !preview}
            className="h-12 px-8 bg-success hover:bg-success/90 disabled:opacity-50 disabled:grayscale rounded-full flex items-center gap-3 transition-all active:scale-95 shadow-xl shadow-success/20"
          >
            {isUploading ? <Loader2 className="animate-spin" /> : <Send size={20} />}
            <span className="font-black uppercase tracking-widest text-sm">{isUploading ? "Posting..." : "Post"}</span>
          </button>
        </div>
      </div>

      {/* ── Sub-menus (Overlays) ──────────────────────────────────── */}
      {showMusicMenu && renderMusicPicker()}
      {showDurationMenu && renderDurationPicker()}
      {showAudienceMenu && renderAudiencePicker()}

      <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileChange} className="hidden" />

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );

  return createPortal(mainUI, document.body);
};

export default StatusUpload;
