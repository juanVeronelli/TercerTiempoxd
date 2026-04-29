import type { Request, Response } from "express";
import { prisma } from "../server.js";
import { sendError } from "../utils/httpErrors.js";
import { LeagueRole, MatchStatus, isLeagueStaffRole, normalizeUpper } from "../constants/domain.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("leagueController");

export interface GeneralRankingResponse {
  id: string;
  name: string;
  photo: string | null;
  matches_played: number;
  matches_won: number;
  matches_drawn: number;
  matches_lost: number;
  average_rating: number;
}

export interface HonorsRankingResponse {
  id: string;
  name: string;
  photo: string | null;
  mvp_count: number;
  figure_count: number;
  clean_sheet_count: number;
  worst_player_count: number;
}

const generateLeagueCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const createLeague = async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return sendError(res, 401, { error: "Unauthorized" });
    }

    if (!name) {
      return sendError(res, 400, { error: "League name is required" });
    }

    const inviteCode = generateLeagueCode();

    const newLeague = await prisma.leagues.create({
      data: {
        name,
        description,
        invite_code: inviteCode,
        admin_id: userId, // Here we define who is the admin (in the leagues table)

        // Automatically add the creator as a member
        league_members: {
          create: {
            user_id: userId,
            role: LeagueRole.OWNER,
            league_overall: 0.0,
            is_banned: false,
          },
        },
      },
    });

    res.status(201).json({
      message: "League created successfully",
      league: newLeague,
    });
  } catch (error) {
    log.errorWithErr("createLeague failed", error, { userId: req.user?.userId });
    return sendError(res, 500, { error: "Failed to create league" });
  }
};

export const joinLeague = async (req: Request, res: Response) => {
  try {
    const { code } = req.body; // Recibimos el código de invitación
    const userId = req.user?.userId;

    if (!userId) return sendError(res, 401, { error: "Unauthorized" });
    if (!code)
      return sendError(res, 400, { error: "Invite code is required" });

    // 1. Buscamos la liga por el código
    const league = await prisma.leagues.findUnique({
      where: { invite_code: code.toUpperCase() }, // Aseguramos mayúsculas
    });

    if (!league) {
      return sendError(res, 404, { error: "Liga no encontrada. Verificá el código." });
    }

    // 2. Verificamos si ya es miembro
    const existingMember = await prisma.league_members.findUnique({
      where: {
        league_id_user_id: {
          league_id: league.id,
          user_id: userId,
        },
      },
    });

    if (existingMember) {
      return sendError(res, 400, { error: "Ya sos miembro de esta liga." });
    }

    // 3. Agregamos al usuario como MEMBER (nunca OWNER: solo el creador lo es)
    await prisma.league_members.create({
      data: {
        user_id: userId,
        league_id: league.id,
        role: LeagueRole.MEMBER,
        league_overall: 0.0,
        is_banned: false,
      },
    });

    res
      .status(200)
      .json({ message: `Te uniste a ${league.name} exitosamente.` });
  } catch (error) {
    log.errorWithErr("joinLeague failed", error, { userId: req.user?.userId });
    return sendError(res, 500, { error: "Error al unirse a la liga" });
  }
};

export const updateLeague = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { name, description, custom_medal_names, profile_photo_url } = req.body;
  try {
    const data: {
      name?: string;
      description?: string;
      custom_medal_names?: Record<string, string>;
      profile_photo_url?: string | null;
    } = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (custom_medal_names !== undefined) data.custom_medal_names = custom_medal_names;
    if (profile_photo_url !== undefined) data.profile_photo_url = profile_photo_url || null;
    const updated = await prisma.leagues.update({
      where: { id },
      data,
    });
    res.json(updated);
  } catch (e) {
    return sendError(res, 500, { error: "Error updating" });
  }
};

export const uploadLeaguePhoto = async (req: Request, res: Response) => {
  const leagueId = req.params.id as string;
  const userId = req.user?.userId;
  try {
    if (!userId) {
      return sendError(res, 401, { error: "Unauthorized" });
    }
    if (!req.file?.path) {
      return sendError(res, 400, { error: "No se subió ninguna imagen" });
    }
    const member = await prisma.league_members.findUnique({
      where: {
        league_id_user_id: { league_id: leagueId, user_id: userId },
      },
      select: { role: true },
    });
    const league = await prisma.leagues.findUnique({
      where: { id: leagueId },
      select: { admin_id: true },
    });
    const isOwner = league?.admin_id === userId;
    const isAdmin = isLeagueStaffRole(member?.role);
    if (!isOwner && !isAdmin) {
      return sendError(res, 403, { error: "Sin permiso para editar esta liga" });
    }
    const updated = await prisma.leagues.update({
      where: { id: leagueId },
      data: { profile_photo_url: req.file.path },
    });
    res.json({ message: "Foto actualizada", league: updated });
  } catch (e) {
    log.errorWithErr("uploadLeaguePhoto failed", e, { leagueId, userId: req.user?.userId });
    return sendError(res, 500, { error: "Error al subir la foto" });
  }
};

