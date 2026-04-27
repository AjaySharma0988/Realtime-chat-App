import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ── Regular message fields ──────────────────────────────────────────────
    text:  { type: String },
    image: { type: String },
    audio: { type: String },

    // ── Reply snapshot — embedded object so preview survives deletion ────────
    // Using type:{...}, default:null is the correct Mongoose pattern for an
    // optional nested object. This ensures replyTo===null for non-reply msgs.
    replyTo: {
      type: {
        messageId:  { type: mongoose.Schema.Types.ObjectId },
        text:       { type: String },
        senderName: { type: String },
        image:      { type: String },
      },
      default: null,     // ← null (not {}) for non-reply messages
      _id: false,        // no nested _id on the sub-document
    },
    statusRef: {
      type: {
        statusId: { type: mongoose.Schema.Types.ObjectId },
        mediaUrl: { type: String },
        mediaType: { type: String },
        caption: { type: String },
        deleted:  { type: Boolean, default: false },
      },
      default: null,
      _id: false,
    },

    // ── Call log fields (type = "call") ────────────────────────────────────
    type: {
      type: String,
      enum: ["text", "call", "status-reply"],
      default: "text",
    },
    callType:     { type: String, enum: ["audio", "video"] },
    callStatus:   { type: String, enum: ["completed", "missed", "rejected"] },
    callDuration: { type: Number, default: 0 },
    isEdited:     { type: Boolean, default: false },
    status:       { type: String, enum: ["sent", "delivered", "seen"], default: "sent" },

    // ── Emoji reactions ────────────────────────────────────────────────────
    reactions: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      emoji:  { type: String, required: true },
      _id: false,
    }],

    // ── Deletion Engine ────────────────────────────────────────────────────
    deletedFor: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    isDeletedForEveryone: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);

export default Message;
