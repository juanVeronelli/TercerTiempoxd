import type { Request, Response } from "express";
import { prisma } from "../server.js";

/** GET /api/achievements - Catálogo de logros (público o auth) */
export const getAchievementsCatalog = async (req: Request, res: Response) => {
  try {
    const achievements = await prisma.achievements.findMany({
      orderBy: { sort_order: "asc" },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        condition_type: true,
        condition_value: true,
        reward_type: true,
        reward_value: true,
        is_pro_exclusive: true,
        sort_order: true,
      },
    });
    return res.json(achievements);
  } catch (error) {
    console.error("[getAchievementsCatalog]", error);
    return res.status(500).json({ error: "Error al obtener catálogo de logros" });
  }
};

/** GET /api/achievements/me - Mis logros con progreso (requiere auth) */
export const getMyAchievements = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ error: "No autenticado" });

    const achievements = await prisma.achievements.findMany({
      orderBy: { sort_order: "asc" },
      include: {
        user_achievements: {
          where: { user_id: userId },
          select: {
            id: true,
            current_progress: true,
            is_completed: true,
            claimed_at: true,
          },
        },
      },
    });

    const withProgress = achievements.map((a) => {
      const ua = a.user_achievements[0];
      return {
        ...a,
        user_achievement: ua
          ? {
              id: ua.id,
              current_progress: Number(ua.current_progress),
              is_completed: ua.is_completed,
              claimed_at: ua.claimed_at,
            }
          : null,
        user_achievements: undefined,
      };
    });

    return res.json(withProgress);
  } catch (error) {
    console.error("[getMyAchievements]", error);
    return res.status(500).json({ error: "Error al obtener tus logros" });
  }
};

/** GET /api/achievements/me/cosmetics - Mis cosméticos desbloqueados */
export const getMyCosmetics = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ error: "No autenticado" });

    const cosmetics = await prisma.user_cosmetics.findMany({
      where: { user_id: userId },
      orderBy: { unlocked_at: "desc" },
      select: {
        id: true,
        cosmetic_key: true,
        cosmetic_type: true,
        unlocked_at: true,
        source_achievement_id: true,
      },
    });
    return res.json(cosmetics);
  } catch (error) {
    console.error("[getMyCosmetics]", error);
    return res.status(500).json({ error: "Error al obtener cosméticos" });
  }
};
