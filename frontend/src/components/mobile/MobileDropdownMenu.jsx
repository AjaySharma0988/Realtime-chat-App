/**
 * MobileDropdownMenu — a reusable popup menu that accepts the same
 * `menuItems` array format used by the desktop Sidebar and ChatHeader.
 *
 * Format: Array of { icon, label, action, danger? } | null (divider)
 *
 * Usage:
 *   <MobileDropdownMenu
 *     isOpen={menuOpen}
 *     onClose={() => setMenuOpen(false)}
 *     menuItems={menuItems}
 *     menuRef={menuRef}
 *   />
 */
import { useEffect } from "react";

const MobileDropdownMenu = ({ isOpen, onClose, menuItems, menuRef }) => {
  // Close on outside click — handled by the parent's ref
  // Also close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-12 w-[220px] bg-base-200 rounded-xl shadow-2xl border border-base-300 overflow-hidden z-[100]"
      style={{ animation: "wa-pop-in 0.12s ease-out" }}
    >
      {menuItems.map((item, idx) => {
        if (item === null) {
          return <div key={`divider-${idx}`} className="border-t border-base-300 my-1" />;
        }
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            onClick={() => { onClose(); item.action?.(); }}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors
              ${item.danger
                ? "text-error hover:bg-error/10 active:bg-error/20"
                : "text-base-content hover:bg-base-300 active:bg-base-300/70"
              }`}
          >
            {Icon && <Icon className="size-4 flex-shrink-0 opacity-70" />}
            {item.label}
          </button>
        );
      })}
    </div>
  );
};

export default MobileDropdownMenu;
