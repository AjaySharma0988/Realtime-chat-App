import Call from "../models/call.model.js";
import User from "../models/user.model.js";

export const getCallHistory = async (req, res) => {
  try {
    const userId = req.user._id;

    const history = await Call.find({ userId })
      .populate("peerId", "fullName profilePic")
      .sort({ timestamp: -1 });

    res.status(200).json(history);
  } catch (error) {
    console.error("Error in getCallHistory:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createCallEntry = async (req, res) => {
  try {
    const { peerId, type, status, callType, duration, timestamp } = req.body;
    const userId = req.user._id;

    const newCall = new Call({
      userId,
      peerId,
      type,
      status,
      callType,
      duration,
      timestamp: timestamp || Date.now(),
    });

    await newCall.save();
    res.status(201).json(newCall);
  } catch (error) {
    console.error("Error in createCallEntry:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteCallHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    await Call.deleteMany({ userId });
    res.status(200).json({ message: "Call history cleared" });
  } catch (error) {
    console.error("Error in deleteCallHistory:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
