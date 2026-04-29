import type { Request, Response } from "express";
import { prisma } from "../server.js";
import * as MatchService from "../services/MatchService.js";
import * as DuelService from "../services/DuelService.js";
import * as PredictionService from "../services/PredictionService.js";
import { sendNotification } from "../services/NotificationService.js";
import { grantTtpInTx } from "../services/TtpService.js";
import { signupToMatch, unsignupFromMatch } from "../services/MatchSignupService.js";
import * as MatchCommentService from "../services/MatchCommentService.js";
import { MatchMode, MatchStatus, isLeagueStaffRole, normalizeUpper } from "../constants/domain.js";
import { isUuid } from "../utils/ids.js";
import { sendCaughtError, sendError } from "../utils/httpErrors.js";
import { validateBody } from "../utils/validate.js";
import { z } from "zod";
import { selectUserPublicLite } from "../selects/userSelects.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("matchController");

type UserMatchStatus = "NOT_CONVOKED" | "CONFIRMED" | "PENDING";

function computeUserStatusFromPlayers(
  matchPlayers: Array<{ user_id: string; has_confirmed: boolean }>,
  userId: string,
): { userStatus: UserMatchStatus; userIsPlayer: boolean } {
  const playerRecord = matchPlayers.find((p) => String(p.user_id) === String(userId));
  if (!playerRecord) return { userStatus: "NOT_CONVOKED", userIsPlayer: false };
  return { userStatus: playerRecord.has_confirmed ? "CONFIRMED" : "PENDING", userIsPlayer: true };
}

function decorateMatchForUser(params: {
  match: any;
  userId: string;
  signedUpCount: number;
  spectatorAttending: boolean;
  userIsPlayer: boolean;
  userStatus: UserMatchStatus;
}) {
  const { match, userStatus, spectatorAttending, signedUpCount, userIsPlayer } = params;
  return {
    ...match,
    user_status: userStatus,
    spectator_attending: spectatorAttending,
    is_open_signup: (match as any).is_open_signup === true,
    max_players: (match as any).max_players ?? null,
    signed_up_count: signedUpCount,
    user_signed_up: userIsPlayer,
  };
}

const MATCH_TTP_REWARDS = {
  PLAYED: 15,
  SPECTATOR: 5,
  MVP: 45,
  ORACLE: 30,
  DUEL_WIN: 20,
  RANK: [40, 25, 10] as number[],
} as const;

async function buildUserMatchTtpSummary(matchId: string, userId: string) {
  const [match, matchPlayer, spectator, honors, duel] = await Promise.all([
    prisma.matches.findUnique({
      where: { id: matchId },
      select: { id: true, status: true },
    }),
    prisma.match_players.findUnique({
      where: { match_id_user_id: { match_id: matchId, user_id: userId } },
      select: { has_confirmed: true, match_rating: true },
    }),
    prisma.match_spectators.findUnique({
      where: { match_id_user_id: { match_id: matchId, user_id: userId } },
      select: { attending: true },
    }),
    prisma.honors.findMany({
      where: { match_id: matchId, user_id: userId },
      select: { honor_type: true },
    }),
    prisma.duels.findFirst({
      where: { match_id: matchId, status: "COMPLETED" },
      select: { winner_id: true },
    }),
  ]);

  if (!match) return null;
  const breakdown: Array<{ key: string; label: string; amount: number }> = [];

  if (matchPlayer?.has_confirmed === true) {
    breakdown.push({ key: "played", label: "Participación", amount: MATCH_TTP_REWARDS.PLAYED });
  } else if (spectator?.attending === true) {
    breakdown.push({ key: "spectator", label: "Espectador", amount: MATCH_TTP_REWARDS.SPECTATOR });
  }

  const honorSet = new Set(honors.map((h) => String(h.honor_type).toUpperCase()));
  if (honorSet.has("MVP")) {
    breakdown.push({ key: "mvp", label: "Medalla MVP", amount: MATCH_TTP_REWARDS.MVP });
  }
  if (honorSet.has("ORACLE")) {
    breakdown.push({ key: "oracle", label: "Medalla Oracle", amount: MATCH_TTP_REWARDS.ORACLE });
  }

  if (duel?.winner_id === userId) {
    breakdown.push({ key: "duel", label: "Ganador del duelo", amount: MATCH_TTP_REWARDS.DUEL_WIN });
  }

  if (matchPlayer?.has_confirmed === true) {
    const ranking = await prisma.match_players.findMany({
      where: { match_id: matchId, has_confirmed: true },
      select: { user_id: true, match_rating: true },
      orderBy: [{ match_rating: "desc" }, { user_id: "asc" }],
    });
    const rankIndex = ranking.findIndex((p) => p.user_id === userId);
    if (rankIndex >= 0 && rankIndex < MATCH_TTP_REWARDS.RANK.length) {
      const amount = MATCH_TTP_REWARDS.RANK[rankIndex] ?? 0;
      if (amount > 0) {
        breakdown.push({
          key: `rank_${rankIndex + 1}`,
          label: `Ranking #${rankIndex + 1}`,
          amount,
        });
      }
    }
  }

  const total = breakdown.reduce((sum, item) => sum + item.amount, 0);
  const alreadyClaimed = await prisma.ttp_ledger.findFirst({
    where: {
      user_id: userId,
      reason: "MATCH_TTP_CLAIM",
      ref_type: "match",
      ref_id: matchId,
    },
    select: { id: true, created_at: true },
  });

  return {
    total,
    breakdown,
    claimed: !!alreadyClaimed,
    claimed_at: alreadyClaimed?.created_at ?? null,
    can_claim: total > 0 && !alreadyClaimed && String(match.status || "").toUpperCase() === "COMPLETED",
  };
}

