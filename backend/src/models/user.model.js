import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false, // Never returned in queries unless explicitly projected
    },
    profilePic: {
      type: String,
      default: "",
    },
    about: {
      type: String,
      default: "Hey there! I am using Chatty.",
    },
    privacy: {
      profilePhotoVisibility: {
        type: String,
        enum: ["everyone", "nobody", "custom"],
        default: "everyone",
      },
      allowedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      }],
    },
    deletionScheduledAt: {
      type: Date,
      default: null,
    },
    notificationSettings: {
      popupsEnabled: { type: Boolean, default: true },
      soundEnabled: { type: Boolean, default: true },
      soundType: {
        type: String,
        enum: ["default", "custom", "mute"],
        default: "default",
      },
      customSoundUrl: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
