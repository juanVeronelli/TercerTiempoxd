import type { Request, Response } from "express";
import { z } from "zod";
import { getMyMissions, markMissionsPopupSeen, claimMission } from "../services/MissionService.js";

export async function getMyMissionsController(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  const data = await getMyMissions(userId);
  return res.json(data);
}

export async function markPopupSeenController(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  const body = z
    .object({
      missionKeys: z.array(z.string()).default([]),
    })
    .parse(req.body ?? {});
  await markMissionsPopupSeen(userId, body.missionKeys);
  return res.json({ ok: true });
}

export async function claimMissionController(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  const body = z
    .object({
      missionKey: z.string().min(1),
    })
    .parse(req.body ?? {});
  const result = await claimMission(userId, body.missionKey);
  if (!result.ok) {
    const code =
      result.error === "FORBIDDEN_PRO"
        ? 403
        : result.error === "NOT_FOUND"
          ? 404
          : 400;
    return res.status(code).json(result);
  }
  return res.json(result);
}

