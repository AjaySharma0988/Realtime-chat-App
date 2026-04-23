import { Server } from "socket.io";
import http from "http";
import express from "express";
import Call from "../models/call.model.js";

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
});

export function getReceiverSocketId(userId) {
  // Returns the userId itself, which represents the room containing all sockets for that user.
  return userId;
}

// used to store online users
const userSocketMap = {}; // {userId: socketId}
const activeCalls = new Map(); // { callerUserId : { to, offer, callType, callerInfo, timestamp } }

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  const userId = socket.handshake.query.userId;
  if (userId) {
    socket.join(userId); // Join native socket.io room for multi-tab support
    userSocketMap[userId] = socket.id; // Still used just for getOnlineUsers string payload

    // Delivery sweep: Check if anyone is actively ringing this newly logged-in user
    for (const [callerId, session] of activeCalls.entries()) {
      if (session.to === userId && session.status === "ringing") {
        // If the ringing offer is less than 60000ms old, instantly connect it!
        if (Date.now() - session.timestamp < 60_000) {
          io.to(socket.id).emit("incoming-call", {
            from: callerId,
            offer: session.offer,
            callType: session.callType,
            callerInfo: session.callerInfo
          });
        } else {
          // Stale ring, purge it
          activeCalls.delete(callerId);
        }
      }
    }
  }

  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // ─── Chat Message Events ──────────────────────────────────────────────────
  // (handled in controllers via getReceiverSocketId + io.to().emit())

  socket.on("mark-delivered", async ({ messageId, senderId }) => {
    try {
      const Message = (await import("../models/message.model.js")).default;
      await Message.updateOne(
        { _id: messageId, status: "sent" },
        { $set: { status: "delivered" } }
      );

      io.to(senderId).emit("messageDelivered", { messageId });
    } catch (err) {
      console.error("[Socket] Failed to mark delivered:", err);
    }
  });

  // ─── WebRTC Signaling ─────────────────────────────────────────────────────
  socket.on("call-user", async ({ to, offer, callType, callerInfo }) => {
    let callerRecordId = null;
    let receiverRecordId = null;

    try {
      const callerCall = new Call({
        userId: userId,
        peerId: to,
        type: "outgoing",
        status: "missed",
        callType,
      });
      const receiverCall = new Call({
        userId: to,
        peerId: userId,
        type: "incoming",
        status: "missed",
        callType,
      });

      const [savedCaller, savedReceiver] = await Promise.all([
        callerCall.save(),
        receiverCall.save()
      ]);
      callerRecordId = savedCaller._id;
      receiverRecordId = savedReceiver._id;
      
      // Notify both users to refresh history (for the new missed/outgoing entries)
      io.to(userId).emit("callHistoryUpdated");
      io.to(to).emit("callHistoryUpdated");
    } catch (err) {
      console.error("[Socket] Failed to create call history records:", err);
    }

    activeCalls.set(userId, {
      to, offer, callType, callerInfo, timestamp: Date.now(),
      status: "ringing",
      callerRecordId,
      receiverRecordId
    });

    const isOnline = !!userSocketMap[to];
    if (isOnline) {
      io.to(to).emit("incoming-call", { from: userId, offer, callType, callerInfo });
    } else {
      socket.emit("call-user-offline");
    }
  });

  socket.on("call-accepted", async ({ to, answer }) => {
    const session = activeCalls.get(to);
    if (session) {
      session.status = "active";
      session.answeredAt = Date.now();
      if (session.callerRecordId && session.receiverRecordId) {
        try {
          await Call.updateMany(
            { _id: { $in: [session.callerRecordId, session.receiverRecordId] } },
            { $set: { status: "answered" } }
          );
          io.to(userId).emit("callHistoryUpdated");
          io.to(to).emit("callHistoryUpdated");
        } catch (err) {
          console.error("[Socket] Failed to update call status to answered:", err);
        }
      }
    }
    io.to(to).emit("call-accepted-by-peer", { answer });
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    io.to(to).emit("ice-candidate", { candidate });
  });

  socket.on("call-ringing", ({ to }) => {
    io.to(to).emit("call-ringing");
  });

  socket.on("call-rejected", async ({ to }) => {
    const session = activeCalls.get(to);
    if (session && session.callerRecordId && session.receiverRecordId) {
      try {
        await Call.updateMany(
          { _id: { $in: [session.callerRecordId, session.receiverRecordId] } },
          { $set: { status: "rejected" } }
        );
        io.to(userId).emit("callHistoryUpdated");
        io.to(to).emit("callHistoryUpdated");
      } catch (err) {
        console.error("[Socket] Failed to update call status to rejected:", err);
      }
    }
    activeCalls.delete(to); // to is callerId
    io.to(to).emit("call-rejected");
  });

  const handleEndCallCleanup = async (callerId) => {
    const session = activeCalls.get(callerId);
    if (!session) return;

    if (session.status === "active" && session.answeredAt) {
      const duration = Math.floor((Date.now() - session.answeredAt) / 1000);
      if (session.callerRecordId && session.receiverRecordId) {
        try {
          await Call.updateMany(
            { _id: { $in: [session.callerRecordId, session.receiverRecordId] } },
            { $set: { duration } }
          );
          // Notify both users to refresh history
          io.to(callerId).emit("callHistoryUpdated");
          io.to(session.to).emit("callHistoryUpdated");
        } catch (err) {
          console.error("[Socket] Failed to update call duration:", err);
        }
      }
    }
    activeCalls.delete(callerId);
  };

  socket.on("end-call", async ({ to }) => {
    await handleEndCallCleanup(userId); // I was the caller
    await handleEndCallCleanup(to); // Or I was the receiver (callerId = to)
    io.to(to).emit("call-ended");
  });

  socket.on("call:end", async ({ to, reason }) => {
    await handleEndCallCleanup(userId);
    await handleEndCallCleanup(to);
    io.to(to).emit("call:ended", { reason });
  });

  socket.on("call-timeout", async ({ to }) => {
    await handleEndCallCleanup(userId);
    io.to(to).emit("call-timeout");
  });

  // ─── WebRTC Call Reactions ────────────────────────────────────────────────
  socket.on("call:handRaise", ({ callId, userId: senderId, raised }) => {
    io.to(callId).emit("call:handRaise", { userId: senderId, raised });
  });

  socket.on("call:emoji", ({ callId, userId: senderId, emoji }) => {
    io.to(callId).emit("call:emoji", { userId: senderId, emoji });
  });

  socket.on("call:deviceInfo", ({ callId, device }) => {
    io.to(callId).emit("call:deviceInfo", { device });
  });

  socket.on("call:mediaStatus", ({ callId, isMuted, isCameraOff }) => {
    io.to(callId).emit("call:mediaStatus", { isMuted, isCameraOff });
  });

  // ─── WebRTC Renegotiation (Dynamic Track Additions) ───────────────────────
  socket.on("call:renegotiate", ({ callId, offer }) => {
    io.to(callId).emit("call:renegotiate", { offer });
  });

  socket.on("call:renegotiate:answer", ({ callId, answer }) => {
    io.to(callId).emit("call:renegotiate:answer", { answer });
  });

  // ─── Group Call (Mesh Topology) ───────────────────────────────────────────
  socket.on("call:addParticipants", ({ callId, from, users }) => {
    users.forEach(user => {
      const targetId = user._id || user.id || user;
      io.to(targetId).emit("call:incomingGroup", { callId, from });
    });
  });

  socket.on("call:group:offer", ({ to, from, offer }) => {
    io.to(to).emit("call:group:offer", { from, offer });
  });

  socket.on("call:group:answer", ({ to, from, answer }) => {
    io.to(to).emit("call:group:answer", { from, answer });
  });


  socket.on("call:watchPartyToggle", ({ callId, enabled }) => {
    io.to(callId).emit("call:watchPartyToggle", { enabled });
  });

  socket.on("call:group:ice", ({ to, from, candidate }) => {
    io.to(to).emit("call:group:ice", { from, candidate });
  });

  socket.on("vbrowser:navigate", ({ callId, url }) => {
    io.to(callId).emit("vbrowser:navigate", { url });
  });

  socket.on("vbrowser:start", ({ callId }) => {
    io.to(callId).emit("vbrowser:start");
  });

  socket.on("vbrowser:stop", ({ callId }) => {
    io.to(callId).emit("vbrowser:stop");
  });

  socket.on("vbrowser:controller", ({ callId, controller }) => {
    io.to(callId).emit("vbrowser:controller", { controller });
  });

  socket.on("screen:start", ({ callId }) => {
    io.to(callId).emit("screen:start");
  });

  socket.on("screen:stop", ({ callId }) => {
    io.to(callId).emit("screen:stop");
  });

  socket.on("screen:offer", ({ to, offer }) => {
    io.to(to).emit("screen:offer", { from: userId, offer });
  });

  socket.on("screen:answer", ({ to, answer }) => {
    io.to(to).emit("screen:answer", { from: userId, answer });
  });

  socket.on("screen:ice", ({ to, candidate }) => {
    io.to(to).emit("screen:ice", { from: userId, candidate });
  });

  // ─── Watch Party Events ──────────────────────────────────────────────────
  socket.on("wp:start", ({ callId, url, actionId, userId: senderId }) => {
    console.log("[Socket] wp:start", { callId, url, actionId });
    io.to(callId).emit("wp:start", { url, actionId, userId: senderId });
  });

  socket.on("wp:action", (data) => {
    // data: { callId, type, time, actionId, userId }
    io.to(data.callId).emit("wp:action", data);
  });

  socket.on("wp:heartbeat", (data) => {
    // data: { callId, time, playing, userId }
    io.to(data.callId).emit("wp:heartbeat", data);
  });

  socket.on("wp:stop", ({ callId }) => {
    console.log("[Socket] wp:stop", { callId });
    io.to(callId).emit("wp:stop");
  });

  // ─── Call heartbeat (keep-alive ping/pong) ────────────────────────────────
  socket.on("call:ping", ({ to }) => {
    io.to(to).emit("call:pong");
    socket.emit("call:pong");
  });

  // ─── QR Linked Device ─────────────────────────────────────────────────────
  socket.on("qr:join", ({ sessionId }) => {
    if (sessionId) {
      socket.join(`qr:${sessionId}`);
      console.log(`Socket ${socket.id} joined QR room qr:${sessionId}`);
    }
  });

  // ─── Re-register after popup call ends ────────────────────────────────────
  // When the call popup disconnects, userSocketMap[userId] is deleted.
  // The main window socket is still alive but unregistered.
  // It emits "re-register" so the server maps it back and user stays "online".
  socket.on("re-register", () => {
    if (userId) {
      userSocketMap[userId] = socket.id;
      io.emit("getOnlineUsers", Object.keys(userSocketMap));
      console.log(`[Socket] Re-registered ${userId} → ${socket.id}`);
    }
  });

  // ─── Disconnect ───────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.id);

    // If the disconnecting socket belongs to a caller who is currently ringing a peer, terminate it natively
    if (activeCalls.has(userId)) {
      const activeSession = activeCalls.get(userId);
      activeCalls.delete(userId);
      io.to(activeSession.to).emit("call:ended", { reason: "caller_disconnected" });
      io.to(activeSession.to).emit("call-ended"); // Backup for backward compat
    }

    // Critical: only remove from map if THIS socket is still the registered one.
    // When the call popup opens, it re-registers the same userId with a NEW socket.
    // The OLD socket then disconnects — we must NOT delete the new socket from the map.
    if (userSocketMap[userId] === socket.id) {
      delete userSocketMap[userId];
      io.emit("getOnlineUsers", Object.keys(userSocketMap));
    }
  });
});

export { io, app, server };
