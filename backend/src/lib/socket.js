import { Server } from "socket.io";
import http from "http";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Call from "../models/call.model.js";
import Session from "../models/linkedDevice.model.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === "production"
      ? [process.env.FRONTEND_URL]
      : [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
      ],
    credentials: true,
  },
  // ── Timeout tuning: prevent socket drop during long WebRTC calls ──────────
  // Default pingTimeout (~20 s) causes disconnects on slow/mobile networks.
  // 120 s timeout gives ICE restarts time to complete without killing the socket.
  pingTimeout: 120000,   // 120 s — wait this long before declaring socket dead
  pingInterval: 25000,   // 25 s — heartbeat interval (standard recommended value)
  // 5 MB cap — SDP offers + callerInfo can be several KB; generous but still bounded
  maxHttpBufferSize: 5e6,
});

// ─── Socket Authentication Middleware ─────────────────────────────────────
// Runs ONCE per connection. After this, socket.verifiedUserId is trusted forever.
// No per-event re-authentication — this is the WebRTC-safe pattern.
io.use(async (socket, next) => {
  try {
    let token = null;

    // ── Primary path: read JWT from httpOnly cookie ──────────────────────
    // Requires withCredentials:true on the client socket connection.
    const raw = socket.handshake.headers.cookie || "";
    const match = raw.match(/(?:^|;\s*)jwt=([^;]+)/);
    if (match?.[1]) {
      // URL-decode in case the browser encoded the token value
      try { token = decodeURIComponent(match[1]); } catch { token = match[1]; }
    }

    // ── Fallback: auth.token sent in socket handshake options ─────────────
    // Used by the call popup window which may not have cookie access.
    if (!token && socket.handshake.auth?.token) {
      token = socket.handshake.auth.token;
    }

    if (!token) {
      console.warn("[Socket:Auth] No token found — rejecting", socket.id);
      return next(new Error("Unauthorized"));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      console.warn("[Socket:Auth] Invalid token —", err.message);
      return next(new Error("Unauthorized"));
    }

    if (!decoded?.userId) return next(new Error("Unauthorized"));

    // Real-time: check if this specific device/session is still active
    const session = decoded.sessionId 
      ? await Session.findOne({ 
          userId: decoded.userId, 
          sessionId: decoded.sessionId, 
          isActive: true 
        })
      : true;

    if (!session) return next(new Error("Unauthorized"));

    socket.verifiedUserId = decoded.userId;
    socket.sessionId = decoded.sessionId;
    next();
  } catch (err) {
    console.error("[Socket:Auth] Unexpected error:", err.message);
    next(new Error("Unauthorized"));
  }
});


export function getReceiverSocketId(userId) {
  return userId;
}

// ─── Helpers ──────────────────────────────────────────────────────────────
// ObjectId check — all MongoDB user IDs and message IDs pass this.
const isValidObjectId = (id) =>
  typeof id === "string" && mongoose.Types.ObjectId.isValid(id);

// callId is typically a user ID (ObjectId string) or a UUID — allow both formats.
// We only enforce type and a sane max length.
const isValidCallId = (id) =>
  typeof id === "string" && id.length > 0 && id.length <= 150;

const MAX_EMOJI_LENGTH = 10;

// ─── In-memory stores ─────────────────────────────────────────────────────
const userSocketMap = {}; // { userId: socketId }
const activeCalls = new Map(); // { callerUserId: { to, offer, callType, callerInfo, ... } }

// ─── Background DB helper — NEVER blocks signaling ────────────────────────
// Fire-and-forget: the caller DOES NOT await this. The call proceeds immediately.
// DB failure is logged but never interrupts the WebRTC flow.
const persistAsync = (fn, label) => {
  fn().catch((err) => console.error(`[Socket:DB] ${label}:`, err.message));
};

