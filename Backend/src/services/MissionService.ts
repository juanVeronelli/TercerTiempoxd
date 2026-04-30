import { prisma } from "../db.js";
import type { TxClient } from "./TtpService.js";
import { grantTtpInTx } from "./TtpService.js";
import { lockUserRow } from "../utils/locks.js";

export type MissionBranch = "FREE" | "PRO";

type MissionCatalogItem = {
  key: string;
  title: string;
  description: string;
  branch: MissionBranch;
  metricKey: string;
  target: number;
  sortOrder: number;
  rewardTtp: number;
  rewardCosmeticKey?: string | null;
  rewardCosmeticType?: string | null;
  rewardConsumableKey?: string | null;
  rewardConsumableQty?: number | null;
};

export type MissionDto = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  branch: MissionBranch;
  metricKey: string;
  target: number;
  sortOrder: number;
  isActive: boolean;
  rewards: {
    ttp: number;
    cosmeticKey: string | null;
    cosmeticType: string | null;
    consumableKey: string | null;
    consumableQty: number | null;
  };
  user: null | {
    progress: number;
    isCompleted: boolean;
    completedAt: string | null;
    claimedAt: string | null;
    popupShownAt: string | null;
  };
};

const FREE_MISSIONS: MissionCatalogItem[] = [
  { key: "FREE_DEBUTANTE", title: "Debutante", description: "Jugá tu primer partido.", branch: "FREE", metricKey: "MATCHES_PLAYED", target: 1, sortOrder: 10, rewardTtp: 20 },
  { key: "FREE_NUEVO_AFICIONADO", title: "Nuevo Aficionado", description: "Sé espectador por primera vez.", branch: "FREE", metricKey: "SPECTATED_MATCHES", target: 1, sortOrder: 20, rewardTtp: 10 },
  { key: "FREE_CRITICO_CINE", title: "Crítico de Cine", description: "Dejá un comentario a cada compañero en un partido.", branch: "FREE", metricKey: "COMMENTED_ALL_TEAMMATES_ON_MATCH", target: 1, sortOrder: 30, rewardTtp: 10 },
  { key: "FREE_CALENTON", title: "Calentón", description: "Respondé 5 comentarios de compañeros.", branch: "FREE", metricKey: "COMMENT_REPLIES_POSTED", target: 5, sortOrder: 40, rewardTtp: 10 },
  { key: "FREE_JUGADOR_REGULAR", title: "Jugador Regular", description: "Jugá 5 partidos.", branch: "FREE", metricKey: "MATCHES_PLAYED", target: 5, sortOrder: 50, rewardTtp: 50 },
  { key: "FREE_JUGADOR_TITULAR", title: "Jugador Titular", description: "Jugá 20 partidos.", branch: "FREE", metricKey: "MATCHES_PLAYED", target: 20, sortOrder: 60, rewardTtp: 100 },
  { key: "FREE_ORGANIZADOR", title: "Organizador", description: "Creá 5 partidos distintos.", branch: "FREE", metricKey: "MATCHES_CREATED", target: 5, sortOrder: 70, rewardTtp: 15 },
  { key: "FREE_MANIJA_FUTBOL", title: "Manija del fútbol", description: "Sé el primero en confirmar para un partido 10 veces.", branch: "FREE", metricKey: "FIRST_CONFIRM_COUNT", target: 10, sortOrder: 80, rewardTtp: 40 },
  { key: "FREE_AFICIONADO_FIEL", title: "Aficionado fiel", description: "Sé espectador al menos 5 veces.", branch: "FREE", metricKey: "SPECTATED_MATCHES", target: 5, sortOrder: 90, rewardTtp: 50 },

  { key: "FREE_ORACULO_I", title: "Oráculo", description: "Gańa 20 puntos de prode.", branch: "FREE", metricKey: "PRODE_POINTS_EARNED", target: 20, sortOrder: 100, rewardTtp: 20 },
  { key: "FREE_ORACULO_II", title: "Oráculo II", description: "Gańa 50 puntos de prode.", branch: "FREE", metricKey: "PRODE_POINTS_EARNED", target: 50, sortOrder: 110, rewardTtp: 50 },

  { key: "FREE_APOSTADOR_I", title: "Apostador", description: "Gańa una apuesta simple.", branch: "FREE", metricKey: "HOUSE_BETS_WON_SIMPLE", target: 1, sortOrder: 120, rewardTtp: 30 },
  { key: "FREE_APOSTADOR_II", title: "Apostador II", description: "Gańa una apuesta combinada de 5 o más.", branch: "FREE", metricKey: "HOUSE_BETS_WON_COMBO_5PLUS", target: 1, sortOrder: 130, rewardTtp: 50 },
  { key: "FREE_GENIO_CASINO", title: "Genio del casino", description: "Gańa una apuesta con una cuota total mayor a 5.", branch: "FREE", metricKey: "HOUSE_BETS_WON_ODDS_5PLUS", target: 1, sortOrder: 140, rewardTtp: 100 },

  { key: "FREE_EL_PEOR_DE_TODOS", title: "El peor de todos", description: "Ganá la medalla de Tronco por primera vez.", branch: "FREE", metricKey: "HONOR_TRONCO_COUNT", target: 1, sortOrder: 150, rewardTtp: 50 },
  { key: "FREE_FANTASMA", title: "Fantasma", description: "Ganá la medalla de Fantasma por primera vez.", branch: "FREE", metricKey: "HONOR_FANTASMA_COUNT", target: 1, sortOrder: 160, rewardTtp: 50 },
  { key: "FREE_DUELISTA", title: "Duelista", description: "Ganá la medalla de Duelo por primera vez.", branch: "FREE", metricKey: "HONOR_DUEL_WINS", target: 1, sortOrder: 170, rewardTtp: 50 },
  { key: "FREE_ORACULO_MEDALLA", title: "Oráculo (medalla)", description: "Ganá la medalla de Oracle por primera vez.", branch: "FREE", metricKey: "HONOR_ORACLE_COUNT", target: 1, sortOrder: 180, rewardTtp: 50 },
  { key: "FREE_MESSI", title: "Messi", description: "Ganá la medalla de MVP por primera vez.", branch: "FREE", metricKey: "HONOR_MVP_COUNT", target: 1, sortOrder: 190, rewardTtp: 50 },
  { key: "FREE_COLECCIONISTA", title: "Coleccionista", description: "Obtené al menos 2 veces cada medalla disponible.", branch: "FREE", metricKey: "HONORS_ALL_MEDALS_AT_LEAST_2", target: 1, sortOrder: 200, rewardTtp: 150 },

  { key: "FREE_APROBADO", title: "Aprobado", description: "Obtené más de 6.0 de nota en un partido.", branch: "FREE", metricKey: "MATCH_RATING_OVER_6", target: 1, sortOrder: 210, rewardTtp: 35 },
  { key: "FREE_EXCELENTE", title: "Excelente", description: "Obtené más de 9.0 de nota en un partido.", branch: "FREE", metricKey: "MATCH_RATING_OVER_9", target: 1, sortOrder: 220, rewardTtp: 50 },
  { key: "FREE_PERFECCION", title: "Perfección", description: "Obtené un 10 de nota en un partido.", branch: "FREE", metricKey: "MATCH_RATING_10", target: 1, sortOrder: 230, rewardTtp: 100 },

  { key: "FREE_MURO_IMPASABLE", title: "Muro impasable", description: "Sé el que más puntos sacó en DEFENSA en un partido.", branch: "FREE", metricKey: "TOP_STAT_DEFENSE_MATCHES", target: 1, sortOrder: 240, rewardTtp: 20 },
  { key: "FREE_ATLETA_OLIMPICO", title: "Atleta olímpico", description: "Sé el que más puntos sacó en RITMO en un partido.", branch: "FREE", metricKey: "TOP_STAT_PACE_MATCHES", target: 1, sortOrder: 250, rewardTtp: 20 },
  { key: "FREE_ARTISTA", title: "Artista", description: "Sé el que más puntos sacó en TÉCNICA en un partido.", branch: "FREE", metricKey: "TOP_STAT_TECHNIQUE_MATCHES", target: 1, sortOrder: 260, rewardTtp: 20 },
  { key: "FREE_GYMBRO", title: "Gymbro", description: "Sé el que más puntos sacó en FÍSICO en un partido.", branch: "FREE", metricKey: "TOP_STAT_PHYSICAL_MATCHES", target: 1, sortOrder: 270, rewardTtp: 20 },
  { key: "FREE_FRANCOTIRADOR", title: "Francotirador", description: "Sé el que más puntos sacó en ATAQUE en un partido.", branch: "FREE", metricKey: "TOP_STAT_ATTACK_MATCHES", target: 1, sortOrder: 280, rewardTtp: 20 },

  { key: "FREE_ESTELISTA_I", title: "Estelista I", description: "Ponete una foto de perfil.", branch: "FREE", metricKey: "PROFILE_HAS_PHOTO", target: 1, sortOrder: 290, rewardTtp: 50 },
  { key: "FREE_ESTELISTA_II", title: "Estelista II", description: "Ponete un marco.", branch: "FREE", metricKey: "PROFILE_HAS_FRAME", target: 1, sortOrder: 300, rewardTtp: 20 },
  { key: "FREE_ESTELISTA_III", title: "Estelista III", description: "Ponete una biografía.", branch: "FREE", metricKey: "PROFILE_HAS_BIO", target: 1, sortOrder: 310, rewardTtp: 20 },
  { key: "FREE_ESTELISTA_IV", title: "Estelista IV", description: "Ponete una foto de portada.", branch: "FREE", metricKey: "PROFILE_HAS_BANNER", target: 1, sortOrder: 320, rewardTtp: 20 },
  { key: "FREE_ESTELISTA_V", title: "Estelista V", description: "Cambiá el color de acento.", branch: "FREE", metricKey: "PROFILE_CHANGED_ACCENT", target: 1, sortOrder: 330, rewardTtp: 20 },
  { key: "FREE_ESTELISTA_VI", title: "Estelista VI", description: "Cambiá un showcase de tu vitrina.", branch: "FREE", metricKey: "PROFILE_HAS_SHOWCASE", target: 1, sortOrder: 340, rewardTtp: 20 },
  { key: "FREE_CONSUMIDOR", title: "Consumidor", description: "Utilizá un consumible.", branch: "FREE", metricKey: "CONSUMABLES_USED", target: 1, sortOrder: 350, rewardTtp: 20 },
  {
    key: "FREE_REY_TT_I",
    title: "Rey del Tercer Tiempo I",
    description: "Completá todas las misiones básicas.",
    branch: "FREE",
    metricKey: "FREE_ALL_BASIC_COMPLETED",
    target: 1,
    sortOrder: 999,
    rewardTtp: 5000,
  },
];

