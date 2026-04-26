import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { THEMES } from "../constants";
import { useThemeStore } from "../store/useThemeStore";
import {
  Settings, Shield, Lock, Bell, MessageSquare,
  HardDrive, ChevronRight, Globe, Smartphone, Send,
  Palette, Layout, Wifi, Database, ArrowLeft, Search,
  HelpCircle, Info, Keyboard, Image as ImageIcon
} from "lucide-react";
import SidebarBase from "../components/SidebarBase";
import { useAppStore } from "../store/useAppStore";
import { useAuthStore } from "../store/useAuthStore";
import { Trash2, AlertTriangle, X as CloseIcon } from "lucide-react";


const PREVIEW_MESSAGES = [
  { id: 1, content: "Hey! How's it going? 👋", isSent: false },
  { id: 2, content: "Great! Just upgraded the chat UI 🎉", isSent: true },
];

// ── Sidebar sections list ───────────────────────────────────────────────────
const SECTIONS = [
  { id: "general", icon: Settings, label: "General" },
  { id: "account", icon: Shield, label: "Account" },
  { id: "privacy", icon: Lock, label: "Privacy" },
  { id: "notifications", icon: Bell, label: "Notifications" },
  { id: "chats", icon: MessageSquare, label: "Chats" },
  { id: "storage", icon: HardDrive, label: "Storage & data" },
];

