import type { Prisma } from "../../generated/client/index.js";
import type { TxClient } from "../TtpService.js";
import { recomputeTargetPlayerMatchCard } from "../MatchService.js";
import { syncLeagueMemberFromHistory } from "../LeagueMemberSyncService.js";
import type { PostActivateMeta } from "./activationMeta.js";
import { EffectKey } from "./effectKeys.js";

export type PostMatchEffectInput = {
  tx: TxClient;
  effectKey: string;
  userId: string;
  leagueId: string;
  matchId: string;
  postMeta: PostActivateMeta;
};

export type RankingHeistPreconditionError =
  | "HEIST_NO_PEER"
  | "HEIST_NOT_IN_MATCH"
  | "INVALID_SWAP_TARGET";

/**
 * Debe llamarse antes de descontar stock: evita consumir el ítem si el canje no puede aplicarse.
 */
export async function validateRankingHeistPreconditions(
  tx: TxClient,
  matchId: string,
  userId: string,
  postMeta: PostActivateMeta,
): Promise<{ ok: true } | { ok: false; error: RankingHeistPreconditionError }> {
  const players = await tx.match_players.findMany({
    where: { match_id: matchId },
    select: { user_id: true },
  });
  const inMatch = new Set(players.map((p) => p.user_id));
  if (!inMatch.has(userId)) {
    return { ok: false, error: "HEIST_NOT_IN_MATCH" };
  }
  const others = players.filter((p) => p.user_id !== userId);
  if (others.length === 0) {
    return { ok: false, error: "HEIST_NO_PEER" };
  }
  const swap = postMeta.swapWithUserId?.trim();
  if (swap) {
    if (swap === userId || !inMatch.has(swap)) {
      return { ok: false, error: "INVALID_SWAP_TARGET" };
    }
  }
  return { ok: true };
}

/** Prioridad al borrar una medalla con "Chapa fuera". */
const MEDAL_FORFEIT_ORDER = ["MVP", "ORACLE", "CRYSTAL_BALL", "DUEL", "TRONCO", "FANTASMA"] as const;

/**
 * Aplica un efecto POST_MATCH dentro de la misma transacción que ya creó la activación y descontó stock.
 * No marca CONSUMED en la activación (lo hace el llamador).
 */
export async function applyPostMatchConsumableEffect(input: PostMatchEffectInput): Promise<void> {
  const { tx, effectKey, userId, leagueId, matchId, postMeta } = input;
  const k = effectKey.trim();

  switch (k) {
    case EffectKey.MEDAL_FORFEIT_TOKEN:
      await applyMedalForfeit(tx, matchId, userId, leagueId);
      return;
    case EffectKey.GHOST_TOP_SCORE_TIE:
      await applyGhostTopScoreTie(tx, matchId, userId, leagueId);
      return;
    case EffectKey.HISTORY_DELETE_MATCH:
      await applyHistoryDeleteMatch(tx, matchId, userId, leagueId);
      return;
    case EffectKey.RANKING_HEIST_SWAP:
      await applyRankingHeistSwap(tx, matchId, userId, leagueId, postMeta);
      return;
    case EffectKey.REWIND_TEAMMATE_VOTE:
      await applyRewindTeammateVote(tx, matchId, userId, leagueId);
      return;
    default:
      return;
  }
}

async function applyMedalForfeit(
  tx: TxClient,
  matchId: string,
  userId: string,
  leagueId: string,
): Promise<void> {
  const honors = await tx.honors.findMany({
    where: { match_id: matchId, user_id: userId },
    select: { id: true, honor_type: true },
  });
  const rank = (t: string) => {
    const i = MEDAL_FORFEIT_ORDER.indexOf(t.toUpperCase() as (typeof MEDAL_FORFEIT_ORDER)[number]);
    return i === -1 ? 999 : i;
  };
  honors.sort((a, b) => rank(String(a.honor_type || "")) - rank(String(b.honor_type || "")));
  if (honors[0]?.id) {
    await tx.honors.delete({ where: { id: honors[0].id } });
  }
  await syncLeagueMemberFromHistory(tx, userId, leagueId);
}

