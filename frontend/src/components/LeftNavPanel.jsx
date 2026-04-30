import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import {
  MessageSquare,
  Radio,
  Phone,
  Users,
  Settings,
  Star,
} from "lucide-react";

import Tooltip from "./Tooltip";

import { useAppStore } from "../store/useAppStore";

const LeftNavPanel = () => {
  const { authUser } = useAuthStore();
  const navigate = useNavigate();
  const { activeView, setActiveView } = useAppStore();
  const location = useLocation();

  const topItems = [
    { id: "chats", icon: MessageSquare, label: "Chats" },
    { id: "status", icon: Radio, label: "Status" },
    { id: "calls", icon: Phone, label: "Calls" },
    { id: "starred", icon: Star, label: "Starred" },
    { id: "communities", icon: Users, label: "Communities" },
  ];

  return (
    <div
      className="flex flex-col h-full flex-shrink-0 relative bg-base-300 transition-colors duration-200"
      style={{ width: "62px" }}
    >
      <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-base-content/10 z-10 pointer-events-none" />

      {/* ── Top nav items ─────────────────────────────────────────────────── */}
      <nav className="flex flex-col items-center gap-0.5 pt-3 flex-shrink-0">
        {topItems.map((item) => {
          const isActive = location.pathname === "/chats" && activeView === item.id;
          return (
            <Tooltip key={item.id} position="right" text={item.label}>
              <button
                onClick={() => {
                  setActiveView(item.id);
                  if (location.pathname !== "/chats") navigate("/chats");
                }}
                className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-150 relative ${isActive
                  ? "bg-primary/15 text-primary"
                  : "text-base-content/50 hover:bg-base-content/10 hover:text-base-content"
                  }`}
              >
                <item.icon size={20} />
                {/* Active indicator bar */}
                {isActive && (
                  <span className="absolute left-0 w-0.5 rounded-r-full bg-primary" />
                )}
              </button>
            </Tooltip>
          );
        })}
      </nav>

      {/* ── Spacer ─────────────────────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Bottom nav ───────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-1 pb-3 flex-shrink-0">
        {/* Settings */}
        <Tooltip position="right" text="Settings">
          <button
            onClick={() => {
              setActiveView(null);
              navigate("/settings");
            }}
            className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-150 ${location.pathname === "/settings"
              ? "bg-primary/15 text-primary"
              : "text-base-content/50 hover:bg-base-content/10 hover:text-base-content"
              }`}
          >
            <Settings size={20} />
            {location.pathname === "/settings" && (
              <span className="absolute left-0 w-0.5 rounded-r-full bg-primary" />
            )}
          </button>
        </Tooltip>

        {/* Profile avatar */}
        <Tooltip position="right" text={authUser?.fullName || "Profile"}>
          <button
            onClick={() => {
              setActiveView(null);
              navigate("/profile");
            }}
            className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-150 overflow-hidden border-2 ${location.pathname === "/profile" ? "border-primary" : "border-transparent hover:border-primary"}`}
          >
            <img
              src={authUser?.profilePic || "/avatar.png"}
              alt={authUser?.fullName || "Profile"}
              className="size-8 rounded-lg object-cover"
            />
          </button>
        </Tooltip>
      </div>
    </div>
  );
};

export default LeftNavPanel;
