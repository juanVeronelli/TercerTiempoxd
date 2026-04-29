import { Router } from "express";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { validateRequest } from "../middlewares/validationMiddleware.js";
import { predictionSchema, removePredictionSchema } from "../schemas/predictionSchemas.js";
import {
  getLeaguePredictions,
  submitPrediction,
  removePrediction,
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
router.post(
  "/remove",
  authenticateToken,
  validateRequest(removePredictionSchema),
  removePrediction,
);

export default router;
