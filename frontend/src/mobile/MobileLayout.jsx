import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { useChatStore } from "../store/useChatStore";
import MobileBottomNav from "./MobileBottomNav";
import MobileChats from "./MobileChats";
import MobileChatPage from "./MobileChatPage";
import MobileUpdates from "./MobileUpdates";
import MobileCommunities from "./MobileCommunities";
import MobileCalls from "./MobileCalls";
import MobileCallInfo from "./MobileCallInfo";
import MobileSettings from "./MobileSettings";
import MobileLinkedDevices from "./MobileLinkedDevices";
import MobileTheme from "./MobileTheme";
import MobileProfile from "./MobileProfile";
import MobileProfileHub from "./MobileProfileHub";

// Global context object — pass setMobileScreen down so any child can navigate
export const navigateMobile = { fn: null };

const MobileLayout = () => {
  const { activeView } = useAppStore();
  const { selectedUser } = useChatStore();
  const [selectedCall, setSelectedCall] = useState(null);
  const [mobileScreen, setMobileScreen] = useState(null); // null = default view

  // Wire up global imperative navigation so MobileMenu can call it
  navigateMobile.fn = setMobileScreen;

  // Priority order: overlay screens → chat page → call info → tab views

  // Full-screen overlay screens
  if (mobileScreen === "settings") {
    return <MobileSettings onBack={() => setMobileScreen(null)} />;
  }
  if (mobileScreen === "linkedDevices") {
    return <MobileLinkedDevices onBack={() => setMobileScreen(null)} />;
  }
  if (mobileScreen === "chatTheme") {
    return <MobileTheme onBack={() => setMobileScreen(null)} />;
  }
  if (mobileScreen === "profile") {
    return (
      <MobileProfile
        onBack={() => setMobileScreen(null)}
      />
    );
  }
  if (mobileScreen === "myProfile") {
    return <MobileProfileHub onBack={() => setMobileScreen(null)} />;
  }

  // Chat conversation view
  if (selectedUser) {
    return (
      <MobileChatPage />
    );
  }

  // Call info view
  if (selectedCall) {
    return <MobileCallInfo call={selectedCall} onBack={() => setSelectedCall(null)} />;
  }

  const renderView = () => {
    switch (activeView) {
      case "chats":       return <MobileChats />;
      case "status":      return <MobileUpdates />;
      case "communities": return <MobileCommunities />;
      case "calls":       return <MobileCalls onSelectCall={setSelectedCall} />;
      default:            return <MobileChats />;
    }
  };

  return (
    <div className="flex flex-col w-full h-[100dvh] md:hidden overflow-hidden bg-base-100">
      <div className="flex-1 overflow-hidden">
        {renderView()}
      </div>
      <MobileBottomNav />
    </div>
  );
};

export default MobileLayout;
