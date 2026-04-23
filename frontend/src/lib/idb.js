import { openDB } from "idb";

const DB_NAME = "chatty_db";
const DB_VERSION = 1;

export const initDB = async () => {
  return await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("messages")) {
        const msgStore = db.createObjectStore("messages", { keyPath: "_id" });
        msgStore.createIndex("chatId", "chatId", { unique: false });
        msgStore.createIndex("status", "status", { unique: false }); // For pending vs sent
      }
      if (!db.objectStoreNames.contains("users")) {
        db.createObjectStore("users", { keyPath: "_id" });
      }
      if (!db.objectStoreNames.contains("syncData")) {
        db.createObjectStore("syncData", { keyPath: "key" });
      }
    },
  });
};

export const idb = {
  // ─── Messages ─────────────────────────────────────────────────────────────
  async saveMessage(msg, currentUserId) {
    if (!msg || !msg._id) return;
    const db = await initDB();
    
    // Determine the chat session folder this message belongs to.
    const chatId = msg.senderId === currentUserId ? msg.receiverId : msg.senderId;
    
    await db.put("messages", { ...msg, chatId });
  },

  async saveMessages(messages, currentUserId) {
    if (!messages || !messages.length) return;
    const db = await initDB();
    const tx = db.transaction("messages", "readwrite");
    messages.forEach((msg) => {
      const chatId = msg.senderId === currentUserId ? msg.receiverId : msg.senderId;
      tx.store.put({ ...msg, chatId });
    });
    await tx.done;
  },

  async getMessages(chatId) {
    const db = await initDB();
    const tx = db.transaction("messages", "readonly");
    const index = tx.store.index("chatId");
    let msgs = await index.getAll(chatId);
    
    // Sort by createdAt ascending (oldest first)
    msgs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    return msgs;
  },

  async deleteMessage(messageId) {
    if (!messageId) return;
    const db = await initDB();
    await db.delete("messages", messageId);
  },

  async queuePendingMessage(msg) {
    const db = await initDB();
    // Allow IDB to record failed so getPendingMessages uses manual filtering if needed, or query them both!
    // Explicitly write the chatId as the receiver since the message is inherently outgoing
    await db.put("messages", { ...msg, chatId: msg.receiverId });
  },

  async getPendingMessages() {
    const db = await initDB();
    const tx = db.transaction("messages", "readonly");
    // We want to retry both 'pending' and 'failed'
    const index = tx.store.index("status");
    const p1 = await index.getAll("pending");
    const p2 = await index.getAll("failed");
    return [...p1, ...p2];
  },

  // ─── Users Cache ────────────────────────────────────────────────────────
  async saveUsers(users) {
    const db = await initDB();
    const tx = db.transaction("users", "readwrite");
    users.forEach((u) => tx.store.put(u));
    await tx.done;
  },

  async getUsers() {
    const db = await initDB();
    return await db.getAll("users");
  },

  // ─── Sync Timestamps ─────────────────────────────────────────────────────
  async setLastSync(timestamp) {
    const db = await initDB();
    await db.put("syncData", { key: "lastSync", value: timestamp });
  },

  async getLastSync() {
    const db = await initDB();
    const record = await db.get("syncData", "lastSync");
    return record ? record.value : 0;
  },

  // Purge ALL databases (used heavily during explicit Logout)
  async clearAll() {
    const db = await initDB();
    await db.clear("messages");
    await db.clear("users");
    await db.clear("syncData");
  }
};
