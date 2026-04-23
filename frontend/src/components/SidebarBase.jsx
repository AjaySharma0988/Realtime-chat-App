import { useEffect, useState, useRef, useCallback } from "react";

const SidebarBase = ({ children, className = "" }) => {
  const sidebarRef = useRef(null);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e) => {
    if (isResizing && sidebarRef.current) {
      const sidebarRect = sidebarRef.current.getBoundingClientRect();
      let newWidth = e.clientX - sidebarRect.left;
      
      // Constraints (matching CSS)
      if (newWidth < 200) newWidth = 200;
      if (newWidth > 500) newWidth = 500;
      
      // Update SINGLE SOURCE OF TRUTH (CSS Variable)
      document.documentElement.style.setProperty("--sidebar-width", `${newWidth}px`);
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizing);
    } else {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  return (
    <aside
      ref={sidebarRef}
      className={`sidebar-base relative h-full flex-shrink-0 ${isResizing ? "" : "transition-[width] duration-300"} ${className}`}
    >
      {/* ── Resize Handle ───────────────────────────────────────────────── */}
      <div
        className={`absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-50 hover:bg-primary/50 transition-colors ${
          isResizing ? "bg-primary/50" : ""
        }`}
        onMouseDown={startResizing}
      />
      
      {children}
    </aside>
  );
};


export default SidebarBase;
