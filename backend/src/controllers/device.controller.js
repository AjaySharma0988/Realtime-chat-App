import { v4 as uuidv4 } from "uuid";
import QRSession from "../models/qrSession.model.js";
import LinkedDevice from "../models/linkedDevice.model.js";
import User from "../models/user.model.js";
import { generateToken } from "../lib/utils.js";
import { io } from "../lib/socket.js";

// ── Helpers ────────────────────────────────────────────────────────────────
const parseUA = (ua = "") => {
  const ua_ = ua.toLowerCase();
  let os = "Unknown OS";
  let browser = "Unknown Browser";

  if (ua_.includes("windows")) os = "Windows";
  else if (ua_.includes("mac os")) os = "macOS";
  else if (ua_.includes("android")) os = "Android";
  else if (ua_.includes("iphone") || ua_.includes("ipad")) os = "iOS";
  else if (ua_.includes("linux")) os = "Linux";

  if (ua_.includes("chrome") && !ua_.includes("edg")) browser = "Chrome";
  else if (ua_.includes("firefox")) browser = "Firefox";
  else if (ua_.includes("safari") && !ua_.includes("chrome")) browser = "Safari";
  else if (ua_.includes("edg")) browser = "Edge";
  else if (ua_.includes("opera") || ua_.includes("opr")) browser = "Opera";

  return { os, browser };
};

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
    const { os, browser } = parseUA(req.headers["user-agent"]);

    // Register the new device
    await LinkedDevice.findOneAndUpdate(
      { userId, deviceId: sessionId },
      { userId, deviceId: sessionId, deviceName: deviceName || `${browser} on ${os}`, browser, os, lastActive: new Date(), isActive: true },
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
    const session = await QRSession.findOne({ sessionId });
    if (!session) return res.status(404).json({ status: "expired" });
    if (session.expiresAt < new Date()) return res.status(200).json({ status: "expired" });
    res.status(200).json({ status: session.status });
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ── GET /auth/linked-devices — list all devices for current user ───────────
export const getLinkedDevices = async (req, res) => {
  try {
    const devices = await LinkedDevice.find({ userId: req.user._id, isActive: true })
      .sort({ lastActive: -1 });
    res.status(200).json(devices);
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ── DELETE /auth/linked-devices/:deviceId — logout a device ───────────────
export const removeLinkedDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    await LinkedDevice.findOneAndUpdate(
      { userId: req.user._id, deviceId },
      { isActive: false }
    );
    res.status(200).json({ message: "Device removed" });
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ── PATCH /auth/linked-devices/:deviceId — update last active ─────────────
export const updateDeviceActivity = async (req, res) => {
  try {
    const { deviceId } = req.params;
    await LinkedDevice.findOneAndUpdate(
      { userId: req.user._id, deviceId },
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
    if (!sessionId) return res.status(400).json({ message: "sessionId is required" });

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
    generateToken(user._id, res);

    // Consume session so it can't be replayed
    await QRSession.deleteOne({ sessionId });

    res.status(200).json(user);
  } catch (err) {
    console.error("qrLogin error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