export const createMatch = async (req: Request, res: Response) => {
  try {
    const { leagueId, location, dateTime, price, players, isOpenSignup, maxPlayers, matchMode } = req.body;
    const userId = req.user?.userId;

    if (!leagueId || !location || !dateTime) {
      return sendError(res, 400, { error: "Faltan datos obligatorios (Liga, Lugar o Fecha)." });
    }
    if (!userId) {
      return sendError(res, 401, { error: "Usuario no autenticado" });
    }

    const matchDate = new Date(dateTime);
    if (isNaN(matchDate.getTime())) {
      return sendError(res, 400, { error: "Formato de fecha inválido." });
    }

    let finalPrice = 0;
    if (typeof price === "string") {
      finalPrice = parseFloat(price.replace(/\./g, "").replace(",", "."));
    } else {
      finalPrice = Number(price);
    }

    // Permitir creación por cualquier miembro de la liga (no solo admin).
    const member = await prisma.league_members.findUnique({
      where: { league_id_user_id: { league_id: leagueId, user_id: userId } },
      select: { user_id: true, is_banned: true },
    });
    if (!member || member.is_banned === true) {
      return sendError(res, 403, {
        error: "FORBIDDEN",
        message: "Debes ser miembro activo de la liga para crear partidos.",
      });
    }

    const openSignup = isOpenSignup === true;
    if (openSignup) {
      const n = Number(maxPlayers);
      if (!Number.isFinite(n) || n < 2) {
        return sendError(res, 400, {
          error: "INVALID_MAX_PLAYERS",
          message: "Debes definir un límite de jugadores (mínimo 2).",
        });
      }
    } else {
      // Modo convocatoria (el de siempre): debe haber jugadores.
      if (!players || !Array.isArray(players) || players.length === 0) {
        return sendError(res, 400, {
          error: "PLAYERS_REQUIRED",
          message: "Debes convocar al menos un jugador.",
        });
      }
    }

    const result = await MatchService.createMatch({
      leagueId,
      adminId: userId,
      location,
      dateTime: matchDate,
      price: finalPrice,
      players,
      isOpenSignup: openSignup,
      maxPlayers: openSignup ? Number(maxPlayers) : undefined,
      matchMode: matchMode === "EXTERNAL" ? "EXTERNAL" : "INTERNAL",
    });

    res.status(201).json({
      message: "Partido creado exitosamente",
      match: result,
    });

    // Notificaciones: convocatoria a cada jugador convocado
    if (!openSignup && players && Array.isArray(players) && players.length > 0) {
      const matchDateStr = matchDate.toLocaleDateString("es-AR", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
      const title = "Te convocaron";
      const body = `${location} – ${matchDateStr}. Confirmá tu asistencia.`;
      const data = { matchId: result.id, leagueId };
      for (const p of players) {
        const uid = (p as { id: string }).id;
        if (uid) {
          sendNotification(uid, "MATCH_SUMMON", title, body, data).catch((err) =>
            log.errorWithErr("MATCH_SUMMON failed", err, { userId: uid, matchId: result.id }),
          );
        }
      }
    }
  } catch (error) {
    log.errorWithErr("createMatch failed", error, { userId: req.user?.userId, leagueId: req.body?.leagueId });
    return sendError(res, 500, { error: "Error interno al crear el partido." });
  }
};

export const getNextMatch = async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string;
    const userId = req.user?.userId; // Aquí userId es string | undefined

    // 1. VALIDACIÓN ESTRICTA (Soluciona el error 1 y 3)
    // Si no hay userId, detenemos todo. TypeScript ahora sabe que abajo userId es string.
    if (!userId) {
      return sendError(res, 401, { error: "Usuario no autenticado" });
    }

    if (!isUuid(leagueId)) {
      return sendError(res, 400, { error: "leagueId inválido" });
    }

    // 2. QUERY (Ahora segura)
    const nextMatch = await prisma.matches.findFirst({
      where: {
        league_id: leagueId,
        date_time: { gte: new Date() },
        status: { notIn: [MatchStatus.CANCELLED, MatchStatus.COMPLETED] as any },
      },
      orderBy: { date_time: "asc" },
      include: {
        match_players: { select: { user_id: true, has_confirmed: true, team: true } },
      },
    });

    if (!nextMatch) {
      return res.json(null);
    }

    const { userStatus, userIsPlayer } = computeUserStatusFromPlayers(
      nextMatch.match_players.map((p) => ({
        user_id: String(p.user_id),
        has_confirmed: p.has_confirmed === true,
      })),
      userId,
    );

    const spectator = await prisma.match_spectators.findUnique({
      where: { match_id_user_id: { match_id: nextMatch.id, user_id: userId } },
      select: { attending: true },
    });

    const signedUpCount = await prisma.match_players.count({
      where: { match_id: nextMatch.id },
    });

    return res.json(
      decorateMatchForUser({
        match: nextMatch,
        userId,
        userStatus,
        userIsPlayer,
        spectatorAttending: spectator?.attending ?? false,
        signedUpCount,
      }),
    );
  } catch (error) {
    log.errorWithErr("getNextMatch failed", error, { leagueId: req.params.leagueId, userId: req.user?.userId });
    return sendError(res, 500, { error: "Error fetching next match" });
  }
};

export const getAllMatches = async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string;
    const userId = req.user?.userId;

    if (!userId) {
      return sendError(res, 401, { error: "Usuario no autenticado" });
    }
    if (!isUuid(leagueId)) {
      return sendError(res, 400, { error: "leagueId inválido" });
    }

    // Traemos TODOS, ordenados por fecha (los más nuevos al final o al principio según prefieras)
    // Aquí ordenamos 'asc' (el más viejo primero) para ver el calendario cronológico
    const matches = await prisma.matches.findMany({
      where: {
        league_id: leagueId,
        status: { notIn: [MatchStatus.COMPLETED, MatchStatus.CANCELLED] as any },
      },
      orderBy: { date_time: "asc" },
      include: {
        match_players: { select: { user_id: true, has_confirmed: true, team: true } },
        match_spectators: {
          where: { user_id: userId },
          select: { attending: true },
        },
      },
    });

    const matchIds = matches.map((m) => m.id);
    const counts =
      matchIds.length > 0
        ? await prisma.match_players.groupBy({
            by: ["match_id"],
            where: { match_id: { in: matchIds } },
            _count: { match_id: true },
          })
        : [];
    const countByMatchId = new Map<string, number>(
      counts.map((c: any) => [String(c.match_id), Number(c._count?.match_id ?? 0)]),
    );

    const formattedMatches = matches.map((match) => {
      const { userStatus, userIsPlayer } = computeUserStatusFromPlayers(
        (match.match_players ?? []).map((p: any) => ({
          user_id: String(p.user_id),
          has_confirmed: p.has_confirmed === true,
        })),
        String(userId),
      );

      const spectatorAttending =
        Array.isArray((match as any).match_spectators) &&
        (match as any).match_spectators[0]?.attending === true;

      const signedUpCount = countByMatchId.get(String(match.id)) ?? 0;

      return decorateMatchForUser({
        match,
        userId: String(userId),
        userStatus,
        userIsPlayer,
        spectatorAttending,
        signedUpCount,
      });
    });

    res.json(formattedMatches);
  } catch (error) {
    log.errorWithErr("getAllMatches failed", error);
    return sendError(res, 500, { error: "Error fetching all matches" });
  }
};

export const signupMatch = async (req: Request, res: Response) => {
  try {
    const matchId = req.params.matchId as string;
    const userId = req.user?.userId;
    if (!userId) return sendError(res, 401, { error: "Usuario no autenticado" });
    if (!matchId) return sendError(res, 400, { error: "Falta matchId" });

    const result = await signupToMatch({ matchId, userId });

    return res.json({ message: "Te anotaste al partido", ...result });
  } catch (error) {
    log.errorWithErr("signupMatch failed", error, { matchId: req.params.matchId, userId: req.user?.userId });
    return sendCaughtError(res, error, { status: 500, error: "SIGNUP_FAILED", message: "Error anotándose al partido" });
  }
};

export const unsignupMatch = async (req: Request, res: Response) => {
  try {
    const matchId = req.params.matchId as string;
    const userId = req.user?.userId;
    if (!userId) return sendError(res, 401, { error: "Usuario no autenticado" });
    if (!matchId) return sendError(res, 400, { error: "Falta matchId" });

    await unsignupFromMatch({ matchId, userId });
    return res.json({ message: "Te desanotaste del partido" });
  } catch (error) {
    log.errorWithErr("unsignupMatch failed", error, { matchId: req.params.matchId, userId: req.user?.userId });
    return sendCaughtError(res, error, { status: 500, error: "UNSIGNUP_FAILED", message: "Error desanotándose del partido" });
  }
};

export const confirmMatch = async (req: Request, res: Response) => {
  try {
    const matchId = req.params.matchId as string;
    const userId = req.user?.userId;

    // VALIDACIÓN ESTRICTA
    if (!userId) {
      return sendError(res, 401, { error: "Usuario no autenticado" });
    }

    if (!matchId) {
      return sendError(res, 400, { error: "Falta matchId" });
    }

    // 1) Verificar que el partido exista y esté OPEN
    const match = await prisma.matches.findUnique({
      where: { id: matchId },
      select: { status: true, date_time: true },
    });
    if (!match) {
      return sendError(res, 404, { error: "Partido no encontrado" });
    }
    if (normalizeUpper(match.status) !== MatchStatus.OPEN) {
      return sendError(res, 400, { error: "No se puede confirmar (El partido no está abierto)" });
    }

    const kickoff = new Date(match.date_time);
    if (Date.now() >= kickoff.getTime()) {
      return sendError(res, 400, {
        error: "KICKOFF_PASSED",
        message:
          "Ya pasó el horario del partido. No se puede confirmar asistencia.",
      });
    }

    // 2) Verificar que el usuario esté cargado como jugador en este partido
    const playerRecord = await prisma.match_players.findFirst({
      where: { match_id: matchId, user_id: userId },
      select: { match_id: true, user_id: true },
    });
    if (!playerRecord) {
      return sendError(res, 400, {
        error: "NO_PLAYER_RECORD",
        message:
          "No estás cargado como jugador en este partido. Pedile al admin que te agregue.",
      });
    }

    // 3) UPDATE SEGURO (solo cambia has_confirmed del registro del usuario)
    const result = await prisma.match_players.updateMany({
      where: {
        match_id: matchId,
        user_id: userId,
      },
      data: { has_confirmed: true },
    });

    if (result.count === 0) {
      return sendError(res, 400, { error: "No se puede confirmar (El partido no está abierto)" });
    }

    await tryActivateMatchPredictionsAndDuelAfterConfirm(matchId);

    res.json({ message: "Asistencia confirmada" });
  } catch (error) {
    log.errorWithErr("confirmMatch failed", error, { matchId: req.params.matchId, userId: req.user?.userId });
    return sendError(res, 500, { error: "Error confirmando asistencia" });
  }
};

