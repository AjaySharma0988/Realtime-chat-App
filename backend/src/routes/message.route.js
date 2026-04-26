import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { validateIdParam } from "../middleware/validateId.middleware.js";
import {
  getUsersForSidebar,
  getMessages,
  sendMessage,
  deleteMessages,
  bulkDeleteMessages,
  editMessage,
  markMessagesAsRead,
  reactToMessage,
  uploadVideo,
} from "../controllers/message.controller.js";
import multer from "multer";

const router = express.Router();

// ─── Multer config with size + MIME enforcement ────────────────────────────
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB — watch-party videos only

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed for upload"));
    }
  },
});

// ─── Routes ────────────────────────────────────────────────────────────────
router.get("/users", protectRoute, getUsersForSidebar);

// ⚠️  /bulk and /upload-video MUST come before /:id so the literal strings
//     are not treated as MongoDB ObjectIds by validateIdParam.
router.delete("/bulk", protectRoute, bulkDeleteMessages);
router.post("/upload-video", protectRoute, upload.single("video"), uploadVideo);

// Routes with :id — ObjectId validation applied before controller
router.get("/:id", protectRoute, validateIdParam, getMessages);
router.post("/send/:id", protectRoute, validateIdParam, sendMessage);
router.delete("/:id", protectRoute, validateIdParam, deleteMessages);
router.put("/:id", protectRoute, validateIdParam, editMessage);
router.put("/mark-read/:id", protectRoute, validateIdParam, markMessagesAsRead);
router.post("/:id/react", protectRoute, validateIdParam, reactToMessage);

export default router;
