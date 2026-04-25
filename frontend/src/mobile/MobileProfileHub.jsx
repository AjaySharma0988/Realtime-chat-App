import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import {
  ArrowLeft, User, Lock, Bell, Smartphone, Shield,
  ChevronRight, Camera, Edit3, Check, X, Mail, Calendar,
  MessageCircle, Phone, Star, Clock, Trash2, AlertTriangle, X as CloseIcon,
} from "lucide-react";
import ImageCropModal from "../components/ImageCropModal";
import { useNavigate } from "react-router-dom";
import { navigateMobile } from "./MobileLayout";

/* ── Sidebar tabs ── */
const TABS = [
  { id: "profile",       icon: User,         label: "My Profile"   },
  { id: "privacy",       icon: Lock,         label: "Privacy"      },
  { id: "notifications", icon: Bell,         label: "Notifications"},
  { id: "devices",       icon: Smartphone,   label: "Devices"      },
  { id: "security",      icon: Shield,       label: "Security"     },
];

/* ── Small reusable row ── */
const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-4 py-4 border-b border-base-300 last:border-0">
    <Icon className="size-5 text-primary mt-0.5 flex-shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="text-xs text-base-content/50 mb-0.5">{label}</p>
      <p className="text-sm text-base-content break-all">{value}</p>
    </div>
  </div>
);

const NavRow = ({ icon: Icon, label, sub, onClick }) => (
  <button onClick={onClick} className="w-full flex items-center gap-4 py-3.5 border-b border-base-300 last:border-0 hover:bg-base-200 -mx-4 px-4 transition-colors">
    {Icon && <Icon className="size-5 text-primary flex-shrink-0" />}
    <div className="flex-1 text-left">
      <p className="text-sm text-base-content">{label}</p>
      {sub && <p className="text-xs text-base-content/50 mt-0.5">{sub}</p>}
    </div>
    <ChevronRight className="size-4 text-base-content/30" />
  </button>
);

const ToggleRow = ({ label, sub, enabled, onChange }) => (
  <div className="flex items-center justify-between py-3.5 border-b border-base-300 last:border-0">
    <div>
      <p className="text-sm text-base-content">{label}</p>
      {sub && <p className="text-xs text-base-content/50 mt-0.5">{sub}</p>}
    </div>
    <input type="checkbox" className="toggle toggle-primary toggle-sm" checked={enabled} onChange={onChange} />
  </div>
);

const SectionTitle = ({ title }) => (
  <div className="mb-6">
    <h2 className="text-2xl font-bold text-base-content">{title}</h2>
    <div className="h-1 w-10 bg-primary rounded-full mt-2" />
  </div>
);

const StatBadge = ({ icon: Icon, label, value }) => (
  <div className="flex flex-col items-center gap-1 px-4 py-3 rounded-2xl bg-base-200 border border-base-300 flex-1">
    <Icon className="size-5 text-primary mb-1" />
    <span className="text-sm font-bold text-base-content">{value}</span>
    <span className="text-[10px] text-base-content/50 uppercase tracking-wide">{label}</span>
  </div>
);