let catalogSyncPromise: Promise<void> | null = null;
async function syncMissionCatalog(): Promise<void> {
  if (catalogSyncPromise) return catalogSyncPromise;
  catalogSyncPromise = (async () => {
  // Upsert idempotente: permite ajustar catálogo sin romper producción.
  for (const m of FREE_MISSIONS) {
    await prisma.missions.upsert({
      where: { key: m.key },
      create: {
        key: m.key,
        title: m.title,
        description: m.description,
        branch: m.branch,
        metric_key: m.metricKey,
        target: m.target,
        sort_order: m.sortOrder,
        reward_ttp: m.rewardTtp,
        reward_cosmetic_key: m.rewardCosmeticKey ?? null,
        reward_cosmetic_type: m.rewardCosmeticType ?? "FRAME",
        reward_consumable_key: m.rewardConsumableKey ?? null,
        reward_consumable_qty: m.rewardConsumableQty ?? 1,
        is_active: true,
      } as any,
      update: {
        title: m.title,
        description: m.description,
        branch: m.branch,
        metric_key: m.metricKey,
        target: m.target,
        sort_order: m.sortOrder,
        reward_ttp: m.rewardTtp,
        reward_cosmetic_key: m.rewardCosmeticKey ?? null,
        reward_cosmetic_type: m.rewardCosmeticType ?? "FRAME",
        reward_consumable_key: m.rewardConsumableKey ?? null,
        reward_consumable_qty: m.rewardConsumableQty ?? 1,
        is_active: true,
      } as any,
    });
  }
  })().finally(() => {
    // Mantenerlo seteado (evita sync por request). Si querés resync, reiniciás el server.
  });
  return catalogSyncPromise;
}

