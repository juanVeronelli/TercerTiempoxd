import { Router } from "express";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { getActionsNowController, markActionsSeenController } from "../controllers/actionNowController.js";

const router = Router();

router.get("/now", authenticateToken, getActionsNowController);
router.post("/seen", authenticateToken, markActionsSeenController);

export default router;