export const removeMember = async (req: Request, res: Response) => {
  const userId = req.params.userId as string;
  const leagueId = req.params.leagueId as string;

  try {
    await prisma.league_members.deleteMany({
      where: {
        league_id: leagueId,
        user_id: userId,
      },
    });
    res.json({ success: true });
  } catch (e) {
    return sendError(res, 500, { error: "Error removing member" });
  }
};

export const leaveLeague = async (req: Request, res: Response) => {
  const leagueId = req.params.leagueId as string;
  const userId = req.user?.userId;
  try {
    if (!userId) {
      return sendError(res, 401, { error: "Unauthorized" });
    }
    await prisma.league_members.deleteMany({
      where: {
        league_id: leagueId,
        user_id: userId,
      },
    });
    res.json({ success: true });
  } catch (e) {
    return sendError(res, 500, { error: "Error leaving league" });
  }
};

// 4. ELIMINAR LIGA (DELETE)
export const deleteLeague = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const userId = req.user?.userId;
  try {
    if (!userId) return sendError(res, 401, { error: "Unauthorized" });

    const league = await prisma.leagues.findUnique({
      where: { id },
      select: { id: true, admin_id: true },
    });
    if (!league) {
      return sendError(res, 404, { error: "Liga no encontrada" });
    }
    if (league.admin_id !== userId) {
      return sendError(res, 403, { error: "Solo el creador puede eliminar la liga" });
    }

    await prisma.$transaction(async (tx) => {
      // Limpieza defensiva de referencias con FK no-cascade.
      await tx.user_consumable_activations.deleteMany({ where: { league_id: id } });
      await tx.friend_stats_cache.deleteMany({ where: { league_id: id } });
      await tx.match_votes.deleteMany({ where: { league_id: id } });
      await tx.honors.deleteMany({ where: { league_id: id } });

      // Matches cuelgan de league_id (cascade), pero lo hacemos explícito.
      await tx.matches.deleteMany({ where: { league_id: id } });
      await tx.prediction_groups.deleteMany({ where: { league_id: id } });
      await tx.league_members.deleteMany({ where: { league_id: id } });
      await tx.leagues.delete({ where: { id } });
    });

    res.json({ success: true, deletedLeagueId: id });
  } catch (e) {
    log.errorWithErr("deleteLeague failed", e, { id, userId: req.user?.userId });
    return sendError(res, 500, { error: "Error deleting league" });
  }
};

export const getLeagueMembers = async (req: Request, res: Response) => {
  const id = req.params.id as string; // El ID de la liga
  const isUuid =
    typeof id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    );
  if (!isUuid) {
    return sendError(res, 400, { error: "ID de liga inválido" });
  }

  try {
    const members = await prisma.league_members.findMany({
      where: {
        league_id: id,
      },
      include: {
        users: {
          select: {
            id: true,
            full_name: true,
            profile_photo_url: true,
            username: true,
            plan_type: true,
            avatar_frame: true,
            accent_color: true,
          },
        },
      },
    });

    res.json(members);
  } catch (error) {
    log.errorWithErr("getLeagueMembers failed", error, { id: req.params.id });
    return sendError(res, 500, { error: "Error obteniendo miembros" });
  }
};

export const getLeagueById = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const userId = req.user?.userId;

  try {
    if (!id || id === "undefined" || id === "null") {
      return sendError(res, 400, { error: "ID de liga inválido" });
    }

    const league = await prisma.leagues.findUnique({
      where: { id: id },
      include: {
        league_members: {
          where: { user_id: userId },
          select: { role: true },
        },
      },
    });

    if (!league) return sendError(res, 404, { error: "Liga no encontrada" });
    const userRole = league.league_members[0]?.role || "NONE";

    res.json({
      ...league,
      userRole, // <-- LA CLAVE: El frontend recibe esto directamente
      league_members: undefined, // Limpiamos para no enviar datos innecesarios
    });
  } catch (error) {
    log.errorWithErr("getLeagueById failed", error, { id: req.params.id, userId: req.user?.userId });
    return sendError(res, 500, { error: "Error fetching league" });
  }
};

