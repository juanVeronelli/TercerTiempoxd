import type { Request, Response } from "express";
import { prisma } from "../server.js";
import { sanitizeUser } from "../utils/sanitize.js";
import { isValidPosition } from "../constants/positions.js";

export const getMe = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        full_name: true,
        email: true,
        plan_type: true,
        profile_photo_url: true,
        bio: true,
        main_position: true,
        banner_url: true,
        accent_color: true,
        avatar_frame: true,
        showcase_items: true,

        league_members: {
          orderBy: {
            joined_at: "asc",
          },
          select: {
            role: true,
            leagues: {
              select: {
                id: true,
                name: true,
                invite_code: true,
                admin_id: true,
                profile_photo_url: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const formattedLeagues = user?.league_members.map((m) => ({
      id: m.leagues.id,
      name: m.leagues.name,
      invite_code: m.leagues.invite_code,
      admin_id: m.leagues.admin_id,
      profile_photo_url: m.leagues.profile_photo_url ?? null,
      role: m.role,
    }));

    res.json({
      user: sanitizeUser(user),
      leagues: formattedLeagues,
    });
  } catch (error) {
    console.error("Error in getMe:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getPublicUserProfile = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    if (!id) {
      return res.status(400).json({ error: "Falta el ID del usuario" });
    }

    const user = await prisma.users.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true, // Necesario para el fallback del frontend (split('@'))
        profile_photo_url: true,
        banner_url: true,
        bio: true,
        main_position: true,
        plan_type: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const safeUser = sanitizeUser(user);

    res.json({ user: safeUser });
  } catch (error) {
    console.error("Error obteniendo perfil público:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

export const uploadProfilePicture = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId; // Asumiendo que tienes el middleware de auth

    // Multer agrega el archivo en req.file
    if (!req.file) {
      return res.status(400).json({ error: "No se subió ninguna imagen" });
    }

    // La URL segura viene de Cloudinary
    const imageUrl = req.file.path;

    // Actualizamos el usuario en la DB (solo el campo necesario)
    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: {
        profile_photo_url: imageUrl,
      },
      select: {
        id: true,
        username: true,
        full_name: true,
        email: true,
        profile_photo_url: true,
        banner_url: true,
        bio: true,
        main_position: true,
        accent_color: true,
        avatar_frame: true,
        plan_type: true,
      },
    });

    res.json({
      message: "Foto actualizada correctamente",
      user: sanitizeUser(updatedUser),
    });
  } catch (error) {
    console.error("Error subiendo imagen:", error);
    res.status(500).json({ error: "Error al subir la imagen" });
  }
};

export const updateProfileData = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    // 1. Recibimos TODOS los campos, tanto los viejos como los nuevos
    const {
      name,
      surname,
      bio,
      mainPosition,
      // --- Nuevos campos visuales (solo PRO) ---
      bannerUrl,
      accentColor,
      avatarFrame,
      showcaseItems,
      // --- Push notifications ---
      expoPushToken,
      notificationsEnabled,
    } = req.body;

    // Cosméticos (vitrina, marcos, banners, color acento) solo para PRO
    const wantsCosmeticUpdate =
      bannerUrl !== undefined ||
      accentColor !== undefined ||
      avatarFrame !== undefined ||
      showcaseItems !== undefined;
    if (wantsCosmeticUpdate) {
      const u = await prisma.users.findUnique({
        where: { id: userId },
        select: { plan_type: true },
      });
      if (u?.plan_type !== "PRO") {
        return res.status(403).json({
          error: "Plan PRO requerido",
          message: "La vitrina, marcos y banners son exclusivos del plan PRO.",
        });
      }
    }

    // Preparamos el objeto de actualización dinámicamente
    const updateData: any = {};

    // --- Lógica existente (Nombre/Bio/Posición) ---
    if (name !== undefined || surname !== undefined) {
      const currentName = name || "";
      const currentSurname = surname || "";
      updateData.full_name = `${currentName} ${currentSurname}`.trim();
    }

    if (bio !== undefined) updateData.bio = bio;
    if (mainPosition !== undefined) {
      if (mainPosition === null || mainPosition === "") {
        updateData.main_position = null;
      } else if (!isValidPosition(mainPosition)) {
        return res.status(400).json({
          error: "Posición inválida",
          message: "Debe ser: Arquero, Defensor, Mediocampista o Delantero.",
        });
      } else {
        updateData.main_position = mainPosition.trim();
      }
    }

    // --- NUEVA LÓGICA: Mapeo de campos estéticos ---
    if (bannerUrl !== undefined) {
      const BANNER_URL_TO_COSMETIC: Record<string, string> = {
        "https://singlecolorimage.com/get/4b5563/800x400": "wall_banner",
        "https://singlecolorimage.com/get/1d4ed8/800x400": "loyalty_banner",
        "https://singlecolorimage.com/get/b91c1c/800x400": "gladiator_banner",
        "https://singlecolorimage.com/get/7c3aed/800x400": "crystal_ball_banner",
        "https://singlecolorimage.com/get/22d3ee/800x400": "neon_banner",
        "https://singlecolorimage.com/get/f59e0b/800x400": "century_banner",
      };
      const requiredKey = BANNER_URL_TO_COSMETIC[bannerUrl];
      if (requiredKey) {
        const hasCosmetic = await prisma.user_cosmetics.findUnique({
          where: {
            user_id_cosmetic_key: { user_id: userId, cosmetic_key: requiredKey },
          },
        });
        if (!hasCosmetic) {
          return res.status(403).json({
            error: "Banner no desbloqueado",
            message: "Debes completar una misión para desbloquear ese banner.",
          });
        }
      }
      updateData.banner_url = bannerUrl;
    }

    if (accentColor !== undefined) {
      const ACCENT_COLOR_TO_COSMETIC: Record<string, string> = {
        "#059669": "accent_emerald",
        "#DC2626": "accent_crimson",
        "#06B6D4": "accent_neon_blue",
      };
      const requiredKey = ACCENT_COLOR_TO_COSMETIC[accentColor];
      if (requiredKey) {
        const hasCosmetic = await prisma.user_cosmetics.findUnique({
          where: {
            user_id_cosmetic_key: { user_id: userId, cosmetic_key: requiredKey },
          },
        });
        if (!hasCosmetic) {
          return res.status(403).json({
            error: "Color de acento no desbloqueado",
            message: "Debes completar una misión para desbloquear ese color.",
          });
        }
      }
      updateData.accent_color = accentColor;
    }

    if (avatarFrame !== undefined) {
      const frameId = typeof avatarFrame === "object" ? avatarFrame.id : avatarFrame;
      // Nativo (siempre): none, simple, accent (color tema). PRO sin misión: gold.
      const allowedFrames = ["none", "simple", "accent", "gold"];
      const frameToCosmetic: Record<string, string> = {
        danger: "danger_frame",
        streak_frame: "streak_frame",
        mvp_frame: "mvp_frame",
        crown_frame: "crown_frame",
        duo_frame: "duo_frame",
        captain_frame: "captain_frame",
        champion_frame: "champion_frame",
        phoenix_frame: "phoenix_frame",
        ghost_frame: "ghost_frame",
        duel_frame: "duel_frame",
        oracle_frame: "oracle_frame",
        neon_frame: "neon_frame",
        all_rounder_frame: "all_rounder_frame",
        comeback_frame: "comeback_frame",
      };
      if (!allowedFrames.includes(frameId) && frameToCosmetic[frameId]) {
        const requiredKey = frameToCosmetic[frameId];
        const hasCosmetic = await prisma.user_cosmetics.findUnique({
          where: {
            user_id_cosmetic_key: { user_id: userId, cosmetic_key: requiredKey },
          },
        });
        if (!hasCosmetic) {
          return res.status(403).json({
            error: "Cosmético no desbloqueado",
            message: `Debes completar una misión para desbloquear el marco "${frameId}".`,
          });
        }
      }
      updateData.avatar_frame = frameId;
    }

    if (showcaseItems !== undefined) {
      const allowedShowcase = ["matches", "avg_hist", "best_rating"];
      const showcaseToCosmetic: Record<string, string> = {
        mvp: "showcase_mvp",
        avg_hist: "showcase_avg_hist",
        best_rating: "showcase_best_rating",
        last_match: "showcase_last_match",
        tronco: "showcase_tronco",
        duel: "showcase_duel",
        oracle: "showcase_oracle",
      };
      const items = Array.isArray(showcaseItems) ? showcaseItems : [];
      const userCosmeticsList = await prisma.user_cosmetics.findMany({
        where: { user_id: userId },
        select: { cosmetic_key: true },
      });
      const unlockedKeys = new Set(userCosmeticsList.map((c) => c.cosmetic_key));
      for (const itemId of items) {
        if (allowedShowcase.includes(itemId)) continue;
        const requiredKey = showcaseToCosmetic[itemId];
        if (requiredKey && !unlockedKeys.has(requiredKey)) {
          return res.status(403).json({
            error: "Cosmético no desbloqueado",
            message: `Debes completar una misión para desbloquear "${itemId}" en la vitrina.`,
          });
        }
      }
      updateData.showcase_items = showcaseItems;
    }

    if (expoPushToken !== undefined) {
      updateData.expo_push_token = expoPushToken === "" ? null : expoPushToken;
    }
    if (notificationsEnabled !== undefined) {
      updateData.notifications_enabled = Boolean(notificationsEnabled);
    }

    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        full_name: true,
        email: true,
        profile_photo_url: true,
        banner_url: true,
        bio: true,
        main_position: true,
        accent_color: true,
        avatar_frame: true,
        showcase_items: true,
        plan_type: true,
      },
    });

    res.json({
      message: "Perfil actualizado",
      user: {
        ...sanitizeUser(updatedUser),
        showcaseItems: updatedUser.showcase_items,
      },
    });
  } catch (error) {
    console.error("Error actualizando perfil:", error);
    res.status(500).json({ error: "Error al actualizar el perfil" });
  }
};