/* ─────────────────────────────────────────────────────────────────────────────
   Panel Content for each section
───────────────────────────────────────────────────────────────────────────── */
const ProfilePanelContent = ({
  tab, authUser, selectedImg, editingName, nameValue,
  setNameValue, setEditingName, handleSaveName,
  isUpdatingProfile, isCropLoading, handleFileSelect,
  onDeleteClick,
}) => {
  const [privacy, setPrivacy] = useState({ readReceipts: true, onlineStatus: true, profilePhoto: true });
  const [notifs, setNotifs]   = useState({ messages: true, groups: true, sounds: true, preview: true });

  const avatarSrc = selectedImg || authUser?.profilePic || "/avatar.png";
  const joinDate  = authUser?.createdAt?.split("T")[0] || "—";

  switch (tab) {
    case "profile": return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
        {/* Hero banner */}
        <div className="relative rounded-3xl overflow-hidden border border-base-300 shadow-sm">
          <div
            className="h-32"
            style={{ background: "linear-gradient(135deg, oklch(var(--p)) 0%, oklch(var(--s)) 100%)" }}
          />
          <div className="absolute left-6 top-[64px]">
            <div className="relative group">
              <img
                src={avatarSrc}
                alt="Profile"
                className="size-20 rounded-full object-cover ring-4 ring-base-100 shadow-md"
              />
              <label
                htmlFor="avatar-upload"
                className={`absolute inset-0 rounded-full flex items-center justify-center
                  bg-black/40 cursor-pointer transition-opacity
                  ${(isUpdatingProfile || isCropLoading) ? "opacity-100 cursor-not-allowed" : ""}`}
              >
                {(isUpdatingProfile || isCropLoading)
                  ? <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Camera className="size-5 text-white" />}
                <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleFileSelect} disabled={isUpdatingProfile || isCropLoading} />
              </label>
            </div>
          </div>
          <div className="pt-14 pb-5 px-6 bg-base-100">
            {editingName ? (
              <div className="flex items-center gap-2 mb-1">
                <input
                  type="text"
                  className="input input-sm bg-base-200 border-primary text-base-content font-semibold flex-1"
                  value={nameValue}
                  onChange={e => setNameValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter")  handleSaveName();
                    if (e.key === "Escape") { setEditingName(false); setNameValue(authUser?.fullName || ""); }
                  }}
                  autoFocus
                />
                <button onClick={handleSaveName} className="p-1.5 bg-success/10 rounded-full hover:bg-success/20 text-success"><Check className="size-4" /></button>
                <button onClick={() => { setEditingName(false); setNameValue(authUser?.fullName || ""); }} className="p-1.5 bg-base-200 rounded-full hover:bg-base-300 text-base-content/60"><X className="size-4" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold text-base-content truncate">{authUser?.fullName}</h2>
                <button onClick={() => setEditingName(true)} className="p-1 rounded-full hover:bg-base-200 transition-colors">
                  <Edit3 className="size-4 text-base-content/50" />
                </button>
              </div>
            )}
            <p className="text-sm text-base-content/50 truncate">{authUser?.email}</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-2">
          <StatBadge icon={MessageCircle} label="Messages"  value="—"   />
          <StatBadge icon={Phone}         label="Calls"     value="—"   />
          <StatBadge icon={Star}          label="Starred"   value="—"   />
          <StatBadge icon={Clock}         label="Joined"    value={joinDate} />
        </div>

        {/* Account info card */}
        <div className="bg-base-200/50 rounded-3xl p-5 border border-base-300 shadow-sm">
          <h3 className="text-[10px] font-bold text-base-content/50 uppercase tracking-widest mb-2">Account info</h3>
          <InfoRow icon={User}     label="Full name"    value={authUser?.fullName} />
          <InfoRow icon={Mail}     label="Email"        value={authUser?.email}    />
          <InfoRow icon={Calendar} label="Member since" value={joinDate}           />
        </div>
      </div>
    );

    case "privacy": return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8">
        <SectionTitle title="Privacy" />
        <section>
          <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-4">Who can see my info</h3>
          <NavRow label="Last seen &amp; online" sub="Everyone" />
          <NavRow label="Profile photo"          sub="Everyone" />
          <NavRow label="About"                  sub="Everyone" />
          <NavRow label="Status"                 sub="My contacts" />
        </section>
        <section>
          <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-4">Messaging</h3>
          <ToggleRow label="Read receipts"  sub="Send/receive blue ticks"          enabled={privacy.readReceipts}  onChange={e => setPrivacy(p => ({ ...p, readReceipts: e.target.checked }))} />
          <ToggleRow label="Online status"  sub="Let others see when you're online" enabled={privacy.onlineStatus}  onChange={e => setPrivacy(p => ({ ...p, onlineStatus: e.target.checked }))} />
          <ToggleRow label="Profile photo"  sub="Show profile photo to contacts"   enabled={privacy.profilePhoto}  onChange={e => setPrivacy(p => ({ ...p, profilePhoto: e.target.checked }))} />
        </section>
      </div>
    );

    case "notifications": return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8">
        <SectionTitle title="Notifications" />
        <section>
          <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-4">Alerts</h3>
          <ToggleRow label="Message notifications" enabled={notifs.messages} onChange={e => setNotifs(n => ({ ...n, messages: e.target.checked }))} />
          <ToggleRow label="Group notifications"   enabled={notifs.groups}   onChange={e => setNotifs(n => ({ ...n, groups:   e.target.checked }))} />
          <ToggleRow label="Notification sounds"   enabled={notifs.sounds}   onChange={e => setNotifs(n => ({ ...n, sounds:   e.target.checked }))} />
          <ToggleRow label="Show message preview" sub="Show content in notifications" enabled={notifs.preview} onChange={e => setNotifs(n => ({ ...n, preview: e.target.checked }))} />
        </section>
      </div>
    );

    case "devices": return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8">
        <SectionTitle title="Devices" />
        <div className="bg-base-200 rounded-2xl border border-base-300 overflow-hidden">
          {[
            { name: "This device", detail: "Web Browser · Active now", active: true },
            { name: "Chrome — Windows", detail: "Last active 2 hrs ago", active: false },
          ].map((d, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-base-300 last:border-0">
              <div className={`size-10 rounded-xl flex items-center justify-center ${d.active ? "bg-success/10" : "bg-base-300"}`}>
                <Smartphone className={`size-5 ${d.active ? "text-success" : "text-base-content/40"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-base-content truncate">{d.name}</p>
                <p className="text-xs text-base-content/50 truncate">{d.detail}</p>
              </div>
              {d.active
                ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-success/10 text-success">Current</span>
                : <button className="text-xs text-error hover:underline">Remove</button>
              }
            </div>
          ))}
        </div>
        <NavRow 
          icon={Smartphone} 
          label="Link a device" 
          sub="Connect additional devices" 
          onClick={() => navigateMobile.fn?.("linkedDevices")}
        />
      </div>
    );

    case "security": return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8">
        <SectionTitle title="Security" />
        <section>
          <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-4">Authentication</h3>
          <NavRow icon={Lock}   label="Two-step verification"  sub="Add an extra layer of security" />
          <NavRow icon={Shield} label="Change password"        sub="Update your login credentials"  />
          <NavRow icon={Mail}   label="Change email"           sub="Update your registered email"   />
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
    );

    default: return null;
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   Main Mobile Profile Hub
───────────────────────────────────────────────────────────────────────────── */
const MobileProfileHub = ({ onBack }) => {
  const { authUser, isUpdatingProfile, updateProfile, deleteAccount } = useAuthStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(null); // null = show nav list
  const [selectedImg, setSelectedImg] = useState(null);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(authUser?.fullName || "");
  const [isCropLoading, setIsCropLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleDeleteConfirm = async () => {
    await deleteAccount();
    setShowDeleteModal(false);
    navigate("/login");
  };

  const handleFileSelect = e => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setCropImageSrc(reader.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCropSave = async croppedBase64 => {
    setIsCropLoading(true);
    try {
      await updateProfile({ profilePic: croppedBase64 });
      setSelectedImg(croppedBase64);
      setCropImageSrc(null);
    } catch { /* handled in store */ } finally { setIsCropLoading(false); }
  };

  const handleSaveName = async () => {
    setEditingName(false);
    if (nameValue !== authUser?.fullName) {
      await updateProfile({ fullName: nameValue });
    }
  };

  /* ── Detail view ── */
  if (activeTab) {
    const tabObj = TABS.find((t) => t.id === activeTab);
    return (
      <div className="w-full h-full flex flex-col bg-base-100">
        <div className="h-16 bg-base-300 flex items-center px-2 gap-1 border-b border-base-content/10 flex-shrink-0">
          <button onClick={() => setActiveTab(null)} className="p-2 hover:bg-base-content/10 rounded-full text-base-content">
            <ArrowLeft className="size-6" />
          </button>
          <h1 className="text-lg font-bold text-base-content flex-1 px-2">{tabObj?.label}</h1>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 pb-[80px]">
          <ProfilePanelContent
            tab={activeTab}
            authUser={authUser}
            selectedImg={selectedImg}
            editingName={editingName}
            nameValue={nameValue}
            setNameValue={setNameValue}
            setEditingName={setEditingName}
            handleSaveName={handleSaveName}
            isUpdatingProfile={isUpdatingProfile}
            isCropLoading={isCropLoading}
            handleFileSelect={handleFileSelect}
            onDeleteClick={() => setShowDeleteModal(true)}
          />
        </div>

        {/* Modals */}
        {cropImageSrc && (
          <ImageCropModal
            imageSrc={cropImageSrc}
            onSave={handleCropSave}
            onCancel={() => setCropImageSrc(null)}
            isLoading={isCropLoading}
          />
        )}

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
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Main Nav List ── */
  return (
    <div className="w-full h-full flex flex-col bg-base-100">
      <div className="h-16 bg-base-300 flex items-center px-2 gap-1 border-b border-base-content/10 flex-shrink-0">
        <button onClick={onBack} className="p-2 hover:bg-base-content/10 rounded-full text-base-content transition-colors">
          <ArrowLeft className="size-6" />
        </button>
        <h1 className="text-lg font-bold text-base-content flex-1 px-2">Profile Hub</h1>
      </div>

      <div className="flex-1 overflow-y-auto pb-[80px]">
        {/* Profile header snippet */}
        <div className="px-4 py-6 border-b border-base-content/10 flex items-center gap-4 bg-base-200/30">
          <img
            src={selectedImg || authUser?.profilePic || "/avatar.png"}
            alt="avatar"
            className="size-16 rounded-full object-cover ring-2 ring-primary/30"
          />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-base-content truncate">{authUser?.fullName}</p>
            <p className="text-sm text-base-content/50 truncate">{authUser?.email}</p>
          </div>
        </div>

        {/* Tab list */}
        <div className="py-2">
          {TABS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="w-full flex items-center gap-4 px-5 py-4 hover:bg-base-content/5 active:bg-base-content/10 transition-colors border-b border-base-content/5"
            >
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="size-5 text-primary" />
              </div>
              <span className="flex-1 text-base font-medium text-base-content text-left">
                {label}
              </span>
              <ChevronRight className="size-5 text-base-content/30" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MobileProfileHub;