export const getGeneralRanking = async (req: Request, res: Response) => {
  const leagueId = (req.params.id || req.params.leagueId) as string;
  const { period } = req.query;

  if (!leagueId || leagueId === "undefined") {
    return sendError(res, 400, { error: "ID de liga inválido" });
  }

  try {
    let dateFilter: any = {};
    const now = new Date();

    if (period === "month") {
      dateFilter = { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
    } else if (period === "week") {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      dateFilter = { gte: weekAgo };
    }

    const members = await prisma.league_members.findMany({
      where: {
        league_id: leagueId,
        is_banned: false,
      },
      include: {
        users: {
          select: {
            id: true,
            full_name: true,
            profile_photo_url: true,
            avatar_frame: true,
            accent_color: true,
            match_players: {
              where: {
                matches: {
                  league_id: leagueId,
                  status: "COMPLETED",
                  // Si el periodo es "total", NO aplicamos el dateFilter
                  ...(period !== "total" &&
                    period !== undefined && { date_time: dateFilter }),
                },
              },
              include: {
                matches: true,
              },
            },
          },
        },
      },
    });

    const ranking = (members as any[])
      .map((member) => {
        const user = member.users;
        if (!user) return null;

        const filteredMatches = user.match_players || [];

        let won = 0;
        let drawn = 0;
        let lost = 0;
        let totalRating = 0;

        filteredMatches.forEach((mp: any) => {
          const m = mp.matches;
          if (!m) return;

          // IMPORTANTE: Aseguramos que sume incluso si es 0
          totalRating += Number(mp.match_rating || 0);

          const scoreA = Number(m.team_a_score ?? 0);
          const scoreB = Number(m.team_b_score ?? 0);

          if (scoreA === scoreB) {
            drawn++;
          } else {
            const isWinner =
              (mp.team === "A" && scoreA > scoreB) ||
              (mp.team === "B" && scoreB > scoreA);

            if (isWinner) won++;
            else lost++;
          }
        });

        const playedCount = filteredMatches.length;

        // --- CORRECCIÓN AQUÍ ---
        // Ya no confiamos en league_overall, calculamos SIEMPRE sobre filteredMatches
        // Esto garantiza que si filteredMatches tiene 4 partidos, se divida por 4,
        // aunque uno de esos partidos tenga rating 0.
        const averageRating = playedCount > 0 ? totalRating / playedCount : 0;

        return {
          id: user.id,
          name: user.full_name || "Sin nombre",
          photo: user.profile_photo_url,
          avatar_frame: user.avatar_frame,
          accent_color: user.accent_color,
          matches_played: playedCount,
          matches_won: won,
          matches_drawn: drawn,
          matches_lost: lost,
          average_rating: averageRating,
        };
      })
      .filter(Boolean);

    const sortedRanking = ranking.sort(
      (a: any, b: any) => b.average_rating - a.average_rating,
    );

    return res.status(200).json(sortedRanking);
  } catch (error: any) {
    log.errorWithErr("getGeneralRanking failed", error, { leagueId: req.params.id ?? req.params.leagueId });
    return sendError(res, 500, {
      error: "INTERNAL_ERROR",
      message: "Error interno del servidor",
      details: error?.message,
    });
  }
};

export const getProdeRanking = async (req: Request, res: Response) => {
  const leagueId = (req.params.leagueId || req.params.id) as string;
  if (!leagueId || leagueId === "undefined") {
    return sendError(res, 400, { error: "ID de liga inválido" });
  }
  try {
    const members = await prisma.league_members.findMany({
      where: { league_id: leagueId, is_banned: false },
      include: {
        users: {
          select: {
            id: true,
            full_name: true,
            username: true,
            profile_photo_url: true,
            avatar_frame: true,
            accent_color: true,
          },
        },
      },
    });
    const ranking = members
      .map((m) => ({
        id: m.users.id,
        name: m.users.full_name || "Sin nombre",
        username: m.users.username,
        photo: m.users.profile_photo_url,
        avatar_frame: m.users.avatar_frame,
        accent_color: m.users.accent_color,
        prode_points_total: Number(m.prode_points_total ?? 0),
      }))
      .sort((a, b) => b.prode_points_total - a.prode_points_total);
    return res.status(200).json(ranking);
  } catch (error) {
    log.errorWithErr("getProdeRanking failed", error, { leagueId: req.params.leagueId ?? req.params.id });
    return sendError(res, 500, { error: "Error al obtener tabla del prode." });
  }
};

export const getHonorsRanking = async (req: Request, res: Response) => {
  // Asegurate de que el parámetro coincida con tu ruta (id o leagueId)
  const leagueId = req.params.leagueId as string;

  try {
    const members = await prisma.league_members.findMany({
      where: { league_id: leagueId },
      include: {
        users: {
          select: {
            id: true,
            full_name: true,
            profile_photo_url: true,
            avatar_frame: true,
            accent_color: true,
          },
        },
      },
    });

    const honors = members.map((member) => ({
      id: member.users.id,
      name: member.users.full_name || "Sin nombre",
      photo: member.users.profile_photo_url,
      mvp_count: member.honors_mvp || 0,
      fantasma_count: member.honors_fantasma || 0,
      worst_player_count: member.honors_tronco || 0,
      duel_count: member.honors_duel || 0,
      prediction_count: member.honors_prediction || 0,
      avatar_frame: member.users.avatar_frame,
      accent_color: member.users.accent_color,
    }));

    const result = honors.sort((a, b) => b.mvp_count - a.mvp_count);

    return res.status(200).json(result);
  } catch (error) {
    log.errorWithErr("getHonorsRanking failed", error, { leagueId: req.params.leagueId });
    return sendError(res, 500, { error: "Error al obtener honores de miembros." });
  }
};

export const getUserLeagueStats = async (req: Request, res: Response) => {
  const leagueId = req.params.id as string;
  const userId = req.user?.userId;

  const isLeagueUuid =
    typeof leagueId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      leagueId,
    );
  if (!userId || !isLeagueUuid) {
    return sendError(res, 400, { error: "Faltan parámetros" });
  }

  try {
    // Actividad (tipo GitHub): días donde el usuario jugó (asistencia confirmada),
    // independientemente de que el partido ya esté procesado o no.
    const now = new Date();
    const activityFrom = new Date(now);
    activityFrom.setDate(activityFrom.getDate() - 364);
    // `matches.date_time` es la fecha/hora del partido (timestamp sin tz).
    // En algunos entornos puede quedar levemente "en el futuro" por offsets históricos.
    // Para UX de actividad, usamos una ventana superior con tolerancia.
    const activityTo = new Date(now);
    activityTo.setDate(activityTo.getDate() + 2);

    // Nota UX: "actividad" debe ser confiable. Usamos match_players (tu registro en el partido),
    // sin depender de status/confirmaciones que pueden estar inconsistentes históricamente.
    const activityMatches = await prisma.match_players.findMany({
      where: {
        user_id: userId,
        matches: {
          league_id: leagueId,
          status: { notIn: ["CANCELLED"] },
          date_time: { gte: activityFrom, lte: activityTo },
        },
      },
      select: { matches: { select: { date_time: true } } },
      orderBy: { matches: { date_time: "asc" } },
    });

    const allMatches = await prisma.match_players.findMany({
      where: {
        user_id: userId,
        matches: { league_id: leagueId, status: "COMPLETED" },
      },
      include: {
        matches: {
          select: {
            id: true,
            date_time: true,
            location_name: true,
            team_a_score: true,
            team_b_score: true,
          },
        },
      },
      orderBy: { matches: { date_time: "asc" } },
    });

    const allLeagueData = await prisma.match_players.findMany({
      where: {
        matches: { league_id: leagueId, status: "COMPLETED" },
      },
    });

    // --- SOLUCIÓN AL ERROR TS(7053) ---
    // Definimos explícitamente cuáles son las llaves válidas del modelo match_players
    type MatchPlayerSkills =
      | "match_pace"
      | "match_defense"
      | "match_technique"
      | "match_physical"
      | "match_attack"
      | "match_rating";

    const calcLeagueAvg = (key: MatchPlayerSkills) => {
      const validPoints = allLeagueData.filter((p) => Number(p[key] || 0) > 0);
      return validPoints.length > 0
        ? Number(
            (
              validPoints.reduce((acc, p) => acc + Number(p[key] || 0), 0) /
              validPoints.length
            ).toFixed(1),
          )
        : 6.0;
    };

    const leagueAverages = {
      pace: calcLeagueAvg("match_pace"),
      defense: calcLeagueAvg("match_defense"),
      technique: calcLeagueAvg("match_technique"),
      physical: calcLeagueAvg("match_physical"),
      attack: calcLeagueAvg("match_attack"),
      rating: calcLeagueAvg("match_rating"),
    };

    // --- LÓGICA DEL USUARIO ---
    let historicalAvg = "0.0";
    let monthAvg = "0.0";
    const sums = { pace: 0, defense: 0, technique: 0, physical: 0, attack: 0 };
    const counts = {
      pace: 0,
      defense: 0,
      technique: 0,
      physical: 0,
      attack: 0,
    };

    let monthSum = 0;
    let monthCount = 0;

    allMatches.forEach((curr) => {
      const p = Number(curr.match_pace || 0);
      const d = Number(curr.match_defense || 0);
      const t = Number(curr.match_technique || 0);
      const f = Number(curr.match_physical || 0);
      const a = Number(curr.match_attack || 0);

      if (p > 0) {
        sums.pace += p;
        counts.pace++;
      }
      if (d > 0) {
        sums.defense += d;
        counts.defense++;
      }
      if (t > 0) {
        sums.technique += t;
        counts.technique++;
      }
      if (f > 0) {
        sums.physical += f;
        counts.physical++;
      }
      if (a > 0) {
        sums.attack += a;
        counts.attack++;
      }

      const mDate = new Date(curr.matches.date_time);
      if (
        mDate.getMonth() === now.getMonth() &&
        mDate.getFullYear() === now.getFullYear()
      ) {
        monthSum += Number(curr.match_rating || 0);
        monthCount++;
      }
    });

    if (allMatches.length > 0) {
      historicalAvg = (
        allMatches.reduce((acc, m) => acc + Number(m.match_rating || 0), 0) /
        allMatches.length
      ).toFixed(1);
    }
    if (monthCount > 0) {
      monthAvg = (monthSum / monthCount).toFixed(1);
    }

    const userAverages = {
      pace: counts.pace > 0 ? Number((sums.pace / counts.pace).toFixed(1)) : 0,
      defense:
        counts.defense > 0
          ? Number((sums.defense / counts.defense).toFixed(1))
          : 0,
      technique:
        counts.technique > 0
          ? Number((sums.technique / counts.technique).toFixed(1))
          : 0,
      physical:
        counts.physical > 0
          ? Number((sums.physical / counts.physical).toFixed(1))
          : 0,
      attack:
        counts.attack > 0
          ? Number((sums.attack / counts.attack).toFixed(1))
          : 0,
    };

    // --- Serie evolución: partido a partido (tú vs compañero opcional). Promedio liga = leagueAverages en cliente ---
    const matchIds = [...new Set(allMatches.map((m) => m.match_id))];

    const statsFromMatchPlayer = (row: {
      match_rating: unknown;
      match_pace: unknown;
      match_defense: unknown;
      match_technique: unknown;
      match_physical: unknown;
      match_attack: unknown;
    }) => ({
      rating: Number(row.match_rating || 0),
      pace: Number(row.match_pace || 0),
      defense: Number(row.match_defense || 0),
      technique: Number(row.match_technique || 0),
      physical: Number(row.match_physical || 0),
      attack: Number(row.match_attack || 0),
    });

    const compareUserIdParam =
      typeof req.query.compareUserId === "string" &&
      req.query.compareUserId.trim().length > 0
        ? req.query.compareUserId.trim()
        : undefined;

    let compareUserMeta: { id: string; label: string } | null = null;
    const peerByMatchId = new Map<string, ReturnType<typeof statsFromMatchPlayer>>();

    if (
      compareUserIdParam &&
      compareUserIdParam !== userId &&
      matchIds.length > 0
    ) {
      const peerMembership = await prisma.league_members.findUnique({
        where: {
          league_id_user_id: {
            league_id: leagueId,
            user_id: compareUserIdParam,
          },
        },
      });
      if (peerMembership) {
        const peerProfile = await prisma.users.findUnique({
          where: { id: compareUserIdParam },
          select: { full_name: true, username: true },
        });
        compareUserMeta = {
          id: compareUserIdParam,
          label:
            peerProfile?.full_name?.trim() ||
            peerProfile?.username ||
            "Compañero",
        };
        const peerRows = await prisma.match_players.findMany({
          where: {
            user_id: compareUserIdParam,
            match_id: { in: matchIds },
          },
        });
        for (const row of peerRows) {
          peerByMatchId.set(row.match_id, statsFromMatchPlayer(row));
        }
      }
    }

    const evolutionSeries = allMatches.map((mp) => ({
      matchId: mp.matches.id,
      dateTime: mp.matches.date_time.toISOString(),
      user: statsFromMatchPlayer(mp),
      peer: peerByMatchId.get(mp.match_id) ?? null,
    }));

    const last5Matches = [...allMatches].reverse().slice(0, 5);
    const form = last5Matches.map((mp) => {
      const sA = mp.matches.team_a_score || 0;
      const sB = mp.matches.team_b_score || 0;
      if (sA === sB) return "D";
      return (mp.team === "A" ? sA > sB : sB > sA) ? "W" : "L";
    });

    const bestMatchStat = [...allMatches].sort(
      (a, b) => Number(b.match_rating || 0) - Number(a.match_rating || 0),
    )[0];

    res.json({
      historicalAvg,
      monthAvg,
      form,
      activityDates: activityMatches.map((m) => m.matches.date_time.toISOString()),
      averages: userAverages,
      leagueAverages,
      evolutionSeries,
      compareUser: compareUserMeta,
      bestMatch: bestMatchStat
        ? {
            rating: Number(bestMatchStat.match_rating || 0).toFixed(1),
            date: bestMatchStat.matches.date_time,
            location: bestMatchStat.matches.location_name,
          }
        : null,
      recentMatches: allMatches.map((mp) => ({
        rating: Number(mp.match_rating || 0).toFixed(1),
        matches: {
          id: mp.matches.id,
          date_time: mp.matches.date_time,
          location_name: mp.matches.location_name,
        },
      })),
    });
  } catch (error) {
    log.errorWithErr("getLeagueStats failed", error, { leagueId: req.params.id, userId: req.user?.userId });
    return sendError(res, 500, { error: "Internal error" });
  }
};

