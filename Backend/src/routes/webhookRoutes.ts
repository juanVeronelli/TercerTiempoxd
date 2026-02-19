import { Router } from "express";
import { revenueCatWebhook } from "../controllers/webhookController.js";

const router = Router();

// Webhook de RevenueCat (sin auth; RevenueCat envía POST directo)
// Opcional: validar Authorization Bearer con REVENUECAT_WEBHOOK_SECRET
router.post("/revenuecat", revenueCatWebhook);

export default router;
