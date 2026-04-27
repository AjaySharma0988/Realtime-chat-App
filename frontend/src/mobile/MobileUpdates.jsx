import { MoreVertical, Camera, Plus, Search, Edit, Star, CheckSquare, Bell, Smartphone, Settings, User, LogOut, Clock } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import MobileDropdownMenu from "../components/mobile/MobileDropdownMenu";
import { navigateMobile } from "./MobileLayout";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { useStatusStore } from "../store/useStatusStore";
import StatusUpload from "../components/StatusUpload";
import StatusViewer from "../components/StatusViewer";

const MobileUpdates = () => {
  const { authUser, logout } = useAuthStore();
  const { statuses, fetchStatuses, getUserStatuses } = useStatusStore();
  
  const [menuOpen, setMenuOpen] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [viewerGroup, setViewerGroup] = useState(null);
  
  const menuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const groupByUser = (allStatuses) => {
    const map = new Map();
    for (const s of allStatuses) {
      const uid = s.userId?._id || s.userId;
      if (!map.has(uid)) {
        map.set(uid, { user: s.userId, items: [] });
      }
      map.get(uid).items.push(s);
    }
    return Array.from(map.values());
  };

  const myStatuses = statuses.filter(s => (s.userId?._id || s.userId) === authUser?._id);
  const otherStatuses = statuses.filter(s => (s.userId?._id || s.userId) !== authUser?._id);
  const otherGroups = groupByUser(otherStatuses);

  const timeAgo = (iso) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-base-content">Status</h2>
            <button className="text-primary text-xs font-bold uppercase tracking-widest">Privacy</button>
          </div>
          
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none">
            {/* My Status */}
            <div 
              onClick={() => myStatuses.length > 0 ? setViewerGroup({ items: myStatuses }) : setShowUpload(true)}
              className="flex flex-col items-center gap-2 flex-shrink-0 cursor-pointer active:scale-95 transition-transform"
            >
              <div className="relative">
                <div className={`size-[72px] rounded-full border-2 p-1 transition-colors ${myStatuses.length > 0 ? 'border-primary' : 'border-base-content/10'}`}>
                   <img src={authUser?.profilePic || "/avatar.png"} className="size-full rounded-full object-cover" />
                </div>
                <div className="absolute bottom-1 right-1 size-6 bg-primary rounded-full border-2 border-base-100 flex items-center justify-center">
                  <Plus className="size-4 text-primary-content" />
                </div>
              </div>
              <span className="text-[11px] font-medium text-base-content/70">My status</span>
            </div>
            
            {/* Recent Updates */}
            {otherGroups.map(({ user, items }) => (
              <div 
                key={user?._id} 
                onClick={() => setViewerGroup({ items })}
                className="flex flex-col items-center gap-2 flex-shrink-0 cursor-pointer active:scale-95 transition-transform"
              >
                <div className="size-[72px] rounded-full border-2 border-primary p-1 shadow-sm">
                  <img src={user?.profilePic || "/avatar.png"} className="size-full rounded-full object-cover" />
                </div>
                <span className="text-[11px] font-medium text-base-content/70 truncate w-16 text-center">
                  {user?.fullName?.split(" ")[0]}
                </span>
              </div>
            ))}

            {otherGroups.length === 0 && (
              <div className="flex flex-col items-center justify-center py-4 px-2 opacity-30 grayscale italic">
                <p className="text-[10px] whitespace-nowrap">No updates yet</p>
              </div>
            )}
          </div>
        </section>

        {/* Channels Section (Placeholder) */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-base-content">Channels</h2>
            <button className="text-primary text-sm font-bold">Explore</button>
          </div>
          <p className="text-sm text-base-content/50 mb-6 leading-relaxed">Stay updated on topics that matter to you. Find channels to follow below.</p>
          
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 group">
                <div className="size-12 rounded-2xl bg-base-200 flex items-center justify-center">
                  <span className="text-xl">📢</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm text-base-content">Global News {i}</h3>
                  <p className="text-[11px] text-base-content/50 truncate">Latest updates and highlights from today...</p>
                </div>
                <button className="h-9 px-6 bg-primary/10 text-primary hover:bg-primary hover:text-white text-xs font-black rounded-full transition-all uppercase tracking-widest">
                   Follow
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-[110px] right-6 flex flex-col gap-4 items-center animate-in slide-in-from-bottom duration-500">
         <button 
           onClick={() => setShowUpload(true)}
           className="size-11 bg-base-200 text-base-content/70 rounded-2xl shadow-2xl flex items-center justify-center hover:scale-110 active:scale-90 transition-all border border-base-content/5"
         >
            <Edit className="size-5" />
         </button>
         <button 
           onClick={() => setShowUpload(true)}
           className="size-14 bg-primary text-primary-content rounded-2xl shadow-2xl flex items-center justify-center hover:scale-110 active:scale-90 transition-all ring-4 ring-primary/20"
         >
            <Camera className="size-6" />
         </button>
      </div>

      {/* Shared Modals */}
      {showUpload && (
        <StatusUpload 
          onClose={() => setShowUpload(false)} 
          onUploaded={() => { setShowUpload(false); fetchStatuses(); }} 
        />
      )}

      {viewerGroup && (
        <StatusViewer 
          statuses={viewerGroup.items} 
          onClose={() => setViewerGroup(null)} 
        />
      )}
    </div>
  );
};

export default MobileUpdates;