function toNum(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

async function productOdds(odds: Array<{ odds: any }>): Promise<number> {
  let p = 1;
  for (const o of odds) {
    const n = Number((o as any).odds);
    if (!Number.isFinite(n) || n <= 0) continue;
    p *= n;
  }
  return p;
}

async function computeProgressByMetric(userId: string, metricKeys: string[]) {
  const keys = Array.from(new Set(metricKeys.map((k) => String(k))));
  const map = new Map<string, number>();

  // Pre-cálculos para métricas costosas (minimizar roundtrips).
  const needFirstConfirm = keys.includes("FIRST_CONFIRM_COUNT");
  const needCommentAll = keys.includes("COMMENTED_ALL_TEAMMATES_ON_MATCH");
  const needTopStats = keys.some((k) => k.startsWith("TOP_STAT_"));

  const needMatchBased =
    needFirstConfirm || needCommentAll || needTopStats || keys.includes("MATCHES_PLAYED") ||
    keys.includes("PRODE_POINTS_EARNED") || keys.includes("MATCH_RATING_OVER_6") ||
    keys.includes("MATCH_RATING_OVER_9") || keys.includes("MATCH_RATING_10");

  const myCompletedMatchIds: string[] = [];
  if (needMatchBased) {
    const rows = await prisma.match_players.findMany({
      where: {
        user_id: userId,
        has_confirmed: true,
        matches: { status: "COMPLETED" },
      } as any,
      select: { match_id: true },
      take: 200,
      orderBy: { matches: { date_time: "desc" } } as any,
    });
    for (const r of rows as any[]) myCompletedMatchIds.push(String(r.match_id));
  }

  // User (perfil)
  const needUser = keys.some((k) => k.startsWith("PROFILE_"));
  const user = needUser
    ? await prisma.users.findUnique({
        where: { id: userId },
        select: {
          profile_photo_url: true,
          avatar_frame: true,
          bio: true,
          banner_url: true,
          accent_color: true,
          showcase_items: true,
        },
      })
    : null;

  // Queries independientes, en paralelo (reduce latencia total).
  const [
    spectatedCount,
    replyCount,
    createdCount,
    prodeAgg,
    consumablesUsed,
    wonSlips,
    honorRows,
    duelMembers,
    ratingRows,
  ] = await Promise.all([
    keys.includes("SPECTATED_MATCHES")
      ? prisma.match_spectators.count({ where: { user_id: userId, attending: true } as any })
      : Promise.resolve(0),
    keys.includes("COMMENT_REPLIES_POSTED")
      ? prisma.match_vote_comment_replies.count({ where: { user_id: userId } as any })
      : Promise.resolve(0),
    keys.includes("MATCHES_CREATED")
      ? prisma.matches.count({ where: { admin_id: userId } as any })
      : Promise.resolve(0),
    keys.includes("PRODE_POINTS_EARNED")
      ? prisma.match_players.aggregate({
          where: { user_id: userId, has_confirmed: true } as any,
          _sum: { prediction_points: true } as any,
        })
      : Promise.resolve(null as any),
    keys.includes("CONSUMABLES_USED")
      ? prisma.user_consumable_activations.count({ where: { user_id: userId } as any })
      : Promise.resolve(0),
    keys.some((k) => k.startsWith("HOUSE_BETS_WON_"))
      ? prisma.ttp_house_bet_slips.findMany({
          where: { user_id: userId, status: "WON" } as any,
          select: { id: true, legs: { select: { odds: true } } },
        })
      : Promise.resolve([] as any[]),
    keys.some((k) => k.startsWith("HONOR_") || k === "HONORS_ALL_MEDALS_AT_LEAST_2")
      ? prisma.honors.findMany({
          where: { user_id: userId, honor_type: { in: ["TRONCO", "FANTASMA", "ORACLE", "MVP", "IDEAL_XI"] } } as any,
          select: { honor_type: true },
        })
      : Promise.resolve([] as any[]),
    keys.includes("HONOR_DUEL_WINS") || keys.includes("HONORS_ALL_MEDALS_AT_LEAST_2")
      ? prisma.league_members.findMany({ where: { user_id: userId } as any, select: { honors_duel: true } })
      : Promise.resolve([] as any[]),
    keys.some((k) => k.startsWith("MATCH_RATING_"))
      ? prisma.match_players.findMany({
          where: { user_id: userId, has_confirmed: true, match_rating: { not: null }, matches: { status: "COMPLETED" } } as any,
          select: { match_rating: true },
          take: 500,
        })
      : Promise.resolve([] as any[]),
  ]);

  const honorCounts = honorRows.reduce<Record<string, number>>((acc, r: any) => {
    const t = String(r.honor_type || "");
    if (!t) return acc;
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});
  const duelWins = duelMembers.reduce((sum, m: any) => sum + Number(m.honors_duel ?? 0), 0);

  let simpleWins = 0;
  let combo5Wins = 0;
  let odds5Wins = 0;
  if (wonSlips.length) {
    for (const s of wonSlips as any[]) {
      const legs = (s as any).legs as Array<{ odds: any }>;
      const totalOdds = await productOdds(legs);
      if (legs.length === 1) simpleWins += 1;
      if (legs.length >= 5) combo5Wins += 1;
      if (totalOdds > 5) odds5Wins += 1;
    }
  }

  const ratingOver6 = ratingRows.some((r: any) => Number(r.match_rating) > 6) ? 1 : 0;
  const ratingOver9 = ratingRows.some((r: any) => Number(r.match_rating) > 9) ? 1 : 0;
  const ratingEq10 = ratingRows.some((r: any) => Number(r.match_rating) >= 10) ? 1 : 0;

  for (const mk of keys) {
    if (mk === "FREE_ALL_BASIC_COMPLETED") {
      const totalRows = (await prisma.$queryRaw`
        SELECT COUNT(*)::int AS c
        FROM missions m
        WHERE m.is_active = true
          AND upper(m.branch) = 'FREE'
          AND m.key <> 'FREE_REY_TT_I'
      `) as Array<{ c: number }>;
      const total = Number(totalRows?.[0]?.c ?? 0);
      if (total <= 0) {
        map.set(mk, 0);
        continue;
      }
      const doneRows = (await prisma.$queryRaw`
        SELECT COUNT(*)::int AS c
        FROM user_missions um
        JOIN missions m ON m.id = um.mission_id
        WHERE um.user_id = ${userId}::uuid
          AND um.is_completed = true
          AND m.is_active = true
          AND upper(m.branch) = 'FREE'
          AND m.key <> 'FREE_REY_TT_I'
      `) as Array<{ c: number }>;
      const done = Number(doneRows?.[0]?.c ?? 0);
      map.set(mk, done >= total ? 1 : 0);
      continue;
    }

    if (mk === "MATCHES_PLAYED") {
      map.set(mk, myCompletedMatchIds.length);
      continue;
    }

    if (mk === "SPECTATED_MATCHES") {
      map.set(mk, spectatedCount);
      continue;
    }

    if (mk === "COMMENT_REPLIES_POSTED") {
      map.set(mk, replyCount);
      continue;
    }

    if (mk === "MATCHES_CREATED") {
      map.set(mk, createdCount);
      continue;
    }

    if (mk === "FIRST_CONFIRM_COUNT") {
      const c = await prisma.match_players.count({
        where: { user_id: userId, was_first_confirm: true } as any,
      });
      map.set(mk, c);
      continue;
    }

    if (mk === "PRODE_POINTS_EARNED") {
      map.set(mk, Number((prodeAgg as any)?._sum?.prediction_points ?? 0));
      continue;
    }

    if (mk === "HOUSE_BETS_WON_SIMPLE" || mk === "HOUSE_BETS_WON_COMBO_5PLUS" || mk === "HOUSE_BETS_WON_ODDS_5PLUS") {
      map.set("HOUSE_BETS_WON_SIMPLE", simpleWins);
      map.set("HOUSE_BETS_WON_COMBO_5PLUS", combo5Wins);
      map.set("HOUSE_BETS_WON_ODDS_5PLUS", odds5Wins);
      continue;
    }

    if (mk === "HONOR_TRONCO_COUNT" || mk === "HONOR_FANTASMA_COUNT" || mk === "HONOR_ORACLE_COUNT" || mk === "HONOR_MVP_COUNT") {
      map.set("HONOR_TRONCO_COUNT", Number(honorCounts["TRONCO"] ?? 0));
      map.set("HONOR_FANTASMA_COUNT", Number(honorCounts["FANTASMA"] ?? 0));
      map.set("HONOR_ORACLE_COUNT", Number(honorCounts["ORACLE"] ?? 0));
      map.set("HONOR_MVP_COUNT", Number(honorCounts["MVP"] ?? 0));
      continue;
    }

    if (mk === "HONOR_DUEL_WINS") {
      map.set(mk, duelWins);
      continue;
    }

    if (mk === "HONORS_ALL_MEDALS_AT_LEAST_2") {
      const ok =
        Number(honorCounts["MVP"] ?? 0) >= 2 &&
        Number(honorCounts["TRONCO"] ?? 0) >= 2 &&
        Number(honorCounts["FANTASMA"] ?? 0) >= 2 &&
        Number(honorCounts["ORACLE"] ?? 0) >= 2 &&
        Number(honorCounts["IDEAL_XI"] ?? 0) >= 2 &&
        duelWins >= 2;
      map.set(mk, ok ? 1 : 0);
      continue;
    }

    if (mk === "MATCH_RATING_OVER_6" || mk === "MATCH_RATING_OVER_9" || mk === "MATCH_RATING_10") {
      map.set("MATCH_RATING_OVER_6", ratingOver6);
      map.set("MATCH_RATING_OVER_9", ratingOver9);
      map.set("MATCH_RATING_10", ratingEq10);
      continue;
    }

    if (mk.startsWith("TOP_STAT_")) {
      const flag =
        mk === "TOP_STAT_DEFENSE_MATCHES"
          ? "is_top_defense"
          : mk === "TOP_STAT_PACE_MATCHES"
            ? "is_top_pace"
            : mk === "TOP_STAT_TECHNIQUE_MATCHES"
              ? "is_top_technique"
              : mk === "TOP_STAT_PHYSICAL_MATCHES"
                ? "is_top_physical"
                : mk === "TOP_STAT_ATTACK_MATCHES"
                  ? "is_top_attack"
                  : null;
      if (!flag) {
        map.set(mk, 0);
        continue;
      }
      const c = await prisma.match_players.count({
        where: {
          user_id: userId,
          has_confirmed: true,
          matches: { status: "COMPLETED" },
          [flag]: true,
        } as any,
      });
      map.set(mk, c);
      continue;
    }

    if (mk === "COMMENTED_ALL_TEAMMATES_ON_MATCH") {
      const matchIds = myCompletedMatchIds.slice(0, 80);
      if (matchIds.length === 0) {
        map.set(mk, 0);
        continue;
      }
      const teammates = await prisma.match_players.findMany({
        where: { match_id: { in: matchIds }, has_confirmed: true } as any,
        select: { match_id: true, user_id: true },
      });
      const targetsByMatch = new Map<string, Set<string>>();
      for (const r of teammates as any[]) {
        const mid = String(r.match_id);
        const uid = String(r.user_id);
        if (uid === userId) continue;
        if (!targetsByMatch.has(mid)) targetsByMatch.set(mid, new Set());
        targetsByMatch.get(mid)!.add(uid);
      }
      const comments = await prisma.match_votes.findMany({
        where: { match_id: { in: matchIds }, voter_id: userId, comment: { not: null } } as any,
        select: { match_id: true, target_id: true },
      });
      const commentedByMatch = new Map<string, Set<string>>();
      for (const c of comments as any[]) {
        const mid = String(c.match_id);
        const tid = String(c.target_id ?? "");
        if (!tid) continue;
        if (!commentedByMatch.has(mid)) commentedByMatch.set(mid, new Set());
        commentedByMatch.get(mid)!.add(tid);
      }
      let met = false;
      for (const [mid, targets] of targetsByMatch.entries()) {
        if (targets.size === 0) continue;
        const commentedSet = commentedByMatch.get(mid) ?? new Set();
        let ok = true;
        for (const tid of targets) {
          if (!commentedSet.has(tid)) {
            ok = false;
            break;
          }
        }
        if (ok) {
          met = true;
          break;
        }
      }
      map.set(mk, met ? 1 : 0);
      continue;
    }

    if (mk === "CONSUMABLES_USED") {
      map.set(mk, consumablesUsed);
      continue;
    }

    if (mk === "PROFILE_HAS_PHOTO") {
      map.set(mk, user?.profile_photo_url ? 1 : 0);
      continue;
    }
    if (mk === "PROFILE_HAS_FRAME") {
      const frame = String(user?.avatar_frame ?? "simple");
      map.set(mk, frame && frame !== "simple" ? 1 : 0);
      continue;
    }
    if (mk === "PROFILE_HAS_BIO") {
      map.set(mk, user?.bio && String(user.bio).trim().length > 0 ? 1 : 0);
      continue;
    }
    if (mk === "PROFILE_HAS_BANNER") {
      map.set(mk, user?.banner_url ? 1 : 0);
      continue;
    }
    if (mk === "PROFILE_CHANGED_ACCENT") {
      const accent = String(user?.accent_color ?? "#2563EB");
      map.set(mk, accent !== "#2563EB" ? 1 : 0);
      continue;
    }
    if (mk === "PROFILE_HAS_SHOWCASE") {
      const items = (user as any)?.showcase_items;
      map.set(mk, Array.isArray(items) && items.length > 0 ? 1 : 0);
      continue;
    }

    map.set(mk, 0);
  }

  return map;
}

export async function getMyMissions(userId: string): Promise<{
  planType: string;
  missions: MissionDto[];
  popup: { missionKeys: string[] };
}> {
  await syncMissionCatalog();
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { plan_type: true },
  });
  const planType = String(user?.plan_type ?? "FREE").toUpperCase();

  const missions = await prisma.missions.findMany({
    where: { is_active: true },
    orderBy: [{ branch: "asc" as any }, { sort_order: "asc" }],
  });

  const userRows = await prisma.user_missions.findMany({
    where: { user_id: userId, mission_id: { in: missions.map((m) => m.id) } },
  });
  const byMissionId = new Map(userRows.map((r) => [r.mission_id, r]));

  // Recalcular SOLO lo que todavía puede cambiar (no completado).
  const pendingMissions = missions.filter((m) => {
    const um = byMissionId.get(m.id);
    if (!um) return true;
    if ((um as any).claimed_at) return false; // reclamadas: no hace falta recalcular
    if ((um as any).is_completed) return false; // completadas: evitamos métricas pesadas
    return true;
  });
  const metricKeysToCompute = Array.from(new Set(pendingMissions.map((m) => String((m as any).metric_key))));
  const hasFinalFree = pendingMissions.some((m) => String((m as any).metric_key) === "FREE_ALL_BASIC_COMPLETED");
  const metricKeysWithoutFinal = hasFinalFree
    ? metricKeysToCompute.filter((k) => k !== "FREE_ALL_BASIC_COMPLETED")
    : metricKeysToCompute;

  const progressByMetric =
    metricKeysWithoutFinal.length > 0 ? await computeProgressByMetric(userId, metricKeysWithoutFinal) : new Map();

  const now = new Date();
  const ops: any[] = [];
  for (const m of pendingMissions) {
    const mk = String((m as any).metric_key);
    const p = progressByMetric.get(mk) ?? 0;
    const target = toNum((m as any).target);
    const met = p >= Math.max(1, target);
    const existing = byMissionId.get(m.id);

    if (!existing) {
      ops.push(
        prisma.user_missions.create({
          data: {
            user_id: userId,
            mission_id: m.id,
            progress: p,
            is_completed: met,
            completed_at: met ? now : null,
          } as any,
        }),
      );
      continue;
    }

    const existingProgress = toNum((existing as any).progress);
    const existingCompleted = Boolean((existing as any).is_completed);
    const needsProgressUpdate = Math.abs(existingProgress - p) > 0.0001;
    const needsComplete = met && !existingCompleted;

    if (needsProgressUpdate || needsComplete) {
      ops.push(
        prisma.user_missions.update({
          where: { id: (existing as any).id },
          data: {
            ...(needsProgressUpdate ? { progress: p } : {}),
            ...(needsComplete ? { is_completed: true, completed_at: now } : {}),
          } as any,
        }),
      );
    }
  }
  if (ops.length) {
    const batchSize = 10;
    for (let i = 0; i < ops.length; i += batchSize) {
      await Promise.all(ops.slice(i, i + batchSize));
    }
  }

  // Refetch (solo si hicimos cambios) para no usar datos viejos en UI/popup.
  const finalUserRows =
    ops.length > 0
      ? await prisma.user_missions.findMany({
          where: { user_id: userId, mission_id: { in: missions.map((m) => m.id) } },
        })
      : userRows;
  const finalByMissionId = new Map(finalUserRows.map((r) => [r.mission_id, r]));

  // Segunda pasada: misión final FREE depende del estado actualizado de las demás.
  if (hasFinalFree) {
    const finalMission = missions.find((m) => m.key === "FREE_REY_TT_I");
    if (finalMission) {
      const progressFinal = await computeProgressByMetric(userId, ["FREE_ALL_BASIC_COMPLETED"]);
      const p = progressFinal.get("FREE_ALL_BASIC_COMPLETED") ?? 0;
      const um = finalByMissionId.get(finalMission.id);
      const isCompleted = Boolean((um as any)?.is_completed);
      if (p >= 1 && um && !isCompleted) {
        await prisma.user_missions.update({
          where: { id: (um as any).id },
          data: { progress: 1, is_completed: true, completed_at: new Date() } as any,
        });
        const rows = await prisma.user_missions.findMany({
          where: { user_id: userId, mission_id: { in: missions.map((m) => m.id) } },
        });
        finalByMissionId.clear();
        for (const r of rows as any[]) finalByMissionId.set(String(r.mission_id), r);
      }
    }
  }

  const dtos: MissionDto[] = missions.map((m) => {
    const um = finalByMissionId.get(m.id) ?? null;
    return {
      id: m.id,
      key: m.key,
      title: m.title,
      description: (m as any).description ?? null,
      branch: (String(m.branch || "FREE").toUpperCase() as MissionBranch) ?? "FREE",
      metricKey: String((m as any).metric_key),
      target: toNum((m as any).target),
      sortOrder: Number((m as any).sort_order ?? 0),
      isActive: Boolean((m as any).is_active),
      rewards: {
        ttp: Number((m as any).reward_ttp ?? 0),
        cosmeticKey: (m as any).reward_cosmetic_key ?? null,
        cosmeticType: (m as any).reward_cosmetic_type ?? null,
        consumableKey: (m as any).reward_consumable_key ?? null,
        consumableQty: (m as any).reward_consumable_qty ?? null,
      },
      user: um
        ? {
            progress: toNum((um as any).progress),
            isCompleted: Boolean((um as any).is_completed),
            completedAt: (um as any).completed_at ? (um as any).completed_at.toISOString() : null,
            claimedAt: (um as any).claimed_at ? (um as any).claimed_at.toISOString() : null,
            popupShownAt: (um as any).popup_shown_at ? (um as any).popup_shown_at.toISOString() : null,
          }
        : null,
    };
  });

  const popupMissionKeys = dtos
    .filter((m) => m.user?.isCompleted && !m.user?.claimedAt && !m.user?.popupShownAt)
    .map((m) => m.key);

  return { planType, missions: dtos, popup: { missionKeys: popupMissionKeys } };
}