export const unconfirmMatch = async (req: Request, res: Response) => {
  try {
    const matchId = req.params.matchId as string;
    const userId = req.user?.userId;

    if (!userId) return sendError(res, 401, { error: "No autorizado" });

    // 1. Buscamos el partido para ver su estado
    const match = await prisma.matches.findUnique({
      where: { id: matchId },
      select: { status: true, date_time: true },
    });

    if (!match) return sendError(res, 404, { error: "Partido no encontrado" });

    const kickoff = new Date(match.date_time);
    if (Date.now() >= kickoff.getTime()) {
      return sendError(res, 400, {
        error: "KICKOFF_PASSED",
        message:
          "Ya pasó el horario del partido. No podés modificar la asistencia.",
      });
    }

    // 2. Validación Específica con Mensaje Claro
    if (!match.status)
      return sendError(res, 404, { error: "NO se encontro un status" });
    if (match.status !== "OPEN") {
      // TRADUCCIÓN DE ESTADOS PARA EL USUARIO
      const statusMap: any = {
        [MatchStatus.ACTIVE]: "EN JUEGO",
        [MatchStatus.FINISHED]: "FINALIZADO",
        [MatchStatus.COMPLETED]: "CERRADO",
        [MatchStatus.CANCELLED]: "CANCELADO",
      };
      const estadoLeible = statusMap[match.status] || match.status;

      return sendError(res, 400, {
        error: `No puedes cancelar ahora. El partido está ${estadoLeible}.`,
      });
    }

    // 3. Ejecutar Update
    const result = await prisma.match_players.updateMany({
      where: {
        match_id: matchId,
        user_id: userId,
      },
      data: { has_confirmed: false },
    });

    if (result.count === 0)
      return sendError(res, 400, { error: "No estabas confirmado en este partido" });

    res.json({ message: "Asistencia cancelada" });
  } catch (error) {
    log.errorWithErr("unconfirmMatch failed", error, { matchId: req.params.matchId, userId: req.user?.userId });
    return sendError(res, 500, { error: "Error cancelando asistencia" });
  }
};

export const spectateMatch = async (req: Request, res: Response) => {
  try {
    const matchId = req.params.matchId as string;
    const userId = req.user?.userId;
    if (!userId) return sendError(res, 401, { error: "Usuario no autenticado" });
    if (!matchId) return sendError(res, 400, { error: "Falta matchId" });

    const match = await prisma.matches.findUnique({
      where: { id: matchId },
      select: { league_id: true },
    });
    if (!match?.league_id) return sendError(res, 404, { error: "Partido no encontrado" });

    const member = await prisma.league_members.findUnique({
      where: {
        league_id_user_id: { league_id: match.league_id, user_id: userId },
      },
      select: { user_id: true },
    });
    if (!member) {
      return sendError(res, 403, {
        error: "No eres miembro de la liga",
        message: "Debes pertenecer a la liga para ir como espectador.",
      });
    }

    const isConvoked = await prisma.match_players.findUnique({
      where: { match_id_user_id: { match_id: matchId, user_id: userId } },
      select: { user_id: true },
    });
    if (isConvoked) {
      return sendError(res, 400, {
        error: "USER_IS_PLAYER",
        message: "Ya estás convocado como jugador para este partido.",
      });
    }

    await prisma.match_spectators.upsert({
      where: { match_id_user_id: { match_id: matchId, user_id: userId } },
      create: { match_id: matchId, user_id: userId, attending: true },
      update: { attending: true },
    });

    return res.json({ message: "Asistencia como espectador confirmada", attending: true });
  } catch (error) {
    log.errorWithErr("spectateMatch failed", error, { matchId: req.params.matchId, userId: req.user?.userId });
    return sendError(res, 500, { error: "Error confirmando espectador" });
  }
};

export const unspectateMatch = async (req: Request, res: Response) => {
  try {
    const matchId = req.params.matchId as string;
    const userId = req.user?.userId;
    if (!userId) return sendError(res, 401, { error: "Usuario no autenticado" });
    if (!matchId) return sendError(res, 400, { error: "Falta matchId" });

    await prisma.match_spectators.updateMany({
      where: { match_id: matchId, user_id: userId },
      data: { attending: false },
    });

    return res.json({ message: "Asistencia como espectador cancelada", attending: false });
  } catch (error) {
    log.errorWithErr("unspectateMatch failed", error, { matchId: req.params.matchId, userId: req.user?.userId });
    return sendError(res, 500, { error: "Error cancelando espectador" });
  }
};

