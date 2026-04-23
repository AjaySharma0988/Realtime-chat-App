import mongoose from "mongoose";

const linkedDeviceSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  deviceId:   { type: String, required: true },       // fingerprint or uuid stored on device
  deviceName: { type: String, default: "Unknown Device" },
  browser:    { type: String, default: "" },
  os:         { type: String, default: "" },
  lastActive: { type: Date, default: Date.now },
  isActive:   { type: Boolean, default: true },
}, { timestamps: true });

linkedDeviceSchema.index({ userId: 1, deviceId: 1 }, { unique: true });

const LinkedDevice = mongoose.model("LinkedDevice", linkedDeviceSchema);
export default LinkedDevice;
