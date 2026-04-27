import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  getStatuses,
  createStatus,
  viewStatus,
  deleteStatus,
  getStatusViewers,
} from "../controllers/status.controller.js";

const router = express.Router();

// All status endpoints require a valid session
router.get("/", protectRoute, getStatuses);
router.post("/", protectRoute, createStatus);
router.post("/:id/view", protectRoute, viewStatus);
router.get("/:id/viewers", protectRoute, getStatusViewers);
router.delete("/:id", protectRoute, deleteStatus);

export default router;
