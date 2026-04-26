import { useRef, useEffect } from "react";
import { X, RefreshCcw } from "lucide-react";

export default function CameraOverlay({ onClose, onCapture, cameraImage, onRetake }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }
  };

  useEffect(() => {
    let isActive = true;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        
        // If the component unmounted while waiting for permissions
        if (!isActive) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        // Just in case a stream was already set, stop it first
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Failed to access camera", err);
      }
    };

    if (!cameraImage) {
      startCamera();
    }

    return () => {
      isActive = false;
      stopCamera();
    };
  }, [cameraImage]);

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0);

    const image = canvas.toDataURL("image/png");

    stopCamera();
    onCapture(image);
  };

  const closeCamera = () => {
    stopCamera();
    onClose();
  };

  return (
    <div className="flex-1 flex flex-col relative bg-black overflow-hidden animate-in fade-in duration-200 min-h-0">
      {/* Top Bar Overlay inside the camera view */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
        <div className="flex items-center gap-4 text-white pointer-events-auto">
          <button onClick={closeCamera} className="hover:bg-white/20 p-2 rounded-full transition-colors backdrop-blur-sm bg-black/20">
            <X className="w-6 h-6" />
          </button>
          <span className="text-base font-medium drop-shadow-md">
            {cameraImage ? "Preview" : "Take photo"}
          </span>
        </div>
        {cameraImage && (
          <button onClick={onRetake} className="flex items-center gap-2 text-white hover:bg-white/20 px-4 py-2 rounded-full transition-colors font-medium pointer-events-auto backdrop-blur-sm bg-black/20">
            <RefreshCcw className="w-5 h-5" />
            <span className="text-sm">Retake</span>
          </button>
        )}
      </div>

      {!cameraImage ? (
        <div className="flex-1 flex flex-col relative min-h-0">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-6 md:bottom-10 left-0 right-0 flex justify-center pb-2 z-10 pointer-events-none">
            <button
              onClick={capturePhoto}
              className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full border-[3px] md:border-[4px] border-white flex items-center justify-center p-1 md:p-1.5 bg-transparent hover:scale-105 transition-transform pointer-events-auto shadow-xl"
            >
              <div className="w-full h-full rounded-full bg-white"></div>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-4 bg-[#0B141A] min-h-0">
           <img src={cameraImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" alt="Captured" />
        </div>
      )}
    </div>
  );
}
