import React from "react";
import { useAuthStore } from "../store/useAuthStore";

const ToggleRow = ({ label, sub, enabled, onChange }) => (
  <div className="flex items-center justify-between py-3.5 px-4 border-b border-base-300 last:border-0 rounded-xl hover:bg-base-200 transition-colors">
    <div>
      <p className="text-sm text-base-content">{label}</p>
      {sub && <p className="text-xs text-base-content/50 mt-0.5">{sub}</p>}
    </div>
    <input
      type="checkbox"
      className="toggle toggle-primary toggle-sm"
      checked={enabled}
      onChange={onChange}
    />
  </div>
);

const NotificationSettings = () => {
  const { authUser, updateNotifications } = useAuthStore();
  const notificationSettings = authUser?.notificationSettings || {
    popupsEnabled: true,
    soundEnabled: true,
    soundType: "default",
    customSoundUrl: ""
  };

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-4">Alerts</h3>
        <ToggleRow
          label="Show Notifications (Pop-ups)"
          sub="Show desktop notifications for new messages"
          enabled={notificationSettings.popupsEnabled}
          onChange={async (e) => {
            const checked = e.target.checked;
            if (checked && Notification.permission !== "granted") {
              const perm = await Notification.requestPermission();
              if (perm !== "granted") {
                import("react-hot-toast").then((mod) => mod.default.error("Notification permission denied"));
                return;
              }
            }
            updateNotifications({ popupsEnabled: checked });
          }}
        />
        <ToggleRow
          label="Play Sound"
          sub="Play audio when a message is received"
          enabled={notificationSettings.soundEnabled}
          onChange={(e) => updateNotifications({ soundEnabled: e.target.checked })}
        />

        <div className={`mt-4 p-4 bg-base-200 rounded-xl border border-base-300 transition-opacity duration-300 ${!notificationSettings.soundEnabled ? 'opacity-50 pointer-events-none grayscale-[0.2]' : ''}`}>
          <p className="text-sm font-medium mb-3 text-base-content">Sound Type</p>
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="soundType"
                className="radio radio-primary radio-sm"
                checked={notificationSettings.soundType === "default"}
                onChange={() => updateNotifications({ soundType: "default" })}
              />
              <span className="text-sm">Default Sound</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="soundType"
                className="radio radio-primary radio-sm"
                checked={notificationSettings.soundType === "custom"}
                onChange={() => updateNotifications({ soundType: "custom" })}
              />
              <span className="text-sm">Custom Upload</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="soundType"
                className="radio radio-primary radio-sm"
                checked={notificationSettings.soundType === "mute"}
                onChange={() => updateNotifications({ soundType: "mute" })}
              />
              <span className="text-sm">Muted (No Sound)</span>
            </label>
          </div>

          {notificationSettings.soundType === "custom" && (
            <div className="mt-4">
              <label className="btn btn-sm btn-outline border-base-content/20 hover:bg-base-300 normal-case cursor-pointer">
                Upload Audio File
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      if (file.size > 2 * 1024 * 1024) {
                        import("react-hot-toast").then((mod) => mod.default.error("File size must be < 2MB"));
                        return;
                      }
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        updateNotifications({ soundType: "custom", customSoundUrl: reader.result });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
              {notificationSettings.customSoundUrl && (
                <div className="mt-2 text-xs text-success flex items-center gap-2">
                  <span className="size-2 rounded-full bg-success inline-block"></span> Custom audio uploaded
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default NotificationSettings;
