import React, { useState, useEffect, useRef } from "react";
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, 
  MoreVertical, UserPlus, RotateCw, Wand2, 
  Hand, Smile, MonitorPlay, MessageSquare, Shield,
  ChevronLeft, X, Video as VideoIcon, RotateCcw, Volume2, Speaker, Bluetooth
} from "lucide-react";

const T = {
  bg: "#0B141A",
  panel: "rgba(17, 27, 33, 0.9)",
  surface: "rgba(32, 44, 51, 0.8)",
  textMain: "#E9EDEF",
  textMuted: "#8696A0",
  red: "#F15C6D",
  green: "#00A884",
};

const UI_ANIMATIONS = `
  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
  @keyframes floatUp {
    0% { transform: translateY(0) scale(0.5); opacity: 0; }
    20% { opacity: 1; transform: translateY(-20px) scale(1.2); }
    100% { transform: translateY(-300px) scale(1); opacity: 0; }
  }
`;

const MobileCallUI = ({
  status,
  peerName,
  peerPic,
  peerMuted,
  peerCameraOff,
  isMuted,
  isCameraOff,
  handState,
  duration,
  netStatus,
  uiVisible,
  toggleUI,
  onEndCall,
  toggleMic,
  toggleCamera,
  toggleHandRaise,
  handleEmojiSelect,
  switchCamera, // For rotating camera
  videoInputDevices,
  selectedCamera,
  onNavigateChat,
  onToggleWatchParty,
  selectedSpeaker,
  switchSpeaker,
  audioOutputDevices,
  audioInputDevices,
  selectedMic,
  switchMic,
  localVidRef,
  remoteVidRef,
  remoteCameraStream,
  localStream,
  isSwapped,
  setIsSwapped,
  emojis,
  remoteAudRef,
  callAgain,
  refreshDevices,
  localFit,
  setLocalFit,
  remoteFit,
  setRemoteFit,
  isWatchParty,
}) => {
  const [showMorePanel, setShowMorePanel] = useState(false);
  const [showAudioSheet, setShowAudioSheet] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null); // 'main' | 'pip'
  const containerRef = useRef(null);

  // ── Draggable PiP State (Integrated from Laptop UI) ──
  const pipW = isWatchParty ? 70 : 100;
  const pipH = isWatchParty ? 100 : 150;
  const [pipPos, setPipPos] = useState({ 
    x: window.innerWidth - (isWatchParty ? 70 : 100) - 16, 
    y: isWatchParty ? (uiVisible ? 52 : 12) : (uiVisible ? 60 : 20) 
  });
  const [isDragging, setIsDragging] = useState(false);
  const [hasManuallyMoved, setHasManuallyMoved] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);

  // Sync position on mode change if not manually moved
  useEffect(() => {
    if (!hasManuallyMoved) {
      const initialTop = isWatchParty ? (uiVisible ? 52 : 12) : (uiVisible ? 60 : 20);
      setPipPos({ x: window.innerWidth - pipW - 16, y: initialTop });
    }
  }, [isWatchParty, uiVisible, pipW, hasManuallyMoved]);

  const getConstrainedPos = (x, y) => {
    const rect = containerRef.current?.getBoundingClientRect() || { width: window.innerWidth, height: window.innerHeight };
    const margin = 12;
    const minX = margin;
    const maxX = rect.width - pipW - margin;
    // Bounds depend on whether UI overlays are visible
    const minY = uiVisible ? (isWatchParty ? 52 : 80) : margin;
    const maxY = rect.height - (uiVisible ? (isWatchParty ? 80 : 140) : margin) - pipH;

    return {
      x: Math.max(minX, Math.min(x, maxX)),
      y: Math.max(minY, Math.min(y, maxY))
    };
  };

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    setIsDragging(true);
    hasMoved.current = false;
    dragStart.current = { x: touch.clientX, y: touch.clientY };
    dragOffset.current = { x: touch.clientX, y: touch.clientY };
    e.stopPropagation();
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const dx = touch.clientX - dragOffset.current.x;
    const dy = touch.clientY - dragOffset.current.y;

    if (Math.abs(touch.clientX - dragStart.current.x) > 10 || Math.abs(touch.clientY - dragStart.current.y) > 10) {
      hasMoved.current = true;
      setHasManuallyMoved(true);
    }

    setPipPos(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    dragOffset.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e) => {
    if (!isDragging) return;
    setIsDragging(false);

    if (!hasMoved.current) {
      // Tap detected -> Swap videos
      setIsSwapped(!isSwapped);
    } else {
      // Snapping logic: Snap to left or right edge
      const rect = containerRef.current?.getBoundingClientRect() || { width: window.innerWidth };
      const centerX = rect.width / 2;
      const snapX = (pipPos.x + pipW / 2) < centerX ? 12 : rect.width - pipW - 12;
      const constrained = getConstrainedPos(snapX, pipPos.y);
      setPipPos(constrained);
    }
  };


  // Refresh devices when opening the sheet (parity with laptop logic)
  useEffect(() => {
    if (showAudioSheet && refreshDevices) {
      refreshDevices();
    }
  }, [showAudioSheet, refreshDevices]);
  const isActive = status === "active";
  const isCalling = status === "calling" || status === "ringing" || status === "connecting";
  const isEnded = status === "ended" || status === "no-answer";

  // ── Dynamic Style Overrides (for Watch Party) ──
  const dS = {
    topOverlay: {
      ...S.topOverlay,
      height: isWatchParty ? 48 : 80,
      padding: isWatchParty ? "0 12px" : "0 16px",
    },
    peerName: {
      ...S.peerName,
      fontSize: isWatchParty ? 14 : 18,
    },
    statusText: {
      ...S.statusText,
      fontSize: isWatchParty ? 11 : 13,
    },
    bottomOverlay: {
      ...S.bottomOverlay,
      bottom: isWatchParty ? 12 : 24,
      left: isWatchParty ? 12 : 16,
      right: isWatchParty ? 12 : 16,
    },
    bottomBarContainer: {
      ...S.bottomBarContainer,
      height: isWatchParty ? 56 : 72,
      borderRadius: isWatchParty ? 16 : 24,
      padding: isWatchParty ? "0 12px" : "0 16px",
    },
    bottomBtn: {
      ...S.bottomBtn,
      width: isWatchParty ? 40 : 48,
      height: isWatchParty ? 40 : 48,
    },
    endBtn: {
      ...S.endBtn,
      width: isWatchParty ? 44 : 54,
      height: isWatchParty ? 44 : 54,
    },
    iconSize: isWatchParty ? 18 : 24,
    topIconSize: isWatchParty ? 18 : 24,
    localPreview: {
      ...S.localPreview,
      top: 0,
      right: "auto",
      left: 0,
      width: pipW,
      height: pipH,
      transform: `translate3d(${pipPos.x}px, ${pipPos.y}px, 0)`,
      transition: isDragging ? "none" : "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
      touchAction: "none",
      zIndex: 50, // Ensure it stays above other overlays
    }
  };

  // Format duration
  const fmtTime = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // State 5: Call Ended View
  if (isEnded) {
    return (
      <div style={S.container}>
        <style>{UI_ANIMATIONS}</style>
        <div style={S.blurredBg}>
          <img src={peerPic} style={S.fullImg} alt="" />
          <div style={S.glassOverlay} />
        </div>
        
        <div style={S.endedContent}>
          <div style={S.topBar}>
            <p style={S.peerNameSmall}>{peerName}</p>
            <p style={S.statusText}>{status === "no-answer" ? "No answer" : "Call ended"}</p>
          </div>

          <div style={S.avatarCenter}>
            <img src={peerPic} style={S.largeAvatar} alt={peerName} />
          </div>

          <div style={S.endedActions}>
            <div style={S.actionGroup}>
              <button onClick={onEndCall} style={S.circleBtn}><X size={24} /></button>
              <p style={S.actionLabel}>Cancel</p>
            </div>
            <div style={S.actionGroup}>
              <button style={S.circleBtn}><VideoIcon size={24} /></button>
              <p style={S.actionLabel}>Record video note</p>
            </div>
            <div style={S.actionGroup}>
              <button onClick={callAgain} style={{...S.circleBtn, background: T.green}}><VideoIcon size={24} /></button>
              <p style={S.actionLabel}>Call again</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={S.container} onClick={toggleUI}>
      <style>{UI_ANIMATIONS}</style>
      {/* BACKGROUND VIDEO (Remote or Local if swapped/calling) */}
      <div style={S.videoBg}>
        <video
          key={`bg-${isSwapped}`}
          ref={isCalling ? localVidRef : (isSwapped ? localVidRef : remoteVidRef)}
          autoPlay
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: isCalling ? localFit : (isSwapped ? localFit : remoteFit),
            transform: (isCalling || isSwapped) ? "scaleX(-1)" : "scaleX(1)",
            opacity: (isCalling ? !isCameraOff : (isSwapped ? !isCameraOff : !peerCameraOff)) ? 1 : 0
          }}
        />

        {((isCalling && isCameraOff) || (!isCalling && (isSwapped ? isCameraOff : peerCameraOff))) && (
          <div style={S.placeholderBg}>
            <img src={isSwapped ? "/avatar.png" : peerPic} style={S.fullImgBlurred} alt="" />
            <div style={S.glassOverlay} />
          </div>
        )}
      </div>

      {/* FLOATING LOCAL PREVIEW (State 2) */}
      {isActive && (
        <div 
          style={dS.localPreview} 
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          // Also support mouse for emulator testing
          onMouseDown={(e) => {
            setIsDragging(true);
            hasMoved.current = false;
            dragStart.current = { x: e.clientX, y: e.clientY };
            dragOffset.current = { x: e.clientX, y: e.clientY };
            e.stopPropagation();
          }}
          onMouseMove={(e) => {
            if (!isDragging) return;
            const dx = e.clientX - dragOffset.current.x;
            const dy = e.clientY - dragOffset.current.y;
            if (Math.abs(e.clientX - dragStart.current.x) > 5 || Math.abs(e.clientY - dragStart.current.y) > 5) {
              hasMoved.current = true;
              setHasManuallyMoved(true);
            }
            setPipPos(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            dragOffset.current = { x: e.clientX, y: e.clientY };
          }}
          onMouseUp={() => {
            if (!isDragging) return;
            setIsDragging(false);
            if (!hasMoved.current) setIsSwapped(!isSwapped);
            else {
              const rect = containerRef.current?.getBoundingClientRect() || { width: window.innerWidth };
              const centerX = rect.width / 2;
              const snapX = (pipPos.x + pipW / 2) < centerX ? 12 : rect.width - pipW - 12;
              setPipPos(getConstrainedPos(snapX, pipPos.y));
            }
          }}
        >
          <video
            key={`pip-${isSwapped}`}
            ref={isSwapped ? remoteVidRef : localVidRef}
            autoPlay
            playsInline
            muted
            style={{
              width: "100%",
              height: "100%",
              objectFit: isSwapped ? remoteFit : localFit,
              transform: (isSwapped ? "scaleX(1)" : "scaleX(-1)"),
              opacity: (isSwapped ? !peerCameraOff : !isCameraOff) ? 1 : 0
            }}
          />
          {(isSwapped ? peerCameraOff : isCameraOff) && <div style={S.previewPlaceholder}><img src={isSwapped ? peerPic : "/avatar.png"} style={S.miniAvatar} /></div>}
          
          {/* Internal preview buttons from reference - only visible when UI is up */}
          {uiVisible && (
            <div style={S.previewOverlay}>
               <button style={S.miniBtn} onClick={(e) => { 
                 e.stopPropagation(); 
                 const next = videoInputDevices.find(d => d.deviceId !== selectedCamera)?.deviceId || selectedCamera;
                 switchCamera(next); 
               }}><RotateCw size={14} /></button>
               
               <div style={{ position: 'relative' }}>
                  <button style={S.miniBtn} onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'pip' ? null : 'pip'); }}>
                    <MoreVertical size={14} />
                  </button>
                  {activeMenu === 'pip' && (
                    <div style={{ ...S.miniMenu, top: 24, right: 0 }}>
                      <button style={S.miniMenuItem} onClick={(e) => { e.stopPropagation(); (isSwapped ? setRemoteFit : setLocalFit)('contain'); setActiveMenu(null); }}>
                        Fit {(isSwapped ? remoteFit : localFit) === 'contain' && "✓"}
                      </button>
                      <button style={S.miniMenuItem} onClick={(e) => { e.stopPropagation(); (isSwapped ? setRemoteFit : setLocalFit)('cover'); setActiveMenu(null); }}>
                        Fill {(isSwapped ? remoteFit : localFit) === 'cover' && "✓"}
                      </button>
                    </div>
                  )}
               </div>
            </div>
          )}
        </div>
      )}

      {/* TOP BAR (Always visible if uiVisible, except ended) */}
      {uiVisible && (
        <div style={dS.topOverlay}>
          <div style={S.topBarLeft}>
             {isActive && <button style={S.topIconBtn}><ChevronLeft size={dS.topIconSize} /></button>}
          </div>
          <div style={S.topBarCenter}>
            <p style={dS.peerName}>{peerName}</p>
            <p style={dS.statusText}>
              {isCalling ? (status === "calling" ? "Calling..." : status === "ringing" ? "Ringing..." : "Connecting...") : fmtTime(duration)}
            </p>
          </div>
          <div style={S.topBarRight}>
            <button style={S.topIconBtn} onClick={(e) => { e.stopPropagation(); setShowAddPeople?.(true); }}><UserPlus size={dS.topIconSize - 2} /></button>
            <div style={{ position: 'relative' }}>
              <button 
                style={S.topIconBtn} 
                onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'main' ? null : 'main'); }}
              >
                <MoreVertical size={dS.topIconSize - 2} />
              </button>
              {activeMenu === 'main' && (
                <div style={{ ...S.miniMenu, top: 40, right: 0 }}>
                  <button style={S.miniMenuItem} onClick={(e) => { e.stopPropagation(); (isSwapped ? setLocalFit : setRemoteFit)('contain'); setActiveMenu(null); }}>
                    Fit {(isSwapped ? localFit : remoteFit) === 'contain' && "✓"}
                  </button>
                  <button style={S.miniMenuItem} onClick={(e) => { e.stopPropagation(); (isSwapped ? setLocalFit : setRemoteFit)('cover'); setActiveMenu(null); }}>
                    Fill {(isSwapped ? localFit : remoteFit) === 'cover' && "✓"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* BOTTOM CONTROL BAR */}
      {uiVisible && (
        <div style={dS.bottomOverlay} onClick={e => e.stopPropagation()}>
          <div style={dS.bottomBarContainer}>
            <button style={dS.bottomBtn} onClick={() => setShowMorePanel(true)}>
              <MoreVertical size={dS.iconSize} />
            </button>
            
            <button style={dS.bottomBtn} onClick={toggleCamera}>
              {isCameraOff ? <VideoOff size={dS.iconSize} color={T.textMuted} /> : <Video size={dS.iconSize} />}
            </button>

            <button style={dS.bottomBtn} onClick={() => setShowAudioSheet(true)}>
              <Volume2 size={dS.iconSize} color={selectedSpeaker !== "default" ? T.green : "white"} />
            </button>

            <button style={dS.bottomBtn} onClick={toggleMic}>
              {isMuted ? <MicOff size={dS.iconSize} color={T.red} /> : <Mic size={dS.iconSize} />}
            </button>

            <button style={dS.endBtn} onClick={onEndCall}>
              <PhoneOff size={dS.iconSize} color="white" />
            </button>
          </div>
        </div>
      )}

      {/* State 4: More Options Panel (Bottom Sheet) */}
      {showMorePanel && (
        <div style={S.sheetOverlay} onClick={() => setShowMorePanel(false)}>
          <div style={S.bottomSheet} onClick={e => e.stopPropagation()}>
            <div style={S.sheetHandle} />
            
            <div style={S.sheetHeader}>
              <Shield size={14} color={T.textMuted} />
              <span style={S.encryptedText}>End-to-end encrypted</span>
            </div>

            {/* Emojis */}
            <div style={S.emojiRow}>
              {["👍", "❤️", "😂", "😮", "😢", "🙏"].map(emoji => (
                <button key={emoji} style={S.emojiBtn} onClick={() => { handleEmojiSelect(emoji); setShowMorePanel(false); }}>
                  {emoji}
                </button>
              ))}
            </div>

            {/* Action List */}
            <div style={S.sheetActions}>
              <button style={S.sheetActionItem} onClick={toggleHandRaise}>
                <div style={S.sheetActionLabel}>Raise hand</div>
                <Hand size={20} color={handState.localRaised ? T.green : T.textMain} />
              </button>
              
              <div style={S.sheetDivider} />

              <button style={S.sheetActionItem} onClick={() => { onToggleWatchParty(); setShowMorePanel(false); }}>
                <div style={S.sheetActionLabel}>Watch party</div>
                <MonitorPlay size={20} />
              </button>

              <button style={S.sheetActionItem} onClick={() => { onNavigateChat(); setShowMorePanel(false); }}>
                <div style={S.sheetActionLabel}>Send message</div>
                <MessageSquare size={20} />
              </button>
            </div>

            {/* Connection Status */}
            <div style={S.connectionStatus}>
              <div style={{...S.statusDot, background: netStatus === "good" ? T.green : T.red}} />
              <span style={S.statusLabel}>{netStatus === "good" ? "Good connection" : "Poor connection"}</span>
            </div>
          </div>
        </div>
      )}

      {/* State 6: Audio Device Selection Sheet */}
      {showAudioSheet && (
        <div style={S.sheetOverlay} onClick={() => setShowAudioSheet(false)}>
          <div style={S.bottomSheet} onClick={e => e.stopPropagation()}>
            <div style={S.sheetHandle} />
            <div style={S.sheetHeader}>
               <span style={{ fontWeight: 600, fontSize: 16 }}>Audio settings</span>
            </div>

            <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingBottom: 20 }}>
              {/* Speakers Section */}
              <div style={S.sectionLabel}>Speakers</div>
              <div style={S.sheetActions}>
                {audioOutputDevices.length > 0 ? audioOutputDevices.map(d => {
                  const isSelected = selectedSpeaker === d.deviceId || (selectedSpeaker === 'default' && d.deviceId === 'default');
                  return (
                    <button key={d.deviceId} style={{...S.sheetActionItem, background: isSelected ? 'rgba(0,168,132,0.1)' : S.sheetActionItem.background}} 
                            onClick={() => { switchSpeaker(d.deviceId); setShowAudioSheet(false); }}>
                      <div style={{...S.sheetActionLabel, color: isSelected ? T.green : 'white'}}>{d.label || 'Speaker'}</div>
                      {isSelected ? <span style={{ color: T.green, fontWeight: 'bold' }}>✓</span> : <Speaker size={18} color={T.textMuted} />}
                    </button>
                  );
                }) : <div style={S.emptyLabel}>No speakers found</div>}
              </div>

              <div style={{ height: 20 }} />

              {/* Microphones Section */}
              <div style={S.sectionLabel}>Microphone</div>
              <div style={S.sheetActions}>
                {audioInputDevices.length > 0 ? audioInputDevices.map(d => {
                  const isSelected = selectedMic === d.deviceId || (selectedMic === 'default' && d.deviceId === 'default');
                  return (
                    <button key={d.deviceId} style={{...S.sheetActionItem, background: isSelected ? 'rgba(0,168,132,0.1)' : S.sheetActionItem.background}} 
                            onClick={() => { switchMic(d.deviceId); setShowAudioSheet(false); }}>
                      <div style={{...S.sheetActionLabel, color: isSelected ? T.green : 'white'}}>{d.label || 'Microphone'}</div>
                      {isSelected ? <span style={{ color: T.green, fontWeight: 'bold' }}>✓</span> : <Mic size={18} color={T.textMuted} />}
                    </button>
                  );
                }) : <div style={S.emptyLabel}>No microphones found</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Emojis */}
      {emojis.map(e => (
        <div key={e.id} className="emoji-float" style={{ 
          position: "absolute",
          bottom: 120,
          left: `${50 + e.xOffset}%`,
          fontSize: 32,
          pointerEvents: "none",
          animation: "floatUp 2s ease-out forwards",
          zIndex: 1000
        }}>
          {e.emoji}
        </div>
      ))}
      <audio ref={remoteAudRef} autoPlay playsInline style={{ display: "none" }} />
    </div>
  );
};

