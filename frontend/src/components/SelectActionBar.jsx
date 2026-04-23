import { X, Copy, Star, Trash2, Forward, Download } from "lucide-react";

const Btn = ({ icon: Icon, label, onClick, danger }) => (
  <button
    title={label}
    onClick={onClick}
    className={`
      flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-colors
      ${danger
        ? "hover:bg-error/10 text-error"
        : "hover:bg-base-300 text-base-content/70"}
    `}
  >
    <Icon className="size-5" />
    <span className="text-[10px] font-medium hidden sm:block">{label}</span>
  </button>
);

const SelectActionBar = ({ count, onCopy, onDelete, onForward, onDownload, onClose }) => (
  <div
    className="flex-shrink-0 h-16 bg-base-200 border-t border-base-300 flex items-center px-4 gap-2"
    style={{ animation: "slideUp 0.18s ease-out" }}
  >
    {/* Exit select mode */}
    <button
      onClick={onClose}
      className="p-2 rounded-full hover:bg-base-300 transition-colors flex-shrink-0"
      title="Exit selection"
    >
      <X className="size-5 text-base-content/70" />
    </button>

    {/* Count */}
    <span className="flex-1 text-sm font-medium text-base-content">
      {count} selected
    </span>

    {/* Actions */}
    <div className="flex items-center">
      <Btn icon={Copy}     label="Copy"     onClick={onCopy} />
      <Btn icon={Star}     label="Star"     onClick={() => {}} />
      <Btn icon={Trash2}   label="Delete"   onClick={onDelete}   danger />
      <Btn icon={Forward}  label="Forward"  onClick={onForward} />
      <Btn icon={Download} label="Download" onClick={onDownload} />
    </div>
  </div>
);

export default SelectActionBar;
