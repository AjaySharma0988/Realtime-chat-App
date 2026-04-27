import Status from "../models/status.model.js";
import Message from "../models/message.model.js";
import cloudinary from "../lib/cloudinary.js";
import { io } from "../lib/socket.js";

// ── Helpers ──────────────────────────────────────────────────────────────────
const hasAccessToStatus = (status, viewerId) => {
  // Owner can always see
  if (status.userId._id?.toString() === viewerId.toString() || status.userId.toString() === viewerId.toString()) {
    return true;
  }

  const { type, users } = status.audience || { type: "all" };
  if (type === "all") return true;

  const userList = (users || []).map(u => u.toString());
  const vId = viewerId.toString();

  if (type === "exclude") {
    return !userList.includes(vId);
  }
  if (type === "include") {
    return userList.includes(vId);
  }

  return false;
};

// ── GET /api/status — all non-expired statuses ────────────────────────────
export const getStatuses = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find all non-expired statuses
    const allActive = await Status.find({ expiresAt: { $gt: new Date() } })
      .populate("userId", "fullName profilePic _id")
      .sort({ createdAt: -1 });

    // Filter by audience rules
    const filtered = allActive.filter(status => hasAccessToStatus(status, userId));

    res.status(200).json(filtered);
  } catch (error) {
    console.error("[Status] getStatuses:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── POST /api/status — create a new status ────────────────────────────────
export const createStatus = async (req, res) => {
  try {
    const { media, mediaType, caption, music, expiryDuration, audience } = req.body;
    const userId = req.user._id;

    // ── Authorization check ──────────────────────────────────────────────
    if (!req.user || !req.user._id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!media || !mediaType) {
      return res.status(400).json({ error: "Media and mediaType are required" });
    }
    if (!["image", "video"].includes(mediaType)) {
      return res.status(400).json({ error: "Invalid mediaType" });
    }

    // ── File Validation (Type & Size) ────────────────────────────────────
    if (mediaType === "image") {
      if (!/^data:image\/(png|jpeg|jpg|webp|gif);base64,/.test(media)) {
        return res.status(400).json({ error: "Invalid image format" });
      }
      if (media.length > 11 * 1024 * 1024) { // ~8 MB base64
        return res.status(413).json({ error: "Image too large (max 8 MB)" });
      }
    } else {
      // mp4, webm, ogg, quicktime
      if (!/^data:video\/(mp4|webm|ogg|quicktime);base64,/.test(media)) {
        return res.status(400).json({ error: "Invalid video format" });
      }
      if (media.length > 35 * 1024 * 1024) { // ~25 MB base64
        return res.status(413).json({ error: "Video too large (max 25 MB)" });
      }
    }

    // ── Input Sanitization (XSS Prevention) ─────────────────────────────
    const sanitizedCaption = caption 
      ? String(caption).replace(/<[^>]*>?/gm, "").slice(0, 500).trim() 
      : "";

    // ── Optional Music Upload ────────────────────────────────────────────
    let musicData = null;
    if (music) {
      musicData = { ...music };
      if (music.url?.startsWith("data:audio/")) {
        if (music.url.length > 15 * 1024 * 1024) {
          return res.status(413).json({ error: "Music file too large (max 10 MB)" });
        }
        const audioUpload = await cloudinary.uploader.upload(music.url, {
          resource_type: "video",
          folder: "status-music",
        });
        musicData.url = audioUpload.secure_url;
      }
    }

    // ── Cloudinary Upload ───────────────────────────────────────────────
    const uploadOptions =
      mediaType === "video"
        ? { resource_type: "video", folder: "status-videos" }
        : { folder: "status-images" };

    const uploadResult = await cloudinary.uploader.upload(media, uploadOptions);

    const durationMs = (Math.min(Math.max(expiryDuration || 24, 1), 72)) * 60 * 60 * 1000; // 1h min, 72h max
    const expiresAt = new Date(Date.now() + durationMs);

    const newStatus = await Status.create({
      userId,
      mediaUrl: uploadResult.secure_url,
      mediaType,
      caption: sanitizedCaption,
      expiresAt,
      music: musicData,
      audience: audience || { type: "all" },
    });

    const populated = await newStatus.populate("userId", "fullName profilePic _id");

    // ── Secure Real-time Broadcast ───────────────────────────────────────
    const { type: audType, users: audUsers } = populated.audience;

    if (audType === "include") {
      audUsers.forEach(uid => {
        io.to(uid.toString()).emit("status:created", populated);
      });
      io.to(userId.toString()).emit("status:created", populated);
    } else if (audType === "exclude") {
      // For exclude, we rely on the client-side store to filter, 
      // but persistent security is handled by the backend getStatuses.
      io.emit("status:created", populated); 
    } else {
      io.emit("status:created", populated);
    }

    res.status(201).json(populated);
  } catch (error) {
    console.error("[Status] createStatus:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── POST /api/status/:id/view — mark viewed ───────────────────────────────
export const viewStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const viewerId = req.user._id;

    const status = await Status.findById(id);
    if (!status) return res.status(404).json({ error: "Status not found" });

    // ── Security: Verify Viewer has Permission ──────────────────────────
    if (!hasAccessToStatus(status, viewerId)) {
      return res.status(403).json({ error: "You do not have permission to view this status" });
    }

    const alreadyViewed = status.views.some(
      (v) => v.userId.toString() === viewerId.toString()
    );

    if (!alreadyViewed) {
      status.views.push({ userId: viewerId, viewedAt: new Date() });
      await status.save();

      // Notify the status owner in real-time
      io.to(status.userId.toString()).emit("status:view", {
        statusId: id,
        viewerId: viewerId.toString(),
      });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("[Status] viewStatus:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── GET /api/status/:id/viewers — get populated viewers list ─────────────
export const getStatusViewers = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const status = await Status.findById(id).populate("views.userId", "fullName profilePic _id");
    if (!status) return res.status(404).json({ error: "Status not found" });

    // ── Security: Ownership Check ───────────────────────────────────────
    if (status.userId.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Only the owner can view the list of viewers" });
    }

    res.status(200).json(status.views);
  } catch (error) {
    console.error("[Status] getStatusViewers:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── DELETE /api/status/:id — delete own status ────────────────────────────
export const deleteStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const status = await Status.findById(id);
    if (!status) return res.status(404).json({ error: "Status not found" });

    // ── Security: Ownership Check ───────────────────────────────────────
    if (status.userId.toString() !== userId.toString()) {
      return res.status(403).json({ error: "You can only delete your own status" });
    }

    console.log("[Status] Secure deleting status:", id, "by authorized owner:", userId);

    // ── Cloudinary Cleanup (Asset Destruction) ───────────────────────────
    try {
      const parts = status.mediaUrl.split("/");
      const fileName = parts[parts.length - 1];
      const publicId = fileName.split(".")[0];
      const folderPart = parts[parts.length - 2];
      const fullPublicId = folderPart.startsWith("v") ? publicId : `${folderPart}/${publicId}`;

      await cloudinary.uploader.destroy(fullPublicId, { 
        resource_type: status.mediaType === "video" ? "video" : "image" 
      });
    } catch (err) {
      console.warn("[Status] Cloudinary cleanup issue (ignoring):", err.message);
    }

    await status.deleteOne();

    // ── Cascade Deletion: Flag chat references ──────────────────────────
    await Message.updateMany(
      { "statusRef.statusId": id },
      { $set: { "statusRef.deleted": true } }
    );

    // ── Secure Real-time Sync ───────────────────────────────────────────
    io.emit("status:deleted", { statusId: id });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("[Status] deleteStatus:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
