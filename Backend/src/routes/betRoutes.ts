import { Router } from "express";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { getNextMvpBetMarket, postPlaceMvpBet } from "../controllers/betController.js";
import { getMyHouseBetSlips, getNextHouseBetMarkets, postPlaceHouseSlip } from "../controllers/houseBetController.js";

const router = Router();

router.use(authenticateToken);

// Próximo partido de la liga -> mercado MVP
router.get("/:leagueId/next", getNextMvpBetMarket);

// Apostar / aumentar apuesta
router.post("/:marketId/mvp", postPlaceMvpBet);

// ---- Apuestas contra la casa (odds dinámicas + combinadas) ----
router.get("/:leagueId/next-house", getNextHouseBetMarkets);
router.get("/house/:leagueId/:matchId/mine", getMyHouseBetSlips);
router.post("/house/place", postPlaceHouseSlip);

export default router;

