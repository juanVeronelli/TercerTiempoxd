import { prisma } from "../db.js";
import { grantTtpInTx, type TxClient } from "./TtpService.js";
import { resolveMatchDuel } from "./DuelService.js";
import { processMatchPredictions } from "./PredictionService.js";
import { sendNotification } from "./NotificationService.js";
import { settleMvpMarketForMatch } from "./BetService.js";
import { settleHouseBetsForMatch } from "./HouseBetService.js";
import { DomainError } from "../utils/domainError.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("MatchService");
const TTP_MATCH_PLAYED = 15;

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

type WeightedVoteRow = VoteRow & { weight: number };

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
  allVotes: WeightedVoteRow[],
): Record<string, WeightedVoteRow[]> {
  const votesByPlayer: Record<string, WeightedVoteRow[]> = {};
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
  votesByPlayer: Record<string, WeightedVoteRow[]>,
): ProcessedStat[] {
  const processedStats: ProcessedStat[] = [];

  for (const [playerId, playerVotes] of Object.entries(votesByPlayer)) {
    const totalWeight = playerVotes.reduce((s, v) => s + (v.weight ?? 0), 0);
    if (totalWeight <= 0) continue;

    // Overall siempre viene. Substats pueden venir null; NO deben promediar como 0.
    const sums = playerVotes.reduce(
      (acc, v) => {
        const w = v.weight ?? 0;
        const pace = v.pace != null ? Number(v.pace) : null;
        const defense = v.defense != null ? Number(v.defense) : null;
        const technique = v.technique != null ? Number(v.technique) : null;
        const physical = v.physical != null ? Number(v.physical) : null;
        const attack = v.attack != null ? Number(v.attack) : null;
        return {
          overall: acc.overall + Number(v.overall) * w,
          paceSum: acc.paceSum + (pace != null ? pace * w : 0),
          paceW: acc.paceW + (pace != null ? w : 0),
          defenseSum: acc.defenseSum + (defense != null ? defense * w : 0),
          defenseW: acc.defenseW + (defense != null ? w : 0),
          techniqueSum: acc.techniqueSum + (technique != null ? technique * w : 0),
          techniqueW: acc.techniqueW + (technique != null ? w : 0),
          physicalSum: acc.physicalSum + (physical != null ? physical * w : 0),
          physicalW: acc.physicalW + (physical != null ? w : 0),
          attackSum: acc.attackSum + (attack != null ? attack * w : 0),
          attackW: acc.attackW + (attack != null ? w : 0),
        };
      },
      {
        overall: 0,
        paceSum: 0,
        paceW: 0,
        defenseSum: 0,
        defenseW: 0,
        techniqueSum: 0,
        techniqueW: 0,
        physicalSum: 0,
        physicalW: 0,
        attackSum: 0,
        attackW: 0,
      },
    );

    const finalAvg: ProcessedStat = {
      userId: playerId,
      overall: sums.overall / totalWeight,
      pace: sums.paceW > 0 ? sums.paceSum / sums.paceW : 0,
      defense: sums.defenseW > 0 ? sums.defenseSum / sums.defenseW : 0,
      technique: sums.techniqueW > 0 ? sums.techniqueSum / sums.techniqueW : 0,
      physical: sums.physicalW > 0 ? sums.physicalSum / sums.physicalW : 0,
      attack: sums.attackW > 0 ? sums.attackSum / sums.attackW : 0,
      fantasmaScore: -100,
    };

    const selfVote = playerVotes.find((v) => v.voter_id === playerId);
    const peerVotes = playerVotes.filter((v) => v.voter_id !== playerId);
    const peerWeight = peerVotes.reduce((s, v) => s + (v.weight ?? 0), 0);
    if (selfVote && peerWeight > 0) {
      const peerSum = peerVotes.reduce((sum, v) => sum + Number(v.overall) * (v.weight ?? 0), 0);
      finalAvg.fantasmaScore = Number(selfVote.overall) - peerSum / peerWeight;
    }
    processedStats.push(finalAvg);
  }

  return processedStats;
}

