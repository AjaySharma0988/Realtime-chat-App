import { Search, X } from "lucide-react";

const ChatStyleList = ({ 
  children, 
  searchQuery, 
  setSearchQuery, 
  placeholder = "Search...",
  showSearch = true 
}) => {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* ── Search ──────────────────────────────────────────────────────── */}
      {showSearch && (
        <div className="px-3 pt-3 pb-2 flex-shrink-0">
          <div className="flex items-center gap-2 rounded-full px-4 py-2 bg-base-200 border border-base-300 focus-within:border-primary/40 transition-colors">
            <Search className="size-4 flex-shrink-0 text-base-content/40" />
            <input
              type="text"
              placeholder={placeholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-sm outline-none w-full text-base-content placeholder:text-base-content/40"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-base-content/40 hover:text-base-content transition-colors"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── List Content ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {children}
      </div>
    </div>
  );
};

export default ChatStyleList;
