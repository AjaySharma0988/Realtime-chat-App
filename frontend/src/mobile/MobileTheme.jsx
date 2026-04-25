import { ArrowLeft, Check } from "lucide-react";
import { useThemeStore } from "../store/useThemeStore";
import { THEMES } from "../constants";

// Dark themes to show dark text on preview  
const LIGHT_THEMES = new Set([
  "light","cupcake","bumblebee","emerald","corporate","retro",
  "valentine","garden","aqua","lofi","pastel","fantasy","wireframe",
  "cmyk","autumn","lemonade","winter","nord",
]);

const PREVIEW_MESSAGES = [
  { id: 1, content: "Hey! 👋 How's it going?", isSent: false },
  { id: 2, content: "Great, just testing themes 🎨", isSent: true },
];

const ThemePreviewCard = ({ theme, currentTheme, onSelect }) => {
  const isSelected = theme === currentTheme;
  const isLight = LIGHT_THEMES.has(theme);

  return (
    <button
      onClick={() => onSelect(theme)}
      data-theme={theme}
      className={`relative rounded-xl overflow-hidden border-2 transition-all active:scale-95 ${
        isSelected ? "border-primary ring-2 ring-primary/30" : "border-base-300"
      }`}
    >
      {/* Mini chat preview */}
      <div className="bg-base-100 p-2 space-y-1.5">
        {PREVIEW_MESSAGES.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.isSent ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`px-2 py-1 rounded-lg text-[8px] max-w-[70%] leading-snug ${
                msg.isSent
                  ? "bg-primary text-primary-content"
                  : "bg-base-300 text-base-content"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      {/* Theme name */}
      <div className="bg-base-200 px-2 py-1.5 text-center">
        <p className="text-[10px] font-semibold text-base-content capitalize truncate">{theme}</p>
      </div>

      {/* Selected tick */}
      {isSelected && (
        <div className="absolute top-1.5 right-1.5 size-5 bg-primary rounded-full flex items-center justify-center shadow-md">
          <Check className="size-3 text-primary-content" />
        </div>
      )}
    </button>
  );
};

const MobileTheme = ({ onBack }) => {
  const { theme, setTheme } = useThemeStore();

  // Exclude "videocall" theme from user selection
  const selectableThemes = THEMES.filter((t) => t !== "videocall");

  return (
    <div className="w-full h-full flex flex-col bg-base-100">
      {/* Header */}
      <div className="h-16 bg-base-300 flex items-center px-2 gap-1 border-b border-base-content/10 flex-shrink-0">
        <button onClick={onBack} className="p-2 hover:bg-base-content/10 rounded-full text-base-content">
          <ArrowLeft className="size-6" />
        </button>
        <h1 className="text-lg font-bold text-base-content flex-1 px-2">Chat Theme</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-6">
        {/* Current theme banner */}
        <div className="px-4 py-4 border-b border-base-content/10">
          <div className="flex items-center gap-3">
            <div
              data-theme={theme}
              className="size-12 rounded-xl bg-primary flex items-center justify-center shadow-md"
            >
              <Check className="size-6 text-primary-content" />
            </div>
            <div>
              <p className="text-xs text-base-content/50 uppercase tracking-wider font-semibold">Active Theme</p>
              <p className="font-bold text-base-content capitalize">{theme}</p>
            </div>
          </div>
        </div>

        {/* Hint */}
        <p className="px-4 pt-4 pb-2 text-xs text-base-content/50">
          Tap any theme to apply it instantly across the entire app.
        </p>

        {/* Theme grid */}
        <div className="px-4 grid grid-cols-2 gap-3">
          {selectableThemes.map((t) => (
            <ThemePreviewCard
              key={t}
              theme={t}
              currentTheme={theme}
              onSelect={setTheme}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default MobileTheme;
