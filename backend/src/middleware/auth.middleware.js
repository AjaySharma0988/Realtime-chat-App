import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import Session from "../models/linkedDevice.model.js";

export const protectRoute = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;

    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      // Catches TokenExpiredError, JsonWebTokenError, NotBeforeError
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!decoded?.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [user, session] = await Promise.all([
      User.findById(decoded.userId).select("-password"),
      decoded.sessionId 
        ? Session.findOneAndUpdate(
            { userId: decoded.userId, sessionId: decoded.sessionId, isActive: true },
            { lastActive: new Date() },
            { new: true }
          )
        : Promise.resolve(true) // Fallback for legacy tokens without sessionId
    ]);

    if (!user || !session) {
      return res.status(401).json({ error: "Unauthorized: Session expired or invalid" });
    }

    req.user = user;
    req.sessionId = decoded.sessionId;
    req.deviceId = decoded.deviceId;
    next();
  } catch (error) {
    console.error("Error in protectRoute middleware:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