async function applyGhostTopScoreTie(
  tx: TxClient,
  matchId: string,
  userId: string,
  leagueId: string,
): Promise<void> {
  const players = await tx.match_players.findMany({
    where: { match_id: matchId },
    select: { user_id: true, match_rating: true },
  });
  if (players.length === 0) return;
  const max = Math.max(...players.map((p) => Number(p.match_rating || 0)));
  await tx.match_players.updateMany({
    where: { match_id: matchId, user_id: userId },
    data: { match_rating: max },
  });
  await syncLeagueMemberFromHistory(tx, userId, leagueId);
}

async function applyHistoryDeleteMatch(
  tx: TxClient,
  matchId: string,
  userId: string,
  leagueId: string,
): Promise<void> {
  await tx.match_votes.deleteMany({
    where: { match_id: matchId, OR: [{ voter_id: userId }, { target_id: userId }] },
  });
  await tx.honors.deleteMany({ where: { match_id: matchId, user_id: userId } });
  await tx.match_players.deleteMany({ where: { match_id: matchId, user_id: userId } });
  await syncLeagueMemberFromHistory(tx, userId, leagueId);
}

type CardRow = {
  user_id: string;
  match_rating: Prisma.Decimal | null;
  match_pace: Prisma.Decimal | null;
  match_defense: Prisma.Decimal | null;
  match_technique: Prisma.Decimal | null;
  match_physical: Prisma.Decimal | null;
  match_attack: Prisma.Decimal | null;
};

function cardDataFromRow(
  r: CardRow,
): {
  match_rating: Prisma.Decimal | null;
  match_pace: Prisma.Decimal | null;
  match_defense: Prisma.Decimal | null;
  match_technique: Prisma.Decimal | null;
  match_physical: Prisma.Decimal | null;
  match_attack: Prisma.Decimal | null;
} {
  return {
    match_rating: r.match_rating,
    match_pace: r.match_pace,
    match_defense: r.match_defense,
    match_technique: r.match_technique,
    match_physical: r.match_physical,
    match_attack: r.match_attack,
  };
}

async function applyRankingHeistSwap(
  tx: TxClient,
  matchId: string,
  userId: string,
  leagueId: string,
  postMeta: PostActivateMeta,
): Promise<void> {
  const players = await tx.match_players.findMany({
    where: { match_id: matchId },
    select: {
      user_id: true,
      match_rating: true,
      match_pace: true,
      match_defense: true,
      match_technique: true,
      match_physical: true,
      match_attack: true,
    },
  });

  const others = players.filter((p) => p.user_id !== userId);
  if (others.length === 0) return;

  const me = players.find((p) => p.user_id === userId);
  if (!me) return;

  const swapWithId = postMeta.swapWithUserId?.trim() ?? null;

  let other: CardRow | undefined;
  if (swapWithId) {
    other = players.find((p) => p.user_id === swapWithId && p.user_id !== userId);
  } else {
    other = [...others].sort((a, b) => Number(b.match_rating || 0) - Number(a.match_rating || 0))[0];
  }
  if (!other) return;

  const myCard = cardDataFromRow(me);
  const otherCard = cardDataFromRow(other);

  await tx.match_players.update({
    where: { match_id_user_id: { match_id: matchId, user_id: userId } },
    data: otherCard,
  });
  await tx.match_players.update({
    where: { match_id_user_id: { match_id: matchId, user_id: other.user_id } },
    data: myCard,
  });

  await syncLeagueMemberFromHistory(tx, userId, leagueId);
  await syncLeagueMemberFromHistory(tx, other.user_id, leagueId);
}

async function applyRewindTeammateVote(
  tx: TxClient,
  matchId: string,
  userId: string,
  leagueId: string,
): Promise<void> {
  const worst = await tx.match_votes.findFirst({
    where: { match_id: matchId, target_id: userId, voter_id: { not: userId } },
    orderBy: { overall: "asc" },
    select: { id: true },
  });
  if (!worst?.id) return;

  await tx.match_votes.delete({ where: { id: worst.id } });
  await recomputeTargetPlayerMatchCard(tx, matchId, userId);
  await syncLeagueMemberFromHistory(tx, userId, leagueId);
}
