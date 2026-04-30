import { randomUUID, createHash } from "node:crypto";
import { prisma } from "../db.js";
import type { TxClient } from "./TtpService.js";
import { grantTtpInTx } from "./TtpService.js";
import { lockUserRow } from "../utils/locks.js";

// Pool grande de mercados. Por partido se eligen 15.
export const HOUSE_MARKETS = [
  // Medallas / reconocimientos
  "MVP",
  "TRONCO",
  "FANTASMA",

  // Duelo
  "DUEL_WINNER",

  // Prode / marcador (verificable por score)
  "RESULT_1X2",

  // Evento (flags del admin al cerrar)
  "ANY_INJURY",
  "ANY_LEFT_EARLY",

  // Rendimientos del partido (no repetitivo: solo TOP de algunas stats)
  "DEFENSE_TOP",
  "ATTACK_TOP",
  "TECHNIQUE_TOP",
  "PACE_TOP",
] as const;

export type HouseMarketKey = (typeof HOUSE_MARKETS)[number];

const HOUSE_MARGIN = 0.08; // 8% (reduce payout odds)
const ODDS_MIN = 1.001;
const ODDS_MAX = 50.0;
const MARKETS_PER_MATCH = 15;

const MARKET_LABEL: Record<HouseMarketKey, string> = {
  MVP: "¿Quién será el MVP?",
  TRONCO: "¿Quién será el Tronco?",
  FANTASMA: "¿Quién será el Fantasma?",
  DEFENSE_TOP: "Mayor puntaje en defensa",
  ATTACK_TOP: "Mayor puntaje en ataque",
  TECHNIQUE_TOP: "Mayor puntaje en técnica",
  PACE_TOP: "Mayor puntaje en ritmo",
  DUEL_WINNER: "¿Quién gana el duelo?",
  RESULT_1X2: "Resultado del partido (1X2)",
  ANY_INJURY: "¿Hay al menos 1 lesionado?",
  ANY_LEFT_EARLY: "¿Alguien no completa el partido?",
};

type MarketOption = { optionKey: string; label: string; imageUrl: string | null };

function seededPick15(matchId: string, pool: readonly HouseMarketKey[]): HouseMarketKey[] {
  const seedHex = createHash("sha256").update(matchId).digest("hex");
  const bytes = seedHex.match(/.{1,2}/g)?.map((h) => parseInt(h, 16)) ?? [];
  const items = [...pool];
  let j = 0;
  // Fisher-Yates con "random" determinístico desde bytes
  for (let i = items.length - 1; i > 0; i--) {
    const b = bytes[j % bytes.length] ?? 0;
    j++;
    const k = b % (i + 1);
    [items[i], items[k]] = [items[k]!, items[i]!];
  }
  return items.slice(0, Math.min(15, items.length));
}

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

function softmax(scores: number[]): number[] {
  if (scores.length === 0) return [];
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return sum > 0 ? exps.map((e) => e / sum) : scores.map(() => 1 / scores.length);
}

function toDecimalOdds(prob: number): number {
  const p = clamp(prob, 1e-6, 1);
  // margin -> slightly worse for user
  const pWithMargin = clamp(p * (1 + HOUSE_MARGIN), 1e-6, 0.999999);
  const odds = 1 / pWithMargin;
  return clamp(odds, ODDS_MIN, ODDS_MAX);
}