export const getMatchDetails = async (req: Request, res: Response) => {
  try {
    const matchId = req.params.matchId as string;
    const userId = req.user?.userId;

    const match = await prisma.matches.findUnique({
      where: { id: matchId },
      include: {
        match_players: {
          include: {
            users: {
              select: {
                ...selectUserPublicLite,
                league_members: {
                  select: {
                    league_id: true,
                    league_overall: true,
                    matches_played: true,
                  },
                },
              },
            },
          },
        },
        match_spectators: {
          where: { attending: true },
          include: {
            users: {
              select: selectUserPublicLite,
            },
          },
        },
        // Incluimos todos los campos de los votos para obtener los comentarios
        match_votes: true,
        // Incluimos los honores (MVP, Tronco, etc.)
        honors: true,
      },
    });

    if (!match) return sendError(res, 404, { error: "Match not found" });

    const leagueId = match.league_id ?? undefined;
    const playerIds = match.match_players.map((p) => p.user_id).filter(Boolean) as string[];
    const preActivations = playerIds.length
      ? await prisma.user_consumable_activations.findMany({
          where: {
            target_match_id: matchId,
            timing: "PRE_MATCH",
            status: "ACTIVE",
            user_id: { in: playerIds },
          },
          select: { user_id: true, consumable_key: true },
        })
      : [];
    const postActivations = playerIds.length
      ? await prisma.user_consumable_activations.findMany({
          where: {
            target_match_id: matchId,
            timing: "POST_MATCH",
            status: { in: ["ACTIVE", "CONSUMED"] },
            user_id: { in: playerIds },
          },
          select: { user_id: true, consumable_key: true, created_at: true },
          orderBy: { created_at: "desc" },
        })
      : [];
    const activationByUserId = new Map<string, { consumable_key: string }>();
    for (const a of preActivations) {
      if (!activationByUserId.has(a.user_id)) {
        activationByUserId.set(a.user_id, { consumable_key: a.consumable_key });
      }
    }
    const postActivationByUserId = new Map<string, { consumable_key: string }>();
    for (const a of postActivations) {
      if (!postActivationByUserId.has(a.user_id)) {
        postActivationByUserId.set(a.user_id, { consumable_key: a.consumable_key });
      }
    }

    // 1. Procesamos jugadores con has_voted, datos aplanados y TENDENCIA (vs promedio en la liga)
    const playersWithVoteStatus = match.match_players.map((p) => {
      const currentRating = Number(p.match_rating || 0);
      const leagueMember = leagueId
        ? (p.users as any).league_members?.find(
            (lm: { league_id: string }) => lm.league_id === leagueId,
          )
        : null;
      // Promedio ANTES de este partido (league_overall ya incluye este partido)
      let historicalAvg = 5.0;
      if (leagueMember?.league_overall != null && leagueMember?.matches_played != null) {
        const n = Number(leagueMember.matches_played) || 0;
        const currentAvg = Number(leagueMember.league_overall);
        if (n > 1) {
          historicalAvg =
            (currentAvg * n - currentRating) / (n - 1);
        } else if (n === 1) {
          historicalAvg = currentRating; // solo este partido, tendencia 0
        }
      }
      const trend = currentRating - historicalAvg;

      const u = p.users as any;
      return {
        ...p,
        has_voted: match.match_votes.some((v) => v.voter_id === p.user_id),
        id: u.id,
        full_name: u.full_name,
        username: u.username,
        profile_photo_url: u.profile_photo_url,
        avatar_frame: u.avatar_frame,
        accent_color: u.accent_color,
        trend,
        active_consumable: activationByUserId.get(p.user_id) ?? null,
        post_consumable_used: postActivationByUserId.get(p.user_id) ?? null,
      };
    });

    // 2. Voces del vestuario: comentarios + reacciones + respuestas
    const commentVotes = match.match_votes.filter(
      (v) => v.comment && String(v.comment).trim() !== "",
    );

    const commentVoteIds = commentVotes.map((v) => v.id);
    const [reactionCounts, myReactions, replies] = await Promise.all([
      prisma.match_vote_comment_reactions.groupBy({
        by: ["vote_id", "value"],
        where: { vote_id: { in: commentVoteIds } },
        _count: { vote_id: true },
      }),
      userId
        ? prisma.match_vote_comment_reactions.findMany({
            where: { vote_id: { in: commentVoteIds }, user_id: userId },
            select: { vote_id: true, value: true },
          })
        : Promise.resolve([]),
      prisma.match_vote_comment_replies.findMany({
        where: { vote_id: { in: commentVoteIds } },
        orderBy: { created_at: "asc" },
        select: {
          id: true,
          vote_id: true,
          reply: true,
          created_at: true,
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
      }),
    ]);

    const countsByVote = new Map<string, { likes: number; dislikes: number }>();
    for (const row of reactionCounts as any[]) {
      const voteId = String(row.vote_id);
      const value = Number(row.value);
      const current = countsByVote.get(voteId) ?? { likes: 0, dislikes: 0 };
      const n = Number(row._count?.vote_id ?? 0);
      if (value === 1) current.likes += n;
      if (value === -1) current.dislikes += n;
      countsByVote.set(voteId, current);
    }

    const myReactionByVote = new Map<string, number>();
    for (const r of myReactions as any[]) {
      myReactionByVote.set(String(r.vote_id), Number(r.value));
    }

    const repliesByVote = new Map<string, any[]>();
    for (const rep of replies as any[]) {
      const voteId = String(rep.vote_id);
      const list = repliesByVote.get(voteId) ?? [];
      list.push({
        id: rep.id,
        reply: rep.reply,
        created_at: rep.created_at,
        author: null,
      });
      repliesByVote.set(voteId, list);
    }

    const targetIds = Array.from(
      new Set(
        commentVotes
          .map((v) => v.target_id)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    );
    const targetsFromDb = await (targetIds.length
      ? prisma.users.findMany({
          where: { id: { in: targetIds } },
          select: { id: true, full_name: true, username: true },
        })
      : Promise.resolve([]));
    const userLabel = (u: { full_name: string | null; username: string } | null | undefined) =>
      u?.full_name || u?.username || null;
    const targetsById = new Map(targetsFromDb.map((u) => [u.id, u]));

    const comments = commentVotes.map((v) => {
      const targetMp = match.match_players.find((mp) => mp.user_id === v.target_id);
      const counts = countsByVote.get(v.id) ?? { likes: 0, dislikes: 0 };

      const targetName =
        v.target_id == null
          ? "GENERAL"
          : userLabel((targetMp as any)?.users) ||
            userLabel(targetsById.get(String(v.target_id))) ||
            "Jugador";
      const authorName = "Anónimo";

      return {
        id: v.id,
        comment: v.comment,
        created_at: v.created_at,
        // Backward-compatible fields (para builds viejas del mobile)
        target_name: targetName,
        author_name: authorName,
        target_id: v.target_id,
        target: {
          id: v.target_id,
          name: targetName,
        },
        author: {
          name: authorName,
        },
        likes: counts.likes,
        dislikes: counts.dislikes,
        myReaction: myReactionByVote.get(v.id) ?? 0,
        replies: repliesByVote.get(v.id) ?? [],
      };
    });

    // 3. Votos: se mantienen anónimos. No exponemos "quién votó a quién".

    // Plan del usuario actual (para paywall "Revelar votos")
    let userPlanType = "FREE";
    if (userId) {
      const u = await prisma.users.findUnique({
        where: { id: userId },
        select: { plan_type: true },
      });
      userPlanType = (u?.plan_type ?? "FREE").toUpperCase();
    }

    // Rol del usuario actual en la liga (para UI: ADMIN y OWNER ven Gestionar y botones de estado)
    let userRole = "MEMBER";
    if (leagueId && userId) {
      const [member, league] = await Promise.all([
        prisma.league_members.findUnique({
          where: {
            league_id_user_id: { league_id: leagueId, user_id: userId },
          },
          select: { role: true },
        }),
        prisma.leagues.findUnique({
          where: { id: leagueId },
          select: { admin_id: true },
        }),
      ]);
      // Fallback: si es admin de la liga (leagues.admin_id) pero no está en league_members, tratar como OWNER
      const roleFromMember = member?.role ?? null;
      const isLeagueOwner = league?.admin_id === userId;
      userRole = (roleFromMember ?? (isLeagueOwner ? "OWNER" : null)) ?? "MEMBER";
      // Normalizar a mayúsculas por si la DB tiene valores en minúsculas
      userRole = String(userRole).toUpperCase();
    }

    const myTtpSummary = userId
      ? await buildUserMatchTtpSummary(matchId, userId)
      : null;

    res.json({
      ...match,
      match_players: playersWithVoteStatus,
      players: playersWithVoteStatus,
      spectators: (match as any).match_spectators?.map((s: any) => ({
        user_id: s.user_id,
        attending: s.attending,
        created_at: s.created_at,
        user: s.users,
      })) ?? [],
      comments,
      honors: match.honors,
      userPlanType,
      userRole,
      my_ttp_summary: myTtpSummary,
    });
  } catch (error) {
    log.errorWithErr("getMatchDetails failed", error, { matchId: req.params.matchId, userId: req.user?.userId });
    return sendError(res, 500, { error: "Error fetching match details" });
  }
};

export const reactToMatchComment = async (req: Request, res: Response) => {
  try {
    const matchId = req.params.matchId as string;
    const voteId = req.params.voteId as string;
    const userId = req.user?.userId;
    if (!userId) return sendError(res, 401, { error: "No autenticado" });

    const parsed = validateBody(req, z.object({ value: z.coerce.number().int() }));
    if (!parsed.ok) return sendError(res, 400, { error: "INVALID_BODY", details: parsed.details });

    const result = await MatchCommentService.reactToComment({
      matchId,
      voteId,
      userId,
      value: parsed.data.value,
    });
    return res.json(result);
  } catch (error) {
    log.errorWithErr("reactToMatchComment failed", error, { matchId: req.params.matchId, voteId: req.params.voteId, userId: req.user?.userId });
    return sendCaughtError(res, error, { status: 500, error: "REACTION_FAILED", message: "Error reaccionando al comentario" });
  }
};

export const replyToMatchComment = async (req: Request, res: Response) => {
  try {
    const matchId = req.params.matchId as string;
    const voteId = req.params.voteId as string;
    const userId = req.user?.userId;

    if (!userId) return sendError(res, 401, { error: "No autenticado" });

    const parsed = validateBody(req, z.object({ reply: z.string() }));
    if (!parsed.ok) return sendError(res, 400, { error: "INVALID_BODY", details: parsed.details });

    const result = await MatchCommentService.replyToComment({
      matchId,
      voteId,
      userId,
      reply: parsed.data.reply,
    });
    return res.json(result);
  } catch (error) {
    log.errorWithErr("replyToMatchComment failed", error, { matchId: req.params.matchId, voteId: req.params.voteId, userId: req.user?.userId });
    return sendCaughtError(res, error, { status: 500, error: "REPLY_FAILED", message: "Error respondiendo al comentario" });
  }
};

export const updateMatchStatus = async (req: Request, res: Response) => {
  try {
    const matchId = req.params.matchId as string;
    const { status, teamAScore, teamBScore } = req.body as {
      status: string;
      teamAScore?: number;
      teamBScore?: number;
    };

    const userId = req.user?.userId;
    if (!userId) return sendError(res, 401, { error: "Usuario no autenticado" });
    const canManage = await isLeagueStaffForMatch(userId, matchId);
    if (!canManage) {
      return sendError(res, 403, {
        error: "FORBIDDEN",
        message: "No tienes permisos para cambiar el estado de este partido.",
      });
    }

    // Si se envían goles junto con el cambio de estado, guardarlos primero
    if (teamAScore !== undefined || teamBScore !== undefined) {
      await prisma.matches.update({
        where: { id: matchId },
        data: {
          team_a_score: teamAScore !== undefined ? Number(teamAScore) : undefined,
          team_b_score: teamBScore !== undefined ? Number(teamBScore) : undefined,
        },
      });
    }

    // Si el admin mueve a VOTACIÓN o CIERRE, exigimos que exista resultado
    if (status === "FINISHED" || status === "COMPLETED") {
      const m = await prisma.matches.findUnique({
        where: { id: matchId },
        select: { team_a_score: true, team_b_score: true },
      });
      if (m?.team_a_score == null || m?.team_b_score == null) {
        return res.status(400).json({
          error: "SCORE_REQUIRED",
          message: "Debes cargar el resultado (goles) para pasar a la siguiente fase.",
        });
      }
    }

    if (status === "COMPLETED") {
      await MatchService.closeMatch(matchId);
      return res.json({
        message: "Partido cerrado y procesado exitosamente (Admin force).",
      });
    }

    await prisma.matches.update({
      where: { id: matchId },
      data: { status },
    });

    if (status === "FINISHED") {
      const participants = await prisma.match_players.findMany({
        where: { match_id: matchId },
        select: { user_id: true },
      });
      const match = await prisma.matches.findUnique({
        where: { id: matchId },
        select: { location_name: true, league_id: true },
      });
      const location = match?.location_name ?? "Partido";
      const title = "Hora de votar";
      const body = `Terminó el partido en ${location}. Entrá a votar a tus compañeros.`;
      const data = { matchId, leagueId: match?.league_id };
      for (const { user_id } of participants) {
        if (user_id) {
          sendNotification(user_id, "MATCH_FINISHED_VOTE", title, body, data).catch((err) =>
            log.errorWithErr("MATCH_FINISHED_VOTE notification failed", err, { userId: user_id, matchId }),
          );
        }
      }
    }

    res.json({ message: `Estado actualizado a ${status}` });
  } catch (error) {
    log.errorWithErr("updateMatchStatus failed", error, { matchId: req.params.matchId, userId: req.user?.userId });
    return sendError(res, 500, { error: "Error actualizando estado" });
  }
};

export const adminConfirmPlayer = async (req: Request, res: Response) => {
  try {
    const matchId = req.params.matchId as string;
    const adminId = req.user?.userId;
    const targetUserId = String(req.body?.userId ?? "");
    if (!adminId) return sendError(res, 401, { error: "Usuario no autenticado" });
    if (!matchId) return sendError(res, 400, { error: "Falta matchId" });
    if (!targetUserId) return sendError(res, 400, { error: "Falta userId" });

    const canManage = await isLeagueStaffForMatch(adminId, matchId);
    if (!canManage) {
      return sendError(res, 403, {
        error: "FORBIDDEN",
        message: "No tienes permisos para confirmar asistencia en este partido.",
      });
    }

    const result = await prisma.match_players.updateMany({
      where: { match_id: matchId, user_id: targetUserId, has_confirmed: false },
      data: { has_confirmed: true },
    });
    if (result.count === 0) {
      return sendError(res, 404, {
        error: "NOT_FOUND",
        message: "No se encontró un jugador pendiente para confirmar.",
      });
    }
    return res.json({ message: "Asistencia confirmada por admin", count: result.count });
  } catch (error) {
    log.errorWithErr("adminConfirmPlayer failed", error, { matchId: req.params.matchId, adminId: req.user?.userId });
    return sendError(res, 500, { error: "Error confirmando jugador" });
  }
};

export const adminConfirmAllPending = async (req: Request, res: Response) => {
  try {
    const matchId = req.params.matchId as string;
    const adminId = req.user?.userId;
    if (!adminId) return sendError(res, 401, { error: "Usuario no autenticado" });
    if (!matchId) return sendError(res, 400, { error: "Falta matchId" });

    const canManage = await isLeagueStaffForMatch(adminId, matchId);
    if (!canManage) {
      return sendError(res, 403, {
        error: "FORBIDDEN",
        message: "No tienes permisos para confirmar asistencia en este partido.",
      });
    }

    const result = await prisma.match_players.updateMany({
      where: { match_id: matchId, has_confirmed: false },
      data: { has_confirmed: true },
    });
    return res.json({
      message: "Asistencias confirmadas por admin",
      count: result.count,
    });
  } catch (error) {
    log.errorWithErr("adminConfirmAllPending failed", error, { matchId: req.params.matchId, adminId: req.user?.userId });
    return sendError(res, 500, { error: "Error confirmando pendientes" });
  }
};

export const adminRemoveSpectator = async (req: Request, res: Response) => {
  try {
    const matchId = req.params.matchId as string;
    const adminId = req.user?.userId;
    const targetUserId = String(req.body?.userId ?? "");
    if (!adminId) return sendError(res, 401, { error: "Usuario no autenticado" });
    if (!matchId) return sendError(res, 400, { error: "Falta matchId" });
    if (!targetUserId) return sendError(res, 400, { error: "Falta userId" });

    const canManage = await isLeagueStaffForMatch(adminId, matchId);
    if (!canManage) {
      return sendError(res, 403, {
        error: "FORBIDDEN",
        message: "No tienes permisos para gestionar espectadores en este partido.",
      });
    }

    const result = await prisma.match_spectators.updateMany({
      where: { match_id: matchId, user_id: targetUserId },
      data: { attending: false },
    });
    if (result.count === 0) {
      return sendError(res, 404, {
        error: "NOT_FOUND",
        message: "No se encontró ese espectador en este partido.",
      });
    }

    return res.json({ message: "Espectador eliminado", count: result.count });
  } catch (error) {
    log.errorWithErr("adminRemoveSpectator failed", error, { matchId: req.params.matchId, adminId: req.user?.userId });
    return sendError(res, 500, { error: "Error eliminando espectador" });
  }
};

export const updateMatch = async (req: Request, res: Response) => {
  try {
    const matchId = req.params.matchId as string;

    // 1. Recibimos teamAScore y teamBScore
    const { location, dateTime, price, players, teamAScore, teamBScore } =
      req.body;

    if (!matchId) return sendError(res, 400, { error: "Falta matchId" });

    let dateObj: Date | undefined;
    if (dateTime) {
      dateObj = new Date(dateTime);
    }

    const cleanPrice =
      typeof price === "string" ? parseFloat(price.replace(/\./g, "")) : price;

    const currentMatch = await prisma.matches.findUnique({
      where: { id: matchId },
    });

    if (!currentMatch)
      return sendError(res, 404, { error: "Partido no encontrado" });

    // --- CAMBIO IMPORTANTE ---
    // Eliminamos o comentamos esta restricción.
    // Necesitamos poder editar el partido (poner goles) aunque esté FINISHED o COMPLETED.
    /*
    if (currentMatch.status !== "OPEN") {
      return sendError(res, 403, { error: "No se puede editar un partido finalizado o en juego" });
    }
    */

    await prisma.$transaction(async (tx) => {
      // 2. Actualizar Partido (Incluyendo Goles)
      await tx.matches.update({
        where: { id: matchId },
        data: {
          location_name: location,
          date_time: dateObj,
          price_per_player: cleanPrice,
          // Guardamos los goles si vienen en el request
          team_a_score:
            teamAScore !== undefined ? Number(teamAScore) : undefined,
          team_b_score:
            teamBScore !== undefined ? Number(teamBScore) : undefined,
        },
      });

      // 3. Actualizar Jugadores
      // El Frontend ahora envía: [{ user_id: "...", team: "A" }, { user_id: "...", team: "B" }]
      if (players && Array.isArray(players)) {
        // A. Obtener IDs activos para no borrarlos
        // Nota: El frontend ahora manda 'user_id', no 'id'
        const activeIds = players.map((p: any) => p.user_id);

        // B. BORRAR los que fueron desconvocados (no están en la nueva lista)
        await tx.match_players.deleteMany({
          where: {
            match_id: matchId,
            user_id: { notIn: activeIds },
          },
        });

        // C. UPSERT (Actualizar o Crear)
        for (const p of players) {
          const team = p.team; // "A" o "B" (Ya viene listo del front)
          const userId = p.user_id;

          // Buscamos si ya existe
          const existing = await tx.match_players.findUnique({
            where: { match_id_user_id: { match_id: matchId, user_id: userId } },
          });

          if (existing) {
            // Si existe y cambió de equipo, actualizamos
            if (existing.team !== team) {
              await tx.match_players.update({
                where: {
                  match_id_user_id: { match_id: matchId, user_id: userId },
                },
                data: { team },
              });
            }
          } else {
            // Si es nuevo convocado, lo creamos
            await tx.match_players.create({
              data: {
                match_id: matchId,
                user_id: userId,
                team,
                has_confirmed: false, // Por defecto false si lo agrega el admin manual
              },
            });
          }
        }
      }
    });

    res.json({ message: "Partido actualizado con éxito" });
  } catch (error) {
    log.errorWithErr("updateMatch failed", error, { matchId: req.params.matchId, userId: req.user?.userId });
    return sendError(res, 500, { error: "Error actualizando el partido" });
  }
};

export const getPendingVotes = async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string;
    const userId = req.user?.userId;
    if (!isUuid(leagueId)) {
      return sendError(res, 400, { error: "leagueId inválido" });
    }
    if (!userId) {
      return sendError(res, 401, { error: "No autenticado" });
    }

    // --- A. LÓGICA DE CIERRE AUTOMÁTICO (LAZY CLOSING) ---
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Buscamos partidos 'FINISHED' que ya vencieron
    const expiredMatches = await prisma.matches.findMany({
      where: {
        league_id: leagueId,
        status: "FINISHED",
        date_time: { lt: twentyFourHoursAgo }, // Menor que hace 24hs
      },
    });

    if (expiredMatches.length > 0) {
      await Promise.all(
        expiredMatches.map((match) => MatchService.closeMatch(match.id)),
      );
    }
    // -----------------------------------------------------

    // --- B. OBTENER LISTA LIMPIA ---
    // Ahora traemos solo los vigentes (los expirados ya pasaron a COMPLETED arriba)
    const matches = await prisma.matches.findMany({
      where: {
        league_id: leagueId,
        status: "FINISHED",
        match_players: {
          some: {
            user_id: userId,
            has_confirmed: true, // Solo si jugué
          },
        },
      },
      select: {
        id: true,
        location_name: true,
        date_time: true,
        status: true,
      },
    });

    res.json(matches);
  } catch (error) {
    log.errorWithErr("getPendingVotes failed", error, { leagueId: req.params.leagueId, userId: req.user?.userId });
    return sendError(res, 500, { error: "Error fetching voting matches" });
  }
};

