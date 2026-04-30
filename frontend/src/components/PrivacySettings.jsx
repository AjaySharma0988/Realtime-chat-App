import React, { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import PrivacyCustomUsersModal from "./PrivacyCustomUsersModal";
import { ChevronRight, X as CloseIcon } from "lucide-react";

const NavRow = ({ icon: Icon, label, sub }) => (
  <button className="w-full flex items-center gap-4 py-3.5 px-4 border-b border-base-300 last:border-0 hover:bg-base-200 transition-colors rounded-xl">
    {Icon && <Icon className="size-5 text-primary flex-shrink-0" />}
    <div className="flex-1 text-left">
      <p className="text-sm text-base-content">{label}</p>
      {sub && <p className="text-xs text-base-content/50 mt-0.5">{sub}</p>}
    </div>
    <ChevronRight className="size-4 text-base-content/30" />
  </button>
);

const ToggleRow = ({ label, sub, enabled, onChange }) => (
  <div className="flex items-center justify-between py-3.5 px-4 border-b border-base-300 last:border-0 rounded-xl hover:bg-base-200 transition-colors">
    <div>
      <p className="text-sm text-base-content">{label}</p>
      {sub && <p className="text-xs text-base-content/50 mt-0.5">{sub}</p>}
    </div>
    <input type="checkbox" className="toggle toggle-primary toggle-sm" checked={enabled} onChange={onChange} />
  </div>
);

const SectionTitle = ({ title }) => (
  <div className="mb-8 hidden lg:block">
    <h2 className="text-3xl font-bold text-base-content">{title}</h2>
    <div className="h-1 w-12 bg-primary rounded-full mt-2" />
  </div>
);

const PrivacySettings = () => {
  const { authUser, updatePrivacy } = useAuthStore();
  const [notifs, setNotifs] = useState({ messages: true, groups: true });
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [photoVisibility, setPhotoVisibility] = useState(
    authUser?.privacy?.profilePhotoVisibility || "everyone"
  );

  const PHOTO_OPTIONS = [
    { label: "Everyone", value: "everyone" },
    { label: "Nobody", value: "nobody" },
    { label: "Custom", value: "custom" },
  ];

  const handlePhotoVisibilitySelect = async (value) => {
    if (value === "custom") {
      setShowCustomModal(true);
      return;
    }
    setPhotoVisibility(value);
    await updatePrivacy({ profilePhotoVisibility: value });
  };

  const handleCustomSave = () => {
    setPhotoVisibility("custom");
    setShowCustomModal(false);
  };

  return (
    <>
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <SectionTitle title="Privacy" />
      <div className="space-y-8">
        <section>
          <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-4">Who can see my info</h3>
          <NavRow label="Last seen &amp; online" sub="Everyone" />
          <div className="my-4 p-4 bg-base-200 rounded-xl border border-base-300">
            <p className="text-sm font-medium mb-3 text-base-content">Profile Photo Visibility</p>
            <div className="flex flex-col gap-3">
              {PHOTO_OPTIONS.map(({ label, value }) => (
                <label key={value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="photoVisibility"
                    className="radio radio-primary radio-sm"
                    checked={photoVisibility === value}
                    onChange={() => handlePhotoVisibilitySelect(value)}
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>

            {photoVisibility === "custom" && (
              <div className="mt-4 pt-4 border-t border-base-300/50">
                <button 
                  onClick={() => setShowCustomModal(true)}
                  className="btn btn-sm btn-outline border-base-content/20 hover:bg-base-300 normal-case"
                >
                  Edit Selected Users
                </button>
                {(authUser?.privacy?.allowedUsers?.length || 0) > 0 && (
                  <div className="mt-2 text-xs text-success flex items-center gap-2">
                     <span className="size-2 rounded-full bg-success inline-block"></span> {authUser.privacy.allowedUsers.length} users selected
                  </div>
                )}
              </div>
            )}
          </div>

          <NavRow label="About" sub="Everyone" />
          <NavRow label="Status" sub="My contacts" />
        </section>
        <section>
          <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-4">Messaging</h3>
          <ToggleRow label="Read receipts" sub="Send/receive blue ticks" enabled={notifs.messages} onChange={e => setNotifs(n => ({ ...n, messages: e.target.checked }))} />
          <ToggleRow label="Online status" sub="Let others see when you're online" enabled={notifs.groups} onChange={e => setNotifs(n => ({ ...n, groups: e.target.checked }))} />
        </section>
      </div>
    </div>

      {showCustomModal && (
        <PrivacyCustomUsersModal
          onClose={() => setShowCustomModal(false)}
          onSave={handleCustomSave}
          initialSelected={authUser?.privacy?.allowedUsers || []}
        />
      )}
    </>
  );
};

export default PrivacySettings;
