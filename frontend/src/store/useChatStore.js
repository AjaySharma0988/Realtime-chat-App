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
  isSendingMessage: false,

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
    set({ messages: [], isMessagesLoading: true });

    const cachedMsgs = await idb.getMessages(userId);
    if (cachedMsgs && cachedMsgs.length > 0) {
      set({ messages: cachedMsgs, isMessagesLoading: false });
    }

    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });

      const authUserId = useAuthStore.getState().authUser?._id;
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

  subscribeToMessages: () => {
    const socket = useAuthStore.getState().socket;

    // IMPORTANT: Clear any existing listeners to prevent duplication
    socket.off("newMessage");
    socket.off("messageDelivered");
    socket.off("messagesSeen");
    socket.off("chatDeleted");
    socket.off("messagesDeleted");
    socket.off("messagesDeletedForEveryone");
    socket.off("messageEdited");
    socket.off("messageReacted");

    socket.on("newMessage", (newMessage) => {
      console.log("[Socket] Received newMessage:", newMessage._id);
      const { selectedUser } = get();
      const isCurrentlyChatting = selectedUser && selectedUser._id === newMessage.senderId;
      const me = useAuthStore.getState().authUser?._id;

      let newStatus = newMessage.status;

      if (isCurrentlyChatting) {
        // Mark as read immediately since we are looking at it
        axiosInstance.put(`/messages/mark-read/${newMessage.senderId}`).catch(() => { });
        newStatus = "seen";
      } else {
        // We received it but aren't looking at the chat -> it is delivered
        if (newMessage.receiverId === me) {
          socket.emit("mark-delivered", {
            messageId: newMessage._id,
            senderId: newMessage.senderId
          });
        }
      }

      const messageToStore = { ...newMessage, status: newStatus };
      idb.saveMessage(messageToStore, me); // Save to local IndexedDB

      if (isCurrentlyChatting) {
        set((state) => {
          // Prevent UI duplication: don't append if message already exists
          if (state.messages.some((m) => m._id === messageToStore._id)) return state;
          return { messages: [...state.messages, messageToStore] };
        });
      }

      set((state) => {
        const senderId = newMessage.senderId;
        return {
          users: state.users.map((u) => {
            if (u._id === senderId) {
              return {
                ...u,
                lastMessage: messageToStore,
                unreadCount: isCurrentlyChatting ? 0 : (u.unreadCount || 0) + 1
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
        };
      });
    });

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
    socket.off("newMessage");
    socket.off("messageDelivered");
    socket.off("messagesSeen");
    socket.off("chatDeleted");
    socket.off("messagesDeleted");
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

