import { Router } from "express";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { deleteMyAccount } from "../controllers/userController.js";

const router = Router();

router.delete("/me", authenticateToken, deleteMyAccount);

export default router;
