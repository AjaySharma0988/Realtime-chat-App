/**
 * validateId.middleware.js
 * Guards all :id route params against invalid / injected ObjectId strings
 * that would otherwise cause Mongoose to throw CastErrors or allow
 * operator injection via the URL.
 */
import mongoose from "mongoose";

export const validateIdParam = (req, res, next) => {
  const { id } = req.params;

  // Some routes use /mark-read/:id — id will be undefined for non-param routes; skip.
  if (!id) return next();

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid ID parameter" });
  }

  next();
};
