import { create } from "zustand";

export const useThemeStore = create((set) => ({
  theme: localStorage.getItem("chat-theme") || "whatsapp",
  setTheme: (theme) => {
    localStorage.setItem("chat-theme", theme);
    set({ theme });
  },
  callTheme: localStorage.getItem("call-theme") || "videocall",
  setCallTheme: (callTheme) => {
    localStorage.setItem("call-theme", callTheme);
    set({ callTheme });
  },
  chatPattern: localStorage.getItem("chat-pattern") || "whatsapp",
  setChatPattern: (chatPattern) => {
    localStorage.setItem("chat-pattern", chatPattern);
    set({ chatPattern });
  },
  customBgImage: localStorage.getItem("custom-bg-image") || null,
  setCustomBgImage: (customBgImage) => {
    if (customBgImage) localStorage.setItem("custom-bg-image", customBgImage);
    else localStorage.removeItem("custom-bg-image");
    set({ customBgImage });
  },
}));
