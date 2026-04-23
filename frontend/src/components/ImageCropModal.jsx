import { useCallback, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { X, ZoomIn, ZoomOut, Check } from "lucide-react";

// ── Canvas-based crop utility ──────────────────────────────────────────────────
const createImage = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", reject);
    img.setAttribute("crossOrigin", "anonymous");
    img.src = url;
  });

export const getCroppedImg = async (imageSrc, pixelCrop) => {
  const image  = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx    = canvas.getContext("2d");

  canvas.width  = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0,           0,           pixelCrop.width, pixelCrop.height
  );

  // Return as base64 JPEG (ready for Cloudinary upload)
  return canvas.toDataURL("image/jpeg", 0.92);
};

// ── ImageCropModal ─────────────────────────────────────────────────────────────
const ImageCropModal = ({ imageSrc, onSave, onCancel, isLoading }) => {
  const [crop,          setCrop]          = useState({ x: 0, y: 0 });
  const [zoom,          setZoom]          = useState(1);
  const [croppedPixels, setCroppedPixels] = useState(null);
  const [preview,       setPreview]       = useState(null);

  const onCropComplete = useCallback((_, croppedAreaPixels) => {
    setCroppedPixels(croppedAreaPixels);
  }, []);

  const handlePreview = async () => {
    if (!croppedPixels) return;
    const cropped = await getCroppedImg(imageSrc, croppedPixels);
    setPreview(cropped);
  };

  const handleSave = async () => {
    if (!croppedPixels) return;
    const cropped = await getCroppedImg(imageSrc, croppedPixels);
    onSave(cropped);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div
        className="bg-base-200 rounded-2xl w-full max-w-md mx-4 shadow-2xl border border-base-300 overflow-hidden"
        style={{ animation: "wa-pop-in 0.18s ease-out" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-base-300">
          <h3 className="flex-1 font-bold text-base-content text-base">Crop Profile Photo</h3>
          <button onClick={onCancel} className="p-1.5 rounded-full hover:bg-base-300 transition-colors">
            <X className="size-5 text-base-content/60" />
          </button>
        </div>

        {/* Crop area */}
        <div className="relative bg-black" style={{ height: "320px" }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* Zoom control */}
        <div className="px-5 py-4 border-b border-base-300">
          <div className="flex items-center gap-3">
            <ZoomOut className="size-4 text-base-content/50 flex-shrink-0" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 range range-xs range-primary"
            />
            <ZoomIn className="size-4 text-base-content/50 flex-shrink-0" />
          </div>
          <p className="text-xs text-base-content/40 text-center mt-1">Drag to reposition · Scroll to zoom</p>
        </div>

        {/* Preview + actions */}
        <div className="px-5 py-4 flex items-center gap-4">
          {/* Round preview */}
          <div
            className="size-16 rounded-full bg-base-300 overflow-hidden flex-shrink-0 ring-2 ring-primary/30 cursor-pointer"
            title="Click to preview"
            onClick={handlePreview}
          >
            {preview ? (
              <img src={preview} alt="Preview" className="size-full object-cover" />
            ) : (
              <div className="size-full flex items-center justify-center text-base-content/30 text-xs">Preview</div>
            )}
          </div>

          <div className="flex-1 flex flex-col gap-2">
            <button
              onClick={handlePreview}
              className="btn btn-ghost btn-sm text-xs"
            >
              Preview crop
            </button>
            <div className="flex gap-2">
              <button
                onClick={onCancel}
                disabled={isLoading}
                className="flex-1 btn btn-ghost btn-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isLoading}
                className="flex-1 btn btn-primary btn-sm gap-1"
              >
                {isLoading
                  ? <span className="loading loading-spinner loading-xs" />
                  : <><Check className="size-3.5" /> Save</>
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCropModal;
