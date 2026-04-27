import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { fetchStatuses } from "../lib/statusService";
import StatusUpload from "../components/StatusUpload";
import StatusViewer from "../components/StatusViewer";
import { Plus, Radio, RefreshCw, Clock } from "lucide-react";
import toast from "react-hot-toast";

/**
 * StatusPage — renders inside the /chats route when activeView === "status".
 *
 * Layout mirrors the existing two-panel (sidebar + main) structure used
 * by chats and calls views — NO changes to the surrounding layout.
 *
 * Real-time:
 *   - Listens to "status:new", "status:view", "status:delete" socket events
 *     via the existing authUser socket (zero new connections).
 */

// ── Helpers ────────────────────────────────────────────────────────────────
const groupByUser = (statuses) => {
  const map = new Map();
  for (const s of statuses) {
    const uid = s.userId?._id || s.userId;
    if (!map.has(uid)) {
      map.set(uid, { user: s.userId, items: [] });
    }
    map.get(uid).items.push(s);
  }
  return Array.from(map.values());
};

const timeAgo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m    = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

// ── Component ──────────────────────────────────────────────────────────────
const StatusPage = () => {
  const { authUser, socket } = useAuthStore();

  const [statuses,       setStatuses]       = useState([]);
  const [isLoading,      setIsLoading]      = useState(true);
  const [showUpload,     setShowUpload]      = useState(false);
  const [viewerGroup,    setViewerGroup]     = useState(null); // { items: Status[] }

  // ── Fetch ────────────────────────────────────────────────────────────────
  const loadStatuses = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchStatuses();
      setStatuses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[StatusPage] load:", err.message);
      toast.error("Could not load statuses");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadStatuses(); }, [loadStatuses]);

  // ── Real-time socket events (isolated — only "status:*" prefix) ──────────
  useEffect(() => {
    const s = socket;
    if (!s) return;

    const onNew = (newStatus) => {
      setStatuses((prev) => {
        // Avoid duplicate if we posted it ourselves
        if (prev.some((x) => x._id === newStatus._id)) return prev;
        return [newStatus, ...prev];
      });
    };

    const onView = ({ statusId, viewerId }) => {
      setStatuses((prev) =>
        prev.map((st) => {
          if (st._id !== statusId) return st;
          const alreadyIn = st.views?.some((v) => (v.userId?._id || v.userId) === viewerId);
          if (alreadyIn) return st;
          return { ...st, views: [...(st.views || []), { userId: viewerId, viewedAt: new Date().toISOString() }] };
        })
      );
    };

    const onDelete = ({ statusId }) => {
      setStatuses((prev) => prev.filter((st) => st._id !== statusId));
      // Close viewer if the deleted status was being viewed
      setViewerGroup((g) => {
        if (!g) return g;
        const filtered = g.items.filter((st) => st._id !== statusId);
        return filtered.length > 0 ? { ...g, items: filtered } : null;
      });
    };

    s.on("status:created",    onNew);
    s.on("status:view",   onView);
    s.on("status:deleted", onDelete);

    return () => {
      s.off("status:created",    onNew);
      s.off("status:view",   onView);
      s.off("status:deleted", onDelete);
    };
  }, [socket]);

  // ── Derived state ────────────────────────────────────────────────────────
  const myStatuses   = statuses.filter(
    (s) => (s.userId?._id || s.userId) === authUser?._id
  );
  const otherStatuses = statuses.filter(
    (s) => (s.userId?._id || s.userId) !== authUser?._id
  );
  const otherGroups  = groupByUser(otherStatuses);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleUploaded = (newStatus) => {
    setStatuses((prev) => [newStatus, ...prev]);
  };

  const handleDeleted = (statusId) => {
    setStatuses((prev) => prev.filter((s) => s._id !== statusId));
  };

  const openViewer = (group) => setViewerGroup(group);
  const closeViewer = () => setViewerGroup(null);

  // ── Inline scoped styles (no global CSS) ─────────────────────────────────
  const ring = (hasNew) => ({
    width: 48,
    height: 48,
    borderRadius: "50%",
    border: hasNew ? "2.5px solid oklch(var(--p))" : "2.5px solid transparent",
    padding: "2px",
    flexShrink: 0,
    cursor: "pointer",
  });

  const avatarImg = { width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Two-panel layout (matches existing chat/calls pattern) ── */}
      <div className="flex flex-1 h-full overflow-hidden relative z-0">
        {/* ── LEFT: Status list sidebar ─────────────────────────────── */}
        <div
          className="flex flex-col flex-shrink-0 border-r border-base-content/10 bg-base-100 overflow-hidden"
          style={{ width: "340px" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-base-content/10 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Radio size={18} className="text-primary" />
              <h2 className="font-bold text-base-content text-sm">Status</h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={loadStatuses}
                className="btn btn-ghost btn-xs btn-circle"
                title="Refresh"
                id="status-refresh-btn"
              >
                <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
              </button>
              <button
                onClick={() => setShowUpload(true)}
                className="btn btn-primary btn-xs gap-1"
                id="status-add-btn"
              >
                <Plus size={14} />
                Add
              </button>
            </div>
          </div>

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw size={20} className="animate-spin text-base-content/40" />
              </div>
            ) : (
              <>
                {/* ── My status ─────────────────────────────────────── */}
                <div className="px-3 pt-3 pb-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/40 px-1 mb-1">
                    My Status
                  </p>
                  <button
                    onClick={() =>
                      myStatuses.length > 0
                        ? openViewer({ user: authUser, items: myStatuses })
                        : setShowUpload(true)
                    }
                    className="flex items-center gap-3 w-full px-2 py-2 rounded-xl hover:bg-base-200 transition-colors text-left"
                    id="status-my-row"
                  >
                    {/* Avatar with ring */}
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <div style={ring(myStatuses.length > 0)}>
                        <img
                          src={authUser?.profilePic || "/avatar.png"}
                          alt="My status"
                          style={avatarImg}
                        />
                      </div>
                      <span
                        style={{
                          position: "absolute",
                          bottom: 0,
                          right: 0,
                          background: "oklch(var(--p))",
                          borderRadius: "50%",
                          width: 18,
                          height: 18,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "2px solid oklch(var(--b1))",
                        }}
                      >
                        <Plus size={10} color="#fff" />
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-base-content">My Status</p>
                      <p className="text-xs text-base-content/50">
                        {myStatuses.length > 0
                          ? `${myStatuses.length} update${myStatuses.length > 1 ? "s" : ""} · ${timeAgo(myStatuses[0].createdAt)}`
                          : "Tap to add a status update"}
                      </p>
                    </div>
                  </button>
                </div>

                {/* ── Recent updates ──────────────────────────────────── */}
                {otherGroups.length > 0 && (
                  <div className="px-3 pt-2 pb-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/40 px-1 mb-1">
                      Recent Updates
                    </p>
                    {otherGroups.map(({ user, items }) => {
                      const uid = user?._id || user;
                      const hasUnseen = items.some(
                        (s) => !s.views?.some((v) => (v.userId?._id || v.userId) === authUser?._id)
                      );
                      return (
                        <button
                          key={uid}
                          onClick={() => openViewer({ user, items })}
                          className="flex items-center gap-3 w-full px-2 py-2 rounded-xl hover:bg-base-200 transition-colors text-left"
                          id={`status-contact-${uid}`}
                        >
                          <div style={ring(hasUnseen)}>
                            <img
                              src={user?.profilePic || "/avatar.png"}
                              alt={user?.fullName}
                              style={avatarImg}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-base-content truncate">
                              {user?.fullName || "Unknown"}
                            </p>
                            <p className="text-xs text-base-content/50 flex items-center gap-1">
                              <Clock size={10} />
                              {timeAgo(items[0].createdAt)}
                            </p>
                          </div>
                          {hasUnseen && (
                            <span className="size-2 rounded-full bg-primary flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Empty state */}
                {otherGroups.length === 0 && myStatuses.length === 0 && !isLoading && (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
                    <Radio size={40} className="text-base-content/20" />
                    <p className="font-bold text-base-content/60 text-sm">No statuses yet</p>
                    <p className="text-xs text-base-content/40">
                      Be the first to share a status update!
                    </p>
                    <button
                      onClick={() => setShowUpload(true)}
                      className="btn btn-primary btn-sm gap-1 mt-2"
                    >
                      <Plus size={14} />
                      Add Status
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── RIGHT: Placeholder main panel ──────────────────────────── */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-base-200/50">
          <div className="flex flex-col items-center gap-3 text-center px-8 max-w-xs">
            <div className="size-20 rounded-3xl bg-primary/10 flex items-center justify-center">
              <Radio size={36} className="text-primary" />
            </div>
            <h3 className="font-bold text-lg text-base-content">Status Updates</h3>
            <p className="text-sm text-base-content/50 leading-relaxed">
              Tap a contact on the left to view their status, or click{" "}
              <strong>Add</strong> to share a photo or video that disappears in 24 hours.
            </p>
            <button
              onClick={() => setShowUpload(true)}
              className="btn btn-primary btn-sm gap-2 mt-2"
              id="status-main-add-btn"
            >
              <Plus size={16} />
              Add My Status
            </button>
          </div>
        </div>
      </div>

      {/* ── Upload modal (lazy — only when needed) ─────────────────── */}
      {showUpload && (
        <StatusUpload
          onClose={() => setShowUpload(false)}
          onUploaded={handleUploaded}
        />
      )}

      {/* ── Viewer overlay (lazy — only when needed) ───────────────── */}
      {viewerGroup && (
        <StatusViewer
          statuses={viewerGroup.items}
          onClose={closeViewer}
          onDeleted={handleDeleted}
        />
      )}
    </>
  );
};

export default StatusPage;
