import { Wifi, WifiHigh, WifiLow, WifiOff, Volume2, VolumeX, Battery, MessageSquare } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";
import { useAuthStore } from "../store/useAuthStore";

import Tooltip from "./Tooltip";

const TopBar = () => {
  const { setActiveView } = useAppStore();
  const { authUser, updateNotifications } = useAuthStore();
  // Simple clock for the mock system tray
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");

  const soundEnabled = authUser?.notificationSettings?.soundEnabled ?? true;

  const handleToggleSound = () => {
    if (authUser) {
      updateNotifications({ soundEnabled: !soundEnabled });
    }
  };

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wifiQuality, setWifiQuality] = useState("high");

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const updateQuality = () => {
      if (!connection) return;
      const type = connection.effectiveType;
      if (type === "4g") setWifiQuality("high");
      else if (type === "3g") setWifiQuality("medium");
      else setWifiQuality("low");
    };

    if (connection) {
      connection.addEventListener("change", updateQuality);
      updateQuality();
    }

    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
      setDate(
        now.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }).replace(/\//g, "-")
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (connection) connection.removeEventListener("change", updateQuality);
    };
  }, []);

  const renderWifiIcon = () => {
    if (!isOnline) return <WifiOff className="size-4 text-error opacity-100" />;
    if (wifiQuality === "high") return <Wifi className="size-4" />;
    if (wifiQuality === "medium") return <WifiHigh className="size-4" />;
    return <WifiLow className="size-4 text-warning opacity-100" />;
  };

  const getWifiTooltip = () => {
    if (!isOnline) return "Offline";
    if (wifiQuality === "high") return "Strong Connection";
    if (wifiQuality === "medium") return "Good Connection";
    return "Weak Connection";
  };

  return (
    <div className="h-10 flex items-center justify-between px-3 flex-shrink-0 select-none z-10 bg-base-300 text-base-content transition-colors duration-200 border-b border-base-300">
      {/* ── Left side (Title + Logo) ─────────────────────────────────────── */}
      <Link 
        to="/chats" 
        onClick={() => setActiveView("chats")}
        className="flex items-center gap-2 px-1 hover:opacity-80 transition-opacity cursor-default"
      >
        <MessageSquare size={16} className="opacity-70 text-primary" />
        <span className="font-medium tracking-wide text-[13px]">
          Chatty
        </span>
      </Link>

      {/* ── Right side (System tray mock to match reference image) ───────── */}
      <div className="flex items-center gap-4">
        {/* OS-like status icons */}
        <div className="flex items-center gap-3 opacity-80">
          <Tooltip text={getWifiTooltip()}>
            <div className="hover:opacity-80 transition-opacity cursor-default flex items-center justify-center">
              {renderWifiIcon()}
            </div>
          </Tooltip>
          
          <Tooltip text={soundEnabled ? "Mute notifications" : "Unmute notifications"}>
            <button 
              onClick={handleToggleSound}
              className="hover:opacity-80 transition-opacity focus:outline-none flex items-center justify-center cursor-pointer"
            >
              {soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4 text-base-content/50" />}
            </button>
          </Tooltip>

          <Tooltip text="Battery Full">
            <div className="hover:opacity-80 transition-opacity cursor-default flex items-center justify-center">
              <Battery className="size-4" />
            </div>
          </Tooltip>
        </div>

        {/* Date / Time */}
        <div className="flex flex-col items-end opacity-70">
          <span className="text-[11px] leading-tight font-medium">{time}</span>
          <span className="text-[10px] leading-tight">{date}</span>
        </div>
      </div>
    </div>
  );
};

export default TopBar;
