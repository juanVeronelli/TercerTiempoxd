import express from "express";
import {
  createLeague,
  joinLeague,
  getLeagueMembers,
  getLeagueById,
  getGeneralRanking,
  getHonorsRanking,
  removeMember,
  leaveLeague,
  updateLeague,
  uploadLeaguePhoto,
  deleteLeague,
  getUserLeagueStats,
  getOtherUserLeagueStats,
  updateMemberRole,
  getAdvancedStats,
} from "../controllers/leagueController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { uploadLeaguePhoto as uploadLeaguePhotoMulter } from "../config/cloudinary.js";

const router = express.Router();

// 1. RUTAS FIJAS (Sin parámetros dinámicos)
router.post("/", authenticateToken, createLeague);
router.post("/join", authenticateToken, joinLeague);

// 2. RUTAS ESPECÍFICAS CON ID (Stats, Miembros, Acciones)
// Deben ir ANTES de la ruta genérica get("/:id")
router.get("/:leagueId/stats/advanced", authenticateToken, getAdvancedStats);
router.get("/:id/members", authenticateToken, getLeagueMembers);
router.get("/:id/stats/general", authenticateToken, getGeneralRanking);
router.get("/:leagueId/stats/honors", authenticateToken, getHonorsRanking);
router.get("/:id/my-stats", authenticateToken, getUserLeagueStats);
router.get(
  "/:id/users/:userId/stats",
  authenticateToken,
  getOtherUserLeagueStats,
);
router.put(
  "/:leagueId/members/:memberId/role",
  authenticateToken,
  updateMemberRole,
);

router.delete("/:leagueId/members/:userId", authenticateToken, removeMember);
router.post("/:leagueId/leave", authenticateToken, leaveLeague);

// 3. RUTA GENÉRICA (El "Catch-All")
router.put("/:id", authenticateToken, updateLeague);
router.post(
  "/:id/upload-photo",
  authenticateToken,
  (req, res, next) => {
    uploadLeaguePhotoMulter.single("photo")(req, res, (err: unknown) => {
      if (err) {
        const multerErr = err as { code?: string; message?: string };
        if (multerErr.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({ error: "La imagen supera el límite de 5 MB." });
        }
        if (multerErr.message?.includes("Formato")) {
          return res.status(415).json({ error: multerErr.message });
        }
        console.error("Error multer upload league photo:", err);
        return res.status(500).json({ error: "Error al subir la imagen." });
      }
      next();
    });
  },
  uploadLeaguePhoto
);
router.delete("/:id", authenticateToken, deleteLeague);
router.get("/:id", authenticateToken, getLeagueById);

export default router;
