import type { Request, Response } from "express";
import { z } from "zod";
import { sendError } from "../utils/httpErrors.js";
import { createLogger } from "../utils/logger.js";
import {
  getNextHouseMarkets,
  placeHouseSlip,
  HOUSE_MARKETS,
  getMyHouseSlips,
} from "../services/HouseBetService.js";

const log = createLogger("houseBetController");

const nextParams = z.object({
  leagueId: z.string().uuid(),
});

const mySlipsParams = z.object({
  leagueId: z.string().uuid(),
  matchId: z.string().uuid(),
});

export async function getNextHouseBetMarkets(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return sendError(res, 401, { error: "Unauthorized" });
  const parsed = nextParams.safeParse(req.params);
  if (!parsed.success) return sendError(res, 400, { error: "leagueId inválido" });

  try {
    const data = await getNextHouseMarkets(parsed.data.leagueId, userId);
    return res.json(data);
  } catch (e) {
    log.errorWithErr("getNextHouseBetMarkets failed", e, { userId, leagueId: req.params.leagueId });
    return sendError(res, 500, { error: "Error interno" });
  }
}

const placeBody = z.object({
  leagueId: z.string().uuid(),
  matchId: z.string().uuid(),
  stakeTtp: z.number().int().positive().max(200000),
  legs: z
    .array(
      z.object({
        marketKey: z.enum(HOUSE_MARKETS),
        // No siempre es uuid (ej: TEAM_A, DRAW, YES)
        optionUserId: z.string().min(1).max(80),
      }),
    )
    .min(1)
    .max(15),
});

export async function postPlaceHouseSlip(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return sendError(res, 401, { error: "Unauthorized" });
  const parsed = placeBody.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, { error: "INVALID_BODY" });

  try {
    const result = await placeHouseSlip({
      leagueId: parsed.data.leagueId,
      matchId: parsed.data.matchId,
      userId,
      stakeTtp: parsed.data.stakeTtp,
      legs: parsed.data.legs,
    });

    if (!result.ok) {
      const status =
        result.error === "NOT_FOUND"
          ? 404
          : result.error === "FORBIDDEN_PLAYER"
            ? 403
            : result.error === "MARKET_CLOSED"
              ? 409
              : result.error === "INSUFFICIENT_TTP"
                ? 400
                : 400;
      return sendError(res, status, { error: result.error });
    }

    return res.json({
      balanceAfter: result.balanceAfter,
      slipId: result.slipId,
      oddsTotal: result.oddsTotal,
      payoutIfWin: result.payoutIfWin,
    });
  } catch (e) {
    log.errorWithErr("postPlaceHouseSlip failed", e, { userId });
    return sendError(res, 500, { error: "Error interno" });
  }
}

export async function getMyHouseBetSlips(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return sendError(res, 401, { error: "Unauthorized" });
  const parsed = mySlipsParams.safeParse(req.params);
  if (!parsed.success) return sendError(res, 400, { error: "PARAMS_INVALID" });

  try {
    const data = await getMyHouseSlips({
      leagueId: parsed.data.leagueId,
      matchId: parsed.data.matchId,
      userId,
    });
    return res.json(data);
  } catch (e) {
    log.errorWithErr("getMyHouseBetSlips failed", e, { userId, ...req.params });
    return sendError(res, 500, { error: "Error interno" });
  }
}

