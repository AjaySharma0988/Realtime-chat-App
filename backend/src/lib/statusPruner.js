import cron from "node-cron";
import Status from "../models/status.model.js";
import Message from "../models/message.model.js";
import cloudinary from "./cloudinary.js";
import { io } from "./socket.js";

/**
 * Status Pruner — Background job to auto-delete expired statuses.
 * Runs every hour.
 */
export const initStatusPruner = () => {
  console.log("[StatusPruner] Initialized");

  // Run every 10 minutes to ensure timely deletion
  cron.schedule("*/10 * * * *", async () => {
    try {
      const now = new Date();
      const expired = await Status.find({ expiresAt: { $lt: now } });

      if (expired.length === 0) return;

      console.log(`[StatusPruner] Pruning ${expired.length} expired statuses...`);

      for (const status of expired) {
        // ── 1. Cleanup Cloudinary ──────────────────────────────────────────
        try {
          // Extract public_id from URL
          const parts = status.mediaUrl.split("/");
          const filename = parts[parts.length - 1].split(".")[0];
          const folder = status.mediaType === "video" ? "status-videos" : "status-images";
          const publicId = `${folder}/${filename}`;

          await cloudinary.uploader.destroy(publicId, { 
            resource_type: status.mediaType === "video" ? "video" : "image" 
          });

          if (status.music?.url?.includes("cloudinary")) {
            const musicParts = status.music.url.split("/");
            const mFilename = musicParts[musicParts.length - 1].split(".")[0];
            await cloudinary.uploader.destroy(`status-music/${mFilename}`, { resource_type: "video" });
          }
        } catch (err) {
          console.warn(`[StatusPruner] Media cleanup failed for ${status._id}:`, err.message);
        }

        // ── 2. Delete from DB ─────────────────────────────────────────────
        await status.deleteOne();

        // ── 3. Flag chat messages as deleted ──────────────────────────────
        await Message.updateMany(
          { "statusRef.statusId": status._id },
          { $set: { "statusRef.deleted": true } }
        );

        // ── 4. Notify via Socket ──────────────────────────────────────────
        io.emit("status:delete", { statusId: status._id });
      }

      console.log("[StatusPruner] Pruning complete");
    } catch (error) {
      console.error("[StatusPruner] Error during pruning:", error.message);
    }
  });
};
