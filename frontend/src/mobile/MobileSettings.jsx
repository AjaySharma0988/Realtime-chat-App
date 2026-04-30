/**
 * MobileSettings — mobile wrapper that reuses 100% of the existing
 * SettingsPage sections (SectionContent / ToggleRow / NavRow) via a
 * WhatsApp-style two-level navigation:
 *
 *   [Settings list] ──tap section──► [Section detail]
 *
 * We extract the shared components directly from SettingsPage here
 * instead of importing them (they are not exported). Only the shell
 * and routing are new — every rendered control is identical to desktop.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, Search } from "lucide-react";
import {
  Settings, Shield, Lock, Bell, MessageSquare,
  HardDrive, Globe, Smartphone, Send,
  Palette, Wifi, Database, HelpCircle, Keyboard, Image as ImageIcon
} from "lucide-react";
import { Trash2, AlertTriangle, X as CloseIcon } from "lucide-react";
import { THEMES } from "../constants";
import { useThemeStore } from "../store/useThemeStore";
import { useAuthStore } from "../store/useAuthStore";
import { navigateMobile } from "./MobileLayout";

/* ─────────────────────────────────────────────────────────────────────────────
   Shared sub-components (identical to SettingsPage versions)
───────────────────────────────────────────────────────────────────────────── */
const PREVIEW_MESSAGES = [
  { id: 1, content: "Hey! How's it going? 👋", isSent: false },
  { id: 2, content: "Great! Just upgraded the chat UI 🎉", isSent: true },
];

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

