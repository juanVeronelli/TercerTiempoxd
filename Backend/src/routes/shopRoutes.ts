import { Router } from "express";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import {
  getConsumableStacks,
  getShopItems,
  postConsumableActivate,
  postShopPurchase,
} from "../controllers/shopController.js";

const router = Router();

router.get("/items", authenticateToken, getShopItems);
router.get("/consumables", authenticateToken, getConsumableStacks);
router.post("/activate", authenticateToken, postConsumableActivate);
router.post("/purchase", authenticateToken, postShopPurchase);

export default router;