/** Escala 0–10 con medios puntos, alineado con la carta del partido. */
function capHalfStep10(n: number): number {
  const x = Math.min(10, Math.max(0, n));
  return Math.round(x * 2) / 2;
}

/**
 * Aplica consumibles PRE_MATCH activos cuyo target es este partido: ajusta stats
 * agregados antes de MVP / honores / TTP por ranking. Marca activaciones como CONSUMED.
 * Otros effect_key (Prode, duelo, escudos) se resuelven en sus servicios o quedan pendientes.
 */
export async function applyPreMatchConsumableStatBoosts(
  tx: TxClient,
  _matchId: string,
  stats: ProcessedStat[],
): Promise<void> {
  const activations = await tx.user_consumable_activations.findMany({
    where: {
      target_match_id: _matchId,
      status: "ACTIVE",
      timing: "PRE_MATCH",
    },
  });
  if (activations.length === 0) return;

  const keys = [...new Set(activations.map((a) => a.consumable_key))];
  const shopRows = await tx.shop_items.findMany({
    where: { consumable_key: { in: keys }, item_type: "CONSUMABLE" },
    select: { consumable_key: true, effect_key: true },
  });
  const effectByKey = new Map(
    shopRows
      .filter((r) => r.consumable_key)
      .map((r) => [r.consumable_key!, (r.effect_key ?? r.consumable_key)!.trim()]),
  );

  const byUser = new Map(stats.map((s) => [s.userId, s]));

  for (const act of activations) {
    const effect = effectByKey.get(act.consumable_key) ?? act.consumable_key;
    const row = byUser.get(act.user_id);
    if (row) {
      switch (effect) {
        case "overall_soft_boost":
          row.overall = capHalfStep10(row.overall + 0.5);
          break;
        case "overall_micro_boost":
          row.overall = capHalfStep10(row.overall + 0.3);
          break;
        case "overall_plus_one":
          row.overall = capHalfStep10(row.overall + 1);
          break;
        case "tech_soft_boost":
          row.technique = capHalfStep10(row.technique + 0.5);
          break;
        case "tech_plus_one":
          row.technique = capHalfStep10(row.technique + 1);
          break;
        case "overall_multiplier_x2":
          row.overall = capHalfStep10(row.overall * 2);
          break;
        default:
          break;
      }
    }
    // Solo consumimos acá los boosts numéricos directos. Otros efectos PRE se consumen en su servicio.
    if (
      [
        "overall_soft_boost",
        "overall_micro_boost",
        "overall_plus_one",
        "tech_soft_boost",
        "tech_plus_one",
        "overall_multiplier_x2",
      ].includes(effect)
    ) {
      await tx.user_consumable_activations.update({
        where: { id: act.id },
        data: { status: "CONSUMED" },
      });
    }
  }
}

/**
 * Recalcula la carta de un jugador en un partido a partir de los votos actuales en DB.
 * Pesos base (sin consumibles PRE ya aplicados): titular 1×, espectador 0,5×.
 */
export async function recomputeTargetPlayerMatchCard(
  tx: TxClient,
  matchId: string,
  targetUserId: string,
): Promise<void> {
  const confirmedPlayers = await tx.match_players.findMany({
    where: { match_id: matchId, has_confirmed: true },
    select: { user_id: true },
  });
  const playerSet = new Set(confirmedPlayers.map((p) => p.user_id));
  const attendingSpectators = await tx.match_spectators.findMany({
    where: { match_id: matchId, attending: true },
    select: { user_id: true },
  });
  const spectatorSet = new Set(attendingSpectators.map((s) => s.user_id));

  const voterWeight = (voterId: string | null): number => {
    if (!voterId) return 0;
    if (playerSet.has(voterId)) return 1.0;
    if (spectatorSet.has(voterId)) return 0.5;
    return 0;
  };

  const allVotesRaw = await tx.match_votes.findMany({ where: { match_id: matchId } });
  const allVotes: WeightedVoteRow[] = allVotesRaw
    .map((v) => ({
      target_id: v.target_id,
      voter_id: v.voter_id,
      overall: Number(v.overall),
      pace: v.pace != null ? Number(v.pace) : null,
      defense: v.defense != null ? Number(v.defense) : null,
      technique: v.technique != null ? Number(v.technique) : null,
      physical: v.physical != null ? Number(v.physical) : null,
      attack: v.attack != null ? Number(v.attack) : null,
      weight: voterWeight(v.voter_id),
    }))
    .filter((v) => v.weight > 0);

  const votesByPlayer = aggregateVotesByPlayer(allVotes);
  const processedStats = computeProcessedStats(votesByPlayer);
  const mine = processedStats.find((s) => s.userId === targetUserId);
  if (!mine) return;

  await tx.match_players.updateMany({
    where: { match_id: matchId, user_id: targetUserId },
    data: {
      match_rating: mine.overall,
      match_pace: mine.pace,
      match_defense: mine.defense,
      match_technique: mine.technique,
      match_physical: mine.physical,
      match_attack: mine.attack,
    },
  });
}