export const getVoteList = async (req: Request, res: Response) => {
  try {
    const matchId = req.params.matchId as string;
    const userId = req.user?.userId;
    if (!userId) return sendError(res, 401, { error: "No autenticado" });

    // 1. Verificar si ya votó
    const existingVotes = await prisma.match_votes.findFirst({
      where: {
        match_id: matchId,
        voter_id: userId,
      },
    });

    // 2. Buscar partido y jugadores
    const match = await prisma.matches.findUnique({
      where: { id: matchId },
      include: {
        match_players: {
          where: { has_confirmed: true },
          include: {
            users: {
              select: {
                id: true,
                full_name: true,
                profile_photo_url: true,
                username: true,
              },
            },
          },
        },
      },
    });

    if (!match) return sendError(res, 404, { error: "Partido no encontrado" });

    // 3. Validación de Tiempo
    const matchDate = new Date(match.date_time);
    const deadline = new Date(matchDate.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();

    if (now > deadline) {
      return res.status(400).json({
        error: "TIMEOUT",
        message: "El tiempo de votación ha finalizado.",
      });
    }

    // 3.5 Validación de rol para votar:
    // - Jugador: debe estar en match_players y haber confirmado (jugó).
    // - Espectador: debe ser miembro de la liga y estar marcado attending=true.
    const matchPlayer = await prisma.match_players.findUnique({
      where: { match_id_user_id: { match_id: matchId, user_id: userId } },
      select: { has_confirmed: true },
    });
    const spectator = await prisma.match_spectators.findUnique({
      where: { match_id_user_id: { match_id: matchId, user_id: userId } },
      select: { attending: true },
    });
    const isLeagueMember = !!(await prisma.league_members.findUnique({
      where: { league_id_user_id: { league_id: match.league_id!, user_id: userId } },
      select: { user_id: true },
    }));
    const canVote =
      (matchPlayer?.has_confirmed === true) ||
      (isLeagueMember && spectator?.attending === true);
    if (!canVote) {
      return res.status(403).json({
        error: "CANNOT_VOTE",
        message: "Solo jugadores confirmados o espectadores asistentes pueden votar en este partido.",
      });
    }

    // Cantidad de votantes únicos (para indicador de progreso del admin)
    const distinctVoters = await prisma.match_votes.groupBy({
      by: ["voter_id"],
      where: { match_id: matchId },
    });
    const votersCount = distinctVoters.filter((v) => v.voter_id != null).length;
    const totalPlayers = match.match_players.length;
    const isAdmin = !!userId && match.admin_id === userId;

    res.json({
      hasVoted: !!existingVotes,
      players: match.match_players.map((p) => p.users),
      votersCount,
      totalPlayers,
      isAdmin,
      voterRole: matchPlayer?.has_confirmed ? "PLAYER" : "SPECTATOR",
    });
  } catch (error) {
    log.errorWithErr("getVoteList failed", error, { matchId: req.params.matchId, userId: req.user?.userId });
    return sendError(res, 500, { error: "Error interno" });
  }
};

export const submitVotes = async (req: Request, res: Response) => {
  try {
    const matchId = req.params.matchId as string;
    const { votes } = req.body;
    const voterId = req.user?.userId;

    if (!voterId) return sendError(res, 401, { error: "No autorizado" });

    // 1. VALIDACIÓN: ¿Ya votó?
    const alreadyVoted = await prisma.match_votes.findFirst({
      where: { match_id: matchId, voter_id: voterId },
    });

    if (alreadyVoted) {
      return sendError(res, 400, { error: "ALREADY_VOTED", message: "Ya has enviado tus votos." });
    }

    // 2. VALIDACIÓN: ¿Existe el partido y está a tiempo?
    const match = await prisma.matches.findUnique({
      where: { id: matchId },
      select: { league_id: true, date_time: true },
    });

    if (!match) return sendError(res, 404, { error: "Partido no encontrado" });

    const matchDate = new Date(match.date_time);
    const deadline = new Date(matchDate.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();

    if (now > deadline) {
      await MatchService.closeMatch(matchId);
      return sendError(res, 400, { error: "TIMEOUT", message: "Tiempo finalizado." });
    }

    // Validación: el votante debe ser jugador confirmado o espectador asistente (miembro de la liga)
    const matchPlayer = await prisma.match_players.findUnique({
      where: { match_id_user_id: { match_id: matchId, user_id: voterId } },
      select: { has_confirmed: true },
    });
    const spectator = await prisma.match_spectators.findUnique({
      where: { match_id_user_id: { match_id: matchId, user_id: voterId } },
      select: { attending: true },
    });
    const isLeagueMember = !!(match.league_id && (await prisma.league_members.findUnique({
      where: { league_id_user_id: { league_id: match.league_id, user_id: voterId } },
      select: { user_id: true },
    })));
    const canVote =
      (matchPlayer?.has_confirmed === true) ||
      (isLeagueMember && spectator?.attending === true);
    if (!canVote) {
      return sendError(res, 403, {
        error: "CANNOT_VOTE",
        message: "Solo jugadores confirmados o espectadores asistentes pueden votar.",
      });
    }

    // Validación: solo se puede votar a jugadores que hayan participado (confirmados).
    const validTargets = await prisma.match_players.findMany({
      where: { match_id: matchId, has_confirmed: true },
      select: { user_id: true },
    });
    const validSet = new Set(validTargets.map((t) => t.user_id));
    const invalid = Array.isArray(votes)
      ? votes.find((v: any) => !validSet.has(String(v?.voted_user_id ?? "")))
      : null;
    if (invalid) {
      return sendError(res, 400, {
        error: "INVALID_TARGET",
        message: "Solo puedes votar a jugadores que participaron en el partido.",
      });
    }

    await MatchService.submitVotes(matchId, match.league_id, voterId, votes);

    res.json({ message: "Votos guardados correctamente" });
  } catch (error) {
    log.errorWithErr("submitVotes failed", error, { matchId: req.params.matchId, userId: req.user?.userId });
    return sendError(res, 500, { error: "Error interno guardando votos" });
  }
};

export const getRecentCompletedMatches = async (
  req: Request,
  res: Response,
) => {
  try {
    const leagueId = req.params.leagueId as string;
    const userId = req.user?.userId;
    if (!isUuid(leagueId)) {
      return sendError(res, 400, { error: "leagueId inválido" });
    }
    const scope =
      typeof req.query.scope === "string"
        ? req.query.scope.toLowerCase()
        : "user";

    const select = {
      id: true,
      location_name: true,
      date_time: true,
      status: true,
    } as const;

    // Liga: cualquier partido COMPLETED (p. ej. desbloquear ranking / estado de liga).
    if (scope === "league") {
      const matches = await prisma.matches.findMany({
        where: {
          league_id: leagueId,
          status: "COMPLETED",
        },
        orderBy: {
          date_time: "desc",
        },
        take: 20,
        select,
      });
      return res.json(matches);
    }

    // Usuario: partidos recientes en los que participó y confirmó (home / partidos).
    const recentWindowDays = 30;
    const since = new Date();
    since.setDate(since.getDate() - recentWindowDays);

    if (!userId) {
      return sendError(res, 401, { error: "No autenticado" });
    }

    const matches = await prisma.matches.findMany({
      where: {
        league_id: leagueId,
        status: "COMPLETED",
        date_time: {
          gte: since,
        },
        match_players: {
          some: {
            user_id: userId,
            has_confirmed: true,
          },
        },
      },
      orderBy: {
        date_time: "desc",
      },
      take: 20,
      select,
    });

    res.json(matches);
  } catch (error) {
    log.errorWithErr("getRecentCompletedMatches failed", error, { leagueId: req.params.leagueId, userId: req.user?.userId });
    return sendError(res, 500, { error: "Error al obtener resultados recientes" });
  }
};

export const getMatchResults = async (req: Request, res: Response) => {
  try {
    const matchId = req.params.matchId as string;

    // A. Datos del Partido
    const match = await prisma.matches.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        location_name: true,
        date_time: true,
        mvp_id: true,
        status: true,
        league_id: true,
      },
    });

    if (!match || !match.league_id) {
      return sendError(res, 404, { error: "Partido no encontrado" });
    }

    // B. Jugadores y sus Puntajes (Con promedio histórico para Tendencia)
    const players = await prisma.match_players.findMany({
      where: { match_id: matchId, has_confirmed: true },
      select: {
        match_rating: true,
        match_pace: true,
        match_physical: true,
        users: {
          select: {
            id: true,
            full_name: true,
            username: true,
            profile_photo_url: true,
            avatar_frame: true,
            accent_color: true,
            // Buscamos su ficha en ESTA liga para saber su promedio histórico
            league_members: {
              where: { league_id: match.league_id },
              select: { league_overall: true },
            },
          },
        },
      },
      orderBy: { match_rating: "desc" },
    });

    // Formateamos y calculamos la TENDENCIA
    const formattedPlayers = players.map((p) => {
      const currentRating = Number(p.match_rating || 0);

      // Obtenemos promedio histórico.
      // league_members devuelve un array, tomamos el primero (debería ser único por liga/usuario)
      const historicalMember = p.users.league_members[0];
      const historicalAvg = historicalMember?.league_overall
        ? Number(historicalMember.league_overall)
        : 5.0; // Base por defecto

      // TENDENCIA: Diferencia entre cómo jugó HOY y su promedio GENERAL
      const trend = currentRating - historicalAvg;

      return {
        id: p.users.id,
        full_name: p.users.full_name,
        username: p.users.username,
        profile_photo_url: p.users.profile_photo_url,
        match_rating: currentRating,
        match_pace: Number(p.match_pace || 0),
        match_physical: Number(p.match_physical || 0),
        avatar_frame: p.users.avatar_frame,
        accent_color: p.users.accent_color,
        trend: trend, // Enviamos el valor calculado (+0.5, -1.2, etc.)
      };
    });

    // C. Comentarios (CORREGIDO)
    const comments = await prisma.match_votes.findMany({
      where: {
        match_id: matchId,
        comment: { not: null }, // Solo votos con comentario
      },
      select: {
        comment: true,
        // target_name: true, <--- ESTO ESTABA MAL, NO EXISTE EN LA TABLA
        target_user: {
          // <--- ASÍ SE ACCEDE AL NOMBRE
          select: { full_name: true },
        },
      },
    });

    const formattedComments = comments.map((c) => ({
      comment: c.comment,
      target_name: c.target_user?.full_name || "Desconocido", // Extraemos el nombre de la relación
    }));

    // D. Honores (Medallas)
    const honors = await prisma.honors.findMany({
      where: { match_id: matchId },
      select: { user_id: true, honor_type: true },
    });

    res.json({
      match,
      players: formattedPlayers,
      comments: formattedComments,
      honors,
    });
  } catch (error) {
    log.errorWithErr("getMatchResults failed", error, { matchId: req.params.matchId });
    return sendError(res, 500, { error: "Error al obtener detalle de resultados" });
  }
};

