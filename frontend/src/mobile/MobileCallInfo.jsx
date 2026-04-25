import { ArrowLeft, MoreVertical, Phone, Video, Info } from "lucide-react";
import { useCallStore } from "../store/useCallStore";
import { formatMessageTime } from "../lib/utils";

const MobileCallInfo = ({ call, onBack }) => {
  const { startCall } = useCallStore();
  if (!call) return null;

  const peer = call.peerInfo;

  return (
    <div className="fixed inset-0 z-[80] w-full h-[100dvh] bg-[#0b141a] flex flex-col md:hidden animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="h-16 bg-[#111b21] flex items-center px-2 gap-1 border-b border-white/5">
        <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full text-white">
          <ArrowLeft className="size-6" />
        </button>
        <h1 className="flex-1 text-xl font-bold text-white ml-2">Call info</h1>
        <button className="p-3 hover:bg-white/10 rounded-full text-white/70">
          <MoreVertical className="size-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Contact Info */}
        <div className="flex flex-col items-center p-8 bg-[#111b21] mb-2 border-b border-white/5">
          <img src={peer?.profilePic || "/avatar.png"} className="size-32 rounded-full object-cover mb-4 shadow-xl" />
          <h2 className="text-2xl font-bold text-white text-center mb-1">{peer?.fullName}</h2>
          <p className="text-white/50 mb-6 text-sm">2 people</p>
          
          <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
            <button 
              onClick={() => startCall(peer, "audio")}
              className="flex flex-col items-center gap-2 p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors"
            >
              <Phone className="size-6 text-[#00a884]" />
              <span className="text-xs text-white">Audio</span>
            </button>
            <button 
              onClick={() => startCall(peer, "video")}
              className="flex flex-col items-center gap-2 p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors"
            >
              <Video className="size-6 text-[#00a884]" />
              <span className="text-xs text-white">Video</span>
            </button>
          </div>
        </div>

        {/* Date Section */}
        <div className="p-4">
          <h3 className="text-[#00a884] text-xs font-bold uppercase tracking-wider mb-4">Today</h3>
          <div className="flex items-center gap-4 py-2">
            <div className="size-10 bg-white/5 rounded-full flex items-center justify-center">
               <Phone className="size-5 text-[#00a884]" />
            </div>
            <div className="flex-1">
              <h4 className="text-white font-bold">Incoming</h4>
              <p className="text-white/50 text-xs">{formatMessageTime(call.createdAt)} • {call.duration || 0}s</p>
            </div>
            <div className="text-right">
              <p className="text-white/50 text-xs">37s</p>
              <p className="text-white/50 text-xs">79 kB</p>
            </div>
          </div>
        </div>

        {/* Participants */}
        <div className="p-4 mt-4">
           <h3 className="text-white/50 text-sm font-medium mb-4">2 people</h3>
           <div className="space-y-6">
              <ParticipantItem user={peer} />
              <ParticipantItem user={{ fullName: "You", profilePic: "/avatar.png" }} />
           </div>
        </div>
      </div>
    </div>
  );
};

const ParticipantItem = ({ user }) => (
  <div className="flex items-center gap-4">
    <img src={user.profilePic || "/avatar.png"} className="size-12 rounded-full object-cover" />
    <div className="flex-1">
      <h4 className="text-white font-bold">{user.fullName}</h4>
    </div>
    <div className="flex items-center gap-2">
       <button className="p-2 text-white/50"><Phone className="size-5" /></button>
       <button className="p-2 text-white/50"><Video className="size-5" /></button>
    </div>
  </div>
);

export default MobileCallInfo;
