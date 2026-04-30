import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useAppStore } from "../store/useAppStore";
import {
  Camera, Mail, User, Calendar, CheckCircle, Edit3,
  X, Check, LogOut, ArrowLeft, Shield, Bell, Smartphone,
  Lock, ChevronRight, Trash2, AlertTriangle, X as CloseIcon,
  Star, MessageCircle, Phone, Clock, Search,
} from "lucide-react";
import ImageCropModal from "../components/ImageCropModal";
import SidebarBase from "../components/SidebarBase";
import { useNavigate } from "react-router-dom";
import NotificationSettings from "../components/NotificationSettings";
import PrivacySettings from "../components/PrivacySettings";
import DeviceManagement from "../components/DeviceManagement";

/* ── Sidebar tabs ── */
const TABS = [
  { id: "profile", icon: User, label: "My Profile" },
  { id: "privacy", icon: Lock, label: "Privacy" },
  { id: "notifications", icon: Bell, label: "Notifications" },
  { id: "devices", icon: Smartphone, label: "Devices" },
  { id: "security", icon: Shield, label: "Security" },
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
  <div className="mb-8">
    <h2 className="text-3xl font-bold text-base-content">{title}</h2>
    <div className="h-1 w-12 bg-primary rounded-full mt-2" />
  </div>
);

