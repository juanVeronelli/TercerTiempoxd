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
  deleteLeague,
  getUserLeagueStats,
  getOtherUserLeagueStats,
  updateMemberRole,
  getAdvancedStats,
} from "../controllers/leagueController.js"; // Ojo con la extensión .js si usas TS normal
import { authenticateToken } from "../middlewares/authMiddleware.js";

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
// Esta debe ir al final de los GETs, porque si no, Express pensará que "stats" es un ID.
router.put("/:id", authenticateToken, updateLeague);
router.delete("/:id", authenticateToken, deleteLeague);
router.get("/:id", authenticateToken, getLeagueById);

export default router;
