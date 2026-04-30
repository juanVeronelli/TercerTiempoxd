import { Router } from "express";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import {
  claimMissionController,
  getMyMissionsController,
  markPopupSeenController,
} from "../controllers/missionController.js";

const router = Router();

router.get("/me", authenticateToken, getMyMissionsController);
router.post("/popup-seen", authenticateToken, markPopupSeenController);
router.post("/claim", authenticateToken, claimMissionController);

export default router;