function stablePick(userIds: string[]): string {
  return [...userIds].sort((a, b) => String(a).localeCompare(String(b)))[0]!;
}

function pickMinOverallUser(stats: ProcessedStat[], excluded: Set<string>): string {
  const pool = stats.filter((s) => !excluded.has(s.userId));
  const min = Math.min(...pool.map((s) => Number(s.overall)));
  const winners = pool.filter((s) => Number(s.overall) === min).map((s) => s.userId);
  return stablePick(winners);
}

function pickFantasmaUser(stats: ProcessedStat[], excluded: Set<string>): string | null {
  const pool = stats.filter((s) => !excluded.has(s.userId));
  const max = Math.max(...pool.map((s) => Number(s.fantasmaScore ?? -100)));
  if (!(max > 0)) return null;
  const winners = pool.filter((s) => Number(s.fantasmaScore ?? -100) === max).map((s) => s.userId);
  return winners.length ? stablePick(winners) : null;
}

function getWinners(stats: ProcessedStat[]) {
  const maxOverall = Math.max(...stats.map((s) => Number(s.overall)));
  const minOverall = Math.min(...stats.map((s) => Number(s.overall)));
  const maxFantasma = Math.max(...stats.map((s) => Number(s.fantasmaScore ?? -100)));

  const mvpWinners = stats.filter((s) => s.overall === maxOverall).map((s) => s.userId);
  const troncoWinners = stats.filter((s) => s.overall === minOverall).map((s) => s.userId);
  const fantasmaWinners =
    maxFantasma > 0
      ? stats.filter((s) => s.fantasmaScore === maxFantasma).map((s) => s.userId)
      : [];

  return {
    // Para compatibilidad/UX: también devolvemos un "principal" determinístico
    mvpWinnerId: stablePick(mvpWinners),
    troncoWinnerId: stablePick(troncoWinners),
    fantasmaWinnerId: fantasmaWinners.length > 0 ? stablePick(fantasmaWinners) : null,
    mvpWinners,
    troncoWinners,
    fantasmaWinners,
  };
}

