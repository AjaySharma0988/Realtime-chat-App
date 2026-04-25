import { MessageSquare, CircleDashed, Users, Phone } from "lucide-react";
import { useAppStore } from "../store/useAppStore";

const MobileBottomNav = () => {
  const { activeView, setActiveView } = useAppStore();

  const navItems = [
    { id: "chats",       label: "Chats",       icon: MessageSquare },
    { id: "status",      label: "Updates",     icon: CircleDashed  },
    { id: "communities", label: "Communities", icon: Users         },
    { id: "calls",       label: "Calls",       icon: Phone         },
  ];

  return (
    <div className="md:hidden flex-shrink-0 bg-base-300 border-t border-base-content/10 h-[65px] flex items-center justify-around z-50 shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className="flex flex-col items-center gap-1 flex-1 py-1 transition-all duration-200 active:scale-95"
          >
            <div
              className={`px-5 py-1.5 rounded-full transition-all flex items-center justify-center ${
                isActive ? "bg-primary/10" : "hover:bg-base-content/5"
              }`}
            >
              <Icon
                className={`size-6 ${isActive ? "text-primary" : "text-base-content/50"}`}
              />
            </div>
            <span
              className={`text-[11px] font-semibold tracking-tight ${
                isActive ? "text-primary" : "text-base-content/50"
              }`}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default MobileBottomNav;
