import { Router } from "express";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { validateRequest } from "../middlewares/validationMiddleware.js";
import { createLimiter } from "../middlewares/rateLimiters.js";
import {
  createMatchSchema,
  submitVoteSchema,
  updateMatchSchema,
  updateMatchStatusSchema,
} from "../schemas/matchSchemas.js";
import {
  createMatch,
  getNextMatch,
  getAllMatches,
  confirmMatch,
  unconfirmMatch,
  getMatchDetails,
  updateMatchStatus,
  getPendingVotes,
  updateMatch,
  getVoteList,
  submitVotes,
  getRecentCompletedMatches,
  getMatchResults,
  getMatchPredictionsResult,
  generateMatchDuel,
  getMatchDuel,
} from "../controllers/matchController.js";

const router = Router();

router.post(
  "/create",
  authenticateToken,
  createLimiter,
  validateRequest(createMatchSchema),
  createMatch,
);
router.get("/:leagueId/next", authenticateToken, getNextMatch);
router.post("/:matchId/confirm", authenticateToken, confirmMatch);
router.post("/:matchId/unconfirm", authenticateToken, unconfirmMatch);
router.get("/:leagueId/voting", authenticateToken, getPendingVotes);
router.get("/:matchId/details", authenticateToken, getMatchDetails);
router.put(
  "/:matchId/status",
  authenticateToken,
  validateRequest(updateMatchStatusSchema),
  updateMatchStatus,
);
router.put(
  "/:matchId",
  authenticateToken,
  validateRequest(updateMatchSchema),
  updateMatch,
);
router.get("/:leagueId/all", authenticateToken, getAllMatches);
router.get("/:matchId/vote-list", authenticateToken, getVoteList);
router.post(
  "/:matchId/vote",
  authenticateToken,
  validateRequest(submitVoteSchema),
  submitVotes,
);
router.get(
  "/:leagueId/recent-results",
  authenticateToken,
  getRecentCompletedMatches,
);
router.get("/:matchId/results", authenticateToken, getMatchResults);
router.get("/:matchId/predictions-result", authenticateToken, getMatchPredictionsResult);
router.post("/:matchId/duel/generate", authenticateToken, generateMatchDuel);
router.get("/:matchId/duel", authenticateToken, getMatchDuel);

export default router;
