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
}));
