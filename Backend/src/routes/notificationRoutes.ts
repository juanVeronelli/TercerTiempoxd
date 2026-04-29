import { Router } from "express";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import {
  list,
  markRead,
  markAllRead,
  unreadCount,
  testTrigger,
  deleteOne,
  deleteAllRead,
} from "../controllers/notificationController.js";

const router = Router();

// Rutas que no son /:id para evitar que "read-all", "unread-count", "test-trigger", "read" se interpreten como id
router.get("/unread-count", authenticateToken, unreadCount);
router.patch("/read-all", authenticateToken, markAllRead);
router.delete("/read", authenticateToken, deleteAllRead);
router.post("/test-trigger", authenticateToken, testTrigger);

router.get("/", authenticateToken, list);
router.patch("/:id/read", authenticateToken, markRead);
router.delete("/:id", authenticateToken, deleteOne);

export default router;