async function debitTtpInTx(
  tx: TxClient,
  params: {
    userId: string;
    amount: number; // positive
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
  if (!user || user.ttp_balance < amt) return { ok: false, error: "INSUFFICIENT_TTP" };

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

async function isUserPlayerInMatch(matchId: string, userId: string, tx?: TxClient): Promise<boolean> {
  const client = tx ?? prisma;
  const p = await client.match_players.findUnique({
    where: { match_id_user_id: { match_id: matchId, user_id: userId } },
    select: { user_id: true },
  });
  return !!p?.user_id;
}

export async function ensureHouseMarketsForMatch(matchId: string): Promise<void> {
  const match = await prisma.matches.findUnique({
    where: { id: matchId },
    select: { id: true, league_id: true, date_time: true, status: true },
  });
  if (!match?.league_id) return;
  if (String(match.status || "").toUpperCase() === "CANCELLED") return;

  const desiredCount = Math.min(MARKETS_PER_MATCH, HOUSE_MARKETS.length);

  await prisma.$transaction(async (tx) => {
    // Si ya hay mercados creados para este match, solo refrescamos closes_at.
    const existing = await tx.ttp_house_bet_markets.findMany({
      where: { match_id: matchId },
      select: { id: true, market_key: true },
    });
    if (existing.length > 0) {
      const poolSet = new Set<string>(HOUSE_MARKETS as unknown as string[]);
      const allInPool = existing.every((e) => poolSet.has(e.market_key));
      const looksCorrect = existing.length === desiredCount && allInPool;
      if (looksCorrect) {
        await tx.ttp_house_bet_markets.updateMany({
          where: { match_id: matchId, status: "OPEN" },
          data: { closes_at: match.date_time },
        });
        return;
      }

      // Si quedaron mercados viejos (keys antiguas) o cantidad distinta, regenerar para evitar UI rara.
      await tx.ttp_house_bet_markets.deleteMany({ where: { match_id: matchId } });
    }

    // Elegir 15 del pool (determinístico por match)
    const picked = seededPick15(matchId, HOUSE_MARKETS);
    await tx.ttp_house_bet_markets.createMany({
      data: picked.map((mk) => ({
        league_id: match.league_id!,
        match_id: matchId,
        market_key: mk,
        status: "OPEN",
        closes_at: match.date_time,
      })),
    });
  });
}

type PlayerStat = {
  userId: string;
  label: string;
  imageUrl: string | null;
  matchesPlayed: number;
  leagueOverall: number;
  avgPace: number;
  avgDefense: number;
  avgTechnique: number;
  avgPhysical: number;
  avgAttack: number;
  honorsMvp: number;
  honorsTronco: number;
  honorsFantasma: number;
  honorsDuel: number;
};

async function getCandidatePlayers(matchId: string): Promise<PlayerStat[]> {
  const players = await prisma.match_players.findMany({
    where: { match_id: matchId },
    select: {
      user_id: true,
      users: { select: { full_name: true, username: true, profile_photo_url: true } },
    },
    orderBy: { user_id: "asc" },
  });
  const ids = players.map((p) => p.user_id);
  if (ids.length === 0) return [];

  const match = await prisma.matches.findUnique({
    where: { id: matchId },
    select: { league_id: true },
  });
  if (!match?.league_id) return [];

  const members = await prisma.league_members.findMany({
    where: { league_id: match.league_id, user_id: { in: ids } },
    select: {
      user_id: true,
      matches_played: true,
      league_overall: true,
      avg_pace: true,
      avg_defense: true,
      avg_technique: true,
      avg_physical: true,
      avg_attack: true,
      honors_mvp: true,
      honors_tronco: true,
      honors_fantasma: true,
      honors_duel: true,
    },
  });
  const byId = new Map(members.map((m) => [m.user_id, m]));

  return players.map((p) => {
    const m = byId.get(p.user_id);
    return {
      userId: p.user_id,
      label: p.users?.full_name ?? p.users?.username ?? "Jugador",
      imageUrl: p.users?.profile_photo_url ?? null,
      matchesPlayed: Number(m?.matches_played ?? 0),
      leagueOverall: Number(m?.league_overall ?? 5),
      avgPace: Number(m?.avg_pace ?? 5),
      avgDefense: Number(m?.avg_defense ?? 5),
      avgTechnique: Number(m?.avg_technique ?? 5),
      avgPhysical: Number(m?.avg_physical ?? 5),
      avgAttack: Number(m?.avg_attack ?? 5),
      honorsMvp: Number(m?.honors_mvp ?? 0),
      honorsTronco: Number(m?.honors_tronco ?? 0),
      honorsFantasma: Number(m?.honors_fantasma ?? 0),
      honorsDuel: Number(m?.honors_duel ?? 0),
    } satisfies PlayerStat;
  });
}

function oddsForPlayerMarket(marketKey: HouseMarketKey, players: PlayerStat[]): Record<string, number> {
  if (players.length === 0) return {};

  // Heurísticas simples + smoothing (producible y estable, sin "inf")
  // MVP: alto overall + historial MVP, penaliza poco partidos.
  // TRONCO: bajo overall + historial tronco.
  // FANTASMA: historial fantasma + (ligero) overall (fantasma puede ser cualquiera).
  // OVERALL_TOP/BOTTOM: alto/bajo overall.
  // *_TOP/BOTTOM: alto/bajo promedio de esa stat.
  const scores = players.map((p) => {
    const mp = Math.max(1, p.matchesPlayed);
    const prior = 2; // smoothing
    const mvpRate = (p.honorsMvp + 1) / (mp + prior);
    const troncoRate = (p.honorsTronco + 1) / (mp + prior);
    const fantasmaRate = (p.honorsFantasma + 1) / (mp + prior);

    switch (marketKey) {
      case "MVP":
        return 0.65 * (p.leagueOverall - 5) + 1.8 * Math.log(mvpRate) + 0.06 * Math.log(mp);
      case "TRONCO":
        return 0.70 * (5 - p.leagueOverall) + 1.6 * Math.log(troncoRate) + 0.05 * Math.log(mp);
      case "FANTASMA":
        return 0.25 * (p.leagueOverall - 5) + 1.9 * Math.log(fantasmaRate) + 0.04 * Math.log(mp);
      case "DEFENSE_TOP":
        return 1.2 * (p.avgDefense - 5) + 0.04 * Math.log(mp);
      case "ATTACK_TOP":
        return 1.2 * (p.avgAttack - 5) + 0.04 * Math.log(mp);
      case "TECHNIQUE_TOP":
        return 1.2 * (p.avgTechnique - 5) + 0.04 * Math.log(mp);
      case "PACE_TOP":
        return 1.2 * (p.avgPace - 5) + 0.04 * Math.log(mp);
      default:
        return 0;
    }
  });

  const probs = softmax(scores);
  const oddsById: Record<string, number> = {};
  for (let i = 0; i < players.length; i++) {
    const pid = players[i]!.userId;
    oddsById[pid] = toDecimalOdds(probs[i]!);
  }
  return oddsById;
}

function oddsForDuel(challenger: PlayerStat, rival: PlayerStat): Record<string, number> {
  const mpA = Math.max(1, challenger.matchesPlayed);
  const mpB = Math.max(1, rival.matchesPlayed);
  const prior = 2;
  const duelRateA = (challenger.honorsDuel + 1) / (mpA + prior);
  const duelRateB = (rival.honorsDuel + 1) / (mpB + prior);
  const scores = [
    0.65 * (challenger.leagueOverall - 5) + 1.2 * Math.log(duelRateA) + 0.05 * Math.log(mpA),
    0.65 * (rival.leagueOverall - 5) + 1.2 * Math.log(duelRateB) + 0.05 * Math.log(mpB),
  ];
  const probs = softmax(scores);
  return {
    [challenger.userId]: toDecimalOdds(probs[0] ?? 0.5),
    [rival.userId]: toDecimalOdds(probs[1] ?? 0.5),
  };
}

function teamOptions(): MarketOption[] {
  return [
    { optionKey: "TEAM_A", label: "Gana Equipo A", imageUrl: null },
    { optionKey: "DRAW", label: "Empate", imageUrl: null },
    { optionKey: "TEAM_B", label: "Gana Equipo B", imageUrl: null },
  ];
}

function yesNoOptions(yesLabel: string, noLabel: string): MarketOption[] {
  return [
    { optionKey: "YES", label: yesLabel, imageUrl: null },
    { optionKey: "NO", label: noLabel, imageUrl: null },
  ];
}

export async function getNextHouseMarkets(leagueId: string, userId: string) {
  const nextMatch = await prisma.matches.findFirst({
    where: {
      league_id: leagueId,
      status: { notIn: ["CANCELLED", "COMPLETED"] },
      date_time: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
    },
    orderBy: { date_time: "asc" },
    select: { id: true, date_time: true, location_name: true, status: true },
  });
  if (!nextMatch) return { match: null, markets: [] as any[] };

  await ensureHouseMarketsForMatch(nextMatch.id);

  const [markets, players, isPlayer, duel] = await Promise.all([
    prisma.ttp_house_bet_markets.findMany({
      where: { match_id: nextMatch.id, status: "OPEN", market_key: { in: HOUSE_MARKETS as unknown as string[] } },
      orderBy: { created_at: "asc" },
    }),
    getCandidatePlayers(nextMatch.id),
    isUserPlayerInMatch(nextMatch.id, userId),
    prisma.duels.findFirst({
      where: { match_id: nextMatch.id, status: { in: ["PENDING", "ACTIVE", "COMPLETED"] } },
      select: { challenger_id: true, rival_id: true },
    }),
  ]);

  const order = new Map(HOUSE_MARKETS.map((k, i) => [k, i]));
  const sortedMarkets = [...markets].sort((a, b) => {
    const ai = order.get(a.market_key as HouseMarketKey) ?? 999;
    const bi = order.get(b.market_key as HouseMarketKey) ?? 999;
    return ai - bi || String(a.market_key).localeCompare(String(b.market_key));
  });

  const marketDtos = sortedMarkets.map((m) => {
    const mk = m.market_key as HouseMarketKey;

    const playerOdds = oddsForPlayerMarket(mk, players);
    const playerOptions: Array<{ optionKey: string; label: string; imageUrl: string | null; odds: number }> =
      players
        .map((p) => ({
          optionKey: p.userId,
          label: p.label,
          imageUrl: p.imageUrl,
          odds: playerOdds[p.userId] ?? ODDS_MAX,
        }))
        .sort((a, b) => a.odds - b.odds || a.label.localeCompare(b.label));

    const mkOptions: MarketOption[] =
      mk === "RESULT_1X2"
        ? teamOptions()
        : mk === "ANY_INJURY"
          ? yesNoOptions("Sí", "No")
          : mk === "ANY_LEFT_EARLY"
            ? yesNoOptions("Sí", "No")
            : mk === "DUEL_WINNER"
              ? [] // se completa abajo si hay duelo
              : playerOptions.map((p) => ({ optionKey: p.optionKey, label: p.label, imageUrl: p.imageUrl }));

    // Odds para opciones no-player (heurística simple con bias leve)
    const fixedOddsByKey: Record<string, number> = {};
    if (mk === "RESULT_1X2") {
      // default: A/B similares + draw más alta
      fixedOddsByKey["TEAM_A"] = 2.05;
      fixedOddsByKey["DRAW"] = 3.4;
      fixedOddsByKey["TEAM_B"] = 2.05;
    } else if (mk === "ANY_INJURY") {
      fixedOddsByKey["YES"] = 2.6;
      fixedOddsByKey["NO"] = 1.45;
    } else if (mk === "ANY_LEFT_EARLY") {
      fixedOddsByKey["YES"] = 2.4;
      fixedOddsByKey["NO"] = 1.5;
    }

    // Duelo: si existe, opciones son los 2 jugadores (con cuotas dinámicas)
    const duelOptions =
      mk === "DUEL_WINNER" && duel?.challenger_id && duel?.rival_id
        ? (() => {
            const a = players.find((p) => p.userId === duel.challenger_id) ?? null;
            const b = players.find((p) => p.userId === duel.rival_id) ?? null;
            if (!a || !b) return [];
            const odds = oddsForDuel(a, b);
            return [
              { optionKey: a.userId, label: a.label, imageUrl: a.imageUrl, odds: odds[a.userId] ?? ODDS_MAX },
              { optionKey: b.userId, label: b.label, imageUrl: b.imageUrl, odds: odds[b.userId] ?? ODDS_MAX },
            ].sort((x, y) => x.odds - y.odds || x.label.localeCompare(y.label));
          })()
        : [];

    const optionsWithOdds =
      mk === "DUEL_WINNER"
        ? duelOptions
        : mkOptions.length > 0
          ? mkOptions.map((o) => ({
              optionKey: o.optionKey,
              label: o.label,
              imageUrl: o.imageUrl,
              odds: fixedOddsByKey[o.optionKey] ?? 2.0,
            }))
          : playerOptions;

    return {
      id: m.id,
      marketKey: m.market_key,
      marketLabel: MARKET_LABEL[mk] ?? m.market_key,
      status: m.status,
      closesAt: m.closes_at?.toISOString() ?? null,
      isPlayer,
      options: optionsWithOdds,
    };
  });

  return {
    match: {
      id: nextMatch.id,
      dateTime: nextMatch.date_time.toISOString(),
      locationName: nextMatch.location_name,
      status: nextMatch.status,
    },
    markets: marketDtos,
  };
}

export async function getMyHouseSlips(params: {
  leagueId: string;
  matchId: string;
  userId: string;
}): Promise<{
  matchId: string;
  slips: Array<{
    id: string;
    status: string;
    stakeTtp: number;
    oddsTotal: number;
    payoutTtp: number | null;
    placedAt: string | null;
    settledAt: string | null;
    legs: Array<{
      marketKey: HouseMarketKey;
      marketLabel: string;
      optionKey: string;
      optionLabel: string;
      odds: number;
      result: "PENDING" | "WON" | "LOST" | "VOID";
    }>;
  }>;
}> {
  const match = await prisma.matches.findUnique({
    where: { id: params.matchId },
    select: { id: true, league_id: true },
  });
  if (!match || match.league_id !== params.leagueId) {
    return { matchId: params.matchId, slips: [] };
  }

  const slips = await prisma.ttp_house_bet_slips.findMany({
    where: { match_id: params.matchId, league_id: params.leagueId, user_id: params.userId },
    include: {
      legs: {
        include: {
          ttp_house_bet_markets: { select: { market_key: true, status: true, winning_option_key: true } },
        },
      },
    },
    orderBy: { placed_at: "desc" },
    take: 20,
  });

  const userOptionIds = new Set<string>();
  for (const s of slips) {
    for (const l of s.legs) {
      const ok = String(l.option_key);
      if (/^[0-9a-fA-F-]{36}$/.test(ok)) userOptionIds.add(ok);
    }
  }
  const optionUsers = userOptionIds.size
    ? await prisma.users.findMany({
        where: { id: { in: [...userOptionIds] } },
        select: { id: true, full_name: true, username: true },
      })
    : [];
  const optionUserName = new Map(
    optionUsers.map((u) => [u.id, u.full_name ?? u.username ?? "Jugador"]),
  );

  const fixedOptionLabel = (k: string): string => {
    if (k === "TEAM_A") return "Gana Equipo A";
    if (k === "TEAM_B") return "Gana Equipo B";
    if (k === "DRAW") return "Empate";
    if (k === "YES") return "Sí";
    if (k === "NO") return "No";
    return k;
  };

  return {
    matchId: params.matchId,
    slips: slips.map((s) => ({
      id: s.id,
      status: String(s.status),
      stakeTtp: Number(s.stake_ttp ?? 0),
      oddsTotal: Number(s.odds_total ?? 0),
      payoutTtp: s.payout_ttp != null ? Number(s.payout_ttp) : null,
      placedAt: s.placed_at ? s.placed_at.toISOString() : null,
      settledAt: s.settled_at ? s.settled_at.toISOString() : null,
      legs: s.legs.map((l) => {
        const mk = String(l.ttp_house_bet_markets.market_key) as HouseMarketKey;
        const optionKey = String(l.option_key);
        const optionLabel =
          optionUserName.get(optionKey) ?? fixedOptionLabel(optionKey);
        const marketStatus = String(l.ttp_house_bet_markets.status || "").toUpperCase();
        const winning = l.ttp_house_bet_markets.winning_option_key;
        const result: "PENDING" | "WON" | "LOST" | "VOID" =
          marketStatus === "VOID"
            ? "VOID"
            : marketStatus === "SETTLED"
              ? optionKey === winning
                ? "WON"
                : "LOST"
              : "PENDING";
        return {
          marketKey: mk,
          marketLabel: MARKET_LABEL[mk] ?? mk,
          optionKey,
          optionLabel,
          odds: Number(l.odds ?? 0),
          result,
        };
      }),
    })),
  };
}

export async function placeHouseSlip(params: {
  leagueId: string;
  matchId: string;
  userId: string;
  stakeTtp: number;
  legs: Array<{ marketKey: HouseMarketKey; optionUserId: string }>;
}): Promise<
  | { ok: true; balanceAfter: number; slipId: string; oddsTotal: number; payoutIfWin: number }
  | {
      ok: false;
      error:
        | "INVALID"
        | "NOT_FOUND"
        | "MARKET_CLOSED"
        | "FORBIDDEN_PLAYER"
        | "INSUFFICIENT_TTP";
    }
> {
  const stake = Math.floor(Number(params.stakeTtp));
  if (!Number.isFinite(stake) || stake <= 0) return { ok: false, error: "INVALID" };
  if (!Array.isArray(params.legs) || params.legs.length < 1 || params.legs.length > 15) {
    return { ok: false, error: "INVALID" };
  }
  const uniqueMarkets = new Set(params.legs.map((l) => l.marketKey));
  if (uniqueMarkets.size !== params.legs.length) return { ok: false, error: "INVALID" };

  return prisma.$transaction(async (tx) => {
    const match = await tx.matches.findUnique({
      where: { id: params.matchId },
      select: { id: true, league_id: true, status: true, date_time: true },
    });
    if (!match || match.league_id !== params.leagueId) return { ok: false as const, error: "NOT_FOUND" as const };

    if (String(match.status || "").toUpperCase() === "CANCELLED") {
      return { ok: false as const, error: "MARKET_CLOSED" as const };
    }

    const now = new Date();
    if (match.date_time <= now) {
      // desde kickoff, cerramos apuestas
      return { ok: false as const, error: "MARKET_CLOSED" as const };
    }

    const isPlayer = await isUserPlayerInMatch(match.id, params.userId, tx);
    if (isPlayer) return { ok: false as const, error: "FORBIDDEN_PLAYER" as const };

    await ensureHouseMarketsForMatch(match.id);

    const markets = await tx.ttp_house_bet_markets.findMany({
      where: {
        match_id: match.id,
        market_key: { in: params.legs.map((l) => l.marketKey) },
      },
    });
    if (markets.length !== params.legs.length) return { ok: false as const, error: "NOT_FOUND" as const };

    const players = await getCandidatePlayers(match.id);
    const duel = await tx.duels.findFirst({
      where: { match_id: match.id, status: { in: ["PENDING", "ACTIVE", "COMPLETED"] } },
      select: { challenger_id: true, rival_id: true },
    });

    // Helper: options válidas por mercado (debe coincidir con getNextHouseMarkets)
    const validOptionsFor = (mk: HouseMarketKey): string[] => {
      if (mk === "RESULT_1X2") return ["TEAM_A", "DRAW", "TEAM_B"];
      if (mk === "ANY_INJURY") return ["YES", "NO"];
      if (mk === "ANY_LEFT_EARLY") return ["YES", "NO"];
      if (mk === "DUEL_WINNER") {
        if (duel?.challenger_id && duel?.rival_id) return [duel.challenger_id, duel.rival_id];
        return [];
      }
      // Mercado por jugador
      return players.map((p) => p.userId);
    };

    const fixedOddsByMarket: Record<string, Record<string, number>> = {
      RESULT_1X2: { TEAM_A: 2.05, DRAW: 3.4, TEAM_B: 2.05 },
      ANY_INJURY: { YES: 2.6, NO: 1.45 },
      ANY_LEFT_EARLY: { YES: 2.4, NO: 1.5 },
    };

    // Compute odds snapshot for player markets
    const oddsByPlayerMarket: Record<string, Record<string, number>> = {};
    for (const m of markets) {
      const mk = m.market_key as HouseMarketKey;
      if (
        ["MVP", "TRONCO", "FANTASMA", "DEFENSE_TOP", "ATTACK_TOP", "TECHNIQUE_TOP", "PACE_TOP"].includes(mk)
      ) {
        oddsByPlayerMarket[mk] = oddsForPlayerMarket(mk, players);
      }
      if (mk === "DUEL_WINNER" && duel?.challenger_id && duel?.rival_id) {
        const a = players.find((p) => p.userId === duel.challenger_id);
        const b = players.find((p) => p.userId === duel.rival_id);
        if (a && b) oddsByPlayerMarket[mk] = oddsForDuel(a, b);
      }
    }

    const legRows = params.legs.map((l) => {
      const m = markets.find((x) => x.market_key === l.marketKey)!;
      if (String(m.status).toUpperCase() !== "OPEN" || (m.closes_at && m.closes_at <= now)) {
        throw new Error("MARKET_CLOSED");
      }

      const mk = l.marketKey;
      const valid = validOptionsFor(mk);
      if (!valid.includes(l.optionUserId)) {
        throw new Error("INVALID_OPTION");
      }

      const odds =
        fixedOddsByMarket[mk]?.[l.optionUserId] ??
        oddsByPlayerMarket[mk]?.[l.optionUserId] ??
        2.0;

      return { marketId: m.id, optionKey: l.optionUserId, odds };
    });

    // Cuota total:
    // - Simple (1 leg): cuota del leg
    // - Combinada (2-5 legs): SUMA de cuotas (según UX actual)
    const oddsTotal =
      legRows.length <= 1
        ? legRows.reduce((acc, l) => acc * l.odds, 1)
        : legRows.reduce((acc, l) => acc + l.odds, 0);
    const payoutIfWin = Math.floor(stake * oddsTotal);

    const debit = await debitTtpInTx(tx, {
      userId: params.userId,
      amount: stake,
      reason: "HOUSE_BET_STAKE",
      refType: "house_bet_match",
      refId: match.id,
      idempotencyKey: `ttp:house_bet_stake:${match.id}:${params.userId}:${randomUUID()}`,
    });
    if (!debit.ok) return { ok: false as const, error: "INSUFFICIENT_TTP" as const };

    const slip = await tx.ttp_house_bet_slips.create({
      data: {
        league_id: params.leagueId,
        match_id: match.id,
        user_id: params.userId,
        stake_ttp: stake,
        odds_total: oddsTotal,
        status: "OPEN",
      },
      select: { id: true },
    });

    await tx.ttp_house_bet_legs.createMany({
      data: legRows.map((l) => ({
        slip_id: slip.id,
        market_id: l.marketId,
        option_key: l.optionKey,
        odds: l.odds,
      })),
    });

    return {
      ok: true as const,
      balanceAfter: debit.balanceAfter ?? 0,
      slipId: slip.id,
      oddsTotal,
      payoutIfWin,
    };
  }).catch((e: unknown) => {
    const msg = typeof e === "object" && e !== null ? (e as { message?: string }).message : undefined;
    if (msg === "MARKET_CLOSED") return { ok: false as const, error: "MARKET_CLOSED" as const };
    if (msg === "INVALID_OPTION") return { ok: false as const, error: "INVALID" as const };
    throw e;
  });
}

async function pickHonorWinnerUserId(tx: TxClient, matchId: string, honorType: "TRONCO" | "FANTASMA"): Promise<string | null> {
  const row = await tx.honors.findFirst({
    where: { match_id: matchId, honor_type: honorType },
    select: { user_id: true },
    orderBy: { created_at: "asc" },
  });
  return row?.user_id ?? null;
}

async function pickDefenseWinner(tx: TxClient, matchId: string, mode: "TOP" | "BOTTOM"): Promise<string | null> {
  const rows = await tx.match_players.findMany({
    where: { match_id: matchId, has_confirmed: true },
    select: { user_id: true, match_defense: true },
  });
  const scored = rows
    .filter((r) => r.user_id && r.match_defense != null)
    .map((r) => ({ userId: r.user_id, val: Number(r.match_defense) }));
  if (scored.length === 0) return null;
  scored.sort((a, b) => (mode === "TOP" ? b.val - a.val : a.val - b.val) || a.userId.localeCompare(b.userId));
  return scored[0]!.userId;
}

async function pickStatWinner(
  tx: TxClient,
  matchId: string,
  mode: "TOP" | "BOTTOM",
  field: "match_rating" | "match_pace" | "match_defense" | "match_attack" | "match_technique" | "match_physical",
): Promise<string | null> {
  const rows = await tx.match_players.findMany({
    where: { match_id: matchId, has_confirmed: true },
    select: {
      user_id: true,
      match_rating: true,
      match_pace: true,
      match_defense: true,
      match_attack: true,
      match_technique: true,
      match_physical: true,
    },
  });
  const scored = rows
    .filter((r) => r.user_id && (r as any)[field] != null)
    .map((r) => ({ userId: r.user_id, val: Number((r as any)[field]) }));
  if (scored.length === 0) return null;
  scored.sort(
    (a, b) =>
      (mode === "TOP" ? b.val - a.val : a.val - b.val) || a.userId.localeCompare(b.userId),
  );
  return scored[0]!.userId;
}

export async function settleHouseBetsForMatch(matchId: string, tx: TxClient): Promise<void> {
  const markets = await tx.ttp_house_bet_markets.findMany({
    where: { match_id: matchId, status: "OPEN", market_key: { in: HOUSE_MARKETS as unknown as string[] } },
  });
  if (markets.length === 0) return;

  const match = await tx.matches.findUnique({
    where: { id: matchId },
    select: { mvp_id: true, status: true, team_a_score: true, team_b_score: true },
  });
  const st = String(match?.status || "").toUpperCase();
  // closeMatch() marca COMPPLETING dentro de la tx y recién al final pone COMPLETED.
  // Necesitamos poder liquidar dentro de esa misma transacción.
  if (!match || (st !== "COMPLETING" && st !== "COMPLETED")) return;

  const winnersByMarket: Record<string, string | null> = {};
  winnersByMarket["MVP"] = match.mvp_id ?? null;
  winnersByMarket["TRONCO"] = await pickHonorWinnerUserId(tx, matchId, "TRONCO");
  winnersByMarket["FANTASMA"] = await pickHonorWinnerUserId(tx, matchId, "FANTASMA");
  winnersByMarket["DEFENSE_TOP"] = await pickStatWinner(tx, matchId, "TOP", "match_defense");
  winnersByMarket["ATTACK_TOP"] = await pickStatWinner(tx, matchId, "TOP", "match_attack");
  winnersByMarket["TECHNIQUE_TOP"] = await pickStatWinner(tx, matchId, "TOP", "match_technique");
  winnersByMarket["PACE_TOP"] = await pickStatWinner(tx, matchId, "TOP", "match_pace");

  const a = Number(match.team_a_score ?? 0);
  const b = Number(match.team_b_score ?? 0);

  winnersByMarket["RESULT_1X2"] = a > b ? "TEAM_A" : a < b ? "TEAM_B" : "DRAW";

  const duel = await tx.duels.findFirst({
    where: { match_id: matchId, status: "COMPLETED" },
    select: { winner_id: true },
  });
  winnersByMarket["DUEL_WINNER"] = duel?.winner_id ?? null;

  const flags = await tx.match_players.findMany({
    where: { match_id: matchId, has_confirmed: true },
    select: { injured: true, left_early: true },
  });
  winnersByMarket["ANY_INJURY"] = flags.some((p) => p.injured) ? "YES" : "NO";
  winnersByMarket["ANY_LEFT_EARLY"] = flags.some((p) => p.left_early) ? "YES" : "NO";

  for (const m of markets) {
    const w = winnersByMarket[m.market_key] ?? null;
    await tx.ttp_house_bet_markets.update({
      where: { id: m.id },
      data: {
        status: w ? "SETTLED" : "VOID",
        settled_at: new Date(),
        winning_option_key: w,
      },
    });
  }

  const slips = await tx.ttp_house_bet_slips.findMany({
    where: { match_id: matchId, status: "OPEN" },
    include: { legs: { include: { ttp_house_bet_markets: true } } },
  });
  if (slips.length === 0) return;

  for (const slip of slips) {
    const legs = slip.legs;
    const anyVoid = legs.some((l) => String(l.ttp_house_bet_markets.status).toUpperCase() === "VOID");
    if (anyVoid) {
      await grantTtpInTx(tx, {
        userId: slip.user_id,
        amount: slip.stake_ttp,
        reason: "HOUSE_BET_REFUND",
        refType: "house_bet_slip",
        refId: slip.id,
        idempotencyKey: `ttp:house_bet_refund:${slip.id}`,
      });
      await tx.ttp_house_bet_slips.update({
        where: { id: slip.id },
        data: { status: "VOID", settled_at: new Date(), payout_ttp: slip.stake_ttp },
      });
      continue;
    }

    const won = legs.every((l) => l.option_key === l.ttp_house_bet_markets.winning_option_key);
    if (!won) {
      await tx.ttp_house_bet_slips.update({
        where: { id: slip.id },
        data: { status: "LOST", settled_at: new Date(), payout_ttp: 0 },
      });
      continue;
    }

    const oddsTotal = Number(slip.odds_total);
    const payout = Math.floor(Number(slip.stake_ttp) * oddsTotal);
    if (payout > 0) {
      await grantTtpInTx(tx, {
        userId: slip.user_id,
        amount: payout,
        reason: "HOUSE_BET_PAYOUT",
        refType: "house_bet_slip",
        refId: slip.id,
        idempotencyKey: `ttp:house_bet_payout:${slip.id}`,
      });
    }
    await tx.ttp_house_bet_slips.update({
      where: { id: slip.id },
      data: { status: "WON", settled_at: new Date(), payout_ttp: payout },
    });
  }
}