/* ── Stat badge ── */
const StatBadge = ({ icon: Icon, label, value }) => (
  <div className="flex flex-col items-center gap-1 px-6 py-4 rounded-2xl bg-base-200 border border-base-300 flex-1">
    <Icon className="size-5 text-primary mb-1" />
    <span className="text-lg font-bold text-base-content">{value}</span>
    <span className="text-[10px] text-base-content/50 uppercase tracking-wide">{label}</span>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   PANEL CONTENT
══════════════════════════════════════════════════════════════════════════ */
const PanelContent = ({
  tab, authUser, selectedImg, editingName, nameValue,
  setNameValue, setEditingName, handleSaveName,
  editingAbout, aboutValue, setAboutValue, setEditingAbout, handleSaveAbout,
  isUpdatingProfile, isCropLoading, handleFileSelect, onDeleteClick
}) => {
  const avatarSrc = selectedImg || authUser?.profilePic || "/avatar.png";
  const joinDate = authUser?.createdAt?.split("T")[0] || "—";

  switch (tab) {

    /* ── PROFILE ── */
    case "profile": return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">

        {/* Hero banner */}
        <div className="relative rounded-3xl overflow-hidden border border-base-300 shadow-xl">
          {/* cover */}
          <div
            className="h-36"
            style={{ background: "linear-gradient(135deg, oklch(var(--p)) 0%, oklch(var(--s)) 100%)" }}
          />
          {/* avatar */}
          <div className="absolute left-8 top-[72px]">
            <div className="relative group">
              <img
                src={avatarSrc}
                alt="Profile"
                className="size-24 rounded-full object-cover ring-4 ring-base-100 shadow-2xl"
              />
              <label
                htmlFor="avatar-upload"
                className={`absolute inset-0 rounded-full flex items-center justify-center
                  bg-black/50 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity
                  ${(isUpdatingProfile || isCropLoading) ? "opacity-100 cursor-not-allowed" : ""}`}
              >
                {(isUpdatingProfile || isCropLoading)
                  ? <div className="size-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Camera className="size-6 text-white" />}
                <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleFileSelect} disabled={isUpdatingProfile || isCropLoading} />
              </label>
            </div>
          </div>
          {/* name block */}
          <div className="pt-16 pb-6 px-8 bg-base-100">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="input input-sm bg-base-200 border-primary text-base-content font-semibold"
                  value={nameValue}
                  onChange={e => setNameValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") handleSaveName();
                    if (e.key === "Escape") { setEditingName(false); setNameValue(authUser?.fullName || ""); }
                  }}
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  disabled={isUpdatingProfile}
                  className="p-1 rounded-full hover:bg-base-200 text-success"
                >
                  {isUpdatingProfile ? <div className="size-3 border-2 border-success border-t-transparent rounded-full animate-spin" /> : <Check className="size-4" />}
                </button>
                <button onClick={() => { setEditingName(false); setNameValue(authUser?.fullName || ""); }} className="p-1 rounded-full hover:bg-base-200 text-base-content/60"><X className="size-4" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-base-content">{authUser?.fullName}</h2>
                <button onClick={() => setEditingName(true)} className="p-1 rounded-full hover:bg-base-200 transition-colors">
                  <Edit3 className="size-4 text-base-content/40" />
                </button>
              </div>
            )}
            <p className="text-sm text-base-content/50 mt-0.5">{authUser?.email}</p>
          </div>
        </div>

        {/* About / Bio section */}
        <div className="bg-base-100 rounded-2xl p-6 border border-base-300 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">About</h3>
            {!editingAbout && (
              <button onClick={() => setEditingAbout(true)} className="p-1.5 rounded-full hover:bg-base-200 transition-colors">
                <Edit3 className="size-4 text-base-content/40" />
              </button>
            )}
          </div>

          {editingAbout ? (
            <div className="space-y-3">
              <textarea
                className="textarea textarea-bordered w-full bg-base-200 text-sm resize-none h-24 focus:border-primary"
                value={aboutValue}
                onChange={e => setAboutValue(e.target.value)}
                placeholder="Tell us about yourself..."
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setEditingAbout(false); setAboutValue(authUser?.about || ""); }}
                  className="btn btn-ghost btn-sm text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAbout}
                  disabled={isUpdatingProfile}
                  className="btn btn-primary btn-sm text-xs gap-2"
                >
                  {isUpdatingProfile && <div className="size-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-base-content leading-relaxed">
              {authUser?.about || "Hey there! I am using Chatty."}
            </p>
          )}
        </div>

        {/* Stats row */}
        <div className="flex gap-3">
          <StatBadge icon={MessageCircle} label="Messages" value="—" />
          <StatBadge icon={Phone} label="Calls" value="—" />
          <StatBadge icon={Star} label="Starred" value="—" />
          <StatBadge icon={Clock} label="Joined" value={joinDate} />
        </div>

        {/* Account info card */}
        <div className="bg-base-100 rounded-2xl px-6 pb-2 pt-4 border border-base-300 shadow-sm">
          <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-1">Account info</h3>
          <InfoRow icon={User} label="Full name" value={authUser?.fullName} />
          <InfoRow icon={Mail} label="Email" value={authUser?.email} />
          <InfoRow icon={Calendar} label="Member since" value={joinDate} />
        </div>

        {/* Status */}
        <div className="bg-base-100 rounded-2xl p-5 border border-base-300 flex items-center gap-4 shadow-sm">
          <div className="size-11 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
            <CheckCircle className="size-6 text-success" />
          </div>
          <div>
            <p className="text-sm font-semibold text-base-content">Active &amp; in good standing</p>
            <p className="text-xs text-base-content/50">No violations · Verified account</p>
          </div>
          <span className="ml-auto px-3 py-1 rounded-full bg-success/10 text-success text-[11px] font-semibold">Active</span>
        </div>

        {/* Sign out */}
        <button
          onClick={() => { }} /* logout called from sidebar */
          className="w-full hidden"
        />
      </div>
    );

    /* ── PRIVACY ── */
    case "privacy": return <PrivacySettings />;

    /* ── NOTIFICATIONS ── */
    case "notifications": return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8">
        <SectionTitle title="Notifications" />
        <NotificationSettings />
      </div>
    );

    /* ── DEVICES ── */
    case "devices": return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8">
        <SectionTitle title="Devices" />
        <DeviceManagement />
      </div>
    );

    /* ── SECURITY ── */
    case "security": return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8">
        <SectionTitle title="Security" />
        <section>
          <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-4">Authentication</h3>
          <NavRow icon={Lock} label="Two-step verification" sub="Add an extra layer of security" />
          <NavRow icon={Shield} label="Change password" sub="Update your login credentials" />
          <NavRow icon={Mail} label="Change email" sub="Update your registered email" />
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

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════ */
const ProfilePage = () => {
  const { authUser, isUpdatingProfile, updateProfile, updatePrivacy, logout } = useAuthStore();
  const { setActiveView } = useAppStore();
  const navigate = useNavigate();

  const [selectedImg, setSelectedImg] = useState(null);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(authUser?.fullName || "");
  const [editingAbout, setEditingAbout] = useState(false);
  const [aboutValue, setAboutValue] = useState(authUser?.about || "");
  const [isCropLoading, setIsCropLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const filteredTabs = TABS.filter((t) =>
    t.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
    if (!nameValue.trim() || nameValue === authUser.fullName) {
      setEditingName(false);
      return;
    }
    try {
      await updateProfile({ fullName: nameValue });
      setEditingName(false);
    } catch { /* handled in store */ }
  };

  const handleSaveAbout = async () => {
    if (aboutValue === authUser.about) {
      setEditingAbout(false);
      return;
    }
    try {
      await updateProfile({ about: aboutValue });
      setEditingAbout(false);
    } catch { /* handled in store */ }
  };

  return (
    <div className="h-full w-full flex overflow-hidden bg-base-100">

      {/* ── LEFT SIDEBAR ── */}
      <SidebarBase className="bg-base-200">

        {/* Header */}
        <div className="px-4 py-3 border-b border-base-300 flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => { setActiveView("chats"); navigate("/chats"); }}
            className="p-2 rounded-full hover:bg-base-300 transition-colors text-base-content/60 hover:text-base-content"
            title="Back to Chats"
          >
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="text-xl font-bold text-base-content">Profile</h1>
        </div>

        {/* Search profiles/tabs */}
        <div className="px-3 pt-3 pb-2 flex-shrink-0">
          <div className="flex items-center gap-2 rounded-full px-4 py-2 bg-base-100 border border-base-300 focus-within:border-primary/40 transition-colors">
            <Search className="size-4 flex-shrink-0 text-base-content/40" />
            <input
              type="text"
              placeholder="Search sections"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-sm outline-none w-full text-base-content placeholder:text-base-content/40"
            />
          </div>
        </div>

        {/* Mini avatar card */}
        <div className="px-4 py-4 border-b border-base-300 flex items-center gap-3 flex-shrink-0">
          <img
            src={selectedImg || authUser?.profilePic || "/avatar.png"}
            alt="avatar"
            className="size-10 rounded-full object-cover ring-2 ring-primary/30"
          />
          <div className="min-w-0">
            <p className="text-xs font-bold text-base-content truncate">{authUser?.fullName}</p>
            <p className="text-[10px] text-base-content/50 truncate">{authUser?.email}</p>
          </div>
        </div>

        {/* Nav tabs */}
        <nav className="flex-1 overflow-y-auto py-2">
          {filteredTabs.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left
                ${activeTab === id
                  ? "bg-base-300 border-r-2 border-primary"
                  : "hover:bg-base-300"}`}
            >
              <Icon className={`size-5 flex-shrink-0 ${activeTab === id ? "text-primary" : "text-base-content/60"}`} />
              <span className={`text-sm font-medium ${activeTab === id ? "text-primary" : "text-base-content"}`}>
                {label}
              </span>
            </button>
          ))}
          {filteredTabs.length === 0 && (
            <div className="p-8 text-center text-sm text-base-content/40">
              No results found
            </div>
          )}
        </nav>

        {/* Sign out */}
        <div className="p-4 border-t border-base-300 flex-shrink-0">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-error/10 hover:bg-error/20 text-error rounded-2xl font-semibold transition-all group"
          >
            <LogOut className="size-5 group-hover:-translate-x-1 transition-transform" />
            <span>Sign out</span>
          </button>
        </div>
      </SidebarBase>

      {/* ── MAIN PANEL ── */}
      <main className="flex-1 h-full overflow-y-auto custom-scrollbar">
        <div className="w-full min-h-full p-6 lg:p-8 pb-24">
          <PanelContent
            tab={activeTab}
            authUser={authUser}
            selectedImg={selectedImg}
            editingName={editingName}
            nameValue={nameValue}
            setNameValue={setNameValue}
            setEditingName={setEditingName}
            handleSaveName={handleSaveName}
            editingAbout={editingAbout}
            aboutValue={aboutValue}
            setAboutValue={setAboutValue}
            setEditingAbout={setEditingAbout}
            handleSaveAbout={handleSaveAbout}
            isUpdatingProfile={isUpdatingProfile}
            isCropLoading={isCropLoading}
            handleFileSelect={handleFileSelect}
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

      {/* Crop modal */}
      {cropImageSrc && (
        <ImageCropModal
          imageSrc={cropImageSrc}
          onSave={handleCropSave}
          onCancel={() => setCropImageSrc(null)}
          isLoading={isCropLoading}
        />
      )}

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-base-100 rounded-3xl max-w-sm w-full shadow-2xl border border-base-300 overflow-hidden animate-in zoom-in-95 duration-200">
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
                Your account will be <span className="font-semibold text-error">deactivated immediately</span>. You have <span className="font-semibold">15 days</span> to restore it by logging back in. After that, all data is permanently removed.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={async () => { await useAuthStore.getState().deleteAccount(); setShowDeleteModal(false); navigate("/login"); }}
                  className="w-full py-4 px-6 bg-error hover:bg-error/80 text-error-content rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Trash2 className="size-4" /> Delete Permanently
                </button>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="w-full py-4 px-6 bg-base-200 hover:bg-base-300 text-base-content rounded-2xl font-bold transition-all"
                >Cancel</button>
              </div>
            </div>
            <div className="px-6 py-4 bg-base-200/50 border-t border-base-300">
              <p className="text-[10px] text-center text-base-content/40 uppercase tracking-widest font-semibold">This action is reversible within 15 days</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
