import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useStatusStore = create((set, get) => ({
  statuses: [], // flat list of all active statuses
  isStatusesLoading: false,
  viewingUserId: null, // ID of the user whose status we are currently viewing

  setViewingUserId: (userId) => set({ viewingUserId: userId }),

  fetchStatuses: async () => {
    set({ isStatusesLoading: true });
    try {
      const res = await axiosInstance.get("/status");
      set({ statuses: res.data });
    } catch (error) {
      console.error("Failed to fetch statuses:", error);
    } finally {
      set({ isStatusesLoading: false });
    }
  },

  // Helper getters
  getUserStatuses: (userId) => {
    return get().statuses.filter(s => (s.userId?._id || s.userId) === userId);
  },

  hasStatus: (userId) => {
    return get().statuses.some(s => (s.userId?._id || s.userId) === userId);
  },

  getStatusCount: (userId) => {
    return get().statuses.filter(s => (s.userId?._id || s.userId) === userId).length;
  },

  removeStatus: (statusId) => {
    set((state) => ({ 
      statuses: state.statuses.filter(s => s._id !== statusId) 
    }));
  },

  // Real-time updates
  subscribeToStatuses: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.on("status:created", (newStatus) => {
      set((state) => ({ statuses: [newStatus, ...state.statuses] }));
    });

    socket.on("status:deleted", ({ statusId }) => {
      set((state) => ({ statuses: state.statuses.filter(s => s._id !== statusId) }));
    });

    socket.on("status:view", ({ statusId, viewerId }) => {
      set((state) => ({
        statuses: state.statuses.map(s => 
          s._id === statusId && !s.views.some(v => v.userId === viewerId)
            ? { ...s, views: [...s.views, { userId: viewerId, viewedAt: new Date() }] }
            : s
        )
      }));
    });
  },

  unsubscribeFromStatuses: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.off("status:new");
    socket.off("status:delete");
    socket.off("status:view");
  }
}));
