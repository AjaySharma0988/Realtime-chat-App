import { useEffect, useRef, useState } from "react";
import { useCallStore } from "../store/useCallStore";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { Phone, Video, Search, MoreVertical, PhoneCall, ArrowUpRight, ArrowDownLeft, Info, Edit, Star, CheckSquare, Bell, Smartphone, Settings, User, LogOut, Trash2 } from "lucide-react";
import { formatMessageTime } from "../lib/utils";
import MobileDropdownMenu from "../components/mobile/MobileDropdownMenu";
import { navigateMobile } from "./MobileLayout";
import { useNavigate } from "react-router-dom";

const MobileCalls = ({ onSelectCall }) => {
  const { callHistory, fetchCallHistory, isFetchingHistory, startCall, clearCallHistory } = useCallStore();
  const { users } = useChatStore();
  const { logout } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCallHistory();
  }, [fetchCallHistory]);

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

  const groupCalls = (calls) => {
    const groups = {
      TODAY: [],
      YESTERDAY: [],
      OLDER: []
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    calls.forEach(call => {
      const date = new Date(call.timestamp || call.createdAt);
      const callDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      
      if (callDay.getTime() === today.getTime()) {
        groups.TODAY.push(call);
      } else if (callDay.getTime() === yesterday.getTime()) {
        groups.YESTERDAY.push(call);
      } else {
        groups.OLDER.push(call);
      }
    });

    return groups;
  };

  const filteredHistory = callHistory.filter(call => {
    const peerName = call.peerId?.fullName || "Unknown";
    return peerName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const groupedCalls = groupCalls(filteredHistory);

  const getStatusIcon = (call) => {
    const isMissed = call.status === "missed" || call.status === "rejected";
    const isIncoming = call.type === "incoming" || call.direction === "incoming";
    
    if (isIncoming) {
      return <ArrowDownLeft className={`size-3 ${isMissed ? "text-error" : "text-success"}`} />;
    }
    return <ArrowUpRight className={`size-3 ${isMissed ? "text-error" : "text-success"}`} />;
  };

  return (
    <div className="w-full h-full flex flex-col bg-base-100">
      <div className="px-4 py-3 flex items-center justify-between relative flex-shrink-0">
        <h1 className="text-xl font-bold text-base-content tracking-tight">Calls</h1>
        <div className="flex items-center gap-3">
          <button onClick={clearCallHistory} className="p-1 rounded-full transition-colors active:bg-base-content/10">
            <Trash2 className="size-6 text-base-content/70" />
          </button>
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

      {/* Search Bar */}
      <div className="px-4 pb-3 flex-shrink-0">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-base-content/30 transition-colors group-focus-within:text-primary">
            <Search className="size-5" />
          </div>
          <input
            type="text"
            placeholder="Search calls"
            className="w-full bg-base-300 border-none rounded-full py-3 pl-12 pr-4 text-sm text-base-content focus:ring-1 focus:ring-base-content/10 transition-all placeholder:text-base-content/30 outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-[80px]">
        {isFetchingHistory ? (
           <div className="flex flex-col gap-6 p-4">
             {[...Array(5)].map((_, i) => (
               <div key={i} className="flex items-center gap-4 animate-pulse">
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
            {callHistory.length === 0 ? (
              <div className="text-center py-20 text-base-content/20">
                <PhoneCall className="size-12 mx-auto mb-4 opacity-20" />
                <p>No recent calls</p>
              </div>
            ) : (
              Object.entries(groupedCalls).map(([group, calls]) => (
                calls.length > 0 && (
                  <div key={group}>
                    <div className="px-5 py-2">
                      <p className="text-xs font-bold tracking-wider text-success uppercase">
                        {group}
                      </p>
                    </div>
                    {calls.map((call) => {
                      const peer = call.peerId || call.peerInfo;
                      const isMissed = call.status === "missed" || call.status === "rejected";
                      const isIncoming = call.type === "incoming" || call.direction === "incoming";
                      const timeStr = new Date(call.timestamp || call.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
                      const typeStr = isIncoming ? "Incoming" : "Outgoing";
                      
                      return (
                        <div key={call._id} className="flex items-center gap-4 px-4 py-3 group active:bg-base-200 transition-colors">
                          <button onClick={() => onSelectCall(call)} className="relative flex-shrink-0">
                            <img 
                              src={peer?.profilePic || "/avatar.png"} 
                              className="size-12 rounded-full object-cover"
                            />
                          </button>
                          <div className="flex-1 min-w-0" onClick={() => onSelectCall(call)}>
                            <h3 className={`font-bold text-base truncate ${isMissed ? "text-error" : "text-base-content"}`}>
                              {peer?.fullName || "Unknown"}
                            </h3>
                            <div className="flex items-center gap-1.5 text-sm text-base-content/60 mt-0.5">
                              {getStatusIcon(call)}
                              <span className="truncate">
                                {typeStr} • {call.status} • {timeStr}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                             <button 
                               onClick={() => startCall(peer, call.callType || call.type)}
                               className="p-3 active:bg-base-content/10 rounded-full transition-colors"
                             >
                               {call.callType === "video" || call.type === "video" ? <Video className="size-6 text-base-content/70" /> : <Phone className="size-6 text-base-content/70" />}
                             </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ))
            )}
          </div>
        )}
      </div>

      <button className="fixed bottom-[90px] right-6 size-14 bg-primary text-primary-content rounded-2xl shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40">
        <PhoneCall className="size-6" />
      </button>
    </div>
  );
};

export default MobileCalls;