export const getMonthlyPredictionRewardPopup = async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.id as string;
    const userId = req.user?.userId;
    const isLeagueUuid =
      typeof leagueId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        leagueId,
      );
    if (!userId || !isLeagueUuid) {
      return res.json({ show: false });
    }

    const row = await prisma.monthly_prediction_reward_popups.findFirst({
      where: {
        user_id: userId,
        league_id: leagueId,
        seen_at: null,
        ttp_amount: { gt: 0 },
      },
      orderBy: { created_at: "desc" },
    });

    if (!row) {
      return res.json({ show: false });
    }

    // Mark as seen immediately (one-shot UX).
    await prisma.monthly_prediction_reward_popups.update({
      where: { id: row.id },
      data: { seen_at: new Date() },
    });

    return res.json({
      show: true,
      periodKey: row.period_key,
      amount: row.ttp_amount,
      meta: row.meta ?? null,
    });
  } catch (e) {
    const code =
      typeof e === "object" && e !== null ? (e as { code?: string }).code : undefined;
    // Dev safety: si la migración no fue aplicada aún, no queremos romper el home/perfil.
    if (code === "P2021") {
      return res.json({ show: false });
    }
    log.errorWithErr("getMonthlyPredictionRewardPopup failed", e, { leagueId: req.params.id, userId: req.user?.userId });
    return res.json({ show: false });
  }
};