export const getMatchPredictionsResult = async (req: Request, res: Response) => {
  try {
    const matchId = req.params.matchId as string;
    const userId = req.user?.userId;
    if (!userId) {
      return sendError(res, 401, { error: "No autenticado" });
    }
    const result = await PredictionService.getMatchPredictionsResultForUser(
      matchId,
      userId,
    );
    return res.json(result);
  } catch (error) {
    log.errorWithErr("getMatchPredictionsResult failed", error, { matchId: req.params.matchId, userId: req.user?.userId });
    return sendError(res, 500, { error: "Error al obtener detalle de tus predicciones" });
  }
};

export const claimMatchTtp = async (req: Request, res: Response) => {
  try {
    const matchId = req.params.matchId as string;
    const userId = req.user?.userId;
    if (!userId) {
      return sendError(res, 401, { error: "No autenticado" });
    }

    const summary = await buildUserMatchTtpSummary(matchId, userId);
    if (!summary) {
      return sendError(res, 404, { error: "Partido no encontrado" });
    }
    if (!summary.can_claim) {
      return res.status(400).json({
        error: "NOT_CLAIMABLE",
        message: summary.claimed
          ? "Ya reclamaste estos TTP."
          : "Aún no puedes reclamar TTP de este partido.",
      });
    }

    const grant = await prisma.$transaction(async (tx) => {
      return grantTtpInTx(tx, {
        userId,
        amount: summary.total,
        reason: "MATCH_TTP_CLAIM",
        refType: "match",
        refId: matchId,
        idempotencyKey: `ttp:match_claim:${matchId}:${userId}`,
      });
    });

    const updated = await buildUserMatchTtpSummary(matchId, userId);
    return res.json({
      message: "TTP reclamados con éxito.",
      totalClaimed: summary.total,
      balanceAfter: grant.balanceAfter ?? null,
      summary: updated,
    });
  } catch (error) {
    log.errorWithErr("claimMatchTtp failed", error, { matchId: req.params.matchId, userId: req.user?.userId });
    return sendError(res, 500, { error: "No se pudieron reclamar los TTP." });
  }
};

