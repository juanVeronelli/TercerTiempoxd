import { Router } from "express";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import {
  getAchievementsCatalog,
  getMyAchievements,
  getMyCosmetics,
} from "../controllers/achievementController.js";

const router = Router();

// Catálogo público (todos pueden ver los logros)
router.get("/", getAchievementsCatalog);

// Rutas protegidas
router.get("/me", authenticateToken, getMyAchievements);
router.get("/me/cosmetics", authenticateToken, getMyCosmetics);

export default router;
