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
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
