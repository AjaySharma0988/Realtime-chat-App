import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getCallHistory, createCallEntry, deleteCallHistory } from "../controllers/call.controller.js";

const router = express.Router();

router.get("/", protectRoute, getCallHistory);
router.post("/", protectRoute, createCallEntry);
router.delete("/", protectRoute, deleteCallHistory);

export default router;
