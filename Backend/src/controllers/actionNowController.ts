import type { Request, Response } from "express";
import { z } from "zod";
import { getActionsNow, markActionsSeen } from "../services/ActionNowService.js";

export async function getActionsNowController(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  const query = z
    .object({
      leagueId: z.string().uuid().optional(),
    })
    .parse(req.query ?? {});
  const actions = await getActionsNow({ userId, leagueId: query.leagueId ?? null });
  return res.json({ ok: true, actions });
}

export async function markActionsSeenController(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  const body = z
    .object({
      keys: z.array(z.string()).default([]),
    })
    .parse(req.body ?? {});
  await markActionsSeen(userId, body.keys);
  return res.json({ ok: true });
}

