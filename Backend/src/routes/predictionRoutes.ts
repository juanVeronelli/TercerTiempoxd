import { Router } from "express";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { validateRequest } from "../middlewares/validationMiddleware.js";
import { predictionSchema } from "../schemas/predictionSchemas.js";
import {
  getLeaguePredictions,
  submitPrediction,
} from "../controllers/predictionController.js";

const router = Router();

router.get(
  "/league/:leagueId",
  authenticateToken,
  getLeaguePredictions,
);
router.post(
  "/submit",
  authenticateToken,
  validateRequest(predictionSchema),
  submitPrediction,
);

export default router;
