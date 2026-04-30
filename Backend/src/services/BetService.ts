import { randomUUID } from "node:crypto";
import { prisma } from "../db.js";
import type { TxClient } from "./TtpService.js";
import { grantTtpInTx } from "./TtpService.js";
import { lockUserRow } from "../utils/locks.js";

export const MVP_MARKET_KEY = "MVP";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function debitTtpInTx(
  tx: TxClient,
  params: {
    userId: string;
    amount: number; // positive (we store negative ledger)
    reason: string;
    refType?: string | null;
    refId?: string | null;
    idempotencyKey: string;
  },
): Promise<{ ok: boolean; balanceAfter?: number; error?: "INSUFFICIENT_TTP" }> {
  const amt = Math.floor(Number(params.amount));
  if (!Number.isFinite(amt) || amt <= 0) return { ok: false, error: "INSUFFICIENT_TTP" };

  await lockUserRow(tx, params.userId);
  const user = await tx.users.findUnique({
    where: { id: params.userId },
    select: { ttp_balance: true },
  });
  if (!user) return { ok: false, error: "INSUFFICIENT_TTP" };
  if (user.ttp_balance < amt) return { ok: false, error: "INSUFFICIENT_TTP" };

  const balanceAfter = user.ttp_balance - amt;
  await tx.ttp_ledger.create({
    data: {
      user_id: params.userId,
      amount: -amt,
      balance_after: balanceAfter,
      reason: params.reason,
      ref_type: params.refType ?? undefined,
      ref_id: params.refId ?? undefined,
      idempotency_key: params.idempotencyKey,
    },
  });
  await tx.users.update({
    where: { id: params.userId },
    data: { ttp_balance: balanceAfter },
  });
  return { ok: true, balanceAfter };
}

async function isUserPlayerInMatch(
  matchId: string,
  userId: string,
  tx?: TxClient,
): Promise<boolean> {
  const client = tx ?? prisma;
  const p = await client.match_players.findUnique({
    where: { match_id_user_id: { match_id: matchId, user_id: userId } },
    select: { user_id: true },
  });
  return !!p?.user_id;
}

export async function ensureMvpMarketForMatch(matchId: string): Promise<string | null> {
  const match = await prisma.matches.findUnique({
    where: { id: matchId },
    select: { id: true, league_id: true, date_time: true, status: true },
  });
  if (!match?.league_id) return null;
  if (String(match.status || "").toUpperCase() === "CANCELLED") return null;

  const created = await prisma.ttp_bet_markets.upsert({
    where: { match_id_market_key: { match_id: matchId, market_key: MVP_MARKET_KEY } },
    create: {
      league_id: match.league_id,
      match_id: matchId,
      market_key: MVP_MARKET_KEY,
      status: "OPEN",
      closes_at: match.date_time,
    },
    update: {
      // mantenemos el cierre alineado por si se reprograma
      closes_at: match.date_time,
    },
    select: { id: true },
  });
  return created.id;
}