export const getOtherUserLeagueStats = async (req: Request, res: Response) => {
  const leagueId = req.params.id as string; // Del router /leagues/:id/...
  const targetUserId = req.params.userId as string; // Del router .../users/:userId/stats

  if (!targetUserId || !leagueId) {
    return sendError(res, 400, { error: "Faltan parámetros" });
  }

  try {
    const now = new Date();
    const activityFrom = new Date(now);
    activityFrom.setDate(activityFrom.getDate() - 364);
    const activityTo = new Date(now);
    activityTo.setDate(activityTo.getDate() + 2);

    const activityMatches = await prisma.match_players.findMany({
      where: {
        user_id: targetUserId,
        matches: {
          league_id: leagueId,
          status: { notIn: ["CANCELLED"] },
          date_time: { gte: activityFrom, lte: activityTo },
        },
      },
      select: { matches: { select: { date_time: true } } },
      orderBy: { matches: { date_time: "asc" } },
    });
    const activityDates = activityMatches.map((m) =>
      m.matches.date_time.toISOString(),
    );

    // 1. OBTENER DATOS HISTÓRICOS
    const memberStats = await prisma.league_members.findFirst({
      where: {
        league_id: leagueId,
        user_id: targetUserId, // <--- AQUÍ USAMOS EL ID DEL OBJETIVO
      },
      select: {
        league_overall: true,
        matches_played: true,
      },
    });

    // 2. OBTENER PARTIDOS RECIENTES
    const allMatches = await prisma.match_players.findMany({
      where: {
        user_id: targetUserId, // <--- AQUÍ USAMOS EL ID DEL OBJETIVO
        matches: {
          league_id: leagueId,
          status: "COMPLETED",
        },
        match_rating: { not: null },
      },
      include: {
        matches: {
          select: {
            id: true,
            date_time: true,
            location_name: true,
            team_a_score: true,
            team_b_score: true,
          },
        },
      },
      orderBy: {
        matches: {
          date_time: "desc",
        },
      },
    });

    // Si no existen datos, devolvemos ceros
    if (!memberStats) {
      return res.json({
        historicalAvg: "0.0",
        monthAvg: "0.0",
        bestMatch: null,
        recentMatches: [],
        form: [],
        activityDates,
      });
    }

    // --- CÁLCULOS (Idéntico a tu lógica anterior) ---

    // Racha (Form)
    const last5Matches = allMatches.slice(0, 5);
    const form = last5Matches.map((mp) => {
      const myTeam = mp.team;
      const scoreA = mp.matches.team_a_score || 0;
      const scoreB = mp.matches.team_b_score || 0;

      if (scoreA === scoreB) return "D";
      if (myTeam === "A") return scoreA > scoreB ? "W" : "L";
      else return scoreB > scoreA ? "W" : "L";
    });

    // A) Promedio Histórico
    const historicalAvg = memberStats.league_overall
      ? Number(memberStats.league_overall).toFixed(1)
      : "0.0";

    // B) Promedio del Mes Actual
    const currentMonthMatches = allMatches.filter((mp) => {
      if (!mp.matches?.date_time) return false;
      const matchDate = new Date(mp.matches.date_time);
      return (
        matchDate.getMonth() === now.getMonth() &&
        matchDate.getFullYear() === now.getFullYear()
      );
    });

    let monthAvg = "0.0";
    if (currentMonthMatches.length > 0) {
      const sumMonth = currentMonthMatches.reduce(
        (acc, curr) => acc + Number(curr.match_rating || 0),
        0,
      );
      monthAvg = (sumMonth / currentMonthMatches.length).toFixed(1);
    } else {
      monthAvg = "N/A";
    }

    // C) Mejor Partido
    const validMatches = allMatches.filter(
      (m) => Number(m.match_rating || 0) > 0,
    );
    const bestMatchStat = [...validMatches].sort(
      (a, b) => Number(b.match_rating) - Number(a.match_rating),
    )[0];

    // D) Formatear lista
    const recentMatchesFormatted = allMatches.map((mp) => ({
      rating: Number(mp.match_rating || 0).toFixed(1),
      matches: {
        id: mp.matches.id,
        date_time: mp.matches.date_time,
        location_name: mp.matches.location_name,
      },
    }));

    res.json({
      historicalAvg,
      form,
      monthAvg,
      bestMatch: bestMatchStat
        ? {
            rating: Number(bestMatchStat.match_rating).toFixed(1),
            date: bestMatchStat.matches.date_time,
            location: bestMatchStat.matches.location_name,
          }
        : null,
      recentMatches: recentMatchesFormatted,
      activityDates,
    });
  } catch (error) {
    log.errorWithErr("getOtherUserLeagueStats failed", error, { leagueId: req.params.id, targetUserId: req.params.userId });
    return sendError(res, 500, {
      error: "Error interno",
      details: [{ message: String(error) }],
    });
  }
};

