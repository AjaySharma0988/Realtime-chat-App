import React, { useEffect, useState } from "react";
import {
  Play, Maximize, Volume2, VolumeX, Volume1,
  Subtitles, Monitor, Repeat, Clock, FastForward,
  Settings, Type, Pause, X, RotateCcw, Minimize
} from "lucide-react";

/**
 * MediaControlPanel — UNIVERSAL MEDIA CONTROL BAR
 * Works across Screen Share, File Playback, and VBrowser.
 * Functional: Volume & Fullscreen (via videoRef).
 * UI Only: Play, Sync, Timeline, Speed, CC.
 */
const MediaControlPanel = ({
  mode = "screen", // "screen" | "file" | "browser"
  videoRef,
  volume = 1,
  setVolume,
  handleFullscreen: parentHandleFullscreen,
  isVisible = true,
  // NEW PROPS
  isPlaying,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onSync,
  currentTime = 0,
  duration = 0
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(1);
  const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth < 768);
  const [isVerySmallScreen, setIsVerySmallScreen] = useState(window.innerWidth < 480);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Handle Window Resize for responsiveness
  useEffect(() => {
    const handleResize = () => {
      setIsSmallScreen(window.innerWidth < 768);
      setIsVerySmallScreen(window.innerWidth < 480);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Sync volume to video element if videoRef is provided
  useEffect(() => {
    if (videoRef?.current) {
      videoRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted, videoRef]);

  const toggleMute = () => {
    if (isMuted) {
      setVolume(prevVolume);
      setIsMuted(false);
    } else {
      setPrevVolume(volume);
      setVolume(0);
      setIsMuted(true);
    }
  };

  // Sync fullscreen state with browser events
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement || !!document.webkitFullscreenElement || !!document.msFullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
    };
  }, []);

  const handleFullscreenInternal = () => {
    if (isFullscreen) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      else if (document.msExitFullscreen) document.msExitFullscreen();
      return;
    }

    if (parentHandleFullscreen) {
      parentHandleFullscreen();
      return;
    }
    const target = videoRef?.current || document.querySelector(".media-container");
    if (!target) return;

    if (target.requestFullscreen) target.requestFullscreen();
    else if (target.webkitRequestFullscreen) target.webkitRequestFullscreen();
    else if (target.msRequestFullscreen) target.msRequestFullscreen();
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds === null) return "00:00:00";
    return new Date(seconds * 1000).toISOString().substr(11, 8);
  };

  if (!isVisible) return null;

  return (
    <div className={`media-control-panel-wrapper mode-${mode} ${isSmallScreen ? "is-small" : ""} ${isVerySmallScreen ? "is-very-small" : ""}`}>
      <div className="media-control-panel glass-morphism flex items-center justify-between gap-4 px-6 py-2.5 transition-all duration-300 border border-white/10 shadow-2xl">
        
        {/* SECTION 1: PLAYBACK CONTROLS (LEFT) */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={isPlaying ? onPause : onPlay}
            className="media-icon-btn text-white hover:text-[#00A884] transition-all hover:scale-110 active:scale-95"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}
          </button>

          {mode === "file" && !isVerySmallScreen && (
            <button
              onClick={onSync}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00A884]/15 border border-[#00A884]/20 hover:bg-[#00A884]/25 transition-all group"
              title="Sync to Host"
            >
              <Repeat className="size-3 text-[#00A884] group-hover:rotate-180 transition-transform duration-500" />
              {!isSmallScreen && <span className="text-[9px] font-bold text-[#00A884] uppercase tracking-widest">Sync</span>}
            </button>
          )}

          {!isSmallScreen && (
            <div className="flex items-center gap-2 text-white/70 font-mono text-[11px] tabular-nums bg-white/5 px-2.5 py-1 rounded-md border border-white/5">
              <Clock className="size-3" />
              <span>{formatTime(currentTime)}</span>
              <span className="opacity-30">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          )}
        </div>

        {/* SECTION 2: TIMELINE (CENTER - EXPANDS) */}
        <div className="flex-1 flex items-center min-w-[100px] px-2">
          <div className="relative w-full group/timeline">
            <input
              type="range"
              min="0"
              max={duration || 0}
              step="0.1"
              value={currentTime}
              onChange={(e) => onSeek(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#00A884] hover:h-2 transition-all"
            />
          </div>
        </div>

        {/* SECTION 3: UTILITIES & CLOSE (RIGHT) */}
        <div className="flex items-center gap-3 flex-shrink-0">
          
          {/* Volume Control */}
          <div className="flex items-center gap-2 group/vol relative">
            <button
              onClick={toggleMute}
              className="media-icon-btn text-white/70 hover:text-white"
            >
              {isMuted || volume === 0 ? <VolumeX className="size-4" /> : volume < 0.5 ? <Volume1 className="size-4" /> : <Volume2 className="size-4" />}
            </button>
            {!isVerySmallScreen && (
              <div className="w-0 group-hover/vol:w-20 overflow-hidden transition-all duration-300 flex items-center">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => {
                    setVolume(parseFloat(e.target.value));
                    if (parseFloat(e.target.value) > 0) setIsMuted(false);
                  }}
                  className="media-volume-slider w-full h-1 accent-[#00A884]"
                />
              </div>
            )}
          </div>

          {!isSmallScreen && (
            <button
              onClick={handleFullscreenInternal}
              className="media-icon-btn text-white/70 hover:text-white"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize className="size-4.5" /> : <Maximize className="size-4.5" />}
            </button>
          )}

          {/* CLOSE BUTTON (FINE-TUNED) */}
          {mode === "file" && (
            <button
              onClick={onStop}
              className="ml-1 px-4 py-1.5 rounded-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-[10px] font-extrabold uppercase tracking-widest transition-all border border-red-500/20 flex items-center gap-1.5 shadow-lg active:scale-95"
            >
              <X className="size-3 stroke-[3px]" />
              {!isSmallScreen && "Close"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MediaControlPanel;
