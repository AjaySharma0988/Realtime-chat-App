import { Link } from "react-router-dom";
import { MoreVertical, Edit } from "lucide-react";

const ChatStyleHeader = ({ title, actions, showMenu, setShowMenu, menuRef, menuItems }) => {
  return (
    <div className="h-14 px-4 bg-base-200 border-b border-base-300 flex items-center justify-between flex-shrink-0">
      {/* Logo + Title */}
      <div className="flex items-center gap-2">
        <span className="font-bold text-base-content">{title}</span>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-0.5">
        {actions}
        
        {/* 3-dot menu if items provided */}
        {menuItems && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu((v) => !v)}
              className={`p-2 rounded-full transition-colors ${showMenu ? "bg-base-300" : "hover:bg-base-300"}`}
              title="More options"
            >
              <MoreVertical className="size-4 text-base-content/60" />
            </button>

            {showMenu && (
              <div
                className="absolute right-0 top-11 w-56 rounded-xl shadow-2xl bg-base-200 border border-base-300 overflow-hidden z-50"
                style={{ animation: "wa-pop-in 0.12s ease-out" }}
              >
                {menuItems.map((item, idx) => {
                  if (item === null) return <div key={`d-${idx}`} className="border-t border-base-300 my-1" />;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      onClick={() => { setShowMenu(false); item.action?.(); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors
                        ${item.danger ? "text-error hover:bg-error/10" : "text-base-content hover:bg-base-300"}`}
                    >
                      <Icon className="size-4 flex-shrink-0 opacity-70" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatStyleHeader;