export async function markMissionsPopupSeen(userId: string, missionKeys: string[]): Promise<void> {
  const keys = missionKeys.map((k) => String(k)).filter(Boolean);
  if (keys.length === 0) return;
  const missions = await prisma.missions.findMany({
    where: { key: { in: keys } },
    select: { id: true },
  });
  if (missions.length === 0) return;
  await prisma.user_missions.updateMany({
    where: {
      user_id: userId,
      mission_id: { in: missions.map((m) => m.id) },
      popup_shown_at: null,
      is_completed: true,
      claimed_at: null,
    },
    data: { popup_shown_at: new Date() },
  });
}

async function grantCosmeticInTx(tx: TxClient, userId: string, cosmeticKey: string, cosmeticType?: string | null) {
  await tx.user_cosmetics.upsert({
    where: { user_id_cosmetic_key: { user_id: userId, cosmetic_key: cosmeticKey } },
    create: {
      user_id: userId,
      cosmetic_key: cosmeticKey,
      cosmetic_type: cosmeticType ?? "FRAME",
    },
    update: {},
  });
}

async function grantConsumableInTx(tx: TxClient, userId: string, consumableKey: string, qty: number) {
  await tx.user_consumable_stacks.upsert({
    where: { user_id_consumable_key: { user_id: userId, consumable_key: consumableKey } },
    create: { user_id: userId, consumable_key: consumableKey, quantity: qty },
    update: { quantity: { increment: qty } },
  });
}

