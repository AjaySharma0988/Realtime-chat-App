import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "../store/useAuthStore";
import { useAppStore } from "../store/useAppStore";
import {
  Smartphone, Monitor, ChevronLeft, Trash2,
  Loader, Shield, RefreshCw, QrCode, X, CheckCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import QRCode from "react-qr-code";

// ── Device icon by OS ──────────────────────────────────────────────────────
const DeviceIcon = ({ os }) => {
  const cls = "size-8 text-primary";
  if (os?.toLowerCase().includes("windows") || os?.toLowerCase().includes("mac") || os?.toLowerCase().includes("linux")) {
    return <Monitor className={cls} />;
  }
  return <Smartphone className={cls} />;
};

// ── Format last active ─────────────────────────────────────────────────────
const formatLastActive = (date) => {
  if (!date) return "Never";
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000)  return "Just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return d.toLocaleDateString();
};

const LinkedDevicesPage = () => {
  const navigate = useNavigate();
  const { 
    socket, authUser, linkedDevices, totalActiveSessions, 
    fetchLinkedDevices, removeSession, isFetchingDevices 
  } = useAuthStore();
  const { setActiveView } = useAppStore();

  const [showQR, setShowQR]             = useState(false);
  const [qrData, setQrData]             = useState(null);   // { sessionId, expiresAt }
  const [qrExpired, setQrExpired]       = useState(false);
  const [qrLinked, setQrLinked]         = useState(false);
  const [removingId, setRemovingId]     = useState(null);
  const qrTimerRef = useRef(null);

  useEffect(() => { 
    fetchLinkedDevices(); 
  }, [fetchLinkedDevices]);

  // ── Generate QR ──────────────────────────────────────────────────────────
  const generateQR = async () => {
    try {
      setQrExpired(false);
      setQrLinked(false);
      const res = await axiosInstance.get("/auth/qr-session");
      setQrData(res.data);
      setShowQR(true);

      if (socket) socket.emit("qr:join", { sessionId: res.data.sessionId });

      clearTimeout(qrTimerRef.current);
      qrTimerRef.current = setTimeout(() => setQrExpired(true), 2 * 60 * 1000);
    } catch (err) {
      toast.error("Failed to generate QR code");
    }
  };

  // ── Listen for device:linked event ───────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    const handler = (userData) => {
      setQrLinked(true);
      clearTimeout(qrTimerRef.current);
      toast.success(`Device linked as ${userData.fullName}!`);
      setTimeout(() => {
        setShowQR(false);
        fetchLinkedDevices();
      }, 2000);
    };
    socket.on("device:linked", handler);
    return () => socket.off("device:linked", handler);
  }, [socket, fetchLinkedDevices]);

  useEffect(() => () => clearTimeout(qrTimerRef.current), []);

  const handleRemove = async (sessionId) => {
    setRemovingId(sessionId);
    await removeSession(sessionId);
    setRemovingId(null);
  };

  const isCurrentSession = (sessionId) => sessionId === authUser?.sessionId;

  const qrContent = qrData
    ? `${window.location.origin}/link-device?sessionId=${qrData.sessionId}`
    : "";

  return (
    <div className="min-h-screen bg-base-100 flex flex-col">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="h-14 px-4 bg-base-200 border-b border-base-300 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => {
            setActiveView("chats");
            navigate("/chats");
          }}
          className="p-2 rounded-full hover:bg-base-300 transition-colors"
        >
          <ChevronLeft className="size-5" />
        </button>
        <h1 className="font-bold text-base-content">Linked Devices</h1>
        <div className="ml-auto">
          <button
            onClick={() => fetchLinkedDevices()}
            disabled={isFetchingDevices}
            className="p-2 rounded-full hover:bg-base-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`size-4 text-base-content/60 ${isFetchingDevices ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-w-lg mx-auto w-full px-4 py-6 space-y-6">

        {/* ── Illustration + description ─────────────────────────────────── */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-4 py-4">
            <div className="size-16 rounded-2xl bg-base-200 flex items-center justify-center border border-base-300 shadow-sm">
              <Smartphone className="size-8 text-primary" />
            </div>
            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
              <CheckCircle className="size-4 text-primary" />
            </div>
            <div className="size-16 rounded-2xl bg-base-200 flex items-center justify-center border border-base-300 shadow-sm">
              <Monitor className="size-8 text-primary" />
            </div>
          </div>
          <p className="text-sm text-base-content/60 leading-relaxed">
            You can link other devices to this account.
            <br />Use Chatty on up to 4 linked devices.
          </p>
        </div>

        {/* ── Link a Device button ───────────────────────────────────────── */}
        <button
          onClick={generateQR}
          className="w-full btn btn-primary rounded-full shadow-lg shadow-primary/20 gap-2"
        >
          <QrCode className="size-4" />
          Link a device
        </button>

        {/* ── QR Modal ──────────────────────────────────────────────────── */}
        {showQR && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
              className="bg-base-200 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl border border-base-300 space-y-4 animate-in zoom-in-95 duration-200"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base-content">Scan QR Code</h3>
                <button onClick={() => { setShowQR(false); clearTimeout(qrTimerRef.current); }}
                  className="p-1.5 rounded-full hover:bg-base-300 transition-colors">
                  <X className="size-4" />
                </button>
              </div>

              {qrLinked ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <CheckCircle className="size-16 text-success" />
                  <p className="text-sm font-medium text-success">Device linked successfully!</p>
                </div>
              ) : qrExpired ? (
                <div className="flex flex-col items-center gap-4 py-4">
                  <p className="text-sm text-error text-center leading-relaxed">QR code expired.<br/>Generate a new one to continue.</p>
                  <button onClick={generateQR} className="btn btn-primary btn-sm rounded-full px-6">
                    <RefreshCw className="size-4" /> Regenerate
                  </button>
                </div>
              ) : (
                <>
                  <div className="bg-white p-4 rounded-xl flex items-center justify-center shadow-inner">
                    <QRCode value={qrContent} size={220} />
                  </div>
                  <p className="text-xs text-base-content/50 text-center leading-relaxed px-4">
                    Open Chatty on your phone and scan this code.<br />
                    Expires in 2 minutes.
                  </p>
                  <div className="flex items-center gap-2 justify-center py-1">
                    <div className="size-2 rounded-full bg-success animate-pulse" />
                    <span className="text-xs text-base-content/60 font-medium tracking-wide">Waiting for scan…</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Device list ───────────────────────────────────────────────── */}
        {isFetchingDevices && linkedDevices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-40">
            <Loader className="size-8 animate-spin text-primary" />
            <p className="text-xs font-medium uppercase tracking-widest">Loading sessions</p>
          </div>
        ) : (
          <>
            {linkedDevices.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1 mb-2">
                   <p className="text-xs font-bold text-base-content/50 uppercase tracking-widest">
                    Device Status ({totalActiveSessions})
                  </p>
                  {isFetchingDevices && <Loader className="size-3 animate-spin text-primary" />}
                </div>

                {linkedDevices.map((session) => {
                  const isCurrent = isCurrentSession(session.sessionId);
                  return (
                    <div
                      key={session.sessionId}
                      className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300
                        ${isCurrent 
                          ? "bg-primary/5 border-primary/20 shadow-sm" 
                          : "bg-base-200 border-base-300 hover:border-primary/30"}`}
                    >
                      <div className={`size-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm
                        ${isCurrent ? "bg-primary text-primary-content" : "bg-primary/10 text-primary"}`}>
                        <DeviceIcon os={session.os} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-base-content truncate">
                            {isCurrent ? "This device" : (session.deviceName || `${session.browser} on ${session.os}`)}
                          </p>
                          {isCurrent && (
                             <span className="badge badge-primary badge-sm py-0 h-4 text-[10px] font-bold">Active</span>
                          )}
                        </div>
                        <p className="text-xs text-base-content/50 mt-0.5">
                           {session.browser} • {session.ip || "Unknown IP"}
                           {" · "}
                           {isCurrent ? "Online now" : formatLastActive(session.lastActive)}
                        </p>
                      </div>
                      
                      {!isCurrent && (
                        <button
                          onClick={() => handleRemove(session.sessionId)}
                          disabled={removingId === session.sessionId}
                          className="p-2.5 rounded-full hover:bg-error/10 transition-colors disabled:opacity-50 text-error group"
                          title="Remove device"
                        >
                          {removingId === session.sessionId
                            ? <Loader className="size-4 animate-spin" />
                            : <Trash2 className="size-4 group-hover:scale-110 transition-transform" />
                          }
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {linkedDevices.length === 0 && !isFetchingDevices && (
              <div className="text-center py-12 bg-base-200/30 rounded-3xl border border-dashed border-base-content/10">
                <Smartphone className="size-10 mx-auto text-base-content/10 mb-2" />
                <p className="text-sm text-base-content/40">No linked devices yet.</p>
              </div>
            )}
          </>
        )}

        {/* ── E2E note ─────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 text-xs text-base-content/40 justify-center bg-base-200/50 border border-base-300 rounded-2xl p-4 shadow-sm">
          <Shield className="size-5 flex-shrink-0 text-primary mt-0.5" />
          <p className="leading-relaxed">
            Your personal messages are{" "}
            <span className="text-primary font-bold">end-to-end encrypted</span>{" "}
            on all your devices. Chatty cannot read them.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LinkedDevicesPage;