/* ─────────────────────────────────────────────────────────────────────────────
   Section content — exact same as SettingsPage.SectionContent
───────────────────────────────────────────────────────────────────────────── */
const SectionContent = ({ section, theme, setTheme, chatPattern, setChatPattern, customBgImage, setCustomBgImage, onDeleteClick }) => {
  const [notifs, setNotifs] = useState({ messages: true, groups: true, sounds: true, preview: true });
  const [privacy, setPrivacy] = useState({ readReceipts: true, onlineStatus: true });
  const [chatSettings, setChatSettings] = useState({ enterIsSend: true, mediaAutoDownload: true });

  const SectionHeader = ({ title }) => (
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-base-content">{title}</h2>
      <div className="h-1 w-10 bg-primary rounded-full mt-2" />
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
              <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-4">Language &amp; Region</h3>
              <NavRow icon={Globe} label="App language" sub="English (default)" />
              <NavRow icon={Smartphone} label="Desktop notifications" sub="All messages" />
            </section>
            <section>
              <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-4">Productivity</h3>
              <NavRow icon={Keyboard} label="Keyboard shortcuts" sub="View all shortcuts" />
              <div className="bg-base-200 rounded-xl p-4 mt-4 border border-base-300">
                <div className="grid grid-cols-2 gap-4">
                  {[["Search chats","Ctrl+F"],["New chat","Ctrl+N"],["Settings","Ctrl+,"],["Profile","Ctrl+P"]].map(([lbl, key]) => (
                    <div key={lbl} className="flex justify-between items-center text-sm">
                      <span className="text-base-content/60">{lbl}</span>
                      <kbd className="kbd kbd-xs">{key}</kbd>
                    </div>
                  ))}
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
              <ToggleRow label="Read receipts" sub="If turned off, you won't send or receive blue ticks" enabled={privacy.readReceipts} onChange={(e) => setPrivacy(p => ({ ...p, readReceipts: e.target.checked }))} />
              <ToggleRow label="Online status" sub="Allow others to see when you're online" enabled={privacy.onlineStatus} onChange={(e) => setPrivacy(p => ({ ...p, onlineStatus: e.target.checked }))} />
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
              <ToggleRow label="Message notifications" enabled={notifs.messages} onChange={(e) => setNotifs(n => ({ ...n, messages: e.target.checked }))} />
              <ToggleRow label="Group notifications" enabled={notifs.groups} onChange={(e) => setNotifs(n => ({ ...n, groups: e.target.checked }))} />
              <ToggleRow label="Notification sounds" enabled={notifs.sounds} onChange={(e) => setNotifs(n => ({ ...n, sounds: e.target.checked }))} />
              <ToggleRow label="Show message preview" sub="Show content in notifications" enabled={notifs.preview} onChange={(e) => setNotifs(n => ({ ...n, preview: e.target.checked }))} />
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
              <p className="text-xs text-base-content/50 mb-4">Choose a color theme for your interface</p>
              <div className="grid grid-cols-3 gap-3">
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
            </section>
            
            <section>
              <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-4">Chat Background</h3>
              <p className="text-xs text-base-content/50 mb-4">Choose a subtle pattern to overlay on your chat background</p>
              <div className="grid grid-cols-3 gap-3">
                {['whatsapp', 'dots', 'grid', 'squares', 'cubes', 'diagonal', 'zigzag', 'circles', 'cross', 'lines', 'triangles'].map((pattern) => (
                  <div
                    key={pattern}
                    onClick={() => setChatPattern(pattern)}
                    className={`h-20 rounded-xl cursor-pointer border-2 transition-all relative overflow-hidden bg-base-200 ${chatPattern === pattern ? "border-primary" : "border-transparent hover:border-base-content/20"}`}
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
                    <div className="absolute inset-x-0 bottom-0 p-1 bg-base-300/80 backdrop-blur-sm flex justify-center">
                      <span className="text-[10px] font-medium text-base-content capitalize">{pattern}</span>
                    </div>
                  </div>
                ))}
                
                {/* Custom Image Upload */}
                <label
                  className={`h-20 rounded-xl cursor-pointer border-2 transition-all relative overflow-hidden bg-base-200 flex items-center justify-center ${chatPattern === 'custom' ? "border-primary" : "border-transparent hover:border-base-content/20"}`}
                >
                  <input type="file" accept="image/*" className="hidden" onChange={handleCustomBgUpload} />
                  {customBgImage ? (
                    <div className="absolute inset-0 opacity-50" style={{ backgroundImage: `url(${customBgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                  ) : (
                    <ImageIcon className="size-6 text-base-content/30" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 p-1 bg-base-300/80 backdrop-blur-sm flex justify-center z-10">
                    <span className="text-[10px] font-medium text-base-content capitalize">Custom</span>
                  </div>
                </label>
              </div>
            </section>
            <section>
              <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-4">Behavior</h3>
              <ToggleRow label="Enter is send" sub="Pressing Enter will send your message" enabled={chatSettings.enterIsSend} onChange={(e) => setChatSettings(s => ({ ...s, enterIsSend: e.target.checked }))} />
            </section>
            <section>
              <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-4">Preview</h3>
              <div className="rounded-2xl border border-base-300 overflow-hidden shadow-lg bg-base-200">
                <div className="px-4 py-3 bg-base-300 border-b border-base-300 flex items-center gap-3">
                  <div className="size-8 rounded-full bg-primary flex items-center justify-center text-primary-content text-sm font-bold">J</div>
                  <div>
                    <p className="text-sm font-semibold text-base-content">John Doe</p>
                    <p className="text-[10px] text-success font-medium">online</p>
                  </div>
                </div>
                <div className="p-4 space-y-3 bg-base-100 min-h-[120px] relative overflow-hidden">
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
                        className="max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm"
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
                <div className="px-4 py-3 bg-base-300 border-t border-base-300 flex gap-3 items-center">
                  <div className="flex-1 bg-base-200 rounded-full px-4 py-2 text-xs text-base-content/30 border border-base-300">
                    Type a message
                  </div>
                  <div className="size-9 rounded-full bg-primary flex items-center justify-center">
                    <Send className="size-4 text-primary-content" />
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
          <SectionHeader title="Storage &amp; Data" />
          <div className="space-y-8">
            <section>
              <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-4">Usage Breakdown</h3>
              <div className="bg-base-200 rounded-2xl p-5 border border-base-300 shadow-sm">
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
                <div className="flex gap-4 mt-3">
                  {[["bg-primary","Media"],["bg-secondary","Documents"],["bg-accent","Other"]].map(([cls, lbl]) => (
                    <div key={lbl} className="flex items-center gap-2 text-[10px] text-base-content/60">
                      <div className={`size-2 rounded-full ${cls}`} /> {lbl}
                    </div>
                  ))}
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

/* ─────────────────────────────────────────────────────────────────────────────
   Mobile Settings sections list
───────────────────────────────────────────────────────────────────────────── */
const SECTIONS = [
  { id: "general",       icon: Settings,    label: "General" },
  { id: "account",       icon: Shield,      label: "Account" },
  { id: "privacy",       icon: Lock,        label: "Privacy" },
  { id: "notifications", icon: Bell,        label: "Notifications" },
  { id: "chats",         icon: MessageSquare, label: "Chats" },
  { id: "storage",       icon: HardDrive,   label: "Storage &amp; data" },
];

/* ─────────────────────────────────────────────────────────────────────────────
   Main mobile settings component
───────────────────────────────────────────────────────────────────────────── */
const MobileSettings = ({ onBack }) => {
  const { theme, setTheme, chatPattern, setChatPattern, customBgImage, setCustomBgImage } = useThemeStore();
  const { deleteAccount, authUser } = useAuthStore();
  const navigate = useNavigate();

  const [activeSection, setActiveSection] = useState(null); // null = show list
  const [searchQuery, setSearchQuery] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleDeleteConfirm = async () => {
    await deleteAccount();
    setShowDeleteModal(false);
    navigate("/login");
  };

  const filteredSections = SECTIONS.filter((s) =>
    s.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  /* ── Section detail view ────────────────────────────────────────────────── */
  if (activeSection) {
    const section = SECTIONS.find((s) => s.id === activeSection);
    return (
      <div className="w-full h-full flex flex-col bg-base-100">
        {/* Detail header */}
        <div className="h-16 bg-base-300 flex items-center px-2 gap-1 border-b border-base-content/10 flex-shrink-0">
          <button
            onClick={() => setActiveSection(null)}
            className="p-2 hover:bg-base-content/10 rounded-full text-base-content"
          >
            <ArrowLeft className="size-6" />
          </button>
          <h1 className="text-lg font-bold text-base-content flex-1 px-2">
            {section?.label?.replace("&amp;", "&")}
          </h1>
        </div>

        {/* Section content — IDENTICAL to desktop */}
        <div className="flex-1 overflow-y-auto px-4 py-5 pb-10">
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
        </div>

        {/* Delete modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-base-100 rounded-3xl max-w-sm w-full shadow-2xl border border-base-300 overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="size-12 rounded-2xl bg-error/10 flex items-center justify-center text-error">
                    <AlertTriangle className="size-6" />
                  </div>
                  <button onClick={() => setShowDeleteModal(false)} className="p-2 rounded-full hover:bg-base-200 transition-colors">
                    <CloseIcon className="size-5 text-base-content/40" />
                  </button>
                </div>
                <h3 className="text-xl font-bold text-base-content mb-2">Delete Account?</h3>
                <p className="text-sm text-base-content/60 leading-relaxed mb-6">
                  Your account will be <span className="font-semibold text-error">deactivated immediately</span>. You have <span className="font-semibold">15 days</span> to restore it. After that, all data will be permanently removed.
                </p>
                <div className="flex flex-col gap-3">
                  <button onClick={handleDeleteConfirm} className="w-full py-4 px-6 bg-error text-error-content rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2">
                    <Trash2 className="size-4" /> Delete Permanently
                  </button>
                  <button onClick={() => setShowDeleteModal(false)} className="w-full py-4 px-6 bg-base-200 text-base-content rounded-2xl font-bold transition-all">
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
  }

  /* ── Settings list (top-level) ──────────────────────────────────────────── */
  return (
    <div className="w-full h-full flex flex-col bg-base-100">
      {/* Header */}
      <div className="h-16 bg-base-300 flex items-center px-2 gap-1 border-b border-base-content/10 flex-shrink-0">
        <button onClick={onBack} className="p-2 hover:bg-base-content/10 rounded-full text-base-content">
          <ArrowLeft className="size-6" />
        </button>
        <h1 className="text-lg font-bold text-base-content flex-1 px-2">Settings</h1>
        <button className="p-2 hover:bg-base-content/10 rounded-full text-base-content/70">
          <Search className="size-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        {/* Profile card */}
        <button 
          onClick={() => navigateMobile.fn?.("myProfile")}
          className="w-full flex items-center gap-4 px-4 py-5 border-b border-base-content/10 text-left hover:bg-base-200 active:bg-base-300 transition-colors"
        >
          <img
            src={authUser?.profilePic || "/avatar.png"}
            alt={authUser?.fullName}
            className="size-16 rounded-full object-cover"
          />
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-base-content text-base truncate">{authUser?.fullName}</h2>
            <p className="text-sm text-base-content/60 truncate mt-0.5">
              {authUser?.bio || "Hey there! I am using Chatty."}
            </p>
          </div>
          <ChevronRight className="size-5 text-base-content/30 flex-shrink-0" />
        </button>

        {/* Search box */}
        <div className="px-4 py-3 border-b border-base-content/10">
          <div className="flex items-center gap-2 rounded-full px-4 py-2.5 bg-base-300 border border-base-content/10 focus-within:border-primary/40 transition-colors">
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

        {/* Section list */}
        <div className="py-1">
          {filteredSections.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className="w-full flex items-center gap-4 px-4 py-4 hover:bg-base-content/5 active:bg-base-content/10 transition-colors border-b border-base-content/5"
            >
              <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="size-5 text-primary" />
              </div>
              <span className="flex-1 text-sm font-medium text-base-content text-left">
                {label.replace("&amp;", "&")}
              </span>
              <ChevronRight className="size-4 text-base-content/30" />
            </button>
          ))}

          {filteredSections.length === 0 && (
            <div className="p-10 text-center text-sm text-base-content/40">No results found</div>
          )}
        </div>

        <p className="text-center text-xs text-base-content/30 mt-6">Chatty v1.0.0</p>
      </div>
    </div>
  );
};

export default MobileSettings;
