import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
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
const upload = multer({ storage: multer.memoryStorage() });

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/:id", protectRoute, getMessages);
router.post("/send/:id", protectRoute, sendMessage);
// ⚠️ /bulk MUST come before /:id so "bulk" is not treated as a MongoDB ObjectId
router.delete("/bulk", protectRoute, bulkDeleteMessages);
router.delete("/:id", protectRoute, deleteMessages);
// Edit a specific message (sender only)
router.put("/:id", protectRoute, editMessage);
// Mark messages as read for a specific user
router.put("/mark-read/:id", protectRoute, markMessagesAsRead);
// Emoji reaction toggle
router.post("/:id/react", protectRoute, reactToMessage);

// Video upload for Watch Party
router.post("/upload-video", protectRoute, upload.single("video"), uploadVideo);

export default router;
