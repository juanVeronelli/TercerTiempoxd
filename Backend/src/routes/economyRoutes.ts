import { Router } from "express";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { claimDailyFreeTtp, getTtpSummary } from "../controllers/economyController.js";

const router = Router();

router.get("/ttp", authenticateToken, getTtpSummary);
router.post("/ttp/daily-free/claim", authenticateToken, claimDailyFreeTtp);

export default router;
