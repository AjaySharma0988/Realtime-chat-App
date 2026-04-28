import express from "express";
import { checkAuth, login, logout, signup, updateProfile, deleteAccount, restoreAccount, updatePrivacySettings } from "../controllers/auth.controller.js";
import {
  createQRSession,
  linkDevice,
  qrLogin,
  getQRStatus,
  getLinkedDevices,
  removeLinkedDevice,
  generateQRSession,
} from "../controllers/device.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);

router.put("/update-profile", protectRoute, updateProfile);
router.put("/privacy", protectRoute, updatePrivacySettings);
router.get("/check", protectRoute, checkAuth);
router.delete("/delete-account", protectRoute, deleteAccount);
router.post("/restore-account", protectRoute, restoreAccount);

// ── Linked Devices / QR ────────────────────────────────────────────────────
router.get("/qr-session", createQRSession);                                      // public — generate QR
router.post("/qr-login", qrLogin);                                               // public — exchange QR for JWT
router.post("/generate-qr", generateQRSession);                                  // always fresh, no browser cache
router.get("/qr-status/:sessionId", getQRStatus);                                // public — poll
router.post("/link-device", protectRoute, linkDevice);                           // auth required
router.get("/linked-devices", protectRoute, getLinkedDevices);                   // auth required
router.delete("/linked-devices/:deviceId", protectRoute, removeLinkedDevice);    // auth required

export default router;
