import { prisma } from "../server.js";
import { resolveMatchDuel } from "./DuelService.js";
import { processMatchPredictions } from "./PredictionService.js";
import { sendNotification } from "./NotificationService.js";
import { processAchievementsForMatch } from "./AchievementService.js";

type VoteRow = {
  target_id: string | null;
  voter_id: string | null;
  overall: number;
  pace?: number | null;
  defense?: number | null;
  technique?: number | null;
  physical?: number | null;
  attack?: number | null;
};

// ---------------------------------------------------------------------------
// Utilidades: parsing y tipos
// ---------------------------------------------------------------------------

export function parseDateTime(dateTimeStr: string): Date | null {
  try {
    if (!dateTimeStr) return null;
    const [datePart, timePart] = dateTimeStr.split(" - ");
    if (!datePart || !timePart) return null;
    const [day, month, year] = datePart.split("/").map(Number);
    const [hours, minutes] = timePart.split(":").map(Number);
    if (
      day === undefined ||
      month === undefined ||
      year === undefined ||
      hours === undefined ||
      minutes === undefined
    ) {
      return null;
    }
    return new Date(year, month - 1, day, hours, minutes, 0);
  } catch {
    return null;
  }
}

export interface ProcessedStat {
  userId: string;
  overall: number;
  pace: number;
  defense: number;
  technique: number;
  physical: number;
  attack: number;
  fantasmaScore: number;
}

// ---------------------------------------------------------------------------
// Cálculos: agregar votos por jugador
// ---------------------------------------------------------------------------

function aggregateVotesByPlayer(
  allVotes: VoteRow[],
): Record<string, VoteRow[]> {
  const votesByPlayer: Record<string, VoteRow[]> = {};
  for (const vote of allVotes) {
    if (!vote.target_id) continue;
    const key = vote.target_id;
    if (!votesByPlayer[key]) votesByPlayer[key] = [];
    votesByPlayer[key]!.push(vote);
  }
  return votesByPlayer;
}

// ---------------------------------------------------------------------------
// Cálculos: promedios y puntuación Fantasma
// ---------------------------------------------------------------------------

function computeProcessedStats(
  votesByPlayer: Record<string, VoteRow[]>,
): ProcessedStat[] {
  const processedStats: ProcessedStat[] = [];

  for (const [playerId, playerVotes] of Object.entries(votesByPlayer)) {
    const totalCount = playerVotes.length;
    if (totalCount === 0) continue;

    const sums = playerVotes.reduce(
      (acc, v) => ({
        overall: acc.overall + Number(v.overall),
        pace: acc.pace + (Number(v.pace) || 0),
        defense: acc.defense + (Number(v.defense) || 0),
        technique: acc.technique + (Number(v.technique) || 0),
        physical: acc.physical + (Number(v.physical) || 0),
        attack: acc.attack + (Number(v.attack) || 0),
      }),
      {
        overall: 0,
        pace: 0,
        defense: 0,
        technique: 0,
        physical: 0,
        attack: 0,
      },
    );

    const finalAvg: ProcessedStat = {
      userId: playerId,
      overall: sums.overall / totalCount,
      pace: sums.pace / totalCount,
      defense: sums.defense / totalCount,
      technique: sums.technique / totalCount,
      physical: sums.physical / totalCount,
      attack: sums.attack / totalCount,
      fantasmaScore: -100,
    };

    const selfVote = playerVotes.find((v) => v.voter_id === playerId);
    const peerVotes = playerVotes.filter((v) => v.voter_id !== playerId);
    if (selfVote && peerVotes.length > 0) {
      const peerSum = peerVotes.reduce(
        (sum, v) => sum + Number(v.overall),
        0,
      );
      finalAvg.fantasmaScore =
        Number(selfVote.overall) - peerSum / peerVotes.length;
    }
    processedStats.push(finalAvg);
  }

  return processedStats;
}

