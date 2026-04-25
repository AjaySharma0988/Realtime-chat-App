import { Users, Plus, MoreVertical, Edit, Star, CheckSquare, Bell, Smartphone, Settings, User, LogOut } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import MobileDropdownMenu from "../components/mobile/MobileDropdownMenu";
import { navigateMobile } from "./MobileLayout";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";

const MobileCommunities = () => {
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
        <h1 className="text-2xl font-bold text-base-content">Communities</h1>
        <div className="flex items-center gap-4">
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

      <div className="flex-1 overflow-y-auto pb-[80px]">
        <div className="space-y-2">
          {/* New Community Item */}
          <div className="flex items-center gap-4 p-4 hover:bg-base-content/5 transition-colors">
            <div className="relative">
              <div className="size-14 bg-base-300 rounded-2xl flex items-center justify-center text-base-content/50 overflow-hidden">
                <Users className="size-8" />
              </div>
              <div className="absolute -bottom-1 -right-1 size-6 bg-primary rounded-full border-2 border-base-100 flex items-center justify-center">
                <Plus className="size-4 text-primary-content" />
              </div>
            </div>
            <div>
              <h2 className="font-bold text-base-content">New community</h2>
            </div>
          </div>

          <div className="h-3 bg-base-300/50" />

          {/* List of Communities */}
          <div className="divide-y divide-base-content/5">
             {[1, 2].map((i) => (
               <div key={i} className="flex flex-col">
                 <div className="flex items-center gap-4 p-4 hover:bg-base-content/5 transition-colors">
                   <div className="size-14 bg-base-300 rounded-2xl flex items-center justify-center">
                     <Users className="size-8 text-base-content/30" />
                   </div>
                   <div className="flex-1">
                     <h3 className="font-bold text-base-content">Community Name {i}</h3>
                   </div>
                 </div>
                 
                 <div className="flex items-center gap-4 p-4 pl-8 hover:bg-base-content/5 transition-colors group">
                    <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                       <Users className="size-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                       <h4 className="text-sm font-bold text-base-content">Announcements</h4>
                       <p className="text-xs text-base-content/50 truncate">Welcome to the community!</p>
                    </div>
                    <span className="text-[10px] text-base-content/30">12:45</span>
                 </div>
                 
                 <button className="py-3 px-4 pl-20 text-sm text-base-content/50 hover:bg-base-content/5 transition-colors text-left flex items-center gap-2">
                    <span className="text-xs">View all</span>
                 </button>
               </div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileCommunities;
