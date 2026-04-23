import mongoose from "mongoose";

const qrSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  status:    { type: String, enum: ["pending", "approved", "expired"], default: "pending" },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

// Auto-expire documents from MongoDB after expiresAt
qrSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const QRSession = mongoose.model("QRSession", qrSessionSchema);
export default QRSession;
