import type { Request, Response } from "express";
import { prisma } from "../server.js";

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
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!name) {
      return res.status(400).json({ error: "League name is required" });
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
            role: "OWNER",
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
    console.error("Error creating league:", error);
    res.status(500).json({ error: "Failed to create league" });
  }
};

export const joinLeague = async (req: Request, res: Response) => {
  try {
    const { code } = req.body; // Recibimos el código de invitación
    const userId = req.user?.userId;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!code)
      return res.status(400).json({ error: "Invite code is required" });

    // 1. Buscamos la liga por el código
    const league = await prisma.leagues.findUnique({
      where: { invite_code: code.toUpperCase() }, // Aseguramos mayúsculas
    });

    if (!league) {
      return res
        .status(404)
        .json({ error: "Liga no encontrada. Verificá el código." });
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
      return res.status(400).json({ error: "Ya sos miembro de esta liga." });
    }

    // 3. Agregamos al usuario como MEMBER (nunca OWNER: solo el creador lo es)
    await prisma.league_members.create({
      data: {
        user_id: userId,
        league_id: league.id,
        role: "MEMBER",
        league_overall: 0.0,
        is_banned: false,
      },
    });

    res
      .status(200)
      .json({ message: `Te uniste a ${league.name} exitosamente.` });
  } catch (error) {
    console.error("Error joining league:", error);
    res.status(500).json({ error: "Error al unirse a la liga" });
  }
};

export const updateLeague = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { name, description } = req.body;
  try {
    const updated = await prisma.leagues.update({
      where: { id },
      data: { name, description },
    });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: "Error updating" });
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
    res.status(500).json({ error: "Error removing member" });
  }
};

export const leaveLeague = async (req: Request, res: Response) => {
  const leagueId = req.params.leagueId as string;
  const userId = (req as any).user?.id;
  try {
    await prisma.league_members.deleteMany({
      where: {
        league_id: leagueId,
        user_id: userId,
      },
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Error leaving league" });
  }
};

// 4. ELIMINAR LIGA (DELETE)
export const deleteLeague = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  try {
    await prisma.leagues.delete({ where: { id } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Error deleting league" });
  }
};

export const getLeagueMembers = async (req: Request, res: Response) => {
  const id = req.params.id as string; // El ID de la liga

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
    console.error(error);
    res.status(500).json({ error: "Error obteniendo miembros" });
  }
};

export const getLeagueById = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const userId = (req as any).user?.userId;

  try {
    if (!id || id === "undefined" || id === "null") {
      return res.status(400).json({ error: "ID de liga inválido" });
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

    if (!league) return res.status(404).json({ error: "Liga no encontrada" });
    const userRole = league.league_members[0]?.role || "NONE";

    res.json({
      ...league,
      userRole, // <-- LA CLAVE: El frontend recibe esto directamente
      league_members: undefined, // Limpiamos para no enviar datos innecesarios
    });
  } catch (error) {
    console.error("Error interno:", error);
    res.status(500).json({ error: "Error fetching league" });
  }
};

export const getGeneralRanking = async (req: Request, res: Response) => {
  const leagueId = (req.params.id || req.params.leagueId) as string;
  const { period } = req.query;

  if (!leagueId || leagueId === "undefined") {
    return res.status(400).json({ message: "ID de liga inválido" });
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
    console.error("Error en ranking:", error);
    return res
      .status(500)
      .json({ message: "Error interno del servidor", error: error.message });
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
    console.error("Error en getHonorsRanking:", error);
    return res
      .status(500)
      .json({ message: "Error al obtener honores de miembros." });
  }
};

export const getUserLeagueStats = async (req: Request, res: Response) => {
  const leagueId = req.params.id as string;
  const userId = (req as any).user?.userId;

  if (!userId || !leagueId) {
    return res.status(400).json({ error: "Faltan parámetros" });
  }

  try {
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

    const now = new Date();
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
      averages: userAverages,
      leagueAverages,
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
    console.error("getLeagueStats error:", error);
    res.status(500).json({ error: "Internal error" });
  }
};

export const getOtherUserLeagueStats = async (req: Request, res: Response) => {
  const leagueId = req.params.id as string; // Del router /leagues/:id/...
  const targetUserId = req.params.userId as string; // Del router .../users/:userId/stats

  if (!targetUserId || !leagueId) {
    return res.status(400).json({ error: "Faltan parámetros" });
  }

  try {
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
    const now = new Date();
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
    });
  } catch (error) {
    console.error("Error obteniendo stats de otro usuario:", error);
    res.status(500).json({ error: "Error interno", details: String(error) });
  }
};

