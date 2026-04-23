import React from "react";
import MediaControlPanel from "./MediaControlPanel";
import VBrowserModule from "./VBrowserModule";

const MediaHome = ({
  screenStream,
  remoteScreenStream,
  isScreenSharing,
  isRemoteScreenSharing,
  isVBrowserActive,
  setIsVBrowserActive,
  vBrowserUrl,
  setVBrowserUrl,
  controller,
  setController,
  socket,
  callId,
  peerName,
  setActiveFeature
}) => {
  const remoteRef = React.useRef(null);
  const localRef = React.useRef(null);
  const [volume, setVolume] = React.useState(1); // 0 to 1

  React.useEffect(() => {
    if (localRef.current && screenStream) {
      localRef.current.srcObject = screenStream;
    }
  }, [screenStream, isScreenSharing]);

  React.useEffect(() => {
    if (remoteRef.current && remoteScreenStream) {
      remoteRef.current.srcObject = remoteScreenStream;
    }
  }, [remoteScreenStream, isRemoteScreenSharing]);

  // 🧩 TASK 3: APPLY VOLUME
  React.useEffect(() => {
    if (localRef.current) {
      localRef.current.volume = volume;
    }
    if (remoteRef.current) {
      remoteRef.current.volume = volume;
    }
  }, [volume]);

  // 🧩 TASK 4: FULLSCREEN FUNCTION
  function handleFullscreen() {
    const video = localRef.current || remoteRef.current;
    if (!video) return;

    if (video.requestFullscreen) {
      video.requestFullscreen();
    } else if (video.webkitRequestFullscreen) {
      video.webkitRequestFullscreen();
    } else if (video.msRequestFullscreen) {
      video.msRequestFullscreen();
    }
  }

  return (
    <div className="media-home">
      {/* 🧩 PART 8: MEDIA HOME RENDER */}
      {(isScreenSharing || isRemoteScreenSharing) ? (
        <div className="media-container w-full h-full">
          {isScreenSharing && screenStream && (
            <video
              ref={localRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
            />
          )}

          {isRemoteScreenSharing && remoteScreenStream && (
            <video
              ref={remoteRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
          )}

          <MediaControlPanel
            volume={volume}
            setVolume={setVolume}
            handleFullscreen={handleFullscreen}
          />
        </div>
      ) : isVBrowserActive ? (
        <VBrowserModule
          isVBrowserActive={isVBrowserActive}
          vBrowserUrl={vBrowserUrl}
          setVBrowserUrl={setVBrowserUrl}
          controller={controller}
          setController={setController}
          socket={socket}
          callId={callId}
          peerName={peerName}
          setIsVBrowserActive={setIsVBrowserActive}
          setActiveFeature={setActiveFeature}
        />
      ) : (
        <>
          <video
            className="media-bg-video"
            src="/watchParty_Mediaview.mp4"
            autoPlay
            loop
            muted
            playsInline
          />
          <div className="media-overlay">
            <h1 className="media-title shimmer-text">
              Watch Together 🎬
            </h1>
            <p className="media-subtitle">
              Share videos, stream together, and enjoy in sync
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default MediaHome;
