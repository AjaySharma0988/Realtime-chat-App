import { useCallStore } from "../store/useCallStore";
import { 
  Phone, Video, ArrowDownLeft, ArrowUpRight, 
  MoreVertical, PhoneCall, VideoIcon, User, 
  Clock, Info 
} from "lucide-react";

const CallHistoryDetail = () => {
  const { selectedCallPeer, callHistory, startCall } = useCallStore();

  if (!selectedCallPeer) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-base-100">
        <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <Phone className="size-10 text-primary" />
        </div>
        <h3 className="text-xl font-bold text-base-content">Call History Details</h3>
        <p className="text-base-content/50 mt-2 max-w-sm">
          Select a contact from the calls list to view your interaction history and start a new call.
        </p>
      </div>
    );
  }

  const peerHistory = callHistory.filter(
    call => call.peerId?._id === selectedCallPeer._id
  );

  const getStatusColor = (status) => {
    switch (status) {
      case "missed": return "text-error";
      case "rejected": return "text-error";
      case "answered": return "text-success";
      default: return "text-base-content/60";
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return "0s";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-base-100 overflow-hidden">
      {/* ── Header ── */}
      <div className="px-6 py-6 border-b border-base-300 bg-base-200/30 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img
            src={selectedCallPeer.profilePic || "/avatar.png"}
            alt={selectedCallPeer.fullName}
            className="size-16 rounded-full object-cover ring-2 ring-primary/20"
          />
          <div>
            <h2 className="text-xl font-bold text-base-content">{selectedCallPeer.fullName}</h2>
            <p className="text-sm text-base-content/50">Contact info & call history</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => startCall(selectedCallPeer, "audio")}
            className="p-3 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-all active:scale-95"
            title="Audio Call"
          >
            <PhoneCall className="size-5" />
          </button>
          <button
            onClick={() => startCall(selectedCallPeer, "video")}
            className="p-3 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-all active:scale-95"
            title="Video Call"
          >
            <VideoIcon className="size-5" />
          </button>
          <button className="p-3 rounded-full hover:bg-base-300 transition-all">
            <MoreVertical className="size-5 text-base-content/60" />
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="max-w-2xl mx-auto space-y-8">
          
          {/* Info Card */}
          <div className="bg-base-200/50 rounded-2xl p-6 border border-base-300 flex items-start gap-4">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="size-5 text-primary" />
            </div>
            <div>
              <h4 className="font-bold text-base-content">About</h4>
              <p className="text-sm text-base-content/60 mt-1">
                {selectedCallPeer.about || "Hey there! I am using Chatty."}
              </p>
            </div>
          </div>

          {/* History List */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <Clock className="size-4 text-primary" />
              <h3 className="font-bold text-base-content uppercase tracking-wider text-xs">Recent History</h3>
            </div>

            <div className="space-y-2">
              {peerHistory.length === 0 ? (
                <div className="text-center py-10 text-base-content/40">
                  No specific call history found.
                </div>
              ) : (
                peerHistory.map((call) => (
                  <div 
                    key={call._id}
                    className="flex items-center justify-between p-4 bg-base-200/30 rounded-xl border border-base-300/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${call.status === "missed" ? "bg-error/10" : "bg-success/10"}`}>
                        {call.type === "incoming" ? (
                          <ArrowDownLeft className={`size-5 ${getStatusColor(call.status)}`} />
                        ) : (
                          <ArrowUpRight className={`size-5 ${getStatusColor(call.status)}`} />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold capitalize ${getStatusColor(call.status)}`}>
                            {call.status} {call.type} call
                          </span>
                          <span className="text-[10px] bg-base-content/5 px-1.5 py-0.5 rounded text-base-content/40 uppercase font-black">
                            {call.callType}
                          </span>
                        </div>
                        <p className="text-xs text-base-content/40 mt-0.5">
                          {new Date(call.timestamp).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                        </p>
                      </div>
                    </div>

                    {call.status === "answered" && (
                      <div className="text-right">
                        <p className="text-xs font-bold text-base-content/60">
                          {formatDuration(call.duration)}
                        </p>
                        <p className="text-[10px] text-base-content/30 uppercase">Duration</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallHistoryDetail;