export const getGlobalProfile = async (req: Request, res: Response) => {
  try {
    const targetUserId = req.params.userId || (req as any).user?.userId;

    if (!targetUserId)
      return res.status(400).json({ error: "User ID required" });

    const user = await prisma.users.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        username: true,
        full_name: true,
        email: true,
        profile_photo_url: true,
        banner_url: true,
        bio: true,
        main_position: true,
        accent_color: true,
        avatar_frame: true,
        showcase_items: true,
        plan_type: true,
        created_at: true,
        notifications_enabled: true,
      },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    const statsAggregate = await prisma.match_players.aggregate({
      where: {
        user_id: targetUserId,
        has_confirmed: true,
        match_rating: { not: null },
      },
      _count: { match_id: true },
      _avg: { match_rating: true },
      _max: { match_rating: true },
    });

    const honorsGrouped = await prisma.honors.groupBy({
      by: ["honor_type"],
      where: { user_id: targetUserId },
      _count: {
        honor_type: true,
      },
    });

    const duelMembers = await prisma.league_members.findMany({
      where: { user_id: targetUserId },
      select: { honors_duel: true },
    });
    const totalDuelWins = duelMembers.reduce(
      (sum, m) => sum + (m.honors_duel || 0),
      0,
    );

    const trophyCase = {
      mvp:
        honorsGrouped.find((h) => h.honor_type === "MVP")?._count.honor_type ||
        0,
      fantasma:
        honorsGrouped.find((h) => h.honor_type === "FANTASMA")?._count
          .honor_type || 0,
      tronco:
        honorsGrouped.find((h) => h.honor_type === "TRONCO")?._count
          .honor_type || 0,
      ideal_xi:
        honorsGrouped.find((h) => h.honor_type === "IDEAL_XI")?._count
          .honor_type || 0,
      oracle:
        honorsGrouped.find((h) => h.honor_type === "ORACLE")?._count
          .honor_type || 0,
      duel: totalDuelWins,
    };

    const recentMatches = await prisma.match_players.findMany({
      where: {
        user_id: targetUserId,
        has_confirmed: true,
        matches: { status: { in: ["FINISHED", "COMPLETED"] } },
      },
      take: 5,
      orderBy: {
        matches: { date_time: "desc" },
      },
      include: {
        matches: {
          select: {
            id: true,
            date_time: true,
            location_name: true,
            status: true,
            leagues: {
              select: { name: true },
            },
          },
        },
      },
    });

    const isOwnProfile = targetUserId === (req as any).user?.userId;
    let userCosmetics: { cosmetic_key: string; cosmetic_type: string }[] = [];
    if (isOwnProfile) {
      const cosmetics = await prisma.user_cosmetics.findMany({
        where: { user_id: targetUserId },
        select: { cosmetic_key: true, cosmetic_type: true },
      });
      userCosmetics = cosmetics;
    }

    const matchesFormatted = recentMatches.map((record) => ({
      matchId: record.match_id,
      date: record.matches.date_time,
      location: record.matches.location_name,
      rating: record.match_rating,
      leagueName: record.matches.leagues?.name || "Amistoso",
    }));

    res.json({
      profile: sanitizeUser(user),
      careerStats: {
        totalMatches: statsAggregate._count.match_id,
        averageRating: statsAggregate._avg.match_rating || 0,
        highestRating: statsAggregate._max.match_rating || 0,
      },
      trophyCase,
      recentMatches: matchesFormatted,
      userCosmetics: userCosmetics,
    });
  } catch (error) {
    console.error("Error fetching global profile:", error);
    res.status(500).json({ error: "Error fetching profile" });
  }
};
