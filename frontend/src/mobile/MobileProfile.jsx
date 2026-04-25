import { ArrowLeft } from "lucide-react";
import ContactInfoPanel from "../components/ContactInfoPanel";
import { useChatStore } from "../store/useChatStore";

/**
 * MobileProfile — full-screen wrapper around the existing ContactInfoPanel.
 * We temporarily set the selectedUser so ContactInfoPanel's store hooks work,
 * then restore on back.
 *
 * Since MobileLayout only shows this when selectedUser is already set in the
 * chat store (the user just came from a chat), ContactInfoPanel already has
 * access to the right selectedUser and messages — no extra data fetching needed.
 */
const MobileProfile = ({ onBack }) => {
  const { selectedUser } = useChatStore();

  if (!selectedUser) return null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-base-100 md:hidden w-full h-[100dvh]">
      {/* Mobile top bar with back button */}
      <div className="h-14 bg-base-200 border-b border-base-300 flex items-center px-2 gap-1 flex-shrink-0">
        <button
          onClick={onBack}
          className="p-2 hover:bg-base-content/10 rounded-full text-base-content"
        >
          <ArrowLeft className="size-6" />
        </button>
        <h1 className="text-base font-bold text-base-content flex-1 px-1">
          Contact info
        </h1>
      </div>

      {/*
        Render the exact same ContactInfoPanel used on desktop.
        Override its width so it fills the mobile screen instead of being a sidebar.
        The onClose prop maps to the mobile back navigation.
      */}
      <div className="flex-1 overflow-hidden [&>div]:w-full [&>div]:border-l-0 [&>div]:h-full">
        <ContactInfoPanel onClose={onBack} />
      </div>
    </div>
  );
};

export default MobileProfile;