export const updateMemberRole = async (req: Request, res: Response) => {
  try {
    const memberId = req.params.memberId as string;
    const leagueId = req.params.leagueId as string;
    const { newRole } = req.body;
    const requesterId = (req as any).user?.userId;

    if (!["ADMIN", "MEMBER"].includes(newRole)) {
      return res.status(400).json({ error: "Rol inválido." });
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
      (requester.role !== "OWNER" && requester.role !== "ADMIN")
    ) {
      return res
        .status(403)
        .json({ error: "No tienes permisos de administrador." });
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
      return res
        .status(404)
        .json({ error: "El usuario no pertenece a esta liga." });
    }

    // 5. REGLA: Nadie toca al OWNER
    if (target.role === "OWNER") {
      return res
        .status(403)
        .json({ error: "El creador de la liga no puede ser modificado." });
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
    console.error("PRISMA ERROR:", error);

    // Si el error es P2025 es que no encontró el registro
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ error: "No se encontró el miembro para actualizar." });
    }

    res.status(500).json({
      error: "Error interno",
      details: error.message, // Enviamos el mensaje real para debuggear en el front
    });
  }
};

export const getAdvancedStats = async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string;
    const userId = (req as any).user.userId as string;

    // 1. Obtener todos los partidos finalizados de esta liga donde participó el usuario
    const matches = await prisma.matches.findMany({
      where: {
        league_id: leagueId,
        status: "COMPLETED", // Solo partidos terminados
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

    if (!matches || matches.length === 0) {
      return res.json({
        bestPartner: null,
        worstPartner: null,
        biggestRival: null,
        easyTarget: null,
      });
    }

    // Mapas para acumular estadísticas
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
          wins: 0, // Victorias del usuario logueado
          losses: 0, // Derrotas del usuario logueado
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

    // --- LÓGICA DE SELECCIÓN ---

    // 1. MEJOR SOCIO: Con el que tengo más % de victoria (Mínimo 1 partido)
    // Desempate por cantidad de partidos jugados juntos
    const bestPartner =
      partnersList.length > 0
        ? partnersList.sort(
            (a, b) => b.winRate - a.winRate || b.matches - a.matches,
          )[0]
        : null;

    // 2. QUÍMICA NEGATIVA: Con el que tengo menos % de victoria
    const worstPartner =
      partnersList.length > 0
        ? partnersList.sort(
            (a, b) => a.winRate - b.winRate || b.matches - a.matches,
          )[0]
        : null;

    // 3. TU VÍCTIMA (Hijo): El rival al que más veces le has GANADO (winRate alto para ti)
    const easyTarget =
      rivalsList.length > 0
        ? rivalsList.sort(
            (a, b) => b.winRate - a.winRate || b.matches - a.matches,
          )[0]
        : null;

    // 4. TU RIVAL DIRECTO (Padre/Verdugo): El rival contra el que más has PERDIDO (winRate bajo para ti)
    // Si Juan te ganó 2 y tú 0, tu winRate contra él es 0%. Es tu mayor verdugo.
    const biggestRival =
      rivalsList.length > 0
        ? rivalsList.sort(
            (a, b) => a.winRate - b.winRate || b.matches - a.matches,
          )[0]
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
    });
  } catch (error) {
    console.error("Error en advanced stats:", error);
    res.status(500).json({ error: "Error interno al calcular estadísticas" });
  }
};
