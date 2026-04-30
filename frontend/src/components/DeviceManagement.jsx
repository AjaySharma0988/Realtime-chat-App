import { useAuthStore } from "../store/useAuthStore";
import { useEffect } from "react";
import { Monitor, Smartphone, Globe, Clock, Trash2, ShieldCheck, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const DeviceManagement = () => {
  const { authUser, linkedDevices, totalActiveSessions, fetchLinkedDevices, removeSession, isFetchingDevices } = useAuthStore();

  useEffect(() => {
    fetchLinkedDevices();
  }, [fetchLinkedDevices]);

  const getDeviceIcon = (type) => {
    switch (type) {
      case "mobile": return Smartphone;
      case "tablet": return Smartphone; // or Tablet icon if available
      default: return Monitor;
    }
  };

  const isCurrentSession = (sessionId) => sessionId === authUser?.sessionId;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            Sessions ({totalActiveSessions})
          </h2>
          <p className="text-sm text-base-content/60">
            You're currently logged in on {totalActiveSessions} {totalActiveSessions === 1 ? "device" : "devices"}.
          </p>
        </div>
        <button 
          onClick={() => fetchLinkedDevices()}
          disabled={isFetchingDevices}
          className="btn btn-ghost btn-sm btn-circle"
        >
          <RefreshCw className={`size-4 ${isFetchingDevices ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="grid gap-4">
        {linkedDevices.length === 0 && !isFetchingDevices ? (
          <div className="text-center py-8 bg-base-200/50 rounded-2xl border border-dashed border-base-content/10">
            <Globe className="size-10 mx-auto text-base-content/20 mb-2" />
            <p className="text-sm text-base-content/50">No active sessions found</p>
          </div>
        ) : (
          linkedDevices.map((session) => {
            const Icon = getDeviceIcon(session.deviceType);
            const isCurrent = isCurrentSession(session.sessionId);
            return (
              <div 
                key={session.sessionId}
                className={`group flex items-center gap-4 p-4 rounded-2xl border transition-all
                  ${isCurrent 
                    ? "bg-primary/5 border-primary/20" 
                    : "bg-base-200/50 border-base-content/5 hover:border-primary/20"}`}
              >
                <div className={`size-12 rounded-xl flex items-center justify-center 
                  ${isCurrent ? "bg-primary text-primary-content" : "bg-primary/10 text-primary"}`}>
                  <Icon className="size-6" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm truncate">
                      {isCurrent ? "This device" : session.deviceName}
                    </h3>
                    {isCurrent && (
                       <span className="badge badge-primary badge-sm py-0 h-4 text-[10px]">Active</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                    <div className="flex items-center gap-1 text-xs text-base-content/60">
                      <Globe className="size-3" />
                      <span>{session.browser} • {session.ip || "Unknown IP"}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-base-content/60">
                      <Clock className="size-3" />
                      <span>
                        {isCurrent ? "Online now" : (session.lastActive 
                          ? `Active ${formatDistanceToNow(new Date(session.lastActive), { addSuffix: true })}`
                          : "Unknown")}
                      </span>
                    </div>
                  </div>
                </div>

                {!isCurrent && (
                  <button 
                    onClick={() => removeSession(session.sessionId)}
                    className="btn btn-ghost btn-sm text-error opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove session"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
        <p className="text-xs text-primary/70 leading-relaxed">
          <strong>Security Tip:</strong> Each session represents a separate browser or device. If you see one you don't recognize, remove it immediately.
        </p>
      </div>
    </div>
  );
};

export default DeviceManagement;