// ── Generic toggle row ──────────────────────────────────────────────────────
const ToggleRow = ({ label, sub, enabled, onChange }) => (
  <div className="flex items-center justify-between py-3.5 border-b border-base-300 last:border-0">
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

// ── Generic nav row ─────────────────────────────────────────────────────────
const NavRow = ({ icon: Icon, label, sub }) => (
  <button className="w-full flex items-center gap-4 py-3.5 border-b border-base-300 last:border-0 hover:bg-base-200 -mx-4 px-4 transition-colors rounded-lg">
    {Icon && <Icon className="size-5 text-primary flex-shrink-0" />}
    <div className="flex-1 text-left">
      <p className="text-sm text-base-content">{label}</p>
      {sub && <p className="text-xs text-base-content/50 mt-0.5">{sub}</p>}
    </div>
    <ChevronRight className="size-4 text-base-content/30" />
  </button>
);

// ── Per-section content ─────────────────────────────────────────────────────
const SectionContent = ({ section, theme, setTheme, chatPattern, setChatPattern, customBgImage, setCustomBgImage, onDeleteClick }) => {
  const [notifs, setNotifs] = useState({
    messages: true,
    groups: true,
    sounds: true,
    preview: true,
  });
  const [privacy, setPrivacy] = useState({
    readReceipts: true,
    onlineStatus: true,
  });
  const [chatSettings, setChatSettings] = useState({
    enterIsSend: true,
    mediaAutoDownload: true,
  });

  const SectionHeader = ({ title }) => (
    <div className="mb-8">
      <h2 className="text-3xl font-bold text-base-content">{title}</h2>
      <div className="h-1 w-12 bg-primary rounded-full mt-2" />
    </div>
  );

  const handleCustomBgUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomBgImage(reader.result);
        setChatPattern('custom');
      };
      reader.readAsDataURL(file);
    }
  };

  switch (section) {
    case "general":
      return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <SectionHeader title="General" />
          <div className="space-y-6">
            <section>
              <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-4">Language & Region</h3>
              <NavRow icon={Globe} label="App language" sub="English (default)" />
              <NavRow icon={Smartphone} label="Desktop notifications" sub="All messages" />
            </section>

            <section>
              <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-4">Productivity</h3>
              <NavRow icon={Keyboard} label="Keyboard shortcuts" sub="View all shortcuts" />
              <div className="bg-base-200 rounded-xl p-4 mt-4 border border-base-300">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-base-content/60">Search chats</span>
                    <kbd className="kbd kbd-xs">Ctrl + F</kbd>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-base-content/60">New chat</span>
                    <kbd className="kbd kbd-xs">Ctrl + N</kbd>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-base-content/60">Settings</span>
                    <kbd className="kbd kbd-xs">Ctrl + ,</kbd>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-base-content/60">Profile</span>
                    <kbd className="kbd kbd-xs">Ctrl + P</kbd>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      );

    case "account":
      return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <SectionHeader title="Account" />
          <div className="space-y-8">
            <section>
              <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-4">Security</h3>
              <NavRow icon={Lock} label="Two-step verification" sub="Add an extra layer of security" />
              <NavRow icon={Shield} label="Change email" sub="Update your registered email" />
              <NavRow icon={Smartphone} label="Linked devices" sub="Manage connected devices" />
            </section>

            <section>
              <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-4">Danger zone</h3>
              <button
                onClick={onDeleteClick}
                className="w-full text-left py-4 px-4 text-sm text-error hover:bg-error/5 border border-error/20 rounded-xl transition-colors flex items-center justify-between group"
              >
                <div>
                  <p className="font-semibold">Delete account</p>
                  <p className="text-xs opacity-60">Permanently delete your account and all data</p>
                </div>
                <ChevronRight className="size-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </section>
          </div>
        </div>
      );

    case "privacy":
      return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <SectionHeader title="Privacy" />
          <div className="space-y-8">
            <section>
              <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-4">Who can see my info</h3>
              <NavRow label="Last seen and online" sub="Everyone" />
              <NavRow label="Profile photo" sub="Everyone" />
              <NavRow label="About" sub="Everyone" />
              <NavRow label="Status" sub="My contacts" />
            </section>

            <section>
              <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-4">Messaging</h3>
              <ToggleRow
                label="Read receipts"
                sub="If turned off, you won't send or receive blue ticks"
                enabled={privacy.readReceipts}
                onChange={(e) => setPrivacy((p) => ({ ...p, readReceipts: e.target.checked }))}
              />
              <ToggleRow
                label="Online status"
                sub="Allow others to see when you're online"
                enabled={privacy.onlineStatus}
                onChange={(e) => setPrivacy((p) => ({ ...p, onlineStatus: e.target.checked }))}
              />
            </section>
          </div>
        </div>
      );

    case "notifications":
      return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <SectionHeader title="Notifications" />
          <div className="space-y-6">
            <section>
              <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-4">Alerts</h3>
              <ToggleRow label="Message notifications" enabled={notifs.messages} onChange={(e) => setNotifs((n) => ({ ...n, messages: e.target.checked }))} />
              <ToggleRow label="Group notifications" enabled={notifs.groups} onChange={(e) => setNotifs((n) => ({ ...n, groups: e.target.checked }))} />
              <ToggleRow label="Notification sounds" enabled={notifs.sounds} onChange={(e) => setNotifs((n) => ({ ...n, sounds: e.target.checked }))} />
              <ToggleRow label="Show message preview" sub="Show content in notifications" enabled={notifs.preview} onChange={(e) => setNotifs((n) => ({ ...n, preview: e.target.checked }))} />
            </section>
          </div>
        </div>
      );

    case "chats":
      return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <SectionHeader title="Chats" />
          <div className="space-y-8">
            <section>
              <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-4">Appearance</h3>
              <div className="mb-6">
                <p className="text-xs text-base-content/50 mb-4">Choose a color theme for your interface</p>
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
                  {THEMES.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={`group flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all ${theme === t ? "bg-base-300 ring-2 ring-primary" : "hover:bg-base-200"}`}
                    >
                      <div className="relative h-10 w-full rounded-md overflow-hidden" data-theme={t}>
                        <div className="absolute inset-0 grid grid-cols-4 gap-px p-1">
                          <div className="rounded bg-primary" />
                          <div className="rounded bg-secondary" />
                          <div className="rounded bg-accent" />
                          <div className="rounded bg-neutral" />
                        </div>
                      </div>
                      <span className="text-[10px] font-medium truncate w-full text-center text-base-content opacity-70">
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-4">Chat Background</h3>
              <p className="text-xs text-base-content/50 mb-4">Choose a subtle pattern to overlay on your chat background</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {['whatsapp', 'dots', 'grid', 'squares', 'cubes', 'diagonal', 'zigzag', 'circles', 'cross', 'lines', 'triangles'].map((pattern) => (
                  <div
                    key={pattern}
                    onClick={() => setChatPattern(pattern)}
                    className={`h-24 rounded-xl cursor-pointer border-2 transition-all relative overflow-hidden bg-base-200 ${chatPattern === pattern ? "border-primary" : "border-transparent hover:border-base-content/20"}`}
                  >
                    <div 
                      className="absolute inset-0 opacity-[0.2]" 
                      style={{ 
                        backgroundImage: pattern === 'whatsapp' 
                          ? `url("/patterns/whatsapp.png")` 
                          : `url('/patterns/${pattern}.svg')`, 
                        backgroundSize: pattern === 'whatsapp' ? '200px' : 'auto',
                        backgroundRepeat: 'repeat'
                      }} 
                    />
                    <div className="absolute inset-x-0 bottom-0 p-1.5 bg-base-300/80 backdrop-blur-sm flex justify-center">
                      <span className="text-[10px] font-medium text-base-content capitalize">{pattern}</span>
                    </div>
                  </div>
                ))}
                
                {/* Custom Image Upload */}
                <label
                  className={`h-24 rounded-xl cursor-pointer border-2 transition-all relative overflow-hidden bg-base-200 flex items-center justify-center ${chatPattern === 'custom' ? "border-primary" : "border-transparent hover:border-base-content/20"}`}
                >
                  <input type="file" accept="image/*" className="hidden" onChange={handleCustomBgUpload} />
                  {customBgImage ? (
                    <div className="absolute inset-0 opacity-50" style={{ backgroundImage: `url(${customBgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                  ) : (
                    <ImageIcon className="size-6 text-base-content/30" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 p-1.5 bg-base-300/80 backdrop-blur-sm flex justify-center z-10">
                    <span className="text-[10px] font-medium text-base-content capitalize">Custom</span>
                  </div>
                </label>
              </div>
            </section>

            <section>
              <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-4">Behavior</h3>
              <ToggleRow
                label="Enter is send"
                sub="Pressing Enter will send your message"
                enabled={chatSettings.enterIsSend}
                onChange={(e) => setChatSettings(s => ({ ...s, enterIsSend: e.target.checked }))}
              />
            </section>

            <section>
              <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-4">Preview</h3>
              <div className="rounded-2xl border border-base-300 overflow-hidden shadow-2xl bg-base-200">
                {/* Mock header */}
                <div className="px-4 py-3 bg-base-300 border-b border-base-300 flex items-center gap-3">
                  <div className="size-8 rounded-full bg-primary flex items-center justify-center text-primary-content text-sm font-bold shadow-sm">J</div>
                  <div>
                    <p className="text-sm font-semibold text-base-content">John Doe</p>
                    <p className="text-[10px] text-success font-medium">online</p>
                  </div>
                </div>
                {/* Mock messages */}
                <div className="p-6 space-y-4 bg-base-100 min-h-[160px] relative overflow-hidden">
                  {chatPattern === 'custom' && customBgImage && (
                    <div 
                      className="absolute inset-0 z-0 pointer-events-none opacity-[0.4] dark:opacity-[0.2]"
                      style={{ 
                        backgroundImage: `url(${customBgImage})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                      }}
                    />
                  )}
                  {chatPattern !== 'custom' && (
                    <div 
                      className={`absolute inset-0 z-0 pointer-events-none ${chatPattern === 'whatsapp' ? 'opacity-[0.15] dark:invert' : 'opacity-[0.08]'}`}
                      style={{ 
                        backgroundImage: chatPattern === 'whatsapp' 
                          ? `url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")` 
                          : `url('/patterns/${chatPattern}.svg')`,
                        backgroundSize: chatPattern === 'whatsapp' ? '400px' : 'auto',
                        backgroundRepeat: 'repeat',
                      }}
                    />
                  )}
                  {PREVIEW_MESSAGES.map((m) => (
                    <div key={m.id} className={`flex relative z-10 ${m.isSent ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm text-sm animate-in fade-in slide-in-from-${m.isSent ? 'right' : 'left'}-4 duration-500`}
                        style={{
                          background: m.isSent ? "var(--bubble-sent-bg)" : "var(--bubble-received-bg)",
                          color: m.isSent ? "var(--bubble-sent-text)" : "var(--bubble-received-text)",
                        }}
                      >
                        {m.content}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Mock input */}
                <div className="px-4 py-4 bg-base-300 border-t border-base-300 flex gap-3 items-center">
                  <div className="flex-1 bg-base-200 rounded-full px-5 py-2.5 text-xs text-base-content/30 border border-base-300">
                    Type a message
                  </div>
                  <div className="size-10 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                    <Send className="size-5 text-primary-content" />
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      );

    case "storage":
      return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <SectionHeader title="Storage & Data" />
          <div className="space-y-8">
            <section>
              <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-4">Usage Breakdown</h3>
              <div className="bg-base-200 rounded-2xl p-6 border border-base-300 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Database className="size-6 text-primary" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-base-content">Storage used</span>
                      <p className="text-[10px] text-base-content/50">35.2 MB of 100 MB</p>
                    </div>
                  </div>
                  <button className="text-xs font-semibold text-primary hover:underline">Manage</button>
                </div>
                <div className="w-full bg-base-300 rounded-full h-3 overflow-hidden flex">
                  <div className="bg-primary h-full" style={{ width: "20%" }} />
                  <div className="bg-secondary h-full" style={{ width: "10%" }} />
                  <div className="bg-accent h-full" style={{ width: "5%" }} />
                </div>
                <div className="flex gap-4 mt-4">
                  <div className="flex items-center gap-2 text-[10px] text-base-content/60">
                    <div className="size-2 rounded-full bg-primary" /> Media
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-base-content/60">
                    <div className="size-2 rounded-full bg-secondary" /> Documents
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-base-content/60">
                    <div className="size-2 rounded-full bg-accent" /> Other
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-4">Auto-Download</h3>
              <NavRow icon={Wifi} label="When connected on Wi-Fi" sub="All media" />
              <NavRow icon={Smartphone} label="When using mobile data" sub="Photos only" />
            </section>

            <section>
              <button className="w-full text-left py-4 px-4 text-sm text-error hover:bg-error/5 border border-error/20 rounded-xl transition-colors flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <HardDrive className="size-5" />
                  <div>
                    <p className="font-semibold">Clear cache</p>
                    <p className="text-xs opacity-60">Free up space by removing temporary files</p>
                  </div>
                </div>
                <span className="text-xs font-mono opacity-40 group-hover:opacity-100 transition-opacity">12.4 MB</span>
              </button>
            </section>
          </div>
        </div>
      );

    default:
      return null;
  }
};


