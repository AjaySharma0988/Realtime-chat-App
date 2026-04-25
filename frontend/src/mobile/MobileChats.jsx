import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import {
  Search, MoreVertical, MessageSquarePlus, Camera, MessageSquare,
  Edit, Star, Bell, CheckSquare, Smartphone, Settings, User, LogOut, ChevronDown
} from "lucide-react";
import ChatItem from "../components/ChatItem";
import MobileDropdownMenu from "../components/mobile/MobileDropdownMenu";
import { navigateMobile } from "./MobileLayout";

const APP_NAME = "Chatty";

const MobileChats = () => {
  const { getUsers, users, isUsersLoading, selectedUser } = useChatStore();
  const { onlineUsers, logout } = useAuthStore();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => { getUsers(); }, [getUsers]);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // EXACT same menuItems array as desktop Sidebar.jsx
  const menuItems = [
    { icon: Edit,        label: "New group",         action: null },
    { icon: Star,        label: "Starred messages",  action: null },
    { icon: CheckSquare, label: "Select chats",      action: null },
    { icon: Bell,        label: "Mark all as read",  action: null },
    { icon: Smartphone,  label: "Linked devices",    action: () => navigateMobile.fn?.("linkedDevices") },
    null,
    { icon: Settings,    label: "Settings",          action: () => navigateMobile.fn?.("settings") },
    { icon: User,        label: "Profile",           action: () => navigateMobile.fn?.("myProfile") },
    { icon: LogOut,      label: "Log out",           action: logout, danger: true },
  ];

  const filteredUsers = users.filter((u) =>
    u.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full h-full flex flex-col bg-base-100">
      {/* Top Bar */}
      <div className="px-4 py-3 flex items-center justify-between relative flex-shrink-0">
        {/* App branding — tap to refresh */}
        <div
          onClick={() => { window.location.href = "/"; }}
          className="flex items-center gap-2 cursor-pointer active:scale-95 transition-transform select-none"
        >
          <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <MessageSquare className="size-5 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-base-content tracking-tight">{APP_NAME}</h1>
        </div>

        {/* Right icons */}
        <div className="flex items-center gap-3">
          <Camera className="size-6 text-base-content/70" />
          <Search className="size-6 text-base-content/70" />
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className={`p-1 rounded-full transition-colors ${menuOpen ? "bg-base-content/10" : ""}`}
            >
              <MoreVertical className="size-6 text-base-content/70" />
            </button>
            <MobileDropdownMenu
              isOpen={menuOpen}
              onClose={() => setMenuOpen(false)}
              menuItems={menuItems}
            />
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-4 pb-3 flex-shrink-0">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-base-content/30 transition-colors group-focus-within:text-primary">
            <Search className="size-5" />
          </div>
          <input
            type="text"
            placeholder="Ask Meta AI or Search"
            className="w-full bg-base-300 border-none rounded-full py-3 pl-12 pr-4 text-sm text-base-content focus:ring-1 focus:ring-base-content/10 transition-all placeholder:text-base-content/30 outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Chat Filters */}
      <div className="px-4 pb-3 flex items-center gap-2 overflow-x-auto custom-scrollbar flex-shrink-0">
        <button 
          onClick={() => setActiveFilter("all")}
          className={`px-4 py-1.5 rounded-full font-medium text-sm transition-colors whitespace-nowrap ${
            activeFilter === "all" ? "bg-primary text-primary-content" : "bg-base-300 text-base-content/70"
          }`}
        >
          All
        </button>
        <button 
          onClick={() => setActiveFilter("unread")}
          className={`px-4 py-1.5 rounded-full font-medium text-sm transition-colors whitespace-nowrap ${
            activeFilter === "unread" ? "bg-primary text-primary-content" : "bg-base-300 text-base-content/70"
          }`}
        >
          Unread
        </button>
        <button 
          onClick={() => setActiveFilter("favorites")}
          className={`px-4 py-1.5 rounded-full font-medium text-sm transition-colors whitespace-nowrap ${
            activeFilter === "favorites" ? "bg-primary text-primary-content" : "bg-base-300 text-base-content/70"
          }`}
        >
          Favorites
        </button>
        <button className="p-1.5 rounded-full bg-base-300 text-base-content/70 hover:bg-base-300/80 transition-colors flex-shrink-0 ml-auto">
          <ChevronDown className="size-4" />
        </button>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto pb-[80px]">
        {isUsersLoading ? (
          <div className="flex flex-col gap-4 p-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="size-12 rounded-full bg-base-300" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-base-300 rounded w-1/3" />
                  <div className="h-3 bg-base-300 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            {filteredUsers.map((user) => (
              <ChatItem
                key={user._id}
                user={user}
                isSelected={selectedUser?._id === user._id}
              />
            ))}
            {filteredUsers.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-base-content/20">
                <MessageSquarePlus className="size-12 opacity-10 mb-4" />
                <p>No chats found</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <button className="fixed bottom-[80px] right-6 size-14 bg-primary text-primary-content rounded-2xl shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40">
        <MessageSquarePlus className="size-6" />
      </button>
    </div>
  );
};

export default MobileChats;
