import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Play, Pause, RotateCw, Maximize,
  Volume2, Volume1, VolumeX, Repeat,
  FastForward, Rewind, Upload, X, AlertCircle, Camera, Loader2
} from "lucide-react";
import { axiosInstance } from "../../lib/axios";

import MediaHome from "./MediaHome";
import ComingSoon from "./ComingSoon";
import PlaylistEmpty from "./PlaylistEmpty";
import MediaControlPanel from "./MediaControlPanel";

/**
 * WatchPartyContainer
 * Multi-state media view: Default (Call Mirror) | File Mode (Drag & Drop) | Play Mode (Video Player).
 * Designed for zero layout shift and parallel execution with the call system.
 */
const WatchPartyContainer = ({
  socket, callId, activeFeature, setActiveFeature, remoteVidRef, peerName,
  // PASSED MEDIA PROPS
  videoSrc, setVideoSrc, mediaType, setMediaType,
  emitMediaAction, emitMediaSync, isRemoteActionRef,
  // PASSED SCREEN PROPS
  screenStream, remoteScreenStream, isScreenSharing, isRemoteScreenSharing,
  startScreenShare, stopScreenShare,
  userId, setIsWatchParty, isMobile
}) => {
  const [mediaData, setMediaData] = useState(null);
  const [wpState, setWpState] = useState("idle"); // idle | confirming | playing
  const [isPlaying, setIsPlaying] = useState(false);

  const [volume, setVolume] = useState(1);
  const [isVBrowserActive, setIsVBrowserActive] = useState(false);
  const [vBrowserUrl, setVBrowserUrl] = useState("https://google.com");
  const [controller, setController] = useState("me"); // "me" or "peer"

  const videoRef = useRef(null);
  const youtubePlayerRef = useRef(null);
  const fileInputRef = useRef(null);
  const mirrorVidRef = useRef(null);
  const [localCurrentTime, setLocalCurrentTime] = useState(0);
  const [localDuration, setLocalDuration] = useState(0);
  const [playerReady, setPlayerReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // ── 🧩 LOCK SYSTEM (PREVENT CHAOS) ──
  const isApplyingRemote = useRef(false);
  const lastActionId = useRef(null);

  // ── 🧩 PART 4 — SAFE VIDEO LOADING PIPELINE (CRITICAL) ──
  const loadVideo = useCallback((url) => {
    const video = videoRef.current;
    if (!video) return;

    setIsLoading(true);
    console.log("🎬 STARTING VIDEO LOAD:", url);

    // Attach handlers BEFORE setting src
    video.onloadedmetadata = () => {
      console.log("✅ METADATA LOADED");
      video.currentTime = 0;
    };

    video.oncanplay = () => {
      console.log("🚀 VIDEO READY");
      setIsLoading(false);
      video.play().catch((err) => {
        console.warn("Autoplay blocked or failed:", err);
      });
    };

    video.onerror = () => {
      console.error("❌ VIDEO LOAD FAILED");
      setIsLoading(false);
    };

    video.pause();
    video.src = url;
    video.load();
  }, []);

  // ── 🧩 EMIT ACTIONS (SAFE) ──
  function emitAction(type) {
    if (isApplyingRemote.current || !videoRef.current) return;

    const video = videoRef.current;
    const payload = {
      callId,
      type,
      time: video.currentTime,
      actionId: Date.now() + "_" + userId,
      userId
    };

    lastActionId.current = payload.actionId;
    console.log("ACTION SENT", payload);
    socket?.emit("wp:action", payload);
  }

  // ── 🧩 PART 6 — AUTO FAIL-SAFE SYNC ──
  useEffect(() => {
    const heartbeat = setInterval(() => {
      if (!videoRef.current || isApplyingRemote.current || activeFeature !== "player") return;

      const video = videoRef.current;
      socket?.emit("wp:heartbeat", {
        callId,
        time: video.currentTime,
        playing: !video.paused,
        userId
      });
    }, 3000);

    return () => clearInterval(heartbeat);
  }, [socket, callId, userId, activeFeature]);

  // ── 🧩 PART 5 — RECEIVE ACTIONS (REAL FIX) ──
  useEffect(() => {
    if (!socket) return;

    const handleStart = ({ url, actionId }) => {
      console.log("START RECEIVED", { url, actionId });
      setIsWatchParty(true);
      setActiveFeature("player");
      setVideoSrc(url);
      setMediaType("video");
      setWpState("playing");

      setTimeout(() => {
        loadVideo(url);
      }, 100);
    };

    const handleAction = (data) => {
      if (data.actionId === lastActionId.current) return;
      console.log("ACTION RECEIVED", data);

      const video = videoRef.current;
      if (!video) return;

      isApplyingRemote.current = true;

      // TIME CORRECTION (CRITICAL)
      if (Math.abs(video.currentTime - data.time) > 0.4) {
        video.currentTime = data.time;
      }

      if (data.type === "play") {
        video.play().catch(() => { });
        setIsPlaying(true);
      }

      if (data.type === "pause") {
        video.pause();
        setIsPlaying(false);
      }

      if (data.type === "seek") {
        video.currentTime = data.time;
      }

      setTimeout(() => {
        isApplyingRemote.current = false;
      }, 100);
    };

    const handleHeartbeat = ({ time, playing }) => {
      if (isApplyingRemote.current) return;
      const video = videoRef.current;
      if (!video) return;

      if (Math.abs(video.currentTime - time) > 1.5) {
        video.currentTime = time;
      }

      if (playing && video.paused) {
        video.play().catch(() => { });
        setIsPlaying(true);
      }
      if (!playing && !video.paused) {
        video.pause();
        setIsPlaying(false);
      }
    };

    socket.on("wp:start", handleStart);
    socket.on("wp:action", handleAction);
    socket.on("wp:heartbeat", handleHeartbeat);
    socket.on("wp:stop", () => {
      console.log("STOP RECEIVED");
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = "";
      }
      setVideoSrc(null);
      setWpState("idle");
      setActiveFeature("home"); // Redirect to media home
    });

    return () => {
      socket.off("wp:start", handleStart);
      socket.off("wp:action", handleAction);
      socket.off("wp:heartbeat", handleHeartbeat);
      socket.off("wp:stop");
    };
  }, [socket, setVideoSrc, setMediaType, setActiveFeature, setIsWatchParty, setIsPlaying, loadVideo]);

  const handleStop = () => {
    console.log("STOP SENT");
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = "";
    }
    setVideoSrc(null);
    setWpState("idle");
    setActiveFeature("home"); // Redirect to media home

    socket?.emit("wp:stop", { callId, userId });
  };

  // ── 🧩 PART 10 — INITIAL LOAD ──
  useEffect(() => {
    if (videoSrc && activeFeature === "player") {
      setTimeout(() => {
        loadVideo(videoSrc);
      }, 200);
    }
  }, [activeFeature, videoSrc, loadVideo]);

  // Apply volume to videoRef
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
  }, [volume]);

  // Fullscreen for player
  const handleFullscreen = () => {
    const el = document.querySelector(".media-container");
    if (el?.requestFullscreen) el.requestFullscreen();
  };

  // ── Sync Helper for UI ──
  useEffect(() => {
    const interval = setInterval(() => {
      if (mediaType === "video" && videoRef.current) {
        setLocalCurrentTime(videoRef.current.currentTime);
        setLocalDuration(videoRef.current.duration);
      } else if (mediaType === "youtube" && youtubePlayerRef.current) {
        try {
          setLocalCurrentTime(youtubePlayerRef.current.getCurrentTime());
          setLocalDuration(youtubePlayerRef.current.getDuration());
        } catch (e) { }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [mediaType, videoSrc]);

  // ── Mirror Remote Stream ──
  useEffect(() => {
    if (mirrorVidRef.current && remoteVidRef.current?.srcObject) {
      mirrorVidRef.current.srcObject = remoteVidRef.current.srcObject;
    }
  }, [remoteVidRef, wpState, activeFeature]);

  // ── File Strategy ──────────────────────────────────────────
  const handleFile = (file) => {
    if (!file || !file.type.startsWith("video/")) return;
    const url = URL.createObjectURL(file);
    setMediaData({ file, url, name: file.name });
    setWpState("confirming");
  };

  const onConfirm = async () => {
    if (!mediaData.file) return;

    setIsLoading(true);
    try {
      // 1. Use FormData for efficient binary upload
      const formData = new FormData();
      formData.append("video", mediaData.file);

      console.log("☁️ UPLOADING TO CLOUDINARY (BINARY)...");

      // 2. Upload to backend using Multipart/Form-Data
      const res = await axiosInstance.post("/messages/upload-video", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        }
      });

      const videoUrl = res.data.secure_url;
      console.log("🚀 UPLOAD SUCCESS:", videoUrl);

      // 3. Set local state
      setVideoSrc(videoUrl);
      setMediaType("video");
      setWpState("playing");
      setActiveFeature("player");
      setIsWatchParty(true);

      // 4. Tell peer to start
      const actionId = Date.now() + "_" + userId;
      socket?.emit("wp:start", {
        callId,
        url: videoUrl,
        actionId,
        userId
      });
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed. Large videos might take a moment or check your connection.");
      setIsLoading(false);
    }
  };

  // ── Socket Helpers ──────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    const handlers = {
      "vbrowser:start": () => { setIsVBrowserActive(true); setActiveFeature("vbrowser"); },
      "vbrowser:stop": () => { setIsVBrowserActive(false); setActiveFeature("home"); },
      "vbrowser:navigate": ({ url }) => setVBrowserUrl(url),
      "vbrowser:controller": ({ controller: c }) => setController(c === "me" ? "peer" : "me"),
    };
    Object.entries(handlers).forEach(([k, v]) => socket.on(k, v));
    return () => Object.keys(handlers).forEach(k => socket.off(k));
  }, [socket, setActiveFeature]);

  // ── Cleanup ──
  useEffect(() => {
    return () => { if (videoSrc && videoSrc.startsWith("blob:")) URL.revokeObjectURL(videoSrc); };
  }, [videoSrc]);

  // RENDER LOGIC
  if (activeFeature === "home" || activeFeature === "vbrowser") {
    return (
      <MediaHome
        screenStream={screenStream}
        remoteScreenStream={remoteScreenStream}
        isScreenSharing={isScreenSharing}
        isRemoteScreenSharing={isRemoteScreenSharing}
        isVBrowserActive={activeFeature === "vbrowser" || isVBrowserActive}
        setIsVBrowserActive={setIsVBrowserActive}
        vBrowserUrl={vBrowserUrl}
        setVBrowserUrl={setVBrowserUrl}
        controller={controller}
        setController={setController}
        socket={socket}
        callId={callId}
        peerName={peerName}
        setActiveFeature={setActiveFeature}
      />
    );
  }

  if (activeFeature === "screenshare") {
    return (
      <div className={`w-full h-full flex flex-col items-center justify-center bg-[var(--fallback-b2,oklch(var(--b2)))] ${isMobile ? 'p-0' : 'p-12'} fade-in media-container relative group`}>
        {(isScreenSharing || isRemoteScreenSharing) ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-6">
            <video
              ref={el => el && (isScreenSharing ? (screenStream && (el.srcObject = screenStream)) : (remoteScreenStream && (el.srcObject = remoteScreenStream)))}
              autoPlay playsInline muted={isScreenSharing}
              className={`w-full h-full object-contain bg-black ${isMobile ? 'rounded-none' : 'rounded-xl shadow-2xl border border-white/10'}`}
            />
            {isScreenSharing && (
              <button onClick={stopScreenShare} className="absolute top-6 right-6 px-4 py-2 rounded-lg bg-red-500/80 hover:bg-red-500 text-white text-xs font-bold shadow-lg transition-all z-50 backdrop-blur-md">
                Stop Sharing
              </button>
            )}
            <MediaControlPanel volume={volume} setVolume={setVolume} handleFullscreen={handleFullscreen} />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="size-24 rounded-full bg-[#1976d2]/10 flex items-center justify-center border border-[#1976d2]/30">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1976d2" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
            </div>
            <p className="text-2xl font-bold text-white shimmer-text">Share your screen</p>
            <button onClick={startScreenShare} className="px-8 py-3 rounded-full bg-[#1976d2] hover:bg-[#1565c0] text-white font-bold shadow-lg transition-all">Start Sharing</button>
          </div>
        )}
      </div>
    );
  }

  if (activeFeature === "file") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--fallback-b2,oklch(var(--b2)))] p-12 fade-in">
        {wpState === "confirming" ? (
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="p-5 rounded-2xl bg-[var(--fallback-p,oklch(var(--p)))]/10 border border-[var(--fallback-p,oklch(var(--p)))]/30">
              <Upload className="size-10 text-[var(--fallback-p,oklch(var(--p)))]" />
            </div>
            <p className="text-2xl font-bold text-white shimmer-text">Ready to Play?</p>
            <div className="flex gap-4 w-full max-w-xs pt-4">
              <button disabled={isLoading} onClick={() => { setWpState("idle"); setActiveFeature("home"); }} className="flex-1 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 font-semibold disabled:opacity-50">Cancel</button>
              <button disabled={isLoading} onClick={onConfirm} className="flex-[2] py-2.5 rounded-xl bg-[var(--fallback-p,oklch(var(--p)))] hover:bg-[#008f72] font-bold shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50">
                {isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                {isLoading ? "Uploading..." : "Confirm & Share"}
              </button>
            </div>
          </div>
        ) : (
          <div
            className="w-full h-full border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-4 hover:bg-white/[0.02] hover:border-[var(--fallback-p,oklch(var(--p)))]/50 transition-all cursor-pointer group"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-8 text-[oklch(var(--bc) / 0.6)]" />
            <p className="text-xl font-bold text-white shimmer-text">Drag & Drop or Click to Upload</p>
            <input type="file" accept="video/*" hidden ref={fileInputRef} onChange={(e) => handleFile(e.target.files[0])} />
          </div>
        )}
      </div>
    );
  }

  if (activeFeature === "player" && videoSrc) {
    const playLocal = () => {
      if (videoRef.current) {
        videoRef.current.play().catch(() => { });
        setIsPlaying(true);
        emitAction("play");
      }
    };

    const pauseLocal = () => {
      if (videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
        emitAction("pause");
      }
    };

    const seekLocal = (time) => {
      if (videoRef.current) {
        videoRef.current.currentTime = time;
        emitAction("seek");
      }
    };

    const handleSync = () => {
      if (videoRef.current) {
        // Trigger a seek event to broadcast current time
        const currentTime = videoRef.current.currentTime;
        videoRef.current.currentTime = currentTime;
      }
    };

    return (
      <div className="relative w-full h-full group bg-black fade-in media-container">
        {isLoading && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
            <Loader2 className="size-12 text-[var(--fallback-p,oklch(var(--p)))] animate-spin mb-4" />
            <p className="text-white font-bold text-xl shimmer-text">Loading Watch Party...</p>
            <p className="text-[oklch(var(--bc) / 0.6)] text-sm mt-2">Synchronizing with peer</p>
          </div>
        )}
        <video
          ref={videoRef}
          playsInline
          autoPlay
          className="w-full h-full object-contain"
          controls={false}
          preload="auto"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
        <MediaControlPanel
          mode="file" videoRef={videoRef} volume={volume} setVolume={setVolume} handleFullscreen={handleFullscreen}
          isPlaying={isPlaying} onPlay={playLocal} onPause={pauseLocal} onSeek={seekLocal} onSync={handleSync}
          onStop={handleStop}
          currentTime={localCurrentTime} duration={localDuration}
        />
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-[var(--fallback-b2,oklch(var(--b2)))] relative flex flex-col items-center justify-center overflow-hidden fade-in">
      <video ref={mirrorVidRef} autoPlay playsInline className="w-full h-full object-cover brightness-50" />
      <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-4">
        <Camera className="size-8 text-white/20" />
        <p className="text-sm text-[oklch(var(--bc) / 0.6)]">Waiting for media stream...</p>
        <button onClick={() => setActiveFeature("file")} className="mt-4 px-6 py-2 rounded-full bg-[var(--fallback-p,oklch(var(--p)))] text-white text-sm font-bold shadow-lg hover:bg-[#008f72]">Share Media</button>
      </div>
    </div>
  );
};

export default WatchPartyContainer;
