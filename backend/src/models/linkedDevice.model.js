import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  sessionId:  { type: String, required: true, unique: true }, // unique identifier for the session
  deviceName: { type: String, default: "Unknown Device" },
  deviceType: { type: String, enum: ["mobile", "desktop", "tablet"], default: "desktop" },
  browser:    { type: String, default: "" },
  os:         { type: String, default: "" },
  ip:         { type: String, default: "" },
  lastActive: { type: Date, default: Date.now },
  isActive:   { type: Boolean, default: true },
}, { timestamps: true });

sessionSchema.index({ userId: 1, isActive: 1 });

const Session = mongoose.model("Session", sessionSchema);
export default Session;
