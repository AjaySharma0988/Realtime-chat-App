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
  const { socket, authUser } = useAuthStore();
  const { setActiveView } = useAppStore();

  const [devices, setDevices]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showQR, setShowQR]             = useState(false);
  const [qrData, setQrData]             = useState(null);   // { sessionId, expiresAt }
  const [qrExpired, setQrExpired]       = useState(false);
  const [qrLinked, setQrLinked]         = useState(false);
  const [removingId, setRemovingId]     = useState(null);
  const [refreshing, setRefreshing]     = useState(false);
  const qrTimerRef = useRef(null);

  // ── Fetch devices ────────────────────────────────────────────────────────
  const fetchDevices = async () => {
    try {
      const res = await axiosInstance.get("/auth/linked-devices");
      setDevices(res.data);
    } catch (err) {
      toast.error("Failed to load linked devices");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchDevices(); }, []);

  // ── Generate QR ──────────────────────────────────────────────────────────
  const generateQR = async () => {
    try {
      setQrExpired(false);
      setQrLinked(false);
      const res = await axiosInstance.get("/auth/qr-session");
      setQrData(res.data);
      setShowQR(true);

      // Join socket room so we get device:linked event
      if (socket) socket.emit("qr:join", { sessionId: res.data.sessionId });

      // Auto-expire after 2 minutes
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
        fetchDevices();
      }, 2000);
    };
    socket.on("device:linked", handler);
    return () => socket.off("device:linked", handler);
  }, [socket]);

  useEffect(() => () => clearTimeout(qrTimerRef.current), []);

  // ── Remove device ────────────────────────────────────────────────────────
  const removeDevice = async (deviceId) => {
    setRemovingId(deviceId);
    try {
      await axiosInstance.delete(`/auth/linked-devices/${deviceId}`);
      setDevices((prev) => prev.filter((d) => d.deviceId !== deviceId));
      toast.success("Device removed");
    } catch {
      toast.error("Failed to remove device");
    } finally {
      setRemovingId(null);
    }
  };

  // ── QR content string ────────────────────────────────────────────────────
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
            onClick={() => { setRefreshing(true); fetchDevices(); }}
            className="p-2 rounded-full hover:bg-base-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`size-4 text-base-content/60 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-w-lg mx-auto w-full px-4 py-6 space-y-6">

        {/* ── Illustration + description ─────────────────────────────────── */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-4 py-4">
            <div className="size-16 rounded-2xl bg-base-200 flex items-center justify-center border border-base-300">
              <Smartphone className="size-8 text-primary" />
            </div>
            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle className="size-4 text-primary" />
            </div>
            <div className="size-16 rounded-2xl bg-base-200 flex items-center justify-center border border-base-300">
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
          className="w-full btn btn-primary rounded-full"
        >
          <QrCode className="size-4" />
          Link a device
        </button>

        {/* ── QR Modal ──────────────────────────────────────────────────── */}
        {showQR && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div
              className="bg-base-200 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl border border-base-300 space-y-4"
              style={{ animation: "wa-pop-in 0.18s ease-out" }}
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
                  <p className="text-sm text-error text-center">QR code expired. Generate a new one.</p>
                  <button onClick={generateQR} className="btn btn-primary btn-sm rounded-full">
                    <RefreshCw className="size-4" /> Regenerate
                  </button>
                </div>
              ) : (
                <>
                  <div className="bg-white p-4 rounded-xl flex items-center justify-center">
                    <QRCode value={qrContent} size={220} />
                  </div>
                  <p className="text-xs text-base-content/50 text-center leading-relaxed">
                    Open Chatty on your phone and scan this code.<br />
                    Expires in 2 minutes.
                  </p>
                  <div className="flex items-center gap-2 justify-center">
                    <div className="size-2 rounded-full bg-success animate-pulse" />
                    <span className="text-xs text-base-content/60">Waiting for scan…</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Device list ───────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader className="size-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {devices.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wider px-1">
                  Device Status
                </p>
                <p className="text-xs text-base-content/40 px-1 mb-2">
                  Tap a device to log out.
                </p>

                {devices.map((device) => (
                  <div
                    key={device.deviceId}
                    className="flex items-center gap-4 p-4 rounded-xl bg-base-200 border border-base-300 hover:bg-base-300/50 transition-colors"
                  >
                    <div className="size-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <DeviceIcon os={device.os} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-base-content truncate">
                        {device.deviceName || `${device.browser} on ${device.os}`}
                      </p>
                      <p className="text-xs text-success">
                        {device.isActive ? "Active" : "Inactive"}
                        {" · "}
                        <span className="text-base-content/40">{formatLastActive(device.lastActive)}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => removeDevice(device.deviceId)}
                      disabled={removingId === device.deviceId}
                      className="p-2 rounded-full hover:bg-error/10 transition-colors disabled:opacity-50"
                      title="Remove device"
                    >
                      {removingId === device.deviceId
                        ? <Loader className="size-4 animate-spin text-error" />
                        : <Trash2 className="size-4 text-error" />
                      }
                    </button>
                  </div>
                ))}
              </div>
            )}

            {devices.length === 0 && (
              <p className="text-center text-sm text-base-content/40 py-4">
                No linked devices yet.
              </p>
            )}
          </>
        )}

        {/* ── E2E note ─────────────────────────────────────────────────── */}
        <div className="flex items-start gap-2 text-xs text-base-content/40 text-center justify-center border border-base-300 rounded-xl p-3">
          <Shield className="size-4 flex-shrink-0 text-primary mt-0.5" />
          <p>
            Your personal messages are{" "}
            <span className="text-primary font-medium">end-to-end encrypted</span>{" "}
            on all your devices.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LinkedDevicesPage;
