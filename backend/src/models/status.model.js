import mongoose from "mongoose";

const statusSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    mediaUrl: {
      type: String,
      required: true,
    },
    mediaType: {
      type: String,
      enum: ["image", "video"],
      required: true,
    },
    caption: {
      type: String,
      default: "",
      maxlength: 500,
    },
    views: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        viewedAt: { type: Date, default: Date.now },
      },
    ],
    // TTL field — MongoDB auto-deletes documents when expiresAt is reached
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
    music: {
      url: { type: String },
      title: { type: String },
      duration: { type: String },
      thumbnail: { type: String },
      isLocal: { type: Boolean, default: false },
    },
    audience: {
      type: { 
        type: String, 
        enum: ["all", "exclude", "include"], 
        default: "all" 
      },
      users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    },
  },
  { timestamps: true }
);

const Status = mongoose.model("Status", statusSchema);
export default Status;
