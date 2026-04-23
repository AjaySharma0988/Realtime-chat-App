import React, { useState, useEffect, useRef } from "react";
import "./callWindow.css";

// ════════════════════════════════════════════════════════════
//  SVG ICON HELPERS  (inline so no extra deps needed)
// ════════════════════════════════════════════════════════════
const IconDots = () => (
  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
    <circle cx="12" cy="5"  r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
  </svg>
);
const IconCam = () => (
  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
  </svg>
);
const IconCamOff = () => (
  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
    <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/>
  </svg>
);
const IconMic = () => (
  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
  </svg>
);
const IconMicOff = () => (
  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9l4.19 4.18L21 20.73 4.27 3z"/>
  </svg>
);
const IconEmoji = () => (
  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
  </svg>
);
const IconHand = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M7 11.5V5a2 2 0 114 0v6.5m-4 0a2 2 0 104 0m-4 0a2 2 0 114 0m0 0V9a2 2 0 014 0v2.5m0 0a2 2 0 104 0m-4 0a2 2 0 114 0m0 0V11a2 2 0 014 0v2.5a2 2 0 01-2 2 10 10 0 01-10 10 10 10 0 01-10-10 2 2 0 012-2 2 2 0 012 2v1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconScreen = () => (
  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
    <path d="M21 3H3c-1.11 0-2 .89-2 2v12c0 1.1.89 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.11-.9-2-2-2zm0 14H3V5h18v12z"/>
  </svg>
);
const IconAddUser = () => (
  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
    <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
  </svg>
);
const IconChat = () => (
  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
    <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/>
  </svg>
);
const IconPhoneEnd = () => (
  <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
    <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
  </svg>
);
const IconSwap = () => (
  <svg className="w-5 h-5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconLock = () => (
  <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
  </svg>
);
const IconWA = () => (
  <svg viewBox="0 0 24 24" fill="white" className="w-full h-full">
    <path d="M12.031 2c-5.517 0-9.989 4.443-9.989 9.92 0 1.742.451 3.446 1.309 4.938L2 22l5.311-1.383c1.447.781 3.076 1.196 4.711 1.196.002 0 .004 0 .005 0 5.516 0 9.988-4.443 9.988-9.92 0-5.477-4.471-9.92-9.984-9.92zm0 18.2c-1.572 0-3.111-.42-4.461-1.214l-.32-.191-3.32.865.885-3.216-.21-.332a8.21 8.21 0 0 1-1.259-4.39c0-4.516 3.692-8.188 8.243-8.188 2.204 0 4.275.854 5.83 2.405a8.146 8.146 0 0 1 2.41 5.792c0 4.516-3.692 8.188-8.238 8.188z"/>
  </svg>
);

// ════════════════════════════════════════════════════════════
//  TOP BAR  — UNCHANGED logic, upgraded markup
// ════════════════════════════════════════════════════════════
// ── Media Panel (Renamed from TopBar) ──────────────────────────────────────
const MediaPanel = ({ targetName, setMinimized }) => (
  <header className="media-panel">
    {/* Left: WA logo + name */}
    <div className="flex items-center gap-2.5">
      <div className="w-5 h-5 bg-[#00a884] rounded-[5px] flex items-center justify-center p-[3px] flex-shrink-0">
        <IconWA />
      </div>
      <span className="text-[13px] font-medium text-[#e9edef] truncate max-w-[160px]">{targetName}</span>
    </div>

    {/* Center: E2E badge */}
    <div className="hidden md:flex items-center gap-1.5 text-[11px] text-[#8696A0] absolute left-1/2 -translate-x-1/2 pointer-events-none">
      <IconLock />
      <span>End-to-end encrypted</span>
    </div>

    {/* Right: window controls */}
    <div className="flex items-center">
      <div className="win-btn" onClick={() => setMinimized(true)} title="Minimize">
        <svg width="10" height="1" viewBox="0 0 10 1" fill="white"><rect width="10" height="1"/></svg>
      </div>
      <div className="win-btn" title="Maximize">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white"><rect x="0.5" y="0.5" width="9" height="9"/></svg>
      </div>
      <div className="win-btn close" onClick={() => window.location.reload()} title="Close">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="1.2"><path d="M1 1L9 9M9 1L1 9"/></svg>
      </div>
    </div>
  </header>
);

