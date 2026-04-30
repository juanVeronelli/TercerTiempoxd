import type { Request, Response } from "express";
import { z } from "zod";
import { sendError } from "../utils/httpErrors.js";
import { createLogger } from "../utils/logger.js";
import { getNextMatchMvpMarket, placeMvpBet } from "../services/BetService.js";

const log = createLogger("betController");

const nextParams = z.object({
  leagueId: z.string().uuid(),
});

export async function getNextMvpBetMarket(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return sendError(res, 401, { error: "Unauthorized" });

  const parsed = nextParams.safeParse(req.params);
  if (!parsed.success) return sendError(res, 400, { error: "leagueId inválido" });

  try {
    const data = await getNextMatchMvpMarket(parsed.data.leagueId, userId);
    return res.json(data);
  } catch (e) {
    log.errorWithErr("getNextMvpBetMarket failed", e, { userId, leagueId: req.params.leagueId });
    return sendError(res, 500, { error: "Error interno" });
  }
}

const placeBody = z.object({
  optionUserId: z.string().uuid(),
  stakeTtp: z.number().int().positive().max(100000),
});

const placeParams = z.object({
  marketId: z.string().uuid(),
});

export async function postPlaceMvpBet(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return sendError(res, 401, { error: "Unauthorized" });

  const paramsParsed = placeParams.safeParse(req.params);
  if (!paramsParsed.success) return sendError(res, 400, { error: "marketId inválido" });

  const bodyParsed = placeBody.safeParse(req.body);
  if (!bodyParsed.success) return sendError(res, 400, { error: "INVALID_BODY" });

  try {
    const result = await placeMvpBet({
      marketId: paramsParsed.data.marketId,
      userId,
      optionUserId: bodyParsed.data.optionUserId,
      stakeTtp: bodyParsed.data.stakeTtp,
    });

    if (!result.ok) {
      const status =
        result.error === "NOT_FOUND"
          ? 404
          : result.error === "MARKET_CLOSED"
            ? 409
            : result.error === "FORBIDDEN_PARTICIPANT"
              ? 403
              : result.error === "INVALID_OPTION"
                ? 400
                : 400;
      return sendError(res, status, { error: result.error });
    }

    return res.json({
      balanceAfter: result.balanceAfter,
      myBet: result.myBet,
    });
  } catch (e) {
    log.errorWithErr("postPlaceMvpBet failed", e, {
      userId,
      marketId: req.params.marketId,
    });
    return sendError(res, 500, { error: "Error interno" });
  }
}

