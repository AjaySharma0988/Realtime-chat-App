import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import { idb } from "../lib/idb";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  isFetchingMore: false,
  isSendingMessage: false,
  hasMore: true,

  getUsers: async () => {
    const cachedUsers = await idb.getUsers();
    if (cachedUsers && cachedUsers.length > 0) {
      set({ users: cachedUsers });
    } else {
      set({ isUsersLoading: true });
    }

    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
      idb.saveUsers(res.data);
    } catch (error) {
      if (!cachedUsers || cachedUsers.length === 0) {
        toast.error(error.response?.data?.message || "Failed to load users");
      }
    } finally {
      if (get().isUsersLoading) set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    set({ messages: [], isMessagesLoading: true, hasMore: true });

    const cachedMsgs = await idb.getMessages(userId);
    if (cachedMsgs && cachedMsgs.length > 0) {
      // For now, if we have cache, we still fetch the latest 10 to ensure fresh data
      set({ messages: cachedMsgs, isMessagesLoading: false });
    }

    try {
      const res = await axiosInstance.get(`/messages/${userId}?limit=10`);
      set({ 
        messages: res.data, 
        hasMore: res.data.length === 10 
      });

      const authUserId = useAuthStore.getState().authUser?._id;
      // We might want to keep IDB simple for now or merge carefully. 
      // For simplicity in this task, let's just save the latest 10.
      idb.saveMessages(res.data, authUserId);

      // If we fetch messages, we have "seen" them.
      await axiosInstance.put(`/messages/mark-read/${userId}`);

      // Reset unread count locally
      set((state) => ({
        users: state.users.map((u) =>
          u._id === userId ? { ...u, unreadCount: 0 } : u
        )
      }));

    } catch (error) {
      if (!cachedMsgs || cachedMsgs.length === 0) {
        toast.error(error.response?.data?.message || "Failed to load messages");
      }
    } finally {
      if (get().isMessagesLoading) set({ isMessagesLoading: false });
    }
  },

  loadMoreMessages: async (userId) => {
    const { messages, isFetchingMore, hasMore } = get();
    if (isFetchingMore || !hasMore || messages.length === 0) return;

    set({ isFetchingMore: true });

    try {
      const oldestMessageId = messages[0]._id;
      const res = await axiosInstance.get(`/messages/${userId}?before=${oldestMessageId}&limit=10`);
      
      const newMessages = res.data;
      if (newMessages.length < 10) {
        set({ hasMore: false });
      }

      set((state) => ({
        messages: [...newMessages, ...state.messages]
      }));

      return newMessages.length;
    } catch (error) {
      console.error("Error loading more messages:", error);
      toast.error("Failed to load older messages");
    } finally {
      set({ isFetchingMore: false });
    }
  },

  sendMessage: async (messageData) => {
    if (get().isSendingMessage) return;
    set({ isSendingMessage: true });

    const { selectedUser } = get();
    // Support status replies where receiverId might be explicitly provided
    const targetUserId = messageData.receiverId || selectedUser?._id;
    
    if (!targetUserId) {
      set({ isSendingMessage: false });
      return;
    }

    const me = useAuthStore.getState().authUser;

    // Create optimistic message mapping
    const tempId = "temp_" + Date.now();
    const optimisticMsg = {
      _id: tempId,
      senderId: me._id,
      receiverId: targetUserId,
      text: messageData.text,
      image: messageData.image,
      type: messageData.type || "text",
      statusRef: messageData.statusRef || null,
      createdAt: new Date().toISOString(),
      status: "pending",
    };

    // Only append to the current message list if we are actually chatting with that person
    if (selectedUser?._id === targetUserId) {
      set((state) => ({ messages: [...state.messages, optimisticMsg] }));
    }

    try {
      const res = await axiosInstance.post(`/messages/send/${targetUserId}`, messageData);
      const newMessage = res.data;

      idb.saveMessage(newMessage, me._id);

      set((state) => {
        const isCurrentTarget = state.selectedUser?._id === targetUserId;
        const socketAlreadyAdded = isCurrentTarget && state.messages.some(m => m._id === newMessage._id);
        let newMessages = state.messages;
        
        if (isCurrentTarget) {
          if (socketAlreadyAdded) {
            newMessages = state.messages.filter(m => m._id !== tempId);
          } else {
            newMessages = state.messages.map(m => m._id === tempId ? newMessage : m);
          }
        }

        return {
          messages: newMessages,
          users: state.users.map(u =>
            u._id === targetUserId ? { ...u, lastMessage: newMessage } : u
          ).sort((a, b) => {
            const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
            const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
            return bTime - aTime;
          })
        };
      });
    } catch (error) {
      toast.error("Offline. Message queued.");
      optimisticMsg.status = "failed";
      idb.queuePendingMessage(optimisticMsg);
      set((state) => ({ messages: state.messages.map(m => m._id === tempId ? optimisticMsg : m) }));
    } finally {
      set({ isSendingMessage: false });
    }
  },

  retryFailedMessage: async (msg) => {
    set((state) => ({
      messages: state.messages.map(m => m._id === msg._id ? { ...m, status: "pending" } : m)
    }));

    try {
      const me = useAuthStore.getState().authUser;
      const res = await axiosInstance.post(`/messages/send/${msg.receiverId}`, { text: msg.text, image: msg.image, audio: msg.audio });
      const newMessage = res.data;

      idb.deleteMessage(msg._id);
      idb.saveMessage(newMessage, me._id);

      set((state) => ({
        messages: state.messages.map(m => m._id === msg._id ? newMessage : m),
        users: state.users.map(u =>
          u._id === msg.receiverId ? { ...u, lastMessage: newMessage } : u
        ).sort((a, b) => {
          const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
          const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
          return bTime - aTime;
        })
      }));
    } catch (error) {
      toast.error("Still offline, retry failed.");
      set((state) => ({
        messages: state.messages.map(m => m._id === msg._id ? { ...m, status: "failed" } : m)
      }));
    }
  },

  syncPendingMessages: async () => {
    const pending = await idb.getPendingMessages();
    if (!pending || pending.length === 0) return;

    const me = useAuthStore.getState().authUser;
    for (const msg of pending) {
      try {
        const payload = { text: msg.text, image: msg.image, audio: msg.audio };
        const res = await axiosInstance.post(`/messages/send/${msg.receiverId}`, payload);
        const realMsg = res.data;

        idb.deleteMessage(msg._id);
        idb.saveMessage(realMsg, me._id);
        set((state) => ({
          messages: state.messages.map((m) => m._id === msg._id ? realMsg : m),
          users: state.users.map(u =>
            u._id === msg.receiverId ? { ...u, lastMessage: realMsg } : u
          ).sort((a, b) => {
            const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
            const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
            return bTime - aTime;
          })
        }));
      } catch (err) {
        console.warn("[Sync] Still offline, failed to sync message out queue");
      }
    }
  },

  clearAllUnreads: () => {
    set((state) => ({
      users: state.users.map((u) => ({ ...u, unreadCount: 0 }))
    }));
  },

  deleteChat: async (userId) => {
    try {
      await axiosInstance.delete(`/messages/${userId}`);

      const idbMsgs = await idb.getMessages(userId);
      for (const m of idbMsgs) await idb.deleteMessage(m._id);

      set((state) => ({
        messages: [],
        selectedUser: null,
        users: state.users.map(u =>
          u._id === userId ? { ...u, lastMessage: null, unreadCount: 0 } : u
        )
      }));
      toast.success("Chat deleted exclusively for you");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete chat");
    }
  },

  bulkDeleteMessages: async (messageIds, deleteForEveryone = false) => {
    const { selectedUser } = get();
    try {
      await axiosInstance.delete("/messages/bulk", {
        data: { messageIds, receiverId: selectedUser?._id, deleteForEveryone },
      });

      if (deleteForEveryone) {
        set((state) => ({
          messages: state.messages.map((m) =>
            messageIds.includes(m._id) ? { ...m, text: "This message was deleted", image: null, audio: null, isDeletedForEveryone: true } : m
          )
        }));
        const me = useAuthStore.getState().authUser;
        const { messages } = get();
        messages.forEach(m => {
          if (messageIds.includes(m._id)) idb.saveMessage(m, me._id);
        });
        toast.success("Messages deleted for everyone");
      } else {
        const toRemove = new Set(messageIds);
        messageIds.forEach((id) => idb.deleteMessage(id));

        set((state) => ({
          messages: state.messages.filter((m) => !toRemove.has(m._id))
        }));
        toast.success("Messages deleted");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete messages");
    }
  },

  updateMessage: async (messageId, newText) => {
    try {
      const res = await axiosInstance.put(`/messages/${messageId}`, { text: newText });
      set({
        messages: get().messages.map((m) =>
          m._id === messageId ? { ...m, text: newText, isEdited: true } : m
        ),
      });
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to edit message");
      throw error;
    }
  },

  subscribeToGlobalEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off("profileUpdated");
    socket.off("newMessage");

    socket.on("profileUpdated", (updatedUser) => {
      set((state) => ({
        users: state.users.map((u) => u._id === updatedUser._id ? { ...u, ...updatedUser } : u),
        selectedUser: state.selectedUser?._id === updatedUser._id ? { ...state.selectedUser, ...updatedUser } : state.selectedUser
      }));
    });

    socket.on("profilePhotoPrivacyUpdated", ({ userId }) => {
      // Re-fetch users to get updated privacy filtered data
      get().getUsers();
    });

    socket.on("newMessage", (newMessage) => {
      // (Keep existing logic but ensure it updates unread counts for sidebar)
      const { selectedUser } = get();
      const me = useAuthStore.getState().authUser?._id;
      const isCurrentlyChatting = selectedUser && selectedUser._id === newMessage.senderId;
      const isTabHidden = document.hidden;

      let newStatus = newMessage.status;
      if (isCurrentlyChatting && !isTabHidden) {
        axiosInstance.put(`/messages/mark-read/${newMessage.senderId}`).catch(() => { });
        newStatus = "seen";
      } else if (newMessage.receiverId === me) {
        socket.emit("mark-delivered", { messageId: newMessage._id, senderId: newMessage.senderId });
      }

      // ── Advanced Notification System ──
      if (!isCurrentlyChatting || isTabHidden) {
        const authUser = useAuthStore.getState().authUser;
        const settings = authUser?.notificationSettings || { popupsEnabled: true, soundEnabled: true, soundType: "default" };
        const sender = get().users.find(u => u._id === newMessage.senderId);
        const senderName = sender?.fullName || "New Message";
        const messageBody = newMessage.text || (newMessage.image ? "Sent an image" : "Sent a message");

        if (settings.popupsEnabled) {
          if (Notification.permission === "granted" && isTabHidden) {
            const notification = new Notification(senderName, {
              body: messageBody,
              icon: sender?.profilePic || "/avatar.png",
              silent: true // NO SYSTEM SOUND
            });
            notification.onclick = () => {
              window.focus();
              if (sender) get().setSelectedUser(sender);
            };
          } else if (Notification.permission !== "granted") {
            toast(`New message from ${senderName}`, { icon: "💬" });
          }
        }

        if (settings.soundEnabled && settings.soundType !== "mute") {
          try {
            let audio;
            if (settings.soundType === "default") {
              audio = new Audio("/sounds/Message sound.mp3");
            } else if (settings.soundType === "custom" && settings.customSoundUrl) {
              audio = new Audio(settings.customSoundUrl);
            }
            if (audio) {
              audio.play().catch(e => console.log("Audio play blocked by browser", e));
            }
          } catch (e) {
            console.error("Failed to play notification sound", e);
          }
        }
      }
      // ──────────────────────────────────

      const messageToStore = { ...newMessage, status: newStatus };
      idb.saveMessage(messageToStore, me);

      if (isCurrentlyChatting) {
        set((state) => ({
          messages: state.messages.some(m => m._id === messageToStore._id) ? state.messages : [...state.messages, messageToStore]
        }));
      }

      set((state) => ({
        users: state.users.map((u) => {
          if (u._id === newMessage.senderId) {
            return {
              ...u,
              lastMessage: messageToStore,
              unreadCount: (isCurrentlyChatting && !isTabHidden) ? 0 : (u.unreadCount || 0) + 1
            };
          }
          if (u._id === newMessage.receiverId) {
            return { ...u, lastMessage: messageToStore };
          }
          return u;
        }).sort((a, b) => {
          const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
          const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
          return bTime - aTime;
        })
      }));
    });
  },

  unsubscribeFromGlobalEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.off("profileUpdated");
    socket.off("profilePhotoPrivacyUpdated");
    socket.off("newMessage");
  },

  subscribeToMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    
    // IMPORTANT: Clear any existing listeners to prevent duplication
    socket.off("messageDelivered");
    socket.off("messagesSeen");
    socket.off("chatDeleted");
    socket.off("messagesDeleted");
    socket.off("messagesDeletedForEveryone");
    socket.off("messageEdited");
    socket.off("messageReacted");

    socket.on("messageDelivered", ({ messageId }) => {
      // The other person's device received our message
      set((state) => ({
        messages: state.messages.map((m) =>
          m._id === messageId && m.status === "sent" ? { ...m, status: "delivered" } : m
        ),
        users: state.users.map((u) => {
          if (u.lastMessage && u.lastMessage._id === messageId) {
            return { ...u, lastMessage: { ...u.lastMessage, status: "delivered" } };
          }
          return u;
        })
      }));
    });

    socket.on("messagesSeen", ({ receiverId }) => {
      // The other person saw our messages
      set((state) => ({
        messages: state.messages.map((m) =>
          m.receiverId === receiverId ? { ...m, status: "seen" } : m
        ),
        users: state.users.map((u) => {
          if (u._id === receiverId && u.lastMessage && u.lastMessage.senderId !== receiverId) {
            return { ...u, lastMessage: { ...u.lastMessage, status: "seen" } };
          }
          return u;
        })
      }));
    });

    socket.on("chatDeleted", ({ deletedBy }) => {
      const { selectedUser } = get();
      if (selectedUser && deletedBy === selectedUser._id) {
        set({ messages: [], selectedUser: null });
        toast("Chat was cleared by the other user", { icon: "🗑️" });
      }
      set((state) => ({
        users: state.users.map(u =>
          u._id === deletedBy ? { ...u, lastMessage: null, unreadCount: 0 } : u
        )
      }));
    });

    socket.on("messagesDeleted", ({ messageIds }) => {
      const toRemove = new Set(messageIds);
      set({ messages: get().messages.filter((m) => !toRemove.has(m._id)) });
      messageIds.forEach((id) => idb.deleteMessage(id));
    });

    socket.on("messagesDeletedForEveryone", ({ messageIds }) => {
      set((state) => ({
        messages: state.messages.map((m) =>
          messageIds.includes(m._id) ? { ...m, text: "This message was deleted", image: null, audio: null, isDeletedForEveryone: true } : m
        )
      }));
      const me = useAuthStore.getState().authUser;
      const { messages } = get();
      messages.forEach(m => {
        if (messageIds.includes(m._id)) idb.saveMessage(m, me._id);
      });
    });
    socket.on("messageEdited", (updatedMsg) => {
      set({
        messages: get().messages.map((m) =>
          m._id === updatedMsg._id ? { ...m, ...updatedMsg } : m
        ),
      });
    });

    socket.on("messageReacted", ({ messageId, reactions }) => {
      set({
        messages: get().messages.map((m) =>
          m._id === messageId ? { ...m, reactions } : m
        ),
      });
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off("messageDelivered");
    socket.off("messagesSeen");
    socket.off("chatDeleted");
    socket.off("messagesDeleted");
    socket.off("messagesDeletedForEveryone");
    socket.off("messageEdited");
    socket.off("messageReacted");
  },

  reactToMessage: async (messageId, emoji) => {
    try {
      const res = await axiosInstance.post(`/messages/${messageId}/react`, { emoji });
      set({
        messages: get().messages.map((m) =>
          m._id === messageId ? { ...m, reactions: res.data.reactions } : m
        ),
      });
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to react");
    }
  },

  setSelectedUser: (selectedUser) => {
    set({ selectedUser });
    if (selectedUser) {
      get().getMessages(selectedUser._id);
    }
  },
}));