function getWinners(stats: ProcessedStat[]) {
  const mvpWinner = stats.reduce((prev, curr) =>
    prev.overall > curr.overall ? prev : curr,
  );
  const troncoWinner = stats.reduce((prev, curr) =>
    prev.overall < curr.overall ? prev : curr,
  );
  const fantasmaWinner = stats.reduce((prev, curr) =>
    prev.fantasmaScore > curr.fantasmaScore ? prev : curr,
  );
  return { mvpWinner, troncoWinner, fantasmaWinner };
}

// ---------------------------------------------------------------------------
// Logros: siempre inline (el worker puede fallar en dev por paths/dependencias)
// ---------------------------------------------------------------------------
function spawnAchievementWorker(matchId: string): void {
  processAchievementsForMatch(prisma, matchId).catch((err) =>
    console.error("[closeMatch] Achievement checks failed:", err),
  );
}

// ---------------------------------------------------------------------------
// Notificaciones tras cerrar partido (resultados, premios, duelo)
// ---------------------------------------------------------------------------
async function sendCloseMatchNotifications(matchId: string): Promise<void> {
  const match = await prisma.matches.findUnique({
    where: { id: matchId },
    select: { location_name: true, league_id: true },
  });
  if (!match) return;

  const location = match.location_name ?? "Partido";
  const data = { matchId, leagueId: match.league_id ?? undefined };

  const participants = await prisma.match_players.findMany({
    where: { match_id: matchId },
    select: { user_id: true },
  });
  const participantIds = participants.map((p) => p.user_id).filter(Boolean);

  for (const userId of participantIds) {
    sendNotification(
      userId,
      "VOTING_CLOSED_RESULTS",
      "Resultados disponibles",
      `Los resultados de ${location} ya están listos. Mirá las notas y premios.`,
      data,
    ).catch(() => {});
  }

  const honors = await prisma.honors.findMany({
    where: { match_id: matchId, user_id: { not: null } },
    select: { user_id: true, honor_type: true },
  });
  for (const h of honors) {
    const uid = h.user_id;
    if (!uid) continue;
    const type = h.honor_type;
    if (type === "MVP") {
      sendNotification(uid, "AWARD_MVP", "¡MVP!", `Fuiste elegido MVP en ${location}.`, data).catch(() => {});
    } else if (type === "TRONCO") {
      sendNotification(uid, "AWARD_TRUNK", "Tronco del partido", `Te llevaste el tronco en ${location}.`, data).catch(() => {});
    } else if (type === "FANTASMA") {
      sendNotification(uid, "AWARD_GHOST", "Fantasma", `Sos el fantasma en ${location}.`, data).catch(() => {});
    } else if (type === "ORACLE" || type === "CRYSTAL_BALL") {
      sendNotification(uid, "AWARD_ORACLE", "Oracle", `Acertaste las predicciones en ${location}.`, data).catch(() => {});
    }
  }

  const duel = await prisma.duels.findFirst({
    where: { match_id: matchId, status: "COMPLETED" },
    select: { id: true, winner_id: true, challenger_id: true, rival_id: true },
  });
  if (duel?.winner_id) {
    sendNotification(
      duel.winner_id,
      "DUEL_RESULT_WIN",
      "Ganaste el duelo",
      `Ganaste el duelo en ${location}.`,
      { ...data, duelId: duel.id },
    ).catch(() => {});
    const loserId = duel.challenger_id === duel.winner_id ? duel.rival_id : duel.challenger_id;
    if (loserId) {
      sendNotification(
        loserId,
        "DUEL_RESULT_LOSS",
        "Resultado del duelo",
        `Perdiste el duelo en ${location}.`,
        { ...data, duelId: duel.id },
      ).catch(() => {});
    }
  }
}

// ---------------------------------------------------------------------------
// Cerrar partido: transacción atómica (stats, medallas, duelo, status)
// ---------------------------------------------------------------------------

