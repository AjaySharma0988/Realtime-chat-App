import { create } from "zustand";

export const useAppStore = create((set) => ({
  activeView: "chats",
  setActiveView: (view) => set({ activeView: view }),
}));
