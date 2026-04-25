import { MoreVertical, Camera, Plus, Search, Edit, Star, CheckSquare, Bell, Smartphone, Settings, User, LogOut } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import MobileDropdownMenu from "../components/mobile/MobileDropdownMenu";
import { navigateMobile } from "./MobileLayout";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";

const MobileUpdates = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
  return (
    <div className="w-full h-full flex flex-col bg-base-100">
      <div className="p-4 flex items-center justify-between relative">
        <h1 className="text-2xl font-bold text-base-content">Updates</h1>
        <div className="flex items-center gap-4">
          <Search className="size-6 text-base-content/70" />
          <div className="relative" ref={menuRef}>
            <button 
              onClick={() => setMenuOpen(!menuOpen)}
              className={`p-1 rounded-full transition-colors ${menuOpen ? 'bg-base-content/10' : ''}`}
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

      <div className="flex-1 overflow-y-auto px-4 pb-[80px]">
        {/* Status Section */}
        <section className="mb-8">
          <h2 className="text-lg font-bold mb-4 text-base-content">Status</h2>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none">
            {/* My Status */}
            <div className="flex flex-col items-center gap-2 flex-shrink-0">
              <div className="relative">
                <div className="size-[72px] rounded-full border-2 border-base-content/10 p-1">
                   <img src="/avatar.png" className="size-full rounded-full object-cover" />
                </div>
                <div className="absolute bottom-1 right-1 size-6 bg-primary rounded-full border-2 border-base-100 flex items-center justify-center">
                  <Plus className="size-4 text-primary-content" />
                </div>
              </div>
              <span className="text-xs text-base-content/70">My status</span>
            </div>
            
            {/* Recent Updates */}
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0">
                <div className="size-[72px] rounded-full border-2 border-primary p-1">
                  <img src={`https://i.pravatar.cc/150?u=${i}`} className="size-full rounded-full object-cover" />
                </div>
                <span className="text-xs text-base-content/70 truncate w-16 text-center">User {i}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Channels Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-base-content">Channels</h2>
            <button className="text-primary text-sm font-bold">Explore</button>
          </div>
          <p className="text-sm text-base-content/50 mb-6">Stay updated on topics that matter to you. Find channels to follow below.</p>
          
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="size-12 rounded-xl bg-base-300" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm text-base-content">Channel Name {i}</h3>
                  <p className="text-xs text-base-content/50 truncate">Latest update from the channel...</p>
                </div>
                <button className="h-9 px-6 bg-primary text-primary-content text-sm font-bold rounded-full active:scale-95 transition-transform">
                   Follow
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="fixed bottom-[160px] right-6 flex flex-col gap-4 items-center">
         <button className="size-11 bg-base-300 text-base-content/70 rounded-2xl shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all border border-base-content/5">
            <Plus className="size-5" />
         </button>
         <button className="size-14 bg-primary text-primary-content rounded-2xl shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all">
            <Camera className="size-6" />
         </button>
      </div>
    </div>
  );
};

export default MobileUpdates;