export async function getNextMatchMvpMarket(leagueId: string, userId: string) {
  const nextMatch = await prisma.matches.findFirst({
    where: {
      league_id: leagueId,
      status: { notIn: ["CANCELLED", "COMPLETED"] },
      date_time: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
    },
    orderBy: { date_time: "asc" },
    select: { id: true, date_time: true, location_name: true, status: true },
  });
  if (!nextMatch) return { match: null, market: null };

  const marketId = await ensureMvpMarketForMatch(nextMatch.id);
  if (!marketId) return { match: nextMatch, market: null };

  const [market, players, bets] = await Promise.all([
    prisma.ttp_bet_markets.findUnique({ where: { id: marketId } }),
    prisma.match_players.findMany({
      where: { match_id: nextMatch.id },
      select: {
        user_id: true,
        users: {
          select: {
            full_name: true,
            username: true,
            profile_photo_url: true,
            avatar_frame: true,
            accent_color: true,
          },
        },
      },
      orderBy: { user_id: "asc" },
    }),
    prisma.ttp_bets.findMany({
      where: { market_id: marketId },
      select: { option_key: true, stake_ttp: true, user_id: true },
    }),
  ]);

  const totalsByOption: Record<string, number> = {};
  let potTotal = 0;
  let myBet: { optionKey: string; stakeTtp: number } | null = null;
  for (const b of bets) {
    potTotal += Number(b.stake_ttp || 0);
    totalsByOption[b.option_key] = (totalsByOption[b.option_key] ?? 0) + Number(b.stake_ttp || 0);
    if (b.user_id === userId) {
      myBet = { optionKey: b.option_key, stakeTtp: Number(b.stake_ttp || 0) };
    }
  }

  const isParticipant = await isUserPlayerInMatch(nextMatch.id, userId);

  return {
    match: {
      id: nextMatch.id,
      dateTime: nextMatch.date_time.toISOString(),
      locationName: nextMatch.location_name,
      status: nextMatch.status,
    },
    market: market
      ? {
          id: market.id,
          marketKey: market.market_key,
          status: market.status,
          closesAt: market.closes_at?.toISOString() ?? null,
          potTotal,
          isParticipant,
          myBet,
          options: players.map((p) => ({
            optionKey: p.user_id,
            label: p.users?.full_name ?? p.users?.username ?? "Jugador",
            imageUrl: p.users?.profile_photo_url ?? null,
            avatar_frame: p.users?.avatar_frame ?? null,
            accent_color: p.users?.accent_color ?? null,
            totalStaked: totalsByOption[p.user_id] ?? 0,
          })),
        }
      : null,
  };
}

export async function placeMvpBet(params: {
  marketId: string;
  userId: string;
  optionUserId: string;
  stakeTtp: number;
}): Promise<
  | { ok: true; balanceAfter: number; myBet: { optionKey: string; stakeTtp: number } }
  | { ok: false; error: "NOT_FOUND" | "MARKET_CLOSED" | "INVALID_OPTION" | "FORBIDDEN_PARTICIPANT" | "INSUFFICIENT_TTP" }
> {
  const stake = Math.floor(Number(params.stakeTtp));
  if (!Number.isFinite(stake) || stake <= 0) return { ok: false, error: "INSUFFICIENT_TTP" };
  if (!isUuid(params.optionUserId)) return { ok: false, error: "INVALID_OPTION" };

  return prisma.$transaction(async (tx) => {
    const market = await tx.ttp_bet_markets.findUnique({
      where: { id: params.marketId },
      select: { id: true, match_id: true, league_id: true, status: true, closes_at: true, market_key: true },
    });
    if (!market || market.market_key !== MVP_MARKET_KEY) return { ok: false as const, error: "NOT_FOUND" as const };

    const now = new Date();
    if (String(market.status).toUpperCase() !== "OPEN" || (market.closes_at && market.closes_at <= now)) {
      return { ok: false as const, error: "MARKET_CLOSED" as const };
    }

    const isParticipant = await isUserPlayerInMatch(market.match_id, params.userId, tx);
    if (isParticipant) {
      return { ok: false as const, error: "FORBIDDEN_PARTICIPANT" as const };
    }

    // Validar que el option sea un jugador del partido
    const player = await tx.match_players.findUnique({
      where: { match_id_user_id: { match_id: market.match_id, user_id: params.optionUserId } },
      select: { user_id: true },
    });
    if (!player) {
      return { ok: false as const, error: "INVALID_OPTION" as const };
    }

    const existing = await tx.ttp_bets.findUnique({
      where: { market_id_user_id: { market_id: market.id, user_id: params.userId } },
      select: { id: true, stake_ttp: true },
    });

    const idempotencyKey = `ttp:bet_stake:${market.id}:${params.userId}:${randomUUID()}`;
    const debit = await debitTtpInTx(tx, {
      userId: params.userId,
      amount: stake,
      reason: "BET_STAKE",
      refType: "bet_market",
      refId: market.id,
      idempotencyKey,
    });
    if (!debit.ok) return { ok: false as const, error: "INSUFFICIENT_TTP" as const };

    const nextStake = (existing?.stake_ttp ?? 0) + stake;
    await tx.ttp_bets.upsert({
      where: { market_id_user_id: { market_id: market.id, user_id: params.userId } },
      create: {
        market_id: market.id,
        user_id: params.userId,
        option_key: params.optionUserId,
        stake_ttp: stake,
      },
      update: {
        option_key: params.optionUserId,
        stake_ttp: nextStake,
      },
    });

    return { ok: true as const, balanceAfter: debit.balanceAfter ?? 0, myBet: { optionKey: params.optionUserId, stakeTtp: nextStake } };
  });
}