export async function claimMission(userId: string, missionKey: string): Promise<
  | { ok: true; balanceAfter?: number | null }
  | { ok: false; error: "NOT_FOUND" | "FORBIDDEN_PRO" | "NOT_COMPLETED" | "ALREADY_CLAIMED" }
> {
  const key = String(missionKey || "").trim();
  if (!key) return { ok: false, error: "NOT_FOUND" };
  const mission = await prisma.missions.findUnique({ where: { key } });
  if (!mission || !mission.is_active) return { ok: false, error: "NOT_FOUND" };

  return prisma.$transaction(async (tx) => {
    await lockUserRow(tx as any, userId);
    const user = await tx.users.findUnique({ where: { id: userId }, select: { plan_type: true } });
    const isPro = String(user?.plan_type ?? "FREE").toUpperCase() === "PRO";
    if (String(mission.branch || "FREE").toUpperCase() === "PRO" && !isPro) {
      return { ok: false as const, error: "FORBIDDEN_PRO" as const };
    }

    const um = await tx.user_missions.findUnique({
      where: { user_id_mission_id: { user_id: userId, mission_id: mission.id } },
    });
    if (!um || !um.is_completed) return { ok: false as const, error: "NOT_COMPLETED" as const };
    if (um.claimed_at) return { ok: false as const, error: "ALREADY_CLAIMED" as const };

    // Guard idempotente: setear claimed_at una sola vez.
    const upd = await tx.user_missions.updateMany({
      where: { id: um.id, claimed_at: null },
      data: { claimed_at: new Date() },
    });
    if (upd.count === 0) return { ok: false as const, error: "ALREADY_CLAIMED" as const };

    let balanceAfter: number | null = null;

    const rewardTtp = Number(mission.reward_ttp ?? 0);
    if (rewardTtp > 0) {
      const grant = await grantTtpInTx(tx as any, {
        userId,
        amount: rewardTtp,
        reason: "MISSION_REWARD",
        refType: "mission",
        refId: mission.key,
        idempotencyKey: `mission:${mission.key}:reward:${userId}`,
      });
      balanceAfter = typeof (grant as any)?.balanceAfter === "number" ? (grant as any).balanceAfter : null;
    }

    if (mission.reward_cosmetic_key) {
      await grantCosmeticInTx(tx as any, userId, mission.reward_cosmetic_key, mission.reward_cosmetic_type);
    }
    if (mission.reward_consumable_key) {
      const qty = Math.max(1, Number(mission.reward_consumable_qty ?? 1));
      await grantConsumableInTx(tx as any, userId, mission.reward_consumable_key, qty);
    }

    return { ok: true as const, balanceAfter };
  });
}