async function isLeagueStaffForMatch(
  userId: string,
  matchId: string,
): Promise<boolean> {
  const match = await prisma.matches.findUnique({
    where: { id: matchId },
    select: { league_id: true },
  });
  if (!match?.league_id) return false;

  const league = await prisma.leagues.findUnique({
    where: { id: match.league_id },
    select: { admin_id: true },
  });
  if (league?.admin_id === userId) return true;

  const member = await prisma.league_members.findUnique({
    where: {
      league_id_user_id: { league_id: match.league_id, user_id: userId },
    },
    select: { role: true },
  });
  return isLeagueStaffRole(member?.role);
}

async function runDuelGenerationWithNotifications(matchId: string) {
  const result = await DuelService.generateMatchDuel(matchId);
  const title = "Estás en el duelo";
  const body = `${result.details.challenger?.full_name ?? "Rival"} vs ${result.details.rival?.full_name ?? "Rival"}. Jugá bien.`;
  const data = { matchId, duelId: result.duel.id };
  sendNotification(
    result.duel.challenger_id,
    "DUEL_PARTICIPANT",
    title,
    body,
    data,
  ).catch(() => {});
  sendNotification(
    result.duel.rival_id,
    "DUEL_PARTICIPANT",
    title,
    body,
    data,
  ).catch(() => {});
  return result;
}