export async function closeMatch(matchId: string): Promise<boolean> {
  // Idempotencia: si ya está COMPLETED, no hacer nada (evita notificaciones duplicadas)
  const existing = await prisma.matches.findUnique({
    where: { id: matchId },
    select: { status: true },
  });
  if (existing?.status === "COMPLETED") {
    return true;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const match = await tx.matches.findUnique({ where: { id: matchId } });
      if (!match || !match.league_id) {
        throw new Error("MATCH_NOT_FOUND");
      }

      const allVotesRaw = await tx.match_votes.findMany({
        where: { match_id: matchId },
      });

      const allVotes: VoteRow[] = allVotesRaw.map((v) => ({
        target_id: v.target_id,
        voter_id: v.voter_id,
        overall: Number(v.overall),
        pace: v.pace != null ? Number(v.pace) : null,
        defense: v.defense != null ? Number(v.defense) : null,
        technique: v.technique != null ? Number(v.technique) : null,
        physical: v.physical != null ? Number(v.physical) : null,
        attack: v.attack != null ? Number(v.attack) : null,
      }));

      if (allVotes.length === 0) {
        await tx.matches.update({
          where: { id: matchId },
          data: { status: "COMPLETED" },
        });
        return;
      }

      const votesByPlayer = aggregateVotesByPlayer(allVotes);
      const processedStats = computeProcessedStats(votesByPlayer);

      if (processedStats.length === 0) {
        await tx.matches.update({
          where: { id: matchId },
          data: { status: "COMPLETED" },
        });
        return;
      }

      const { mvpWinner, troncoWinner, fantasmaWinner } =
        getWinners(processedStats);

      const leagueId = match.league_id;
      const playerIds = processedStats.map((s) => s.userId);

      const members = await tx.league_members.findMany({
        where: {
          league_id: leagueId,
          user_id: { in: playerIds },
        },
      });
      const membersByUser = new Map(members.map((m) => [m.user_id, m]));

      await Promise.all(
        processedStats.map((stat) =>
          tx.match_players.updateMany({
            where: { match_id: matchId, user_id: stat.userId },
            data: {
              match_rating: stat.overall,
              match_pace: stat.pace,
              match_defense: stat.defense,
              match_technique: stat.technique,
              match_physical: stat.physical,
              match_attack: stat.attack,
            },
          }),
        ),
      );

      const honorsToCreate: {
        match_id: string;
        user_id: string;
        league_id: string;
        honor_type: string;
      }[] = [];
      const leagueMemberUpdates: Promise<unknown>[] = [];

      for (const stat of processedStats) {
        const member = membersByUser.get(stat.userId);
        if (!member) continue;

        const isMvp = stat.userId === mvpWinner.userId;
        const isTronco = stat.userId === troncoWinner.userId;
        const isFantasma =
          stat.userId === fantasmaWinner.userId && stat.fantasmaScore > 0;

        if (isMvp)
          honorsToCreate.push({
            match_id: matchId,
            user_id: stat.userId,
            league_id: leagueId,
            honor_type: "MVP",
          });
        if (isTronco)
          honorsToCreate.push({
            match_id: matchId,
            user_id: stat.userId,
            league_id: leagueId,
            honor_type: "TRONCO",
          });
        if (isFantasma)
          honorsToCreate.push({
            match_id: matchId,
            user_id: stat.userId,
            league_id: leagueId,
            honor_type: "FANTASMA",
          });

        const n = member.matches_played || 0;
        const newAvg = (oldVal: unknown, newVal: number) => {
          const old = Number(oldVal) || 5.0;
          return n === 0 ? newVal : (old * n + newVal) / (n + 1);
        };

        const memberData: {
          matches_played: { increment: number };
          league_overall: number;
          honors_mvp?: { increment: number };
          honors_tronco?: { increment: number };
          honors_fantasma?: { increment: number };
        } = {
          matches_played: { increment: 1 },
          league_overall: newAvg(member.league_overall, stat.overall),
        };
        if (isMvp) memberData.honors_mvp = { increment: 1 };
        if (isTronco) memberData.honors_tronco = { increment: 1 };
        if (isFantasma) memberData.honors_fantasma = { increment: 1 };

        leagueMemberUpdates.push(
          tx.league_members.update({
            where: {
              league_id_user_id: {
                league_id: leagueId,
                user_id: stat.userId,
              },
            },
            data: memberData,
          }),
        );
      }

      await Promise.all(leagueMemberUpdates);

      if (honorsToCreate.length > 0) {
        await tx.honors.createMany({ data: honorsToCreate });
      }

      await tx.matches.update({
        where: { id: matchId },
        data: { mvp_id: mvpWinner.userId },
      });

      await resolveMatchDuel(matchId, tx);

      await processMatchPredictions(matchId, tx);

      await tx.matches.update({
        where: { id: matchId },
        data: { status: "COMPLETED" },
      });
    }, { timeout: 15000 });

    // Notificaciones post-cierre (fire-and-forget): resultados, premios, duelo
    sendCloseMatchNotifications(matchId).catch((err) =>
      console.error("[closeMatch] Notifications failed:", err),
    );

    // Logros: worker en hilo separado (fire-and-forget, no await)
    spawnAchievementWorker(matchId);

    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "MATCH_NOT_FOUND" || error.message === "NO_LEAGUE")
    ) {
      return false;
    }
    console.error(`[Error] Falló cierre de ${matchId}:`, error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Crear partido: transacción (match + match_players)
// ---------------------------------------------------------------------------

export interface CreateMatchInput {
  leagueId: string;
  adminId: string;
  location: string;
  dateTime: Date;
  price: number;
  players?: Array<{ id: string; team: string }>;
}

export async function createMatch(
  input: CreateMatchInput,
): Promise<{ id: string; league_id: string | null; status: string | null; date_time: Date; location_name: string | null }> {
  const { leagueId, adminId, location, dateTime, price, players } = input;

  const result = await prisma.$transaction(async (tx) => {
    const newMatch = await tx.matches.create({
      data: {
        league_id: leagueId,
        admin_id: adminId,
        location_name: location,
        date_time: dateTime,
        price_per_player: price,
        status: "OPEN",
        team_a_score: 0,
        team_b_score: 0,
      },
    });

    if (players && Array.isArray(players) && players.length > 0) {
      await tx.match_players.createMany({
        data: players.map((p) => ({
          match_id: newMatch.id,
          user_id: p.id,
          team: p.team,
          has_confirmed: false,
          match_rating: 0,
        })),
      });
    }

    return newMatch;
  });

  return result;
}

// ---------------------------------------------------------------------------
// Enviar votos: insertar y cerrar partido si todos votaron
// ---------------------------------------------------------------------------

export interface VoteToInsert {
  voted_user_id: string;
  overall: number;
  comment?: string;
  technique?: number;
  physical?: number;
  pace?: number;
  defense?: number;
  attack?: number;
}

export async function submitVotes(
  matchId: string,
  leagueId: string | null,
  voterId: string,
  votes: VoteToInsert[],
): Promise<{ matchClosed: boolean }> {
  const toOptionalRating = (v: number | undefined): number | null =>
    v === undefined || v === 0 ? null : Number(v);

  const votesToInsert = votes.map((vote) => {
    const isSelfVote = vote.voted_user_id === voterId;
    return {
      match_id: matchId,
      league_id: leagueId,
      voter_id: voterId,
      target_id: vote.voted_user_id,
      overall: Number(vote.overall),
      comment: vote.comment || null,
      technique: isSelfVote ? null : toOptionalRating(vote.technique),
      physical: isSelfVote ? null : toOptionalRating(vote.physical),
      pace: isSelfVote ? null : toOptionalRating(vote.pace),
      defense: isSelfVote ? null : toOptionalRating(vote.defense),
      attack: isSelfVote ? null : toOptionalRating(vote.attack),
    };
  });

  await prisma.match_votes.createMany({ data: votesToInsert });

  const totalAttendees = await prisma.match_players.count({
    where: { match_id: matchId, has_confirmed: true },
  });

  const distinctVoters = await prisma.match_votes.groupBy({
    by: ["voter_id"],
    where: { match_id: matchId },
  });
  const totalVoters = distinctVoters.length;

  let matchClosed = false;
  if (totalVoters >= totalAttendees) {
    await closeMatch(matchId);
    matchClosed = true;
  }

  return { matchClosed };
}