// Logros deshabilitados: dejamos el cierre de partido puro (sin side effects).

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
        throw new DomainError({ status: 404, code: "MATCH_NOT_FOUND" });
      }

      // Guard anti-doble-ejecución (race condition):
      // si otro cierre ya comenzó, abortar este intento antes de sumar puntos/medallas.
      const lock = await tx.matches.updateMany({
        where: {
          id: matchId,
          status: { notIn: ["COMPLETED", "COMPLETING"] },
        },
        data: { status: "COMPLETING" },
      });
      if (lock.count === 0) {
        return;
      }

      const allVotesRaw = await tx.match_votes.findMany({
        where: { match_id: matchId },
      });

      const confirmedPlayers = await tx.match_players.findMany({
        where: { match_id: matchId, has_confirmed: true },
        select: { user_id: true },
      });
      const playerSet = new Set(confirmedPlayers.map((p) => p.user_id));
      const attendingSpectators = await tx.match_spectators.findMany({
        where: { match_id: matchId, attending: true },
        select: { user_id: true },
      });
      const spectatorSet = new Set(attendingSpectators.map((s) => s.user_id));

      // Consumibles PRE_MATCH no-numéricos que afectan el cierre:
      // - peso de voto de espectador
      // - escudos anti-Fantasma / anti-Tronco (filtran ganadores)
      const preActs = await tx.user_consumable_activations.findMany({
        where: { target_match_id: matchId, timing: "PRE_MATCH", status: "ACTIVE" },
        select: { id: true, user_id: true, consumable_key: true },
      });
      const preKeys = [...new Set(preActs.map((a) => a.consumable_key))];
      const preShopRows = preKeys.length
        ? await tx.shop_items.findMany({
            where: { consumable_key: { in: preKeys }, item_type: "CONSUMABLE" },
            select: { consumable_key: true, effect_key: true },
          })
        : [];
      const preEffectByKey = new Map(
        preShopRows
          .filter((r) => r.consumable_key)
          .map((r) => [r.consumable_key!, String((r.effect_key ?? r.consumable_key) || "").trim()]),
      );
      const activeEffectsByUser = new Map<string, Set<string>>();
      for (const a of preActs) {
        const effect = preEffectByKey.get(a.consumable_key) ?? a.consumable_key;
        if (!activeEffectsByUser.has(a.user_id)) activeEffectsByUser.set(a.user_id, new Set());
        activeEffectsByUser.get(a.user_id)!.add(effect);
      }

      const voterWeight = (voterId: string | null): number => {
        if (!voterId) return 0;
        if (playerSet.has(voterId)) return 1.0;
        if (spectatorSet.has(voterId)) {
          const effects = activeEffectsByUser.get(voterId);
          if (effects?.has("spectator_overvote")) return 1.3;
          if (effects?.has("spectator_vote_player")) return 1.0;
          return 0.5;
        }
        return 0;
      };

      const allVotes: WeightedVoteRow[] = allVotesRaw
        .map((v) => ({
          target_id: v.target_id,
          voter_id: v.voter_id,
          overall: Number(v.overall),
          pace: v.pace != null ? Number(v.pace) : null,
          defense: v.defense != null ? Number(v.defense) : null,
          technique: v.technique != null ? Number(v.technique) : null,
          physical: v.physical != null ? Number(v.physical) : null,
          attack: v.attack != null ? Number(v.attack) : null,
          weight: voterWeight(v.voter_id),
        }))
        // seguridad: ignorar votos de usuarios no elegibles
        .filter((v) => v.weight > 0);

      if (allVotes.length === 0) {
        // Aun sin votos, el partido debe cerrar correctamente:
        // - resolver duelo (empate estable si no hay stats)
        // - liquidar apuestas TTP (contra la casa)
        // - otorgar TTP por partido jugado a confirmados
        await resolveMatchDuel(matchId, tx);
        await settleHouseBetsForMatch(matchId, tx as TxClient);
        await Promise.all(
          confirmedPlayers.map((p) =>
            grantTtpInTx(tx as TxClient, {
              userId: p.user_id,
              amount: TTP_MATCH_PLAYED,
              reason: "MATCH_PLAYED",
              refType: "MATCH",
              refId: matchId,
              idempotencyKey: `match:${matchId}:played:${p.user_id}`,
            }),
          ),
        );
        await tx.matches.update({
          where: { id: matchId },
          data: { status: "COMPLETED" },
        });
        return;
      }

      const votesByPlayer = aggregateVotesByPlayer(allVotes);
      const processedStats = computeProcessedStats(votesByPlayer);

      if (processedStats.length === 0) {
        await resolveMatchDuel(matchId, tx);
        await settleHouseBetsForMatch(matchId, tx as TxClient);
        await Promise.all(
          confirmedPlayers.map((p) =>
            grantTtpInTx(tx as TxClient, {
              userId: p.user_id,
              amount: TTP_MATCH_PLAYED,
              reason: "MATCH_PLAYED",
              refType: "MATCH",
              refId: matchId,
              idempotencyKey: `match:${matchId}:played:${p.user_id}`,
            }),
          ),
        );
        await tx.matches.update({
          where: { id: matchId },
          data: { status: "COMPLETED" },
        });
        return;
      }

      await applyPreMatchConsumableStatBoosts(tx, matchId, processedStats);

      let {
        mvpWinnerId,
        troncoWinnerId,
        fantasmaWinnerId,
        mvpWinners,
        troncoWinners,
        fantasmaWinners,
      } = getWinners(processedStats);

      // Escudos: filtrar ganadores Tronco/Fantasma si el usuario activó el escudo.
      const shieldTronco = new Set(
        [...activeEffectsByUser.entries()]
          .filter(([, effs]) => effs.has("shield_vs_tronco"))
          .map(([uid]) => uid),
      );
      const shieldFantasma = new Set(
        [...activeEffectsByUser.entries()]
          .filter(([, effs]) => effs.has("shield_vs_fantasma"))
          .map(([uid]) => uid),
      );
      troncoWinners = troncoWinners.filter((u) => !shieldTronco.has(u));
      if (troncoWinners.length === 0 && shieldTronco.size > 0) {
        // si todos los mínimos tenían escudo, elegir el siguiente mínimo sin escudo
        troncoWinnerId = pickMinOverallUser(processedStats, shieldTronco);
        troncoWinners = [troncoWinnerId];
      } else {
        troncoWinnerId = stablePick(troncoWinners);
      }
      fantasmaWinners = fantasmaWinners.filter((u) => !shieldFantasma.has(u));
      if ((fantasmaWinnerId && shieldFantasma.has(fantasmaWinnerId)) || fantasmaWinners.length === 0) {
        fantasmaWinnerId = pickFantasmaUser(processedStats, shieldFantasma);
        fantasmaWinners = fantasmaWinnerId ? [fantasmaWinnerId] : [];
      } else {
        fantasmaWinnerId = fantasmaWinners.length ? stablePick(fantasmaWinners) : null;
      }

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

      // Cache de métricas derivadas (para Misiones / escala):
      // - Top por habilidad (con empates)
      // - Primero en confirmar (por match)
      const maxDefense = Math.max(...processedStats.map((s) => s.defense ?? -Infinity));
      const maxPace = Math.max(...processedStats.map((s) => s.pace ?? -Infinity));
      const maxTechnique = Math.max(...processedStats.map((s) => s.technique ?? -Infinity));
      const maxPhysical = Math.max(...processedStats.map((s) => s.physical ?? -Infinity));
      const maxAttack = Math.max(...processedStats.map((s) => s.attack ?? -Infinity));

      const confirms = await tx.match_players.findMany({
        where: { match_id: matchId, confirmed_at: { not: null } } as any,
        select: { user_id: true, confirmed_at: true },
      });
      const minConfirmAt = confirms.length
        ? new Date(Math.min(...confirms.map((c) => new Date(c.confirmed_at as any).getTime())))
        : null;

      await Promise.all(
        processedStats.map((s) => {
          const wasFirst =
            !!minConfirmAt &&
            confirms.some(
              (c) =>
                c.user_id === s.userId &&
                new Date(c.confirmed_at as any).getTime() === minConfirmAt.getTime(),
            );
          return tx.match_players.updateMany({
            where: { match_id: matchId, user_id: s.userId },
            data: {
              was_first_confirm: wasFirst,
              is_top_defense: s.defense != null && s.defense >= maxDefense,
              is_top_pace: s.pace != null && s.pace >= maxPace,
              is_top_technique: s.technique != null && s.technique >= maxTechnique,
              is_top_physical: s.physical != null && s.physical >= maxPhysical,
              is_top_attack: s.attack != null && s.attack >= maxAttack,
            } as any,
          });
        }),
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

        const isMvp = mvpWinners.includes(stat.userId);
        const isTronco = troncoWinners.includes(stat.userId);
        const isFantasma = fantasmaWinners.includes(stat.userId);

        if (isMvp) {
          honorsToCreate.push({
            match_id: matchId,
            user_id: stat.userId,
            league_id: leagueId,
            honor_type: "MVP",
          });
        }
        if (isTronco) {
          honorsToCreate.push({
            match_id: matchId,
            user_id: stat.userId,
            league_id: leagueId,
            honor_type: "TRONCO",
          });
        }
        if (isFantasma) {
          honorsToCreate.push({
            match_id: matchId,
            user_id: stat.userId,
            league_id: leagueId,
            honor_type: "FANTASMA",
          });
        }

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
        // En empate, puede haber más de un ganador. Sumamos 1 a cada ganador.
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
        data: { mvp_id: mvpWinnerId },
      });

      // Apuestas TTP (MVP): liquidar jackpot cuando hay MVP.
      await settleMvpMarketForMatch(matchId, mvpWinnerId, tx as TxClient);

      // Apuestas TTP contra la casa: liquidar mercados/slips.
      await settleHouseBetsForMatch(matchId, tx as TxClient);

      await resolveMatchDuel(matchId, tx);

      await processMatchPredictions(matchId, tx);

      // TTP: acreditar por partido jugado (idempotente por match+user).
      // Se hace dentro de la misma tx del cierre para que `ttp_balance` y `ttp_ledger` queden consistentes.
      await Promise.all(
        processedStats.map((stat) =>
          grantTtpInTx(tx as TxClient, {
            userId: stat.userId,
            amount: TTP_MATCH_PLAYED,
            reason: "MATCH_PLAYED",
            refType: "MATCH",
            refId: matchId,
            idempotencyKey: `match:${matchId}:played:${stat.userId}`,
          }),
        ),
      );

      // Consumir activaciones PRE_MATCH de peso de espectador y escudos (ya aplicaron en este cierre).
      const effectsThatConsumeOnClose = new Set([
        "spectator_vote_player",
        "spectator_overvote",
        "shield_vs_fantasma",
        "shield_vs_tronco",
      ]);
      const toConsume = preActs.filter((a) => {
        const eff = preEffectByKey.get(a.consumable_key) ?? a.consumable_key;
        return effectsThatConsumeOnClose.has(eff);
      });
      if (toConsume.length) {
        await tx.user_consumable_activations.updateMany({
          where: { id: { in: toConsume.map((a) => a.id) } },
          data: { status: "CONSUMED" },
        });
      }

      await tx.matches.update({
        where: { id: matchId },
        data: { status: "COMPLETED" },
      });
    }, { timeout: 15000 });

    // Notificaciones post-cierre (fire-and-forget): resultados, premios, duelo
    sendCloseMatchNotifications(matchId).catch((err) =>
      log.errorWithErr("closeMatch notifications failed", err, { matchId }),
    );

    // Logros: worker en hilo separado (fire-and-forget, no await)
    // Logros/cosméticos deshabilitados intencionalmente.

    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "MATCH_NOT_FOUND" || error.message === "NO_LEAGUE")
    ) {
      return false;
    }
    log.errorWithErr("Falló cierre de match", error, { matchId });
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
  isOpenSignup?: boolean;
  maxPlayers?: number;
  matchMode?: "INTERNAL" | "EXTERNAL";
  players?: Array<{ id: string; team: string }>;
}

export async function createMatch(
  input: CreateMatchInput,
): Promise<{ id: string; league_id: string | null; status: string | null; date_time: Date; location_name: string | null }> {
  const { leagueId, adminId, location, dateTime, price, players, isOpenSignup, maxPlayers, matchMode } = input;

  const result = await prisma.$transaction(async (tx) => {
    const newMatch = await tx.matches.create({
      data: {
        league_id: leagueId,
        admin_id: adminId,
        location_name: location,
        date_time: dateTime,
        price_per_player: price,
        status: "OPEN",
        is_open_signup: isOpenSignup === true,
        max_players: typeof maxPlayers === "number" ? maxPlayers : null,
        match_mode: matchMode === "EXTERNAL" ? "EXTERNAL" : "INTERNAL",
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
