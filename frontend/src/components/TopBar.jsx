import { Wifi, Volume2, Battery, MessageSquare } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";

const TopBar = () => {
  const { setActiveView } = useAppStore();
  // Simple clock for the mock system tray
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
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
    return () => clearInterval(interval);
  }, []);

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
        <div className="flex items-center gap-3 opacity-60">
          <Wifi className="size-4" />
          <Volume2 className="size-4" />
          <Battery className="size-4" />
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
