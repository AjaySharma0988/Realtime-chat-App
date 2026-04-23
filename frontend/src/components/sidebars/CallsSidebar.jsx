import { useEffect, useState } from "react";
import { useCallStore } from "../../store/useCallStore";
import { useChatStore } from "../../store/useChatStore";
import { 
  Phone, Video, ArrowDownLeft, ArrowUpRight, 
  Trash2, Search, PhoneOff 
} from "lucide-react";
import SidebarBase from "../SidebarBase";
import ChatStyleHeader from "./ChatStyleHeader";
import ChatStyleList from "./ChatStyleList";

const CallsSidebar = () => {
  const { 
    callHistory, fetchCallHistory, setSelectedCallPeer, 
    selectedCallPeer, clearCallHistory, isFetchingHistory 
  } = useCallStore();
  const { users } = useChatStore();
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchCallHistory();
  }, [fetchCallHistory]);

  const groupCalls = (calls) => {
    const groups = {
      Today: [],
      Yesterday: [],
      Older: []
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    calls.forEach(call => {
      const date = new Date(call.timestamp);
      const callDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      
      if (callDay.getTime() === today.getTime()) {
        groups.Today.push(call);
      } else if (callDay.getTime() === yesterday.getTime()) {
        groups.Yesterday.push(call);
      } else {
        groups.Older.push(call);
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
    const isIncoming = call.type === "incoming";
    
    if (isIncoming) {
      return <ArrowDownLeft className={`size-3 ${isMissed ? "text-error" : "text-success"}`} />;
    }
    return <ArrowUpRight className={`size-3 ${isMissed ? "text-error" : "text-success"}`} />;
  };

  const renderCallItem = (call) => {
    const peer = call.peerId;
    const isSelected = selectedCallPeer?._id === peer?._id;

    return (
      <div
        key={call._id}
        onClick={() => setSelectedCallPeer(peer)}
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors
          ${isSelected ? "bg-base-300" : "hover:bg-base-200"}`}
      >
        <div className="relative">
          <img
            src={peer?.profilePic || "/avatar.png"}
            alt={peer?.fullName}
            className="w-10 h-10 rounded-full object-cover"
          />
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${call.status === "missed" ? "text-error" : ""}`}>
            {peer?.fullName || "Unknown"}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            {getStatusIcon(call)}
            <p className="text-xs text-base-content/60 truncate">
              {call.type === "incoming" ? "Incoming" : "Outgoing"} • {call.status} • {new Date(call.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
            </p>
          </div>
        </div>

        <div className="flex-shrink-0">
          {call.callType === "video" ? (
            <Video className="size-4 text-base-content/40" />
          ) : (
            <Phone className="size-4 text-base-content/40" />
          )}
        </div>
      </div>
    );
  };

  return (
    <SidebarBase>
      <ChatStyleHeader
        title="Calls"
        actions={
          <button
            onClick={clearCallHistory}
            className="p-2 rounded-full hover:bg-base-300 transition-colors"
            title="Clear Call History"
          >
            <Trash2 className="size-4 text-base-content/60" />
          </button>
        }
      />

      <ChatStyleList
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        placeholder="Search calls"
      >
        {callHistory.length === 0 && !isFetchingHistory ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="size-16 rounded-full bg-base-200 flex items-center justify-center mb-4">
              <PhoneOff className="size-8 text-base-content/20" />
            </div>
            <p className="text-base-content/60 font-medium">No call history yet</p>
            <p className="text-xs text-base-content/40 mt-1">
              Calls you make and receive will show up here.
            </p>
          </div>
        ) : (
          Object.entries(groupedCalls).map(([group, calls]) => (
            calls.length > 0 && (
              <div key={group}>
                <div className="px-4 py-2 bg-base-200/50">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-primary/70">
                    {group}
                  </p>
                </div>
                {calls.map(renderCallItem)}
              </div>
            )
          ))
        )}
      </ChatStyleList>
    </SidebarBase>
  );
};

export default CallsSidebar;
