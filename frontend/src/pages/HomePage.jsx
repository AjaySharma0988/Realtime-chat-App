import { useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAppStore } from "../store/useAppStore";

import Sidebar from "../components/Sidebar";
import CallsSidebar from "../components/sidebars/CallsSidebar";
import SidebarBase from "../components/SidebarBase";
import ChatStyleHeader from "../components/sidebars/ChatStyleHeader";
import ChatStyleList from "../components/sidebars/ChatStyleList";
import NoChatSelected from "../components/NoChatSelected";
import ChatContainer from "../components/ChatContainer";
import CallHistoryDetail from "../components/CallHistoryDetail";
import { useCallStore } from "../store/useCallStore";
import StatusPage from "./StatusPage";

const VIEWS = {
  status: { icon: "📊", title: "Status", desc: "View and share status updates with your contacts." },
  calls: { icon: "📞", title: "Calls", desc: "Recent calls and call history will appear here." },
  starred: { icon: "⭐", title: "Starred", desc: "Messages you star will appear here for easy access." },
  communities: { icon: "👥", title: "Communities", desc: "Create and manage community groups." },
};

const HomePage = () => {
  const { selectedUser } = useChatStore();
  const { activeView } = useAppStore();
  const [searchQuery, setSearchQuery] = useState("");

  const currentView = VIEWS[activeView] || VIEWS.status;

  return (
    <div className="flex flex-1 h-full overflow-hidden relative z-0">
      {/* Sidebar Section */}
      {activeView === "chats" ? (
        <Sidebar />
      ) : activeView === "calls" ? (
        <CallsSidebar />
      ) : activeView === "status" ? (
        // StatusPage manages its own two-panel layout — render as full-width
        <StatusPage />
      ) : (
        <SidebarBase>
          <ChatStyleHeader title={currentView.title} />
          <ChatStyleList
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            placeholder={`Search ${currentView.title.toLowerCase()}...`}
          >
            <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-3">
              <div className="text-5xl mb-1">{currentView.icon}</div>
              <h3 className="font-bold text-base-content text-lg">{currentView.title}</h3>
              <p className="text-sm text-base-content/50 max-w-[200px] leading-relaxed">
                {currentView.desc}
              </p>
            </div>
          </ChatStyleList>
        </SidebarBase>
      )}

      {/* Main Content Area — hidden when StatusPage handles its own layout */}
      {activeView !== "status" && (
        <div className="flex-1 flex overflow-hidden">
          {activeView === "chats" ? (
            !selectedUser ? <NoChatSelected /> : <ChatContainer />
          ) : activeView === "calls" ? (
            <CallHistoryDetail />
          ) : (
            <NoChatSelected />
          )}
        </div>
      )}
    </div>
  );
};

export default HomePage;
