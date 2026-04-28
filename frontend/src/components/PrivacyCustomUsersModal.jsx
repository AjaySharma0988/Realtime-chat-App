import { useState, useMemo } from "react";
import { Search, X, Check, Users } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";

/**
 * PrivacyCustomUsersModal
 * Shared modal used by both Desktop ProfilePage and Mobile MobileProfileHub.
 *
 * Props:
 *  - onClose()             → close without saving
 *  - onSave(allowedUsers)  → called with array of selected user IDs after save
 *  - initialSelected       → array of user IDs already saved (for pre-check)
 *  - mobileStyle           → bool, renders as bottom-sheet on mobile
 */
const PrivacyCustomUsersModal = ({ onClose, onSave, initialSelected = [], mobileStyle = false }) => {
  const { users } = useChatStore();
  const { authUser, updatePrivacy } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState(new Set(initialSelected.map(String)));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  // Exclude self
  const contacts = useMemo(
    () => users.filter((u) => u._id !== authUser?._id),
    [users, authUser?._id]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((u) => u.fullName.toLowerCase().includes(q));
  }, [contacts, searchQuery]);

  const toggleUser = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(String(id)) ? next.delete(String(id)) : next.add(String(id));
      return next;
    });
    setError("");
  };

  const handleSave = async () => {
    if (selected.size === 0) {
      setError("Please select at least one person.");
      return;
    }
    setIsSaving(true);
    try {
      await updatePrivacy({
        profilePhotoVisibility: "custom",
        allowedUsers: [...selected],
      });
      onSave([...selected]);
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const containerCls = mobileStyle
    ? "fixed inset-0 z-[400] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    : "fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200";

  const panelCls = mobileStyle
    ? "bg-base-100 rounded-t-3xl w-full max-w-lg shadow-2xl border-t border-base-300 animate-in slide-in-from-bottom-4 duration-200 flex flex-col max-h-[85vh]"
    : "bg-base-100 rounded-3xl w-full max-w-md shadow-2xl border border-base-300 animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]";

  return (
    <div className={containerCls}>
      <div className={panelCls}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
          <div>
            <h3 className="text-lg font-bold text-base-content">Custom privacy</h3>
            <p className="text-xs text-base-content/50 mt-0.5">
              {selected.size === 0
                ? "Select who can see your profile photo"
                : `${selected.size} ${selected.size === 1 ? "person" : "people"} selected`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-base-200 transition-colors"
          >
            <X className="size-5 text-base-content/40" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 pb-3 flex-shrink-0">
          <div className="flex items-center gap-3 bg-base-200 rounded-2xl px-4 py-2.5 focus-within:ring-2 ring-primary/30 transition-all">
            <Search className="size-4 text-base-content/40 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-sm outline-none flex-1 text-base-content placeholder:text-base-content/30"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-base-content/40 hover:text-base-content transition-colors">
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="px-6 pb-2 text-xs text-error font-medium">{error}</p>
        )}

        {/* User list */}
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-base-content/30 gap-3">
              <Users className="size-10" />
              <p className="text-sm">{searchQuery ? `No results for "${searchQuery}"` : "No contacts found"}</p>
            </div>
          ) : (
            filtered.map((user) => {
              const isSelected = selected.has(String(user._id));
              return (
                <button
                  key={user._id}
                  onClick={() => toggleUser(user._id)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-all mb-1 ${
                    isSelected ? "bg-primary/8" : "hover:bg-base-200"
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={user.profilePic || "/avatar.png"}
                      alt={user.fullName}
                      className="size-11 rounded-full object-cover"
                    />
                  </div>

                  {/* Name */}
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-semibold text-base-content truncate">{user.fullName}</p>
                    <p className="text-xs text-base-content/40 truncate">{user.about || "Hey there! I am using Chatty."}</p>
                  </div>

                  {/* Checkbox */}
                  <div className={`size-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    isSelected
                      ? "bg-primary border-primary"
                      : "border-base-content/20"
                  }`}>
                    {isSelected && <Check className="size-3.5 text-primary-content" strokeWidth={3} />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-base-300 flex-shrink-0 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl bg-base-200 hover:bg-base-300 text-base-content font-semibold text-sm transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-3 rounded-2xl bg-primary hover:bg-primary/90 text-primary-content font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isSaving && <span className="size-4 border-2 border-primary-content border-t-transparent rounded-full animate-spin" />}
            {isSaving ? "Saving..." : `Save${selected.size > 0 ? ` (${selected.size})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrivacyCustomUsersModal;