export const updateMemberRole = async (req: Request, res: Response) => {
  try {
    const memberId = req.params.memberId as string;
    const leagueId = req.params.leagueId as string;
    const { newRole } = req.body;
    const requesterId = req.user?.userId;
    if (!requesterId) {
      return sendError(res, 401, { error: "Unauthorized" });
    }

    if (![LeagueRole.ADMIN, LeagueRole.MEMBER].includes(newRole)) {
      return sendError(res, 400, { error: "Rol inválido." });
    }

    const requester = await prisma.league_members.findUnique({
      where: {
        league_id_user_id: {
          league_id: leagueId,
          user_id: requesterId,
        },
      },
    });

    if (
      !requester ||
      !isLeagueStaffRole(requester.role)
    ) {
      return sendError(res, 403, { error: "No tienes permisos de administrador." });
    }

    const target = await prisma.league_members.findUnique({
      where: {
        league_id_user_id: {
          league_id: leagueId,
          user_id: memberId,
        },
      },
    });

    if (!target) {
      return sendError(res, 404, { error: "El usuario no pertenece a esta liga." });
    }

    // 5. REGLA: Nadie toca al OWNER
    if (normalizeUpper(target.role) === LeagueRole.OWNER) {
      return sendError(res, 403, { error: "El creador de la liga no puede ser modificado." });
    }

    // 6. EJECUTAR ACTUALIZACIÓN
    const updated = await prisma.league_members.update({
      where: {
        league_id_user_id: {
          league_id: leagueId,
          user_id: memberId,
        },
      },
      data: {
        role: newRole,
      },
    });

    return res.json({
      message: "Rol actualizado correctamente",
      member: updated,
    });
  } catch (error: any) {
    // ESTO ES LO MÁS IMPORTANTE: Ver el error real en la consola
    log.errorWithErr("updateMemberRole prisma error", error, { leagueId: req.params.leagueId, memberId: req.params.memberId });

    // Si el error es P2025 es que no encontró el registro
    if (error.code === "P2025") {
      return sendError(res, 404, { error: "No se encontró el miembro para actualizar." });
    }

    return sendError(res, 500, {
      error: "Error interno",
      details: error.message, // Enviamos el mensaje real para debuggear en el front
    });
  }
};

