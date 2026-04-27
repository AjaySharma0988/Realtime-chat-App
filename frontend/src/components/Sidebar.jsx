import { useEffect, useState, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useStatusStore } from "../store/useStatusStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import {
  MessageSquare, Search, MoreVertical, LogOut,
  Settings, User, Users, Edit, Smartphone,
  Star, Bell, CheckSquare, X, ChevronDown,
} from "lucide-react";
import ChatItem from "./ChatItem";
import SidebarBase from "./SidebarBase";
import ChatStyleHeader from "./sidebars/ChatStyleHeader";
import ChatStyleList from "./sidebars/ChatStyleList";

const FILTERS = ["All", "Unread", "Favorites"];

const Sidebar = () => {
  const { getUsers, users, selectedUser, setSelectedUser, isUsersLoading, messages } = useChatStore();
  const { onlineUsers, logout, authUser } = useAuthStore();
  const { fetchStatuses } = useStatusStore();

  const [filter, setFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => { 
    getUsers(); 
    fetchStatuses();
  }, [getUsers, fetchStatuses]);

  // Close menu on outside click
  useEffect(() => {
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filteredUsers = users
    .filter((u) => {
      if (searchQuery.trim()) return u.fullName.toLowerCase().includes(searchQuery.toLowerCase());
      return true;
    })
    .filter((u) => {
      if (filter === "Unread") return false; // placeholder — needs unread count API
      return true;
    });

  const menuItems = [
    { icon: Edit, label: "New group", action: null },
    { icon: Star, label: "Starred messages", action: null },
    { icon: CheckSquare, label: "Select chats", action: null },
    { icon: Bell, label: "Mark all as read", action: null },
    { icon: Smartphone, label: "Linked devices", action: () => navigate("/linked-devices") },
    null,
    { icon: Settings, label: "Settings", action: () => navigate("/settings") },
    { icon: User, label: "Profile", action: () => navigate("/profile") },
    { icon: LogOut, label: "Log out", action: logout, danger: true },
  ];

  if (isUsersLoading) return <SidebarSkeleton />;

  return (
    <SidebarBase>
      <ChatStyleHeader 
        title="Chats"
        menuRef={menuRef}
        showMenu={showMenu}
        setShowMenu={setShowMenu}
        menuItems={menuItems}
        actions={
          <button
            className="p-2 rounded-full hover:bg-base-300 transition-colors hidden lg:flex"
            title="New chat"
          >
            <Edit className="size-4 text-base-content/60" />
          </button>
        }
      />

      <ChatStyleList 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        placeholder="Search or start a new chat"
      >
        {/* ── Filter Pills ─────────────────────────────────────────────────── */}
        <div className="hidden lg:flex items-center gap-2 px-3 pb-2 flex-shrink-0 overflow-x-auto scrollbar-none">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-shrink-0 px-4 py-1 rounded-full text-xs font-semibold transition-all border
                ${filter === f
                  ? "bg-primary text-primary-content border-primary"
                  : "border-base-300 text-base-content/60 hover:bg-base-200"
                }`}
            >
              {f}
            </button>
          ))}
          <button className="flex-shrink-0 size-6 rounded-full border border-base-300 flex items-center justify-center hover:bg-base-200 transition-colors">
            <ChevronDown className="size-3 text-base-content/50" />
          </button>
        </div>

        {/* ── Chat / Contact List ──────────────────────────────────────────── */}
        <div className="flex-1">
          {filteredUsers.length === 0 && (
            <div className="py-12 flex flex-col items-center gap-3 text-base-content/40">
              <Users className="size-10 opacity-40" />
              <p className="text-sm">
                {searchQuery ? `No results for "${searchQuery}"` : "No contacts found"}
              </p>
            </div>
          )}

          {filteredUsers.map((user) => (
            <ChatItem 
              key={user._id} 
              user={user} 
              isSelected={selectedUser?._id === user._id}
            />
          ))}
        </div>
      </ChatStyleList>
    </SidebarBase>
  );
};

export default Sidebar;