const S = {
  container: {
    position: "absolute",
    inset: 0,
    backgroundColor: T.bg,
    color: T.textMain,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    zIndex: 9999,
    fontFamily: "Segoe UI, sans-serif",
  },
  videoBg: {
    position: "absolute",
    inset: 0,
    zIndex: 1,
  },
  placeholderBg: {
    position: "absolute",
    inset: 0,
    background: "#111",
  },
  fullImgBlurred: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    filter: "blur(40px) brightness(0.6)",
  },
  glassOverlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,0.3)",
  },
  localPreview: {
    position: "absolute",
    top: 60,
    right: 16,
    width: 100,
    height: 150,
    borderRadius: 12,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.2)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
    zIndex: 10,
  },
  previewPlaceholder: {
    position: "absolute",
    inset: 0,
    background: "#222",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  miniAvatar: {
    width: 40,
    height: 40,
    borderRadius: "50%",
  },
  previewOverlay: {
    position: "absolute",
    top: 4,
    right: 4,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  miniBtn: {
    background: "rgba(0,0,0,0.5)",
    border: "none",
    borderRadius: 4,
    padding: 4,
    color: "white",
  },
  miniBtnRound: {
    background: "rgba(0,0,0,0.4)",
    border: "none",
    borderRadius: "50%",
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    backdropFilter: "blur(10px)",
  },
  mainMenuContainer: {
    position: "absolute",
    top: 80,
    right: 16,
    zIndex: 50,
  },
  miniMenu: {
    position: "absolute",
    top: 36,
    right: 0,
    background: "rgba(17, 27, 33, 0.95)",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.1)",
    overflow: "hidden",
    zIndex: 100,
    width: 100,
    boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
    backdropFilter: "blur(20px)",
  },
  miniMenuItem: {
    padding: "10px 14px",
    fontSize: 13,
    color: "white",
    background: "transparent",
    border: "none",
    width: "100%",
    textAlign: "left",
    display: "flex",
    justifyContent: "space-between",
    fontWeight: "500",
  },
  topOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    background: "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)",
    display: "flex",
    alignItems: "center",
    padding: "0 16px",
    zIndex: 20,
  },
  topBarLeft: { flex: 1 },
  topBarCenter: { 
    flex: 2, 
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    gap: 2
  },
  topBarRight: { flex: 1, display: "flex", justifyContent: "flex-end" },
  peerName: {
    fontSize: 18,
    fontWeight: "600",
    margin: 0,
  },
  peerNameSmall: {
    fontSize: 20,
    fontWeight: "600",
    margin: 0,
    textAlign: "center"
  },
  statusText: {
    fontSize: 13,
    color: T.textMuted,
    margin: 0,
  },
  topIconBtn: {
    background: "transparent",
    border: "none",
    color: "white",
    padding: 8,
  },
  bottomOverlay: {
    position: "absolute",
    bottom: 24,
    left: 16,
    right: 16,
    zIndex: 30,
  },
  bottomBarContainer: {
    background: T.panel,
    backdropFilter: "blur(20px)",
    borderRadius: 24,
    height: 72,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 16px",
    boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  bottomBtn: {
    background: "rgba(255,255,255,0.08)",
    border: "none",
    borderRadius: "50%",
    width: 48,
    height: 48,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
  },
  endBtn: {
    background: T.red,
    border: "none",
    borderRadius: "50%",
    width: 54,
    height: 54,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 16px rgba(241,92,109,0.4)",
  },
  sheetOverlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    zIndex: 100,
    display: "flex",
    alignItems: "flex-end",
  },
  bottomSheet: {
    width: "100%",
    background: "#111B21",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: "12px 16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    animation: "slideUp 0.3s ease-out",
  },
  sheetHandle: {
    width: 40,
    height: 4,
    background: "rgba(255,255,255,0.2)",
    borderRadius: 2,
    margin: "0 auto 8px",
  },
  sheetHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  encryptedText: {
    fontSize: 12,
    color: T.textMuted,
  },
  emojiRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "0 8px",
  },
  emojiBtn: {
    fontSize: 28,
    background: "transparent",
    border: "none",
  },
  sheetActions: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  sheetActionItem: {
    background: "rgba(255,255,255,0.05)",
    border: "none",
    borderRadius: 12,
    padding: "10px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    color: "white",
    gap: 8,
  },
  sheetActionLabel: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
    textAlign: "left",
    lineHeight: "1.2",
  },
  sheetDivider: {
    height: 1,
    background: "rgba(255,255,255,0.05)",
    margin: "8px 0",
  },
  connectionStatus: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: T.textMuted,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    margin: "12px 4px 8px",
  },
  emptyLabel: {
    fontSize: 13,
    color: T.textMuted,
    textAlign: "center",
    padding: "10px 0",
    fontStyle: "italic",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
  },
  statusLabel: {
    fontSize: 13,
    color: T.textMuted,
  },
  endedContent: {
    position: "relative",
    zIndex: 10,
    flex: 1,
    display: "flex",
    flexDirection: "column",
    padding: "60px 24px",
  },
  avatarCenter: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  largeAvatar: {
    width: 140,
    height: 140,
    borderRadius: "50%",
    border: "4px solid rgba(255,255,255,0.1)",
    objectFit: "cover",
  },
  endedActions: {
    display: "flex",
    justifyContent: "space-around",
    paddingBottom: 20,
  },
  actionGroup: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },
  circleBtn: {
    width: 60,
    height: 60,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.1)",
    border: "none",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 12,
    color: T.textMuted,
    textAlign: "center",
    maxWidth: 80,
  }
};

export default MobileCallUI;
