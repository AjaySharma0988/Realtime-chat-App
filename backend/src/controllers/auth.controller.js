import { generateToken, parseUA, getDeviceType } from "../lib/utils.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import cloudinary from "../lib/cloudinary.js";
import Message from "../models/message.model.js";
import Session from "../models/linkedDevice.model.js";
import { v4 as uuidv4 } from "uuid";

// ─── Dummy hash — used for constant-time comparison when user doesn't exist ─
// Prevents timing-based username enumeration attacks.
const DUMMY_HASH = "$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012345";

export const signup = async (req, res) => {
  const { fullName, email, password, profilePic } = req.body;
  try {
    if (!fullName || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const user = await User.findOne({ email });
    if (user) return res.status(400).json({ error: "Email already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let imageUrl = "";
    if (profilePic) {
      // Basic base64 format check before sending to Cloudinary
      if (!/^data:image\/(png|jpeg|jpg|webp|gif);base64,/.test(profilePic)) {
        return res.status(400).json({ error: "Invalid image format" });
      }
      const uploadResponse = await cloudinary.uploader.upload(profilePic, {
        folder: "profile-pics",
        resource_type: "image",
      });
      imageUrl = uploadResponse.secure_url;
    }

    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
      profilePic: imageUrl,
    });

    if (newUser) {
      const sessionId = uuidv4();
      const ua = req.headers["user-agent"] || "";
      const { os, browser } = parseUA(ua);
      const deviceType = getDeviceType(ua);
      const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
      
      await Session.create({
        userId: newUser._id,
        sessionId,
        deviceName: `${browser} on ${os}`,
        deviceType,
        browser,
        os,
        ip,
        lastActive: new Date(),
        isActive: true
      });

      generateToken(newUser._id, res, sessionId);
      await newUser.save();

      res.status(201).json({
        _id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        profilePic: newUser.profilePic,
        sessionId,
      });
    } else {
      res.status(400).json({ error: "Invalid user data" });
    }
  } catch (error) {
    console.error("Error in signup controller", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    // Explicitly select password since it's excluded by default (select: false)
    const user = await User.findOne({ email }).select("+password");

    // Timing-safe: always run bcrypt even if user not found (prevents enumeration)
    const hashToCompare = user ? user.password : DUMMY_HASH;
    const isPasswordCorrect = await bcrypt.compare(password, hashToCompare);

    if (!user || !isPasswordCorrect) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.deletionScheduledAt) {
      const daysDiff = (Date.now() - new Date(user.deletionScheduledAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > 15) {
        await Message.deleteMany({
          $or: [{ senderId: user._id }, { receiverId: user._id }],
        });
        await User.findByIdAndDelete(user._id);
        return res.status(401).json({ error: "Invalid credentials" });
      }
    }

    const sessionId = uuidv4();
    const ua = req.headers["user-agent"] || "";
    const { os, browser } = parseUA(ua);
    const deviceType = getDeviceType(ua);
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";

    const newSession = await Session.create({
      userId: user._id,
      sessionId,
      deviceName: `${browser} on ${os}`,
      deviceType,
      browser,
      os,
      ip,
      lastActive: new Date(),
      isActive: true
    });

    generateToken(user._id, res, sessionId);

    // Real-time: Notify all user sessions about the new session
    const { io } = await import("../lib/socket.js");
    io.to(user._id.toString()).emit("session:added", newSession);

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
      deletionScheduledAt: user.deletionScheduledAt,
      sessionId,
    });
  } catch (error) {
    console.error("Error in login controller", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const logout = async (req, res) => {
  try {
    if (req.sessionId) {
      await Session.findOneAndUpdate(
        { userId: req.user._id, sessionId: req.sessionId },
        { isActive: false }
      );
    }
    res.cookie("jwt", "", { maxAge: 0 });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Error in logout controller", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { profilePic, fullName, about } = req.body;
    const userId = req.user._id;

    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (about !== undefined) updateData.about = about;

    if (profilePic) {
      // Enforce valid base64 image before uploading
      if (!/^data:image\/(png|jpeg|jpg|webp|gif);base64,/.test(profilePic)) {
        return res.status(400).json({ error: "Invalid image format" });
      }

      const uploadResponse = await cloudinary.uploader.upload(profilePic, {
        folder: "profile-pics",
        resource_type: "image",
      });
      updateData.profilePic = uploadResponse.secure_url;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No update data provided" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    );

    // Real-time: Notify all online users about the profile update
    const { io } = await import("../lib/socket.js");
    io.emit("profileUpdated", {
      _id: updatedUser._id,
      fullName: updatedUser.fullName,
      profilePic: updatedUser.profilePic,
      about: updatedUser.about,
    });

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Error in update profile:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const checkAuth = (req, res) => {
  try {
    if (req.user.deletionScheduledAt) {
      const daysDiff = (Date.now() - new Date(req.user.deletionScheduledAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > 15) {
        return res.status(401).json({ error: "Unauthorized" });
      }
    }
    res.status(200).json({
      ...req.user.toObject(),
      deviceId: req.deviceId
    });
  } catch (error) {
    console.error("Error in checkAuth controller", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    await User.findByIdAndUpdate(userId, { deletionScheduledAt: new Date() });
    res.cookie("jwt", "", { maxAge: 0 });
    res.status(200).json({ message: "Account scheduled for deletion. You have 15 days to restore it." });
  } catch (error) {
    console.error("Error in deleteAccount controller", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const restoreAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    await User.findByIdAndUpdate(userId, { deletionScheduledAt: null });
    res.status(200).json({ message: "Account restored successfully" });
  } catch (error) {
    console.error("Error in restoreAccount controller", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updatePrivacySettings = async (req, res) => {
  try {
    const { profilePhotoVisibility, allowedUsers } = req.body;
    const userId = req.user._id;

    const VALID_VISIBILITY = ["everyone", "nobody", "custom"];
    if (profilePhotoVisibility && !VALID_VISIBILITY.includes(profilePhotoVisibility)) {
      return res.status(400).json({ error: "Invalid visibility value" });
    }

    const updateData = {};
    if (profilePhotoVisibility) {
      updateData["privacy.profilePhotoVisibility"] = profilePhotoVisibility;
    }
    if (Array.isArray(allowedUsers)) {
      updateData["privacy.allowedUsers"] = allowedUsers;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No privacy settings provided" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true }
    ).select("-password");

    // Real-time: Notify everyone about the privacy update
    const { io } = await import("../lib/socket.js");
    io.emit("profilePhotoPrivacyUpdated", { userId });

    res.status(200).json(updatedUser);
  } catch (error) {
    console.log("Error in updatePrivacySettings controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateNotificationSettings = async (req, res) => {
  try {
    const { popupsEnabled, soundEnabled, soundType, customSoundUrl } = req.body;
    const userId = req.user._id;

    const updateData = {};
    if (popupsEnabled !== undefined) updateData["notificationSettings.popupsEnabled"] = popupsEnabled;
    if (soundEnabled !== undefined) updateData["notificationSettings.soundEnabled"] = soundEnabled;
    if (soundType !== undefined) {
      if (!["default", "custom", "mute"].includes(soundType)) {
        return res.status(400).json({ error: "Invalid sound type" });
      }
      updateData["notificationSettings.soundType"] = soundType;
    }

    if (customSoundUrl !== undefined) {
      // Basic check for audio data URI
      if (customSoundUrl && /^data:audio\/(mp3|wav|ogg|mpeg|webm|mp4);base64,/.test(customSoundUrl)) {
        const uploadResponse = await cloudinary.uploader.upload(customSoundUrl, {
          folder: "notification-sounds",
          resource_type: "video", // Cloudinary treats audio as video for uploads
        });
        updateData["notificationSettings.customSoundUrl"] = uploadResponse.secure_url;
      } else {
         updateData["notificationSettings.customSoundUrl"] = customSoundUrl;
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true }
    ).select("-password");

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Error in updateNotificationSettings controller:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