export async function settleMvpMarketForMatch(matchId: string, winnerUserId: string | null, tx: TxClient): Promise<void> {
  const market = await tx.ttp_bet_markets.findFirst({
    where: { match_id: matchId, market_key: MVP_MARKET_KEY, status: { in: ["OPEN", "CLOSED"] } },
  });
  if (!market) return;

  // lock market row
  await tx.$queryRawUnsafe(`SELECT 1 FROM ttp_bet_markets WHERE id = $1::uuid FOR UPDATE`, market.id);
  const fresh = await tx.ttp_bet_markets.findUnique({ where: { id: market.id } });
  if (!fresh || String(fresh.status).toUpperCase() === "SETTLED") return;

  const bets = await tx.ttp_bets.findMany({
    where: { market_id: market.id },
    select: { id: true, user_id: true, option_key: true, stake_ttp: true },
  });
  if (bets.length === 0) {
    await tx.ttp_bet_markets.update({
      where: { id: market.id },
      data: { status: "VOID", settled_at: new Date(), winning_option_key: winnerUserId ?? null },
    });
    return;
  }

  const potTotal = bets.reduce((s, b) => s + Number(b.stake_ttp || 0), 0);

  if (!winnerUserId || !isUuid(winnerUserId)) {
    // Void/refund if no winner
    for (const b of bets) {
      await grantTtpInTx(tx, {
        userId: b.user_id,
        amount: Number(b.stake_ttp || 0),
        reason: "BET_REFUND",
        refType: "bet_market",
        refId: market.id,
        idempotencyKey: `ttp:bet_refund:${market.id}:${b.id}`,
      });
    }
    await tx.ttp_bet_markets.update({
      where: { id: market.id },
      data: { status: "VOID", settled_at: new Date(), winning_option_key: null },
    });
    return;
  }

  const winners = bets.filter((b) => b.option_key === winnerUserId);
  const winningTotal = winners.reduce((s, b) => s + Number(b.stake_ttp || 0), 0);

  if (winningTotal <= 0) {
    // Nobody bet on the winner -> refund all (UX fair)
    for (const b of bets) {
      await grantTtpInTx(tx, {
        userId: b.user_id,
        amount: Number(b.stake_ttp || 0),
        reason: "BET_REFUND",
        refType: "bet_market",
        refId: market.id,
        idempotencyKey: `ttp:bet_refund:${market.id}:${b.id}`,
      });
    }
    await tx.ttp_bet_markets.update({
      where: { id: market.id },
      data: { status: "VOID", settled_at: new Date(), winning_option_key: winnerUserId },
    });
    return;
  }

  // Payouts proportional (pari-mutuel), with deterministic remainder distribution.
  const basePayouts = winners.map((b) => ({
    betId: b.id,
    userId: b.user_id,
    stake: Number(b.stake_ttp || 0),
    payout: Math.floor((Number(b.stake_ttp || 0) * potTotal) / winningTotal),
  }));
  let paid = basePayouts.reduce((s, p) => s + p.payout, 0);
  let rem = potTotal - paid;
  basePayouts.sort((a, b) => b.stake - a.stake || String(a.userId).localeCompare(String(b.userId)));
  for (let i = 0; i < basePayouts.length && rem > 0; i++) {
    basePayouts[i]!.payout += 1;
    rem -= 1;
  }

  for (const p of basePayouts) {
    if (p.payout <= 0) continue;
    await grantTtpInTx(tx, {
      userId: p.userId,
      amount: p.payout,
      reason: "BET_PAYOUT",
      refType: "bet_market",
      refId: market.id,
      idempotencyKey: `ttp:bet_payout:${market.id}:${p.betId}`,
    });
  }

  await tx.ttp_bet_markets.update({
    where: { id: market.id },
    data: { status: "SETTLED", settled_at: new Date(), winning_option_key: winnerUserId },
  });
}

