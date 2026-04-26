import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

const BASE_URL =
  import.meta.env.MODE === "development" ? "http://localhost:5001" : "/";

// Only these fields are safe to cache in localStorage.
// Never store tokens, passwords, or backend-internal fields.
const SAFE_USER_FIELDS = ["_id", "fullName", "email", "profilePic", "deletionScheduledAt"];
const persistUser = (user) => {
  const safe = {};
  for (const key of SAFE_USER_FIELDS) {
    if (user[key] !== undefined) safe[key] = user[key];
  }
  localStorage.setItem("chatty_user", JSON.stringify(safe));
};

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  isCheckingAuth: true,
  onlineUsers: [],
  socket: null,

  checkAuth: async () => {
    // 1. Instantly use offline context before hitting network
    const cachedUser = localStorage.getItem("chatty_user");
    if (cachedUser) {
      set({ authUser: JSON.parse(cachedUser) });
    }

    try {
      const res = await axiosInstance.get("/auth/check");
      set({ authUser: res.data });
      persistUser(res.data);
      get().connectSocket();
    } catch (error) {
      console.log("Error in checkAuth:", error);
      // ONLY explicitly logout if the backend definitely rejected the session token
      if (error.response && error.response.status === 401) {
        set({ authUser: null });
        localStorage.removeItem("chatty_user");
      } else if (cachedUser) {
        // Offline or Rate-Limited? Good! Launch the socket to wait for reconnection
        get().connectSocket();
      }
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", data);
      set({ authUser: res.data });
      persistUser(res.data);
      toast.success("Account created successfully");
      get().connectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      set({ authUser: res.data });
      persistUser(res.data);
      toast.success("Logged in successfully");
      get().connectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      set({ authUser: null });
      localStorage.removeItem("chatty_user");

      import("../lib/idb.js").then((mod) => mod.idb.clearAll()).catch(() => { });

      toast.success("Logged out successfully");
      get().disconnectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },

  updateProfile: async (data) => {
    set({ isUpdatingProfile: true });
    try {
      const res = await axiosInstance.put("/auth/update-profile", data);
      set({ authUser: res.data });
      persistUser(res.data);
      toast.success("Profile updated successfully");
    } catch (error) {
      console.log("error in update profile:", error);
      toast.error(error.response.data.message);
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  deleteAccount: async () => {
    try {
      await axiosInstance.delete("/auth/delete-account");
      set({ authUser: null });
      localStorage.removeItem("chatty_user");
      import("../lib/idb.js").then((mod) => mod.idb.clearAll()).catch(() => { });
      get().disconnectSocket();
      toast.success("Account scheduled for deletion.");
    } catch (error) {
      toast.error(error.response.data.message || "Failed to delete account");
    }
  },

  restoreAccount: async () => {
    try {
      await axiosInstance.post("/auth/restore-account");
      const updatedUser = { ...get().authUser, deletionScheduledAt: null };
      set({ authUser: updatedUser });
      persistUser(updatedUser);
      toast.success("Account restored successfully!");
    } catch (error) {
      toast.error(error.response.data.message || "Failed to restore account");
    }
  },

  connectSocket: () => {
    const { authUser, socket } = get();
    // Do NOT instantiate a duplicate socket if one is already initialized (even if temporarily re-connecting offline)
    if (!authUser || socket) return;

    const newSocket = io(BASE_URL, {
      query: { userId: authUser._id }, // kept for backward-compat with any older listeners
      withCredentials: true,           // REQUIRED: sends jwt httpOnly cookie in handshake
    });
    newSocket.connect();
    set({ socket: newSocket });

    newSocket.on("connect", () => {
      // Sync deferred background messages gracefully upon networking restoration
      import("./useChatStore").then((mod) => {
        mod.useChatStore.getState().syncPendingMessages?.();
      });
    });

    // Log socket auth failures so they're visible in the browser console
    newSocket.on("connect_error", (err) => {
      console.error("[Socket] Connection error:", err.message);
    });

    // ─── Online presence ──────────────────────────────────────────────────
    newSocket.on("getOnlineUsers", (userIds) => {
      set({ onlineUsers: userIds });
    });

    // ─── WebRTC call event handlers (lazy import avoids circular deps) ─────
    newSocket.on("call:incoming-group", (data) => {
      import("./useCallStore").then(({ useCallStore }) => {
        useCallStore.getState().handleIncomingCall({ ...data, isGroupCall: true, callType: "video" });
      });
    });

    newSocket.on("incoming-call", (data) => {
      import("./useCallStore").then(({ useCallStore }) => {
        useCallStore.getState().handleIncomingCall(data);
      });
    });

    newSocket.on("call-accepted-by-peer", (data) => {
      import("./useCallStore").then(({ useCallStore }) => {
        useCallStore.getState().handleCallAcceptedByPeer(data);
      });
    });

    newSocket.on("ice-candidate", (data) => {
      import("./useCallStore").then(({ useCallStore }) => {
        useCallStore.getState().handleIceCandidate(data);
      });
    });

    newSocket.on("call-rejected", () => {
      import("./useCallStore").then(({ useCallStore }) => {
        useCallStore.getState().handleCallRejected();
        toast.error("Call was declined.", { id: "call-rejected" });
      });
    });

    // Only show toast when the OTHER party ends — not when we end ourselves
    newSocket.on("call-ended", () => {
      import("./useCallStore").then(({ useCallStore }) => {
        useCallStore.getState().handleCallEnded();
        toast("Call ended by the other person", { icon: "📞", id: "call-ended" });
      });
    });

    newSocket.on("call:ended", ({ reason }) => {
      import("./useCallStore").then(({ useCallStore }) => {
        useCallStore.getState().handleCallEnded({ reason });
        toast("Call ended", { icon: "📞", id: "call:ended" });
      });
    });

    newSocket.on("call-timeout", () => {
      import("./useCallStore").then(({ useCallStore }) => {
        useCallStore.getState().handleCallTimeout();
        toast("No answer", { icon: "📵", id: "call-timeout" });
      });
    });

    // Receiver was offline when caller tried to call
    newSocket.on("call-user-offline", () => {
      import("./useCallStore").then(({ useCallStore }) => {
        useCallStore.getState().handleUserOffline();
        toast.error("User is offline. Try again later.", { id: "call-offline" });
      });
    });

    newSocket.on("callHistoryUpdated", () => {
      import("./useCallStore").then(({ useCallStore }) => {
        useCallStore.getState().fetchCallHistory();
      });
    });
  },

  disconnectSocket: () => {
    if (get().socket?.connected) get().socket.disconnect();
  },
}));
