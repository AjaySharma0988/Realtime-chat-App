import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import AuthImagePattern from "../components/AuthImagePattern";
import { Link } from "react-router-dom";
import {
  Eye, EyeOff, Loader2, Lock, Mail, MessageSquare,
  QrCode, Monitor, CheckCircle, RefreshCw,
} from "lucide-react";
import QRCode from "react-qr-code";
import { axiosInstance } from "../lib/axios";
import { io }           from "socket.io-client";
import toast from "react-hot-toast";
import { useAppStore } from "../store/useAppStore";
import { useNavigate } from "react-router-dom";

const BASE_URL = import.meta.env.MODE === "development" ? "http://localhost:5001" : "/";
const QR_TTL   = 60_000; // 60 s — matches backend

const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [useQr, setUseQr]   = useState(false);
  const [qrValue, setQrValue] = useState("");         // the string encoded into the QR image
  const [sessionId, setSessionId] = useState(null);
  const [expired, setExpired]     = useState(false);
  const [linked,  setLinked]      = useState(false);
  const [qrLoading, setQrLoading] = useState(false);

  const sockRef  = useRef(null);
  const timerRef = useRef(null);

  const [formData, setFormData] = useState({ email: "", password: "" });
  const { login, checkAuth, isLoggingIn } = useAuthStore();
  const { setActiveView } = useAppStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    await login(formData);
    setActiveView("chats");
    navigate("/chats", { replace: true });
  };

  // ── Cleanly disconnect the temp socket ────────────────────────────────────
  const disconnectTempSocket = useCallback(() => {
    if (sockRef.current) {
      sockRef.current.off("device:linked");
      sockRef.current.disconnect();
      sockRef.current = null;
    }
    clearTimeout(timerRef.current);
  }, []);

  // ── Generate a fresh QR (called on first open + every Regenerate click) ──
  const generateQR = useCallback(async () => {
    disconnectTempSocket();
    setExpired(false);
    setLinked(false);
    setQrValue("");
    setQrLoading(true);

    try {
      // POST → always fresh, not browser-cached
      const res = await axiosInstance.post("/auth/generate-qr");
      const sid  = res.data.sessionId;
      setSessionId(sid);

      const qrUrl = `${window.location.origin}/link-device?sessionId=${sid}`;
      setQrValue(qrUrl);

      // Temporary unauthenticated socket — only used to join the QR room
      const sock = io(BASE_URL, { autoConnect: false });
      sockRef.current = sock;
      sock.connect();

      sock.on("connect", () => {
        sock.emit("qr:join", { sessionId: sid });
      });

      sock.on("device:linked", async () => {
        setLinked(true);
        disconnectTempSocket();
        try {
          await axiosInstance.post("/auth/qr-login", { sessionId: sid });
          toast.success("Logged in via QR!");
          setActiveView("chats");
          checkAuth();
          navigate("/chats", { replace: true });
        } catch {
          toast.error("QR login failed — please try again");
          setLinked(false);
          setExpired(true);
        }
      });

      // Auto-expire after TTL
      timerRef.current = setTimeout(() => setExpired(true), QR_TTL);

    } catch (err) {
      toast.error("Failed to generate QR code");
      setExpired(true);
    } finally {
      setQrLoading(false);
    }
  }, [checkAuth, disconnectTempSocket]);

  // Start generating QR when tab is first shown; cleanup on hide/unmount
  useEffect(() => {
    if (useQr) {
      generateQR();
    } else {
      disconnectTempSocket();
      setQrValue("");
      setSessionId(null);
      setExpired(false);
      setLinked(false);
    }
    return disconnectTempSocket;
  }, [useQr]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="h-screen grid lg:grid-cols-2">
      {/* Left Side */}
      <div className="flex flex-col justify-center items-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">

          {/* Logo */}
          <div className="text-center mb-4">
            <div className="flex flex-col items-center gap-2 group">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center
                              group-hover:bg-primary/20 transition-colors">
                <MessageSquare className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold mt-2">Welcome Back</h1>
              <p className="text-base-content/60">Sign in to your account</p>
            </div>
          </div>

          {/* Toggle Email / QR */}
          <div className="flex bg-base-200 p-1 rounded-lg">
            <button
              onClick={() => setUseQr(false)}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors
                ${!useQr ? "bg-base-100 shadow-sm text-base-content" : "text-base-content/60"}`}
            >Email Login</button>
            <button
              onClick={() => setUseQr(true)}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors
                ${useQr ? "bg-base-100 shadow-sm text-base-content" : "text-base-content/60"}`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <QrCode className="size-3.5" /> QR Login
              </span>
            </button>
          </div>

          {/* ── QR View ─────────────────────────────────────────────────────── */}
          {useQr ? (
            <div className="flex flex-col items-center gap-5">

              {/* QR box */}
              <div className="relative">
                {qrLoading && (
                  <div className="size-52 flex flex-col items-center justify-center gap-3
                                  bg-base-200 rounded-2xl border border-base-300">
                    <Loader2 className="size-8 animate-spin text-primary" />
                    <p className="text-xs text-base-content/50">Generating…</p>
                  </div>
                )}

                {!qrLoading && linked && (
                  <div className="size-52 flex flex-col items-center justify-center gap-3
                                  bg-success/5 rounded-2xl border border-success/30">
                    <CheckCircle className="size-14 text-success" />
                    <p className="text-sm font-semibold text-success text-center">
                      Approved!<br />Logging in…
                    </p>
                  </div>
                )}

                {!qrLoading && !linked && expired && (
                  <div className="size-52 flex flex-col items-center justify-center gap-4
                                  bg-base-200 rounded-2xl border border-base-300">
                    <QrCode className="size-10 text-error/50" />
                    <p className="text-xs text-error/80 text-center px-4">QR code expired</p>
                    <button
                      onClick={generateQR}
                      className="btn btn-sm btn-outline rounded-full gap-1"
                    >
                      <RefreshCw className="size-3.5" /> Regenerate
                    </button>
                  </div>
                )}

                {!qrLoading && !linked && !expired && qrValue && (
                  <div className="bg-white p-3 rounded-2xl shadow-lg border border-base-300 relative">
                    <QRCode value={qrValue} size={200} />
                    {/* Refresh overlay */}
                    <button
                      onClick={generateQR}
                      title="Regenerate"
                      className="absolute top-2 right-2 size-6 rounded-full bg-black/30 flex items-center justify-center hover:bg-black/50 transition-colors"
                    >
                      <RefreshCw className="size-3 text-white" />
                    </button>
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="text-center space-y-1">
                <p className="font-semibold text-base-content">Use Chatty on this device</p>
                <ol className="text-xs text-base-content/55 space-y-0.5 text-left list-decimal pl-5">
                  <li>Open Chatty on your phone</li>
                  <li>Go to <span className="font-medium">Settings → Linked Devices</span></li>
                  <li>Tap <span className="font-medium">Link a device</span> and scan</li>
                </ol>
              </div>
            </div>
          ) : (
            /* ── Email Form ─────────────────────────────────────────────────── */
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="form-control">
                <label className="label"><span className="label-text font-medium">Email</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-base-content/40" />
                  </div>
                  <input type="email" className="input input-bordered w-full pl-10"
                    placeholder="you@example.com" value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
              </div>

              <div className="form-control">
                <label className="label"><span className="label-text font-medium">Password</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-base-content/40" />
                  </div>
                  <input type={showPassword ? "text" : "password"}
                    className="input input-bordered w-full pl-10" placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
                  <button type="button" className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}>
                    {showPassword
                      ? <EyeOff className="h-5 w-5 text-base-content/40" />
                      : <Eye    className="h-5 w-5 text-base-content/40" />}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn btn-primary w-full" disabled={isLoggingIn}>
                {isLoggingIn
                  ? <><Loader2 className="h-5 w-5 animate-spin" /> Loading…</>
                  : "Sign in"}
              </button>
            </form>
          )}

          {/* Sign-up link — always visible */}
          <div className="text-center">
            <p className="text-base-content/60 text-sm">
              Don&apos;t have an account?{" "}
              <Link to="/signup" className="link link-primary">Create account</Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right Side */}
      <AuthImagePattern
        title="Welcome back!"
        subtitle="Sign in to continue your conversations and catch up with your messages."
      />
    </div>
  );
};

export default LoginPage;