// ════════════════════════════════════════════════════════════
//  BOTTOM CONTROLS
// ════════════════════════════════════════════════════════════
const BottomControls = ({ state, toggleLocalStatus, toggleHandRaise, toggleWatchParty, handleEndCall }) => (
  <footer className="bottom-bar">

    {/* ── LEFT: Mic + Camera ─────────────────────────────── */}
    <div className="bottom-bar-left">
      <button
        className={`control-btn ${state.localCamOff ? 'active-off' : ''}`}
        onClick={() => toggleLocalStatus('cam')}
        title={state.localCamOff ? 'Turn on camera' : 'Turn off camera'}
      >
        {state.localCamOff ? <IconCamOff /> : <IconCam />}
      </button>
      <button
        className={`control-btn ${state.localMicOff ? 'active-off' : ''}`}
        onClick={() => toggleLocalStatus('mic')}
        title={state.localMicOff ? 'Unmute' : 'Mute'}
      >
        {state.localMicOff ? <IconMicOff /> : <IconMic />}
      </button>
    </div>

    {/* ── CENTER: 5 Features ─────────────────────────────── */}
    <div className="bottom-bar-center">
      <button className="feature-btn" title="Emoji" onClick={() => {}}>
        <IconEmoji />
      </button>

      <button
        className={`feature-btn ${state.isHandRaised ? 'active-off' : ''}`}
        title="Raise Hand"
        onClick={toggleHandRaise}
      >
        <IconHand />
      </button>

      <button
        className={`feature-btn ${state.isWatchParty ? 'active-off' : ''}`}
        title="Watch Party"
        onClick={toggleWatchParty}
      >
        <IconScreen />
      </button>

      <button className="feature-btn" title="Add Participant" onClick={() => {}}>
        <IconAddUser />
      </button>

      <button className="feature-btn" title="Chat" onClick={() => {}}>
        <IconChat />
      </button>
    </div>

    {/* ── RIGHT: End Call ────────────────────────────────── */}
    <div className="bottom-bar-right">
      <button className="end-call-btn" onClick={handleEndCall} title="End call">
        <IconPhoneEnd />
      </button>
    </div>
  </footer>
);

// ════════════════════════════════════════════════════════════
//  STATUS BANNER
// ════════════════════════════════════════════════════════════
const StatusBanner = ({ state, targetName }) => {
  const isLocalInMain  = state.isSwapped;
  const isRemoteInMain = !state.isSwapped;

  let show = false;
  let text = "";

  if (state.isWatchParty) {
    if (state.localCamOff) { show = true; text = "Your camera is off"; }
  } else {
    if      (isRemoteInMain && state.remoteCamOff) { show = true; text = `${targetName}'s camera is off`; }
    else if (isLocalInMain  && state.localCamOff)  { show = true; text = "Your camera is off"; }
  }

  if (!show) return null;

  return (
    <div className="status-banner">
      {text}
    </div>
  );
};

