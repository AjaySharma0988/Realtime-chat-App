import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { connectDB } from "./lib/db.js";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import callRoutes from "./routes/call.route.js";
import statusRoutes from "./routes/status.routes.js";
import { app, server } from "./lib/socket.js";
import { sanitizeRequest } from "./middleware/sanitize.middleware.js";
import { initStatusPruner } from "./lib/statusPruner.js";

const PORT = process.env.PORT || 5001;
const __dirname = path.resolve();

// ─── Security: HTTP headers + Content-Security-Policy ─────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // allow Cloudinary images
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'self'"],
        scriptSrc:   ["'self'", "'unsafe-inline'"],   // React needs inline scripts in dev
        styleSrc:    ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc:     ["'self'", "https://fonts.gstatic.com"],
        imgSrc:      ["'self'", "data:", "blob:", "https://res.cloudinary.com"],
        mediaSrc:    ["'self'", "blob:", "https://res.cloudinary.com"],
        connectSrc:  ["'self'", "wss:", "ws:", "https://res.cloudinary.com"],
        frameSrc:    ["'none'"],
        objectSrc:   ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === "production" ? [] : null,
      },
    },
  })
);

// ─── Security: Rate limiting ───────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts, please try again later." },
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Upload limit reached, please try again later." },
});

app.use(generalLimiter);

// ─── Body parsing: 50 MB cap for media uploads ───────────────────────────
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());

// ─── CORS ─────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.FRONTEND_URL
        : "http://localhost:5173",
    credentials: true,
  })
);

// ─── Security: NoSQL injection sanitizer (global) ─────────────────────────
app.use(sanitizeRequest);

// ─── Routes ────────────────────────────────────────────────────────────────
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/signup", authLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/calls", callRoutes);
app.use("/api/status", statusRoutes);

// Video upload has its own tighter rate limit
app.use("/api/messages/upload-video", uploadLimiter);

// ─── Global error handler — never leak stack traces ───────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("[GlobalError]", err.message);
  res.status(500).json({ error: "Internal Server Error" });
});

// ─── Production: serve built frontend ─────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "frontend/dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"));
  });
}

// ─── Start ─────────────────────────────────────────────────────────────────
const startServer = async () => {
  await connectDB();
  initStatusPruner();
  server.listen(PORT, () => {
    console.log("Server is running on PORT: " + PORT);
  });
};

startServer();
