import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    console.error("\n==> ACTION REQUIRED: Go to https://cloud.mongodb.com → Network Access → Add IP Address → Add Your Current IP (or 0.0.0.0/0 for all)");
    process.exit(1); // Exit so you know immediately instead of serving a broken app
  }
};