export const getAdvancedStats = async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string;
    const userId = req.user?.userId;
    if (!userId) {
      return sendError(res, 401, { error: "Unauthorized" });
    }

    // 1. Obtener todos los partidos finalizados de esta liga donde participó el usuario
    const matches = await prisma.matches.findMany({
      where: {
        league_id: leagueId,
        status: MatchStatus.COMPLETED, // Solo partidos terminados
        match_players: { some: { user_id: userId } },
      },
      include: {
        match_players: {
          include: {
            users: {
              select: {
                id: true,
                username: true,
                full_name: true,
                profile_photo_url: true,
              },
            },
          },
        },
      },
    });

    // 2. Duelos de la liga: partidos de la liga + duelos donde el usuario es challenger o rival
    const leagueMatchIds = await prisma.matches.findMany({
      where: { league_id: leagueId },
      select: { id: true },
    });
    const matchIds = leagueMatchIds.map((m) => m.id);

    const duelsList =
      matchIds.length === 0
        ? []
        : await prisma.duels.findMany({
            where: {
              match_id: { in: matchIds },
              OR: [{ challenger_id: userId }, { rival_id: userId }],
            },
            include: {
              challenger: {
                select: {
                  id: true,
                  full_name: true,
                  username: true,
                  profile_photo_url: true,
                },
              },
              rival: {
                select: {
                  id: true,
                  full_name: true,
                  username: true,
                  profile_photo_url: true,
                },
              },
            },
          });

    // --- DUELOS: siempre se calculan desde duelsList (aunque no tengas partidos) ---
    const duelByOpponent = new Map<
      string,
      {
        userId: string;
        name: string;
        photo: string | null;
        duelsPlayed: number;
        wins: number;
        losses: number;
      }
    >();

    duelsList.forEach((d) => {
      const iAmChallenger = d.challenger_id === userId;
      const opponent = iAmChallenger ? d.rival : d.challenger;
      const opponentId = opponent.id;
      const iWon = d.winner_id === userId;

      const current = duelByOpponent.get(opponentId) || {
        userId: opponentId,
        name: opponent.full_name || opponent.username,
        photo: opponent.profile_photo_url,
        duelsPlayed: 0,
        wins: 0,
        losses: 0,
      };
      current.duelsPlayed += 1;
      if (d.winner_id) {
        if (iWon) current.wins += 1;
        else current.losses += 1;
      }
      duelByOpponent.set(opponentId, current);
    });

    const duelStatsList = Array.from(duelByOpponent.values()).filter(
      (s) => s.duelsPlayed >= 1,
    );
    const byDuelWinsDesc = [...duelStatsList].sort(
      (a, b) => b.wins - a.wins || b.duelsPlayed - a.duelsPlayed,
    );
    const byDuelLossesDesc = [...duelStatsList].sort(
      (a, b) => b.losses - a.losses || b.duelsPlayed - a.duelsPlayed,
    );

    const duelVictim = byDuelWinsDesc[0]
      ? {
          ...byDuelWinsDesc[0],
          winRate: Math.round(
            (byDuelWinsDesc[0].wins / byDuelWinsDesc[0].duelsPlayed) * 100,
          ),
        }
      : null;
    let duelNemesis: any = null;
    if (byDuelLossesDesc.length > 0) {
      const rawCandidate =
        byDuelLossesDesc.find((d) => d.userId !== duelVictim?.userId) ??
        byDuelLossesDesc[0];
      if (rawCandidate && rawCandidate.losses > 0) {
        duelNemesis = {
          ...rawCandidate,
          // winRate = mi % de victorias; en el front 100 - winRate = «Él te gana X%»
          winRate: Math.round(
            (rawCandidate.wins / rawCandidate.duelsPlayed) * 100,
          ),
        };
      }
    }

    if (!matches || matches.length === 0) {
      return res.json({
        bestPartner: null,
        worstPartner: null,
        biggestRival: null,
        easyTarget: null,
        duelVictim,
        duelNemesis,
      });
    }

    // Mapas para acumular estadísticas (partidos en cancha)
    // Key: userId del compañero/rival
    const partners = new Map();
    const rivals = new Map();

    matches.forEach((match) => {
      const myPlayer = match.match_players.find((p) => p.user_id === userId);
      if (
        !myPlayer ||
        match.team_a_score === null ||
        match.team_b_score === null
      )
        return;

      const myTeam = myPlayer.team;
      const iWon =
        (myTeam === "A" && match.team_a_score > match.team_b_score) ||
        (myTeam === "B" && match.team_b_score > match.team_a_score);

      const isDraw = match.team_a_score === match.team_b_score;

      // Omitimos empates para que el cálculo de "Hijo/Padre" sea sobre decisiones claras
      if (isDraw) return;

      match.match_players.forEach((p) => {
        if (p.user_id === userId) return; // No contarse a uno mismo

        const statsMap = p.team === myTeam ? partners : rivals;

        const current = statsMap.get(p.user_id) || {
          userId: p.user_id,
          wins: 0,
          losses: 0,
          matches: 0,
          name: p.users.full_name || p.users.username,
          photo: p.users.profile_photo_url,
        };

        current.matches += 1;
        if (iWon) {
          current.wins += 1;
        } else {
          current.losses += 1;
        }

        statsMap.set(p.user_id, current);
      });
    });

    // Función para formatear y calcular winRate basándose en MIS victorias
    const formatStatsList = (map: Map<string, any>) => {
      return Array.from(map.values())
        .filter((item) => item.matches >= 1)
        .map((item) => ({
          ...item,
          // Este winRate siempre representa "Qué tan bien me va a MI con/contra este tipo"
          winRate: Math.round((item.wins / item.matches) * 100),
        }));
    };

    const partnersList = formatStatsList(partners);
    const rivalsList = formatStatsList(rivals);

    // --- SOCIOS: por cantidad de partidos ganados/perdidos juntos (no por %) ---
    // Mejor socio = compañero con el que más veces jugaste y ganaste (más victorias juntos)
    const byPartnerWinsDesc = [...partnersList].sort(
      (a, b) => b.wins - a.wins || b.matches - a.matches,
    );
    // Peor socio = compañero con el que más veces jugaste y perdiste (más derrotas juntos)
    const byPartnerLossesDesc = [...partnersList].sort(
      (a, b) => b.losses - a.losses || b.matches - a.matches,
    );

    const bestPartner = byPartnerWinsDesc[0] ?? null;
    const worstPartner =
      byPartnerLossesDesc[0] && byPartnerLossesDesc[0].losses > 0
        ? byPartnerLossesDesc[0]
        : null;

    // --- RIVALES EN CANCHA: por cantidad de partidos ganados/perdidos contra ellos ---
    // Tu víctima = rival al que más veces le ganaste (más victorias tuyas cuando está enfrente)
    const byRivalWinsDesc = [...rivalsList].sort(
      (a, b) => b.wins - a.wins || b.matches - a.matches,
    );
    // Tu rival directo = rival que más veces te ganó (más derrotas tuyas contra él)
    const byRivalLossesDesc = [...rivalsList].sort(
      (a, b) => b.losses - a.losses || b.matches - a.matches,
    );

    const easyTarget = byRivalWinsDesc[0] ?? null;
    const biggestRival =
      byRivalLossesDesc[0] && byRivalLossesDesc[0].losses > 0
        ? byRivalLossesDesc[0]
        : null;

    res.json({
      bestPartner,
      worstPartner,
      easyTarget: easyTarget
        ? { ...easyTarget, winRateAgainst: easyTarget.winRate }
        : null,
      biggestRival: biggestRival
        ? { ...biggestRival, winRateAgainst: biggestRival.winRate }
        : null,
      duelVictim: duelVictim ?? null,
      duelNemesis: duelNemesis ?? null,
    });
  } catch (error) {
    log.errorWithErr("getAdvancedStats failed", error, { leagueId: req.params.leagueId, userId: req.user?.userId });
    return sendError(res, 500, { error: "Error interno al calcular estadísticas" });
  }
};