// ════════════════════════════════════════════════════════════
//  MAIN COMPONENT  — ALL LOGIC UNCHANGED
// ════════════════════════════════════════════════════════════
export default function CallWindow({ nativeWebRTC, targetInfo, endCall, setMinimized }) {

  // ── STATE (UNCHANGED) ───────────────────────────────────
  const [state, setState] = useState({
    isSwapped:    false,
    isWatchParty: false,
    localCamOff:  false,
    localMicOff:  false,
    remoteCamOff: false,
    remoteMicOff: false,
    isHandRaised: false,
  });

  const [mainMode, setMainMode] = useState('contain');
  const [selfMode, setSelfMode] = useState('cover');
  const [menuOpen, setMenuOpen] = useState({ main: false, self: false });

  const mainVidRef  = useRef(null);
  const selfVidRef  = useRef(null);
  const remoteWPRef = useRef(null);

  // ── LOGIC (UNCHANGED) ───────────────────────────────────
  const toggleLocalStatus = (type) => {
    setState(prev => {
      const next = { ...prev, [`local${type === 'cam' ? 'Cam' : 'Mic'}Off`]: !prev[`local${type === 'cam' ? 'Cam' : 'Mic'}Off`] };
      if (nativeWebRTC) {
        if (type === 'cam') nativeWebRTC.toggleCamera();
        if (type === 'mic') nativeWebRTC.toggleMute();
      }
      return next;
    });
  };

  const toggleWatchParty = () => setState(prev => ({ ...prev, isWatchParty: !prev.isWatchParty, isSwapped: false }));
  const toggleHandRaise  = () => setState(prev => ({ ...prev, isHandRaised: !prev.isHandRaised }));

  const handleScreenSwap = (e) => {
    if (state.isWatchParty) return;
    if (e.target.closest('.menu-trigger-small') || e.target.closest('.dropdown-menu-custom')) return;
    setState(prev => ({ ...prev, isSwapped: !prev.isSwapped }));
  };

  // Stream assignment (UNCHANGED)
  useEffect(() => {
    if (!nativeWebRTC) return;
    const { localStream, remoteStream } = nativeWebRTC;
    const applyStream = (ref, stream) => {
      if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
    };
    if (state.isWatchParty) {
      applyStream(selfVidRef,  localStream);
      applyStream(remoteWPRef, remoteStream);
    } else {
      applyStream(mainVidRef, state.isSwapped ? localStream  : remoteStream);
      applyStream(selfVidRef, state.isSwapped ? remoteStream : localStream);
    }
  }, [nativeWebRTC, state.isSwapped, state.isWatchParty]);

  const targetName = targetInfo?.fullName || "Contact";

  // Close dropdowns on outside click (UNCHANGED)
  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (!e.target.closest('.menu-trigger') && !e.target.closest('.menu-trigger-small')) {
        setMenuOpen({ main: false, self: false });
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Derived UI from state
  const mainCamHidden = state.isSwapped ? state.localCamOff  : state.remoteCamOff;
  const selfCamHidden = state.isSwapped ? state.remoteCamOff : state.localCamOff;
  const mainMicOff    = state.isSwapped ? state.localMicOff  : state.remoteMicOff;
  const selfMicOff    = state.isSwapped ? state.remoteMicOff : state.localMicOff;

  // ── RENDER ──────────────────────────────────────────────
  return (
    <div className="wa-call-window">
      <div className="window-frame">

        {/* ── Media Panel ────────────────────────────────────────── */}
        <MediaPanel
          targetName={state.isWatchParty ? "Watch Party" : (state.isSwapped ? "You" : targetName)}
          setMinimized={setMinimized}
        />

        {/* ── Video Area ───────────────────────────────────── */}
        <main
          id="mainContainer"
          className={`video-container ${state.isWatchParty ? 'watch-party-active' : ''}`}
        >
          {/* Blurred background portrait */}
          <div
            className="video-bg-effect"
            style={{ backgroundImage: `url(${targetInfo?.profilePic || '/avatar.png'})` }}
          />

          {/* ── Watch Party Layer ─────────────────────────── */}
          <div className={`watch-party-content ${state.isWatchParty ? 'active' : ''}`}>
            <div className="w-full h-full flex items-center justify-center p-8">
              <div className="w-full max-w-5xl aspect-video bg-[#111] rounded-xl overflow-hidden shadow-2xl relative border border-white/5">
                <img
                  src="https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80&w=1280"
                  className="w-full h-full object-cover opacity-60"
                  alt="WatchParty"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="w-20 h-20 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md transition-all cursor-pointer group">
                    <svg className="w-8 h-8 text-white fill-current group-hover:scale-110 transition-transform" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  </div>
                  <span className="mt-4 text-white/50 font-medium tracking-widest text-xs">WATCH PARTY IN PROGRESS</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Main Video Wrapper ────────────────────────── */}
          <div className="video-wrapper">

            {/* Status banner (cam off) */}
            <StatusBanner state={state} targetName={targetName} />

            {/* MAIN VIDEO */}
            <div
              className="relative w-full h-full flex items-center justify-center"
              style={{ display: state.isWatchParty ? 'none' : 'flex' }}
            >
              <video
                ref={mainVidRef}
                autoPlay
                playsInline
                muted={state.isSwapped}
                className={`video-feed ${mainMode === 'cover' ? 'fill-mode' : ''} ${mainCamHidden ? 'opacity-0' : 'opacity-100'}`}
              />

              {/* 3-dot menu ── top-LEFT of main video */}
              <div className="menu-trigger" onClick={(e) => { e.stopPropagation(); setMenuOpen(p => ({ ...p, main: !p.main })); }}>
                <IconDots />
                {/* Dropdown nested directly inside absolute trigger context constraint */}
                <div className={`dropdown-menu-custom ${menuOpen.main ? 'active' : ''}`}>
                  <div className="menu-item-custom" onClick={(e) => { e.stopPropagation(); setMainMode('contain'); setMenuOpen(p => ({ ...p, main: false })); }}>
                    Fit {mainMode === 'contain' && <span>✓</span>}
                  </div>
                  <div className="menu-item-custom" onClick={(e) => { e.stopPropagation(); setMainMode('cover'); setMenuOpen(p => ({ ...p, main: false })); }}>
                    Fill {mainMode === 'cover' && <span>✓</span>}
                  </div>
                </div>
              </div>

              {/* Status icons — bottom-left of main video */}
              {(mainMicOff || mainCamHidden) && (
                <div className="video-status-icons">
                  {mainMicOff    && <IconMicOff />}
                  {mainCamHidden && <IconCamOff />}
                </div>
              )}
            </div>

            {/* WATCH PARTY SIDEBAR */}
            <div className="participant-sidebar">
              <div className="remote-preview-wp">
                <video
                  ref={remoteWPRef}
                  autoPlay
                  playsInline
                  className={`w-full h-full object-cover ${state.remoteCamOff ? 'opacity-0' : ''}`}
                />
              </div>
            </div>

            {/* SELF PREVIEW (PIP) ── click to swap ─────────── */}
            <div className="self-preview" onClick={handleScreenSwap}>

              {/* Self video */}
              <video
                ref={selfVidRef}
                autoPlay
                playsInline
                muted={!state.isSwapped}
                className={`w-full h-full ${state.isSwapped ? 'transform -scale-x-100' : ''} ${selfCamHidden ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
                style={{ objectFit: selfMode }}
              />

              {/* 3-dot trigger for pip (Top-Left) */}
              <div className="menu-trigger-small" onClick={(e) => { e.stopPropagation(); setMenuOpen(p => ({ ...p, self: !p.self })); }}>
                <IconDots />
                {/* PIP dropdown */}
                <div className={`dropdown-menu-custom ${menuOpen.self ? 'active' : ''}`}>
                  <div className="menu-item-custom" onClick={(e) => { e.stopPropagation(); setSelfMode('contain'); setMenuOpen(p => ({ ...p, self: false })); }}>Fit</div>
                  <div className="menu-item-custom" onClick={(e) => { e.stopPropagation(); setSelfMode('cover'); setMenuOpen(p => ({ ...p, self: false })); }}>Fill</div>
                </div>
              </div>

              {/* Status icons on pip */}
              {(selfMicOff || selfCamHidden) && (
                <div className="video-status-icons">
                  {selfMicOff    && <IconMicOff />}
                  {selfCamHidden && <IconCamOff />}
                </div>
              )}
            </div>

          </div>{/* end .video-wrapper */}
        </main>

        {/* ── Bottom Controls ───────────────────────────────── */}
        <BottomControls
          state={state}
          toggleLocalStatus={toggleLocalStatus}
          toggleHandRaise={toggleHandRaise}
          toggleWatchParty={toggleWatchParty}
          handleEndCall={endCall}
        />

      </div>
    </div>
  );
}
