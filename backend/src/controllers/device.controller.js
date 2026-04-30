import { v4 as uuidv4 } from "uuid";
import QRSession from "../models/qrSession.model.js";
import Session from "../models/linkedDevice.model.js";
import User from "../models/user.model.js";
import { generateToken, parseUA, getDeviceType } from "../lib/utils.js";
import { io } from "../lib/socket.js";

// UUID v4 format validator
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isValidUUID = (id) => typeof id === "string" && UUID_REGEX.test(id);

// ── GET /auth/qr-session — create a pending QR session ────────────────────
export const createQRSession = async (req, res) => {
  try {
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

    await QRSession.create({ sessionId, expiresAt });

    res.status(200).json({ sessionId, expiresAt });
  } catch (err) {
    console.error("createQRSession error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ── POST /auth/generate-qr — always create a brand-new session (no caching) ──
export const generateQRSession = async (req, res) => {
  try {
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 1000); // 60 seconds
    await QRSession.create({ sessionId, expiresAt });
    res.status(200).json({ sessionId, expiresAt });
  } catch (err) {
    console.error("generateQRSession error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ── POST /auth/link-device — authenticated user approves QR ───────────────
export const linkDevice = async (req, res) => {
  try {
    const { sessionId, deviceName } = req.body;
    const userId = req.user._id;

    if (!isValidUUID(sessionId)) {
      return res.status(400).json({ error: "Invalid session ID" });
    }

    // Sanitize deviceName length to prevent abuse
    const safeName = typeof deviceName === "string"
      ? deviceName.slice(0, 100).replace(/[<>"'&]/g, "")
      : undefined;

    const session = await QRSession.findOne({ sessionId });
    if (!session) return res.status(404).json({ message: "QR session not found" });
    if (session.status !== "pending") return res.status(400).json({ message: "QR already used or expired" });
    if (session.expiresAt < new Date()) {
      await QRSession.deleteOne({ sessionId });
      return res.status(400).json({ message: "QR code expired" });
    }

    // Mark session as approved
    session.userId = userId;
    session.status = "approved";
    await session.save();

    // Generate a new JWT as a cookie-based response (dummy token sent via socket)
    // We emit a socket event to the waiting tab to complete login
    const ua = req.headers["user-agent"] || "";
    const { os, browser } = parseUA(ua);
    const deviceType = getDeviceType(ua);
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";

    // Register the new device
    await Session.findOneAndUpdate(
      { userId, sessionId },
      { userId, sessionId, deviceName: safeName || `${browser} on ${os}`, deviceType, browser, os, ip, lastActive: new Date(), isActive: true },
      { upsert: true, new: true }
    );

    // Notify the waiting browser tab — it will receive this and auto-login
    io.to(`qr:${sessionId}`).emit("device:linked", {
      userId: userId.toString(),
      fullName: req.user.fullName,
      email: req.user.email,
      profilePic: req.user.profilePic,
    });

    res.status(200).json({ message: "Device linked successfully" });
  } catch (err) {
    console.error("linkDevice error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ── GET /auth/qr-status/:sessionId — poll QR status (fallback) ────────────
export const getQRStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!isValidUUID(sessionId)) return res.status(400).json({ status: "invalid" });
    const session = await QRSession.findOne({ sessionId });
    if (!session) return res.status(404).json({ status: "expired" });
    if (session.expiresAt < new Date()) return res.status(200).json({ status: "expired" });
    res.status(200).json({ status: session.status });
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ── GET /auth/linked-devices — list all sessions for current user ───────────
export const getLinkedDevices = async (req, res) => {
  try {
    const currentSessionId = req.sessionId;
    const sessions = await Session.find({ userId: req.user._id, isActive: true })
      .sort({ lastActive: -1 });
    
    const sessionsWithCurrent = sessions.map(s => {
      const obj = s.toObject();
      obj.isCurrent = (obj.sessionId === currentSessionId);
      return obj;
    });

    res.status(200).json({
      sessions: sessionsWithCurrent,
      totalActive: sessions.length
    });
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ── DELETE /auth/linked-devices/:sessionId — logout a session ───────────────
export const removeLinkedDevice = async (req, res) => {
  try {
    const { deviceId: sessionId } = req.params; // parameter is named deviceId in routes
    await Session.findOneAndUpdate(
      { userId: req.user._id, sessionId },
      { isActive: false }
    );

    // Real-time: Notify all user sessions about the session removal
    io.to(req.user._id.toString()).emit("session:removed", sessionId);

    // Target the specific session for termination
    io.to(sessionId).emit("session:terminated", { message: "Your session has been terminated remotely." });
    
    // Optional: Force disconnect the socket(s) in that session room after a short delay
    // to allow the client to receive the event.
    setTimeout(async () => {
       const sockets = await io.in(sessionId).fetchSockets();
       sockets.forEach(s => s.disconnect());
    }, 500);

    res.status(200).json({ message: "Session removed" });
  } catch (err) {
    console.error("removeLinkedDevice error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ── PATCH /auth/linked-devices/:sessionId — update last active ─────────────
export const updateDeviceActivity = async (req, res) => {
  try {
    const { deviceId: sessionId } = req.params;
    await Session.findOneAndUpdate(
      { userId: req.user._id, sessionId },
      { lastActive: new Date() }
    );
    res.status(200).json({ message: "Updated" });
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ── POST /auth/qr-login — exchange approved QR sessionId for JWT ──────────
export const qrLogin = async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: "sessionId is required" });
    if (!isValidUUID(sessionId)) return res.status(400).json({ error: "Invalid session ID" });

    const session = await QRSession.findOne({ sessionId });
    if (!session) return res.status(400).json({ message: "QR session not found" });
    if (session.expiresAt < new Date()) {
      await QRSession.deleteOne({ sessionId });
      return res.status(400).json({ message: "QR code expired" });
    }
    if (session.status !== "approved") {
      return res.status(400).json({ message: "QR not yet scanned" });
    }

    const user = await User.findById(session.userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    // Issue JWT cookie so the browser is authenticated
    generateToken(user._id, res, session.sessionId);

    // Consume session so it can't be replayed
    await QRSession.deleteOne({ sessionId });

    res.status(200).json(user);
  } catch (err) {
    console.error("qrLogin error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
