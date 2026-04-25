import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import SignUpPage from "./pages/SignUpPage";
import LoginPage from "./pages/LoginPage";
import AuthImagePattern from "./components/AuthImagePattern";
import SettingsPage from "./pages/SettingsPage";
import ProfilePage from "./pages/ProfilePage";
import LinkedDevicesPage from "./pages/LinkedDevicesPage";
import LinkDeviceApprovalPage from "./pages/LinkDeviceApprovalPage";
import CallPage from "./pages/CallPage";
import CallModal from "./components/CallModal";
import TopBar from "./components/TopBar";
import LeftNavPanel from "./components/LeftNavPanel";
import MobileLayout from "./mobile/MobileLayout";

import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "./store/useAuthStore";
import { useThemeStore } from "./store/useThemeStore";
import { useCallStore } from "./store/useCallStore";
import { useAppStore } from "./store/useAppStore";
import { useEffect } from "react";

import { Loader, RefreshCw, LifeBuoy, AlertCircle, LogOut } from "lucide-react";
import { Toaster } from "react-hot-toast";

const App = () => {
  const { authUser, checkAuth, isCheckingAuth, restoreAccount, logout } = useAuthStore();
  const { theme } = useThemeStore();
  const { incomingCall, outgoingCall, activeCall, initBroadcastListener } = useCallStore();
  const { activeView, setActiveView } = useAppStore();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === "/chats" && !activeView) {
      setActiveView("chats");
    }
  }, [location.pathname, activeView, setActiveView]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  useEffect(() => {
    const disableContextMenu = (e) => {
      e.preventDefault();
    };
    document.addEventListener("contextmenu", disableContextMenu);
    return () => {
      document.removeEventListener("contextmenu", disableContextMenu);
    };
  }, []);

  // Start BroadcastChannel listener so main app clears call state when popup ends
  useEffect(() => {
    const cleanup = initBroadcastListener();
    return cleanup;
  }, [initBroadcastListener]);

  if (isCheckingAuth && !authUser)
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader className="size-10 animate-spin" />
      </div>
    );

  const showAppLayout = authUser && location.pathname !== "/call";

  return (
    <div className="w-full h-[100dvh] overflow-hidden flex flex-col bg-base-200">
      {showAppLayout ? (
        <>
          {/* Desktop Layout Container */}
          <div className="hidden md:flex flex-col flex-1 overflow-hidden w-full h-full relative z-0">
            <TopBar />
            <div className="flex flex-1 overflow-hidden">
              <LeftNavPanel />
              <div className="flex flex-1 overflow-hidden relative z-0">
                <Routes>
                  <Route path="/" element={<Navigate to="/chats" replace />} />
                  <Route path="/chats" element={authUser ? <HomePage /> : <Navigate to="/login" />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/profile" element={authUser ? <ProfilePage /> : <Navigate to="/login" />} />
                  <Route path="/linked-devices" element={<LinkedDevicesPage />} />
                  <Route path="/link-device" element={<LinkDeviceApprovalPage />} />
                  <Route path="*" element={<Navigate to="/chats" replace />} />
                </Routes>
              </div>
            </div>
          </div>

          {/* Mobile Layout Root — COMPLETELY bypasses desktop constraints */}
          <div className="md:hidden fixed inset-0 w-screen h-[100dvh] bg-base-100 overflow-hidden z-50">
            <MobileLayout />
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-hidden w-full h-full">
          <Routes>
            <Route path="/" element={<Navigate to="/chats" replace />} />
            <Route path="/chats" element={authUser ? <HomePage /> : <Navigate to="/login" />} />
            <Route path="/signup" element={!authUser ? <SignUpPage /> : <Navigate to="/" />} />
            <Route path="/login" element={!authUser ? <LoginPage /> : <Navigate to="/" />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/profile" element={authUser ? <ProfilePage /> : <Navigate to="/login" />} />
            <Route path="/linked-devices" element={authUser ? <LinkedDevicesPage /> : <Navigate to="/login" />} />
            <Route path="/link-device" element={authUser ? <LinkDeviceApprovalPage /> : <Navigate to="/login" />} />
            <Route path="/call" element={<CallPage />} />
            <Route path="*" element={<Navigate to={authUser ? "/chats" : "/login"} replace />} />
          </Routes>
        </div>
      )}

      <Toaster />
      {(incomingCall || outgoingCall || activeCall) && <CallModal />}

      {/* Account Restoration Page Overlay */}
      {authUser?.deletionScheduledAt && (
        <div className="fixed inset-0 z-[100] bg-base-100 flex items-center justify-center animate-in fade-in duration-500 overflow-y-auto">
          <div className="h-full w-full grid lg:grid-cols-2">
            {/* Left Side: Content */}
            <div className="flex flex-col justify-center items-center p-6 sm:p-12">
              <div className="w-full max-w-md space-y-8 text-center">

                {/* Logo & Header */}
                <div className="text-center mb-8">
                  <div className="flex flex-col items-center gap-2 group">
                    <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-all duration-300">
                      <LifeBuoy className="size-8 text-primary animate-spin-slow" />
                    </div>
                    <div className="mt-4 space-y-1">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-error/10 text-error text-[10px] font-black uppercase tracking-widest mb-2">
                        <AlertCircle className="size-3" />
                        Account Scheduled for Deletion
                      </div>
                      <h1 className="text-3xl font-black text-base-content tracking-tight">
                        Welcome back,<br />{authUser.fullName}!
                      </h1>
                      <p className="text-base-content/60 text-sm">We've been holding your spot</p>
                    </div>
                  </div>
                </div>

                <div className="bg-base-200/50 p-6 rounded-3xl border border-base-300 backdrop-blur-sm">
                  <p className="text-base-content/70 text-sm leading-relaxed mb-6">
                    Your account is currently in the 15-day recovery period. To continue using Chatty and keep all your data, you'll need to <span className="text-primary font-bold">restore your account</span>.
                  </p>

                  <div className="space-y-4">
                    <button
                      onClick={() => restoreAccount()}
                      className="btn btn-primary w-full h-14 rounded-2xl font-black text-lg shadow-lg shadow-primary/20 flex items-center justify-center gap-3 transition-all active:scale-95"
                    >
                      <RefreshCw className="size-5" />
                      Restore Account
                    </button>

                    <button
                      onClick={() => logout()}
                      className="btn btn-ghost w-full h-14 rounded-2xl font-bold text-base-content/60 hover:bg-base-300 flex items-center justify-center gap-3 transition-all"
                    >
                      <LogOut className="size-5" />
                      Log Out
                    </button>
                  </div>
                </div>

                {/* Footer status */}
                <div className="pt-4 flex items-center justify-center gap-2">
                  <div className="size-2 rounded-full bg-success animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                  <p className="text-[10px] text-base-content/40 uppercase tracking-[0.2em] font-black">
                    Your data is safe and ready
                  </p>
                </div>
              </div>
            </div>

            {/* Right Side: Visual Pattern */}
            <AuthImagePattern
              title="Restoring your world"
              subtitle="All your messages, photos, and contacts are exactly where you left them. Just one click to bring it all back."
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