// ── Main Settings Page ──────────────────────────────────────────────────────
const SettingsPage = () => {
  const { theme, setTheme, chatPattern, setChatPattern, customBgImage, setCustomBgImage } = useThemeStore();
  const [activeSection, setActiveSection] = useState("chats");
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { setActiveView } = useAppStore();
  const { deleteAccount } = useAuthStore();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleDeleteConfirm = async () => {
    await deleteAccount();
    setShowDeleteModal(false);
    navigate("/login");
  };

  const filteredSections = SECTIONS.filter((s) =>
    s.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const current = SECTIONS.find((s) => s.id === activeSection);

  return (
    // h-full ensures it fits within the parent flex-1 without overflowing due to TopBar
    <div className="h-full w-full flex overflow-hidden bg-base-100">

      {/* ── Left sidebar ──────────────────────────────────────────────────── */}
      <SidebarBase className="bg-base-200">
        <div className="px-4 py-3 border-b border-base-300 flex items-center gap-4">
          <button
            onClick={() => {
              setActiveView("chats");
              navigate("/chats");
            }}
            className="p-2 rounded-full hover:bg-base-300 transition-colors text-base-content/60 hover:text-base-content"
            title="Back to Chats"
          >
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="text-xl font-bold text-base-content">Settings</h1>
        </div>

        {/* Search settings */}
        <div className="px-3 pt-3 pb-2 flex-shrink-0">
          <div className="flex items-center gap-2 rounded-full px-4 py-2 bg-base-100 border border-base-300 focus-within:border-primary/40 transition-colors">
            <Search className="size-4 flex-shrink-0 text-base-content/40" />
            <input
              type="text"
              placeholder="Search settings"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-sm outline-none w-full text-base-content placeholder:text-base-content/40"
            />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {filteredSections.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 transition-colors text-left
                ${activeSection === id
                  ? "bg-base-300 border-r-2 border-primary"
                  : "hover:bg-base-300"}
              `}
            >
              <Icon className={`size-5 flex-shrink-0 ${activeSection === id ? "text-primary" : "text-base-content/60"}`} />
              <span className={`text-sm font-medium ${activeSection === id ? "text-primary" : "text-base-content"}`}>
                {label}
              </span>
            </button>
          ))}
          {filteredSections.length === 0 && (
            <div className="p-8 text-center text-sm text-base-content/40">
              No results found
            </div>
          )}
        </nav>
      </SidebarBase>



      {/* ── Content panel ─────────────────────────────────────────────────── */}
      <main className="flex-1 h-full overflow-y-auto custom-scrollbar">
        <div className="w-full min-h-full p-6 lg:p-8 pb-24">


          <SectionContent
            section={activeSection}
            theme={theme}
            setTheme={setTheme}
            chatPattern={chatPattern}
            setChatPattern={setChatPattern}
            customBgImage={customBgImage}
            setCustomBgImage={setCustomBgImage}
            onDeleteClick={() => setShowDeleteModal(true)}
          />

          {/* Footer */}
          <div className="mt-20 pt-8 border-t border-base-300 text-center">
            <p className="text-xs text-base-content/40 tracking-wide">
              © 2024 Ajay Sharma. All rights reserved.
            </p>
          </div>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="bg-base-100 rounded-3xl max-w-sm w-full shadow-2xl border border-base-300 overflow-hidden animate-in zoom-in-95 duration-200"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="size-12 rounded-2xl bg-error/10 flex items-center justify-center text-error">
                  <AlertTriangle className="size-6" />
                </div>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="p-2 rounded-full hover:bg-base-200 transition-colors"
                >
                  <CloseIcon className="size-5 text-base-content/40" />
                </button>
              </div>

              <h3 className="text-xl font-bold text-base-content mb-2">Delete Account?</h3>
              <p className="text-sm text-base-content/60 leading-relaxed mb-6">
                Your account will be <span className="font-semibold text-error">deactivated immediately</span>. You have <span className="font-semibold">15 days</span> to restore it by logging back in. After that, all your data will be permanently removed.
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleDeleteConfirm}
                  className="w-full py-4 px-6 bg-error hover:bg-error-focus text-error-content rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Trash2 className="size-4" />
                  Delete Permanently
                </button>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="w-full py-4 px-6 bg-base-200 hover:bg-base-300 text-base-content rounded-2xl font-bold transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>

            <div className="px-6 py-4 bg-base-200/50 border-t border-base-300">
              <p className="text-[10px] text-center text-base-content/40 uppercase tracking-widest font-semibold">
                This action is reversible within 15 days
              </p>
            </div>
          </div>
        </div>
      )}
    </div>

  );
};

export default SettingsPage;
