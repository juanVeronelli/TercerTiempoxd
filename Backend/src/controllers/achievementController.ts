import type { Request, Response } from "express";
import { prisma } from "../server.js";
import { sendError } from "../utils/httpErrors.js";

/** GET /api/achievements - Catálogo de logros (público o auth) */
export const getAchievementsCatalog = async (req: Request, res: Response) => {
  // Sistema de logros deshabilitado (todo cosmético está desbloqueado).
  return res.json([]);
};

/** GET /api/achievements/me - Mis logros con progreso (requiere auth) */
export const getMyAchievements = async (req: Request, res: Response) => {
  // Sistema de logros deshabilitado.
  const userId = req.user?.userId;
  if (!userId) return sendError(res, 401, { error: "No autenticado" });
  return res.json([]);
};

/** GET /api/achievements/me/cosmetics - Mis cosméticos desbloqueados */
export const getMyCosmetics = async (req: Request, res: Response) => {
  // Todo está desbloqueado, y ya no mantenemos lista de “mis cosméticos”.
  const userId = req.user?.userId;
  if (!userId) return sendError(res, 401, { error: "No autenticado" });
  return res.json([]);
};