async function allConvokedConfirmedAndMatchOpen(
  matchId: string,
): Promise<boolean> {
  const squad = await prisma.match_players.findMany({
    where: { match_id: matchId },
    select: { has_confirmed: true },
  });
  if (squad.length < 2) return false;
  if (!squad.every((p) => p.has_confirmed === true)) return false;
  const match = await prisma.matches.findUnique({
    where: { id: matchId },
    select: { status: true },
  });
  return !!(match && match.status === "OPEN");
}

/**
 * Cuando todos los convocados confirmaron: crea el grupo de Prode/predicciones
 * y genera el duelo automáticamente (no bloquea la confirmación si algo falla).
 */
async function tryActivateMatchPredictionsAndDuelAfterConfirm(
  matchId: string,
): Promise<void> {
  try {
    const ready = await allConvokedConfirmedAndMatchOpen(matchId);
    if (!ready) return;

    try {
      await PredictionService.createMatchPredictionGroup(matchId);
    } catch {
      // Grupo ya existente u otro error: no impedir duelo
    }

    const existingDuel = await prisma.duels.findFirst({
      where: { match_id: matchId },
      select: { id: true },
    });
    if (existingDuel) return;

    await runDuelGenerationWithNotifications(matchId);
  } catch {
    // Sin parejas para duelo, etc.
  }
}

export const generateMatchDuel = async (req: Request, res: Response) => {
  const matchId = req.params.matchId as string;
  const userId = req.user?.userId;

  if (!matchId) {
    return sendError(res, 400, { error: "Falta matchId" });
  }
  if (!userId) {
    return sendError(res, 401, { error: "No autenticado" });
  }

  try {
    const allowed = await isLeagueStaffForMatch(userId, matchId);
    if (!allowed) {
      return sendError(res, 403, {
        error:
          "Solo administradores de la liga pueden generar el duelo de la fecha.",
      });
    }

    const result = await runDuelGenerationWithNotifications(matchId);
    return res.status(201).json({
      message: "Duelo generado exitosamente",
      duel: result.duel,
      details: result.details,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "PARTIDO_NO_ENCONTRADO")
      return sendError(res, 404, { error: "Partido no encontrado" });
    if (msg === "YA_EXISTE_DUELO")
      return sendError(res, 400, { error: "Ya existe un duelo generado para este partido." });
    if (msg === "SE_NECESITAN_2_JUGADORES_CONFIRMADOS")
      return sendError(res, 400, {
        error:
          "Se necesitan al menos 2 jugadores confirmados para crear un duelo.",
      });
    if (msg === "PARTIDO_SIN_LIGA")
      return sendError(res, 400, { error: "Partido sin liga asociada." });
    if (msg === "DATOS_INSUFICIENTES_MIEMBROS")
      return sendError(res, 400, {
        error: "No se encontraron datos suficientes de los miembros.",
      });
    if (msg === "NO_PAREJAS_COMPATIBLES")
      return sendError(res, 400, { error: "No se pudieron generar parejas compatibles." });
    if (msg === "ERROR_SELECCION_PAREJA")
      return sendError(res, 500, { error: "Error al seleccionar la pareja." });
    log.errorWithErr("generateMatchDuel failed", error, { matchId: req.params.matchId, userId: req.user?.userId });
    return sendError(res, 500, { error: "Error interno al generar duelo" });
  }
};

export const getMatchDuel = async (req: Request, res: Response) => {
  const matchId = req.params.matchId as string;
  try {
    const duel = await prisma.duels.findFirst({
      where: { match_id: matchId },
      include: {
        matches: { select: { league_id: true } }, // Necesitamos saber la liga
        winner: { select: { id: true, full_name: true } },
        // No traemos usuarios aquí directamente para poder buscar sus stats abajo de forma más limpia
      },
    });

    if (!duel || !duel.matches?.league_id) {
      return res.json(null);
    }

    const leagueId = duel.matches.league_id;

    // Función auxiliar para obtener data completa de un jugador (Perfil + Stats + Equipo)
    const getPlayerData = async (userId: string) => {
      // 1. Perfil básico
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: {
          id: true,
          full_name: true,
          profile_photo_url: true,
          avatar_frame: true, // <--- EL MARCO
          username: true,
        },
      });

      // 2. Stats de la liga (Promedio / Racha simulada o MVPs)
      const stats = await prisma.league_members.findUnique({
        where: { league_id_user_id: { league_id: leagueId, user_id: userId } },
        select: {
          league_overall: true, // <--- PROMEDIO
          honors_mvp: true,
        },
      });

      // 3. Equipo en este partido
      const matchPlayer = await prisma.match_players.findUnique({
        where: { match_id_user_id: { match_id: matchId, user_id: userId } },
        select: { team: true }, // <--- EQUIPO (A o B)
      });

      return {
        ...user,
        stats: {
          overall: stats?.league_overall || 5.0,
          mvps: stats?.honors_mvp || 0,
        },
        team: matchPlayer?.team || "UNASSIGNED",
      };
    };

    // Obtenemos la data enriquecida de ambos
    const challengerData = await getPlayerData(duel.challenger_id);
    const rivalData = await getPlayerData(duel.rival_id);

    // Respondemos con la estructura unificada (winner_id explícito para que el cliente detecte duelo terminado)
    res.json({
      ...duel,
      winner_id: duel.winner_id ?? duel.winner?.id ?? null,
      challenger: challengerData,
      rival: rivalData,
    });
  } catch (error) {
    log.errorWithErr("getMatchDuel failed", error, { matchId: req.params.matchId });
    return sendError(res, 500, { error: "Error obteniendo duelo" });
  }
};

