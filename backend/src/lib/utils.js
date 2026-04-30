import jwt from "jsonwebtoken";

export const generateToken = (userId, res, sessionId) => {
  const token = jwt.sign({ userId, sessionId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  res.cookie("jwt", token, {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    httpOnly: true,  // prevent XSS — JS cannot read this cookie
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax", // "lax" needed for dev cross-port (5173→5001)
    secure: process.env.NODE_ENV !== "development",
  });

  return token;
};

export const parseUA = (ua = "") => {
  const ua_ = ua.toLowerCase();
  let os = "Unknown OS";
  let browser = "Unknown Browser";

  if (ua_.includes("windows")) os = "Windows";
  else if (ua_.includes("mac os")) os = "macOS";
  else if (ua_.includes("android")) os = "Android";
  else if (ua_.includes("iphone") || ua_.includes("ipad")) os = "iOS";
  else if (ua_.includes("linux")) os = "Linux";

  if (ua_.includes("chrome") && !ua_.includes("edg")) browser = "Chrome";
  else if (ua_.includes("firefox")) browser = "Firefox";
  else if (ua_.includes("safari") && !ua_.includes("chrome")) browser = "Safari";
  else if (ua_.includes("edg")) browser = "Edge";
  else if (ua_.includes("opera") || ua_.includes("opr")) browser = "Opera";

  return { os, browser };
};

export const getDeviceType = (ua = "") => {
  const ua_ = ua.toLowerCase();
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua_)) {
    return "tablet";
  }
  if (/Mobile|iP(hone|od|ad)|Android|BlackBerry|IEMobile|Kindle|NetFront|Silk-Accelerated|(hpw|web)OS|Fennec|Minimo|Opera M(obi|ini)|Blazer|Dolfin|Dolphin|Skyfire|Zune/i.test(ua_)) {
    return "mobile";
  }
  return "desktop";
};