// ─── Connection handler ───────────────────────────────────────────────────
io.on("connection", (socket) => {
  // ALWAYS use the server-verified userId. Never trust socket.handshake.query.
  const userId = socket.verifiedUserId;
  console.log("[Socket] connected", socket.id, "uid:", userId);


  socket.join(userId);
  if (socket.sessionId) socket.join(socket.sessionId);
  
  // Track multiple connections for "online" status
  if (!userSocketMap[userId]) {
    userSocketMap[userId] = new Set();
  }
  userSocketMap[userId].add(socket.id);

  io.emit("getOnlineUsers", Object.keys(userSocketMap).filter(id => userSocketMap[id].size > 0));
  for (const [callerId, session] of activeCalls.entries()) {
    if (session.to === userId && session.status === "ringing") {
      if (Date.now() - session.timestamp < 60_000) {
        io.to(socket.id).emit("incoming-call", {
          from: callerId,
          offer: session.offer,
          callType: session.callType,
          callerInfo: session.callerInfo,
        });
      } else {
        activeCalls.delete(callerId);
      }
    }
  }

  io.emit("getOnlineUsers", Object.keys(userSocketMap).filter(id => userSocketMap[id].size > 0));

  // ─── Chat Message Events ──────────────────────────────────────────────────
  socket.on("mark-delivered", async ({ messageId, senderId }) => {
    if (!isValidObjectId(messageId) || !isValidObjectId(senderId)) return;
    try {
      const Message = (await import("../models/message.model.js")).default;
      await Message.updateOne(
        { _id: messageId, status: "sent" },
        { $set: { status: "delivered" } }
      );
      io.to(senderId).emit("messageDelivered", { messageId });
    } catch (err) {
      console.error("[Socket] Failed to mark delivered:", err.message);
    }
  });

  // ─── WebRTC Signaling — CRITICAL PATH ────────────────────────────────────
  // Rule: EMIT FIRST, persist to DB in background.
  // No DB call may block or delay any signaling event.

  socket.on("call-user", ({ to, offer, callType, callerInfo }) => {
    // Input validation (lightweight — no async, no DB)
    if (!isValidObjectId(to)) {
      console.warn("[Socket:Security] call-user: invalid 'to' ObjectId", { to, from: userId });
      return;
    }
    if (!offer || typeof offer !== "object") return;
    if (!["audio", "video"].includes(callType)) return;

    // ── Register active call session immediately (in-memory, zero latency) ──
    // This is the source of truth for the call lifecycle.
    // DB records are created in the background below.
    activeCalls.set(userId, {
      to, offer, callType, callerInfo,
      timestamp: Date.now(),
      status: "ringing",
      callerRecordId: null,
      receiverRecordId: null,
    });

    // ── IMMEDIATELY signal the receiver — zero DB wait ───────────────────
    const isOnline = !!userSocketMap[to];
    if (isOnline) {
      io.to(to).emit("incoming-call", { from: userId, offer, callType, callerInfo });
    } else {
      socket.emit("call-user-offline");
    }

    // ── Background: persist call history (does NOT block signaling) ──────
    persistAsync(async () => {
      const [savedCaller, savedReceiver] = await Promise.all([
        new Call({ userId, peerId: to, type: "outgoing", status: "missed", callType }).save(),
        new Call({ userId: to, peerId: userId, type: "incoming", status: "missed", callType }).save(),
      ]);
      // Patch the session with DB IDs once available
      const session = activeCalls.get(userId);
      if (session) {
        session.callerRecordId = savedCaller._id;
        session.receiverRecordId = savedReceiver._id;
      }
      io.to(userId).emit("callHistoryUpdated");
      io.to(to).emit("callHistoryUpdated");
    }, "call-user persist");
  });

  socket.on("call-accepted", ({ to, answer }) => {
    if (!isValidObjectId(to)) return;
    if (!answer || typeof answer !== "object") return;

    // ── IMMEDIATELY forward the SDP answer — zero DB wait ───────────────
    io.to(to).emit("call-accepted-by-peer", { answer });

    // ── Update in-memory session ─────────────────────────────────────────
    const session = activeCalls.get(to);
    if (session) {
      session.status = "active";
      session.answeredAt = Date.now();
    }

    // ── Background: update call history status ───────────────────────────
    if (session?.callerRecordId && session?.receiverRecordId) {
      persistAsync(async () => {
        await Call.updateMany(
          { _id: { $in: [session.callerRecordId, session.receiverRecordId] } },
          { $set: { status: "answered" } }
        );
        io.to(userId).emit("callHistoryUpdated");
        io.to(to).emit("callHistoryUpdated");
      }, "call-accepted persist");
    }
  });

  // ICE candidates are ultra-latency-sensitive — minimal validation only.
  // We validate 'to' is a real user ID, but NEVER block the candidate itself.
  socket.on("ice-candidate", ({ to, candidate }) => {
    if (!isValidObjectId(to)) {
      console.warn("[Socket:Security] ice-candidate: invalid 'to'", { to, from: userId });
      return;
    }
    // Relay candidate exactly as received — do NOT modify ICE payload
    io.to(to).emit("ice-candidate", { candidate });
  });

  socket.on("call-ringing", ({ to }) => {
    if (!isValidObjectId(to)) return;
    io.to(to).emit("call-ringing");
  });

  socket.on("call-rejected", ({ to }) => {
    if (!isValidObjectId(to)) return;

    // ── IMMEDIATELY notify caller ────────────────────────────────────────
    io.to(to).emit("call-rejected");

    const session = activeCalls.get(to);
    activeCalls.delete(to);

    // ── Background: update call history ─────────────────────────────────
    if (session?.callerRecordId && session?.receiverRecordId) {
      persistAsync(async () => {
        await Call.updateMany(
          { _id: { $in: [session.callerRecordId, session.receiverRecordId] } },
          { $set: { status: "rejected" } }
        );
        io.to(userId).emit("callHistoryUpdated");
        io.to(to).emit("callHistoryUpdated");
      }, "call-rejected persist");
    }
  });

  // ─── Background call cleanup (non-blocking) ───────────────────────────
  // Returns immediately; DB writes happen in background.
  const handleEndCallCleanup = (callerId) => {
    const session = activeCalls.get(callerId);
    if (!session) return;

    activeCalls.delete(callerId); // Synchronous — instant

    if (session.status === "active" && session.answeredAt
      && session.callerRecordId && session.receiverRecordId) {
      const duration = Math.floor((Date.now() - session.answeredAt) / 1000);
      persistAsync(async () => {
        await Call.updateMany(
          { _id: { $in: [session.callerRecordId, session.receiverRecordId] } },
          { $set: { duration } }
        );
        io.to(callerId).emit("callHistoryUpdated");
        io.to(session.to).emit("callHistoryUpdated");
      }, "end-call duration persist");
    }
  };

  socket.on("end-call", ({ to }) => {
    if (!isValidObjectId(to)) return;
    // ── IMMEDIATELY signal end — cleanup is sync/background ─────────────
    io.to(to).emit("call-ended");
    handleEndCallCleanup(userId); // synchronous delete + async DB
    handleEndCallCleanup(to);
  });

  socket.on("call:end", ({ to, reason }) => {
    if (!isValidObjectId(to)) return;
    io.to(to).emit("call:ended", { reason });
    handleEndCallCleanup(userId);
    handleEndCallCleanup(to);
  });

  socket.on("call-timeout", ({ to }) => {
    if (!isValidObjectId(to)) return;
    io.to(to).emit("call-timeout");
    handleEndCallCleanup(userId);
  });

  socket.on("call:connected", ({ to }) => {
    if (!isValidObjectId(to)) return;
    io.to(to).emit("call:connected");
  });

  // ─── WebRTC Call Reactions ─────────────────────────────────────────────
  socket.on("call:handRaise", ({ callId, raised }) => {
    if (!isValidCallId(callId)) return;
    io.to(callId).emit("call:handRaise", { userId, raised: !!raised });
  });

  socket.on("call:emoji", ({ callId, emoji }) => {
    if (!isValidCallId(callId)) return;
    if (!emoji || typeof emoji !== "string" || emoji.length > MAX_EMOJI_LENGTH) return;
    io.to(callId).emit("call:emoji", { userId, emoji });
  });

  socket.on("call:deviceInfo", ({ callId, device }) => {
    if (!isValidCallId(callId)) return;
    io.to(callId).emit("call:deviceInfo", { device });
  });

  socket.on("call:mediaStatus", ({ callId, isMuted, isCameraOff }) => {
    if (!isValidCallId(callId)) return;
    io.to(callId).emit("call:mediaStatus", { isMuted: !!isMuted, isCameraOff: !!isCameraOff });
  });

  // ─── WebRTC Renegotiation ──────────────────────────────────────────────
  socket.on("call:renegotiate", ({ callId, offer }) => {
    if (!isValidCallId(callId)) return;
    if (!offer || typeof offer !== "object") return;
    io.to(callId).emit("call:renegotiate", { offer });
  });

  socket.on("call:renegotiate:answer", ({ callId, answer }) => {
    if (!isValidCallId(callId)) return;
    if (!answer || typeof answer !== "object") return;
    io.to(callId).emit("call:renegotiate:answer", { answer });
  });

  // ─── Group Call (Mesh Topology) ────────────────────────────────────────
  socket.on("call:addParticipants", ({ callId, users }) => {
    if (!isValidCallId(callId)) return;
    if (!Array.isArray(users)) return;
    users.forEach((user) => {
      const targetId = user._id || user.id || user;
      if (!isValidObjectId(String(targetId))) return;
      io.to(String(targetId)).emit("call:incomingGroup", { callId, from: userId });
    });
  });

  socket.on("call:group:offer", ({ to, offer }) => {
    if (!isValidObjectId(to)) return;
    if (!offer || typeof offer !== "object") return;
    io.to(to).emit("call:group:offer", { from: userId, offer });
  });

  socket.on("call:group:answer", ({ to, answer }) => {
    if (!isValidObjectId(to)) return;
    if (!answer || typeof answer !== "object") return;
    io.to(to).emit("call:group:answer", { from: userId, answer });
  });

  socket.on("call:watchPartyToggle", ({ callId, enabled }) => {
    if (!isValidCallId(callId)) return;
    io.to(callId).emit("call:watchPartyToggle", { enabled: !!enabled });
  });

  socket.on("call:group:ice", ({ to, candidate }) => {
    if (!isValidObjectId(to)) return;
    // Relay group ICE candidate without modification
    io.to(to).emit("call:group:ice", { from: userId, candidate });
  });

  // ─── vBrowser (Watch Party) ────────────────────────────────────────────
  socket.on("vbrowser:navigate", ({ callId, url }) => {
    if (!isValidCallId(callId)) return;
    if (typeof url !== "string" || url.length > 2048) return;
    if (!/^https?:\/\//.test(url)) return;
    io.to(callId).emit("vbrowser:navigate", { url });
  });

  socket.on("vbrowser:start",      ({ callId }) => { if (isValidCallId(callId)) io.to(callId).emit("vbrowser:start"); });
  socket.on("vbrowser:stop",       ({ callId }) => { if (isValidCallId(callId)) io.to(callId).emit("vbrowser:stop"); });
  socket.on("vbrowser:controller", ({ callId, controller }) => { if (isValidCallId(callId)) io.to(callId).emit("vbrowser:controller", { controller }); });
  socket.on("screen:start",        ({ callId }) => { if (isValidCallId(callId)) io.to(callId).emit("screen:start"); });
  socket.on("screen:stop",         ({ callId }) => { if (isValidCallId(callId)) io.to(callId).emit("screen:stop"); });

  socket.on("screen:offer", ({ to, offer }) => {
    if (!isValidObjectId(to)) return;
    if (!offer || typeof offer !== "object") return;
    io.to(to).emit("screen:offer", { from: userId, offer });
  });

  socket.on("screen:answer", ({ to, answer }) => {
    if (!isValidObjectId(to)) return;
    if (!answer || typeof answer !== "object") return;
    io.to(to).emit("screen:answer", { from: userId, answer });
  });

  socket.on("screen:ice", ({ to, candidate }) => {
    if (!isValidObjectId(to)) return;
    io.to(to).emit("screen:ice", { from: userId, candidate });
  });

  // ─── Watch Party Events ────────────────────────────────────────────────
  socket.on("wp:start", ({ callId, url, actionId }) => {
    if (!isValidCallId(callId)) return;
    if (typeof url !== "string" || url.length > 2048) return;
    if (!/^https?:\/\//.test(url)) return;
    io.to(callId).emit("wp:start", { url, actionId, userId });
  });

  socket.on("wp:action", (data) => {
    const { callId, type, time, actionId } = data;
    if (!isValidCallId(callId)) return;
    if (typeof time !== "number") return;
    io.to(callId).emit("wp:action", { callId, type, time, actionId, userId });
  });

  socket.on("wp:heartbeat", (data) => {
    const { callId, time, playing } = data;
    if (!isValidCallId(callId)) return;
    if (typeof time !== "number") return;
    io.to(callId).emit("wp:heartbeat", { callId, time, playing: !!playing, userId });
  });

  socket.on("wp:stop", ({ callId }) => {
    if (isValidCallId(callId)) io.to(callId).emit("wp:stop");
  });

  // ─── Call heartbeat ────────────────────────────────────────────────────
  socket.on("call:ping", ({ to }) => {
    if (!isValidObjectId(to)) return;
    io.to(to).emit("call:pong");
    socket.emit("call:pong");
  });

  // ─── QR Linked Device ──────────────────────────────────────────────────
  socket.on("qr:join", ({ sessionId }) => {
    if (typeof sessionId !== "string") return;
    if (sessionId.length === 0 || sessionId.length > 100) return;
    if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) return;
    socket.join(`qr:${sessionId}`);
  });

  // ─── Re-register after popup call ends ────────────────────────────────
  // When the call popup closes, the main window re-registers so the user
  // stays "online". userId is the server-verified value — always safe.
  socket.on("re-register", () => {
    if (!userSocketMap[userId]) userSocketMap[userId] = new Set();
    userSocketMap[userId].add(socket.id);
    io.emit("getOnlineUsers", Object.keys(userSocketMap).filter(id => userSocketMap[id].size > 0));
    console.log(`[Socket] Re-registered ${userId} → ${socket.id}`);
  });

  // ─── Disconnect ────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    console.log("[Socket] disconnected", socket.id, "uid:", userId);

    // If this user was in an active call as caller, notify the peer immediately
    if (activeCalls.has(userId)) {
      const session = activeCalls.get(userId);
      activeCalls.delete(userId);
      io.to(session.to).emit("call:ended", { reason: "caller_disconnected" });
      io.to(session.to).emit("call-ended"); // backward-compat alias
    }

    // Remove this specific socket from the user's connection set
    if (userSocketMap[userId]) {
      userSocketMap[userId].delete(socket.id);
      if (userSocketMap[userId].size === 0) {
        delete userSocketMap[userId];
      }
      io.emit("getOnlineUsers", Object.keys(userSocketMap));
    }
  });
});

export { io, app, server };
