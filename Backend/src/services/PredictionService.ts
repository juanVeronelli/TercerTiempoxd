import type { Prisma } from "../generated/client/index.js";
import { prisma } from "../server.js";
import { grantTtpInTx } from "./TtpService.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("PredictionService");

export type TxClient = Prisma.TransactionClient;

function maxPicksForGroupType(type: string): number {
  const t = String(type || "").toUpperCase();
  if (t === "MONTHLY") return 5;
  if (t === "SEASON") return 10;
  return 5; // MATCH
}
const SHOW_QUESTIONS_PER_MATCH = 10;
const SHOW_EASY = 4;
const SHOW_MEDIUM = 4;
const SHOW_HARD = 2;

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function sampleByDifficulty<T extends { difficulty?: string | null }>(
  items: T[],
  easy: number,
  medium: number,
  hard: number,
): T[] {
  const e = shuffle(items.filter((x) => x.difficulty === "EASY"));
  const m = shuffle(items.filter((x) => x.difficulty === "MEDIUM"));
  const h = shuffle(items.filter((x) => x.difficulty === "HARD"));
  return [
    ...e.slice(0, easy),
    ...m.slice(0, medium),
    ...h.slice(0, hard),
  ];
}

// ---------------------------------------------------------------------------
// submitPrediction: valida cierre, máximo 5 por grupo, y guarda/actualiza
// ---------------------------------------------------------------------------
export async function submitPrediction(
  userId: string,
  questionId: string,
  optionId: string,
): Promise<{ success: boolean; error?: string }> {
  const now = new Date();

  const question = await prisma.prediction_questions.findUnique({
    where: { id: questionId },
    include: {
      prediction_groups: true,
      prediction_options: { where: { id: optionId } },
    },
  });

  if (!question) {
    return { success: false, error: "Pregunta no encontrada." };
  }
  if (question.prediction_options.length === 0) {
    return { success: false, error: "Opción no válida para esta pregunta." };
  }
  if (question.prediction_groups.closes_at <= now) {
    return { success: false, error: "Las predicciones para este evento ya están cerradas." };
  }

  const group = question.prediction_groups;
  const groupId = group.id;
  if (group.match_id) {
    const isConvoked = await prisma.match_players.findUnique({
      where: {
        match_id_user_id: { match_id: group.match_id, user_id: userId },
      },
      select: { user_id: true, has_confirmed: true },
    });
    if (!isConvoked) {
      return {
        success: false,
        error: "Tenés que estar convocado al partido para votar en las predicciones.",
      };
    }
    if (!isConvoked.has_confirmed) {
      return {
        success: false,
        error:
          "Confirmá tu asistencia al partido para poder jugar el Prode de esta fecha.",
      };
    }
  }
  const existing = await prisma.user_predictions.findUnique({
    where: {
      user_id_question_id: { user_id: userId, question_id: questionId },
    },
  });

  if (!existing) {
    const countInGroup = await prisma.user_predictions.count({
      where: {
        user_id: userId,
        prediction_questions: { group_id: groupId },
      },
    });
    let maxPicks = maxPicksForGroupType(group.type);
    // Consumible PRE_MATCH: prode_unlimited_picks (levanta el tope de 5 para MATCH).
    if (group.match_id && String(group.type || "").toUpperCase() === "MATCH") {
      const act = await prisma.user_consumable_activations.findFirst({
        where: {
          user_id: userId,
          target_match_id: group.match_id,
          timing: "PRE_MATCH",
          status: "ACTIVE",
          consumable_key: "prode_unlimited_picks",
        },
        select: { id: true },
      });
      if (act) {
        maxPicks = 999;
      }
    }
    if (countInGroup >= maxPicks) {
      return {
        success: false,
        error: `Solo podés elegir ${maxPicks} predicciones en este evento. Cambiá una que ya tengas si querés otra.`,
      };
    }
  }

  await prisma.user_predictions.upsert({
    where: {
      user_id_question_id: { user_id: userId, question_id: questionId },
    },
    create: { user_id: userId, question_id: questionId, option_id: optionId },
    update: { option_id: optionId },
  });

  return { success: true };
}

export async function removePrediction(
  userId: string,
  questionId: string,
): Promise<{ success: boolean; error?: string }> {
  const existing = await prisma.user_predictions.findUnique({
    where: { user_id_question_id: { user_id: userId, question_id: questionId } },
    select: { user_id: true },
  });
  if (!existing) return { success: true };

  // Permitir solo si el grupo aún no cerró (misma regla que submit)
  const question = await prisma.prediction_questions.findUnique({
    where: { id: questionId },
    include: { prediction_groups: true },
  });
  if (!question) return { success: false, error: "Pregunta no encontrada." };
  if (question.prediction_groups.closes_at <= new Date()) {
    return { success: false, error: "Las predicciones para este evento ya están cerradas." };
  }

  await prisma.user_predictions.delete({
    where: { user_id_question_id: { user_id: userId, question_id: questionId } },
  });
  return { success: true };
}

// ---------------------------------------------------------------------------
// processMatchPredictions: ejecutar DENTRO de la transacción de cierre
// Compara predicciones con resultados reales, suma puntos, asigna ORACLE y bonus
// ---------------------------------------------------------------------------
export async function processMatchPredictions(
  matchId: string,
  tx: TxClient,
): Promise<void> {
  const match = await tx.matches.findUnique({
    where: { id: matchId },
    include: {
      match_players: {
        select: {
          user_id: true,
          match_rating: true,
          match_technique: true,
          has_confirmed: true,
        },
      },
      duels: { where: { status: "COMPLETED" }, take: 1 },
    },
  });

  if (!match || !match.league_id) return;

  const group = await tx.prediction_groups.findFirst({
    where: { match_id: matchId, type: "MATCH" },
    include: {
      prediction_questions: {
        include: { prediction_options: true },
      },
    },
  });

  if (!group || group.prediction_questions.length === 0) return;

  const mvpId = match.mvp_id ?? null;
  const playersWithRating = match.match_players.filter(
    (p) => p.match_rating != null,
  );
  const troncoId =
    playersWithRating.length > 0
      ? playersWithRating.reduce((min, p) =>
          Number(p.match_rating) < Number(min.match_rating) ? p : min,
        ).user_id
      : null;
  const duel = match.duels[0];
  const duelWinnerId = duel?.winner_id ?? null;
  const resultKey =
    match.team_a_score != null && match.team_b_score != null
      ? match.team_a_score > match.team_b_score
        ? "A"
        : match.team_b_score > match.team_a_score
          ? "B"
          : "DRAW"
      : null;

  const totalGoals = (match.team_a_score ?? 0) + (match.team_b_score ?? 0);
  const goalsOverKey = totalGoals > 4 ? "YES" : "NO";
  const cleanSheetKey =
    match.team_a_score === 0 || match.team_b_score === 0 ? "YES" : "NO";

  const fantasmaHonor = await tx.honors.findFirst({
    where: { match_id: matchId, honor_type: "FANTASMA" },
  });
  const fantasmaId = fantasmaHonor?.user_id ?? null;

  const confirmedCount = match.match_players.filter((p) => p.has_confirmed).length;
  const confirmedBucket =
    confirmedCount <= 4 ? "0-4" : confirmedCount <= 8 ? "5-8" : confirmedCount <= 12 ? "9-12" : "13+";

  const ratings = playersWithRating.map((p) => Number(p.match_rating));
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
  const avgRatingOver7 = avgRating > 7 ? "YES" : "NO";
  const anyOver8 = ratings.some((r) => r > 8) ? "YES" : "NO";

  const mvpPlayer = mvpId ? playersWithRating.find((p) => p.user_id === mvpId) : null;
  const mvpOver8 = mvpPlayer && Number(mvpPlayer.match_rating) > 8 ? "YES" : "NO";

  const duelDraw = duel && !duelWinnerId ? "YES" : "NO";

  const techniques = match.match_players
    .map((p) => (p.match_technique != null ? Number(p.match_technique) : null))
    .filter((t): t is number => t != null);
  const avgTech = techniques.length ? techniques.reduce((a, b) => a + b, 0) / techniques.length : 0;
  const techRange =
    avgTech <= 6 ? "5-6" : avgTech <= 7 ? "6-7" : avgTech <= 8 ? "7-8" : avgTech <= 9 ? "8-9" : "9-10";

  const ratingByUser: Record<string, number> = {};
  match.match_players.forEach((p) => {
    if (p.match_rating != null) ratingByUser[p.user_id] = Number(p.match_rating);
  });

  const correctByQuestionKey: Record<string, string> = {};
  if (mvpId) correctByQuestionKey["MVP"] = mvpId;
  if (troncoId) correctByQuestionKey["TRONCO"] = troncoId;
  if (fantasmaId) correctByQuestionKey["FANTASMA"] = fantasmaId;
  if (duelWinnerId) correctByQuestionKey["DUEL_WINNER"] = duelWinnerId;
  else if (duel) correctByQuestionKey["DUEL_WINNER"] = "DRAW";
  if (resultKey) correctByQuestionKey["RESULT"] = resultKey;
  correctByQuestionKey["GOALS_OVER"] = goalsOverKey;
  correctByQuestionKey["CLEAN_SHEET"] = cleanSheetKey;
  correctByQuestionKey["CONFIRMED_COUNT"] = confirmedBucket;
  correctByQuestionKey["AVG_RATING_OVER_7"] = avgRatingOver7;
  correctByQuestionKey["ANY_RATING_OVER_8"] = anyOver8;
  correctByQuestionKey["MVP_OVER_8"] = mvpOver8;
  correctByQuestionKey["DUEL_DRAW"] = duelDraw;
  correctByQuestionKey["AVG_TECHNIQUE_RANGE"] = techRange;

  const userPoints: Record<string, number> = {};

  // Traemos TODAS las user_predictions del grupo en un solo query
  // para evitar hacer muchos findMany dentro de la transacción (timeout).
  const allUserPreds = await tx.user_predictions.findMany({
    where: {
      question_id: {
        in: group.prediction_questions.map((q) => q.id),
      },
    },
    select: { user_id: true, question_id: true, option_id: true },
  });

  for (const q of group.prediction_questions) {
    let correctKey: string | undefined = correctByQuestionKey[q.question_key];
    if (correctKey === undefined && q.question_key.includes("|")) {
      const [prefix, userId] = q.question_key.split("|");
      if (prefix === "RATING_OVER_7" && userId) {
        const r = ratingByUser[userId];
        correctKey = r != null ? (r > 7 ? "YES" : "NO") : undefined;
      } else if (prefix === "EXACT_RATING" && userId) {
        const r = ratingByUser[userId];
        if (r != null) {
          const rounded = Math.round(r * 2) / 2;
          correctKey = String(Math.min(10, Math.max(0, rounded)));
        }
      }
    }
    if (correctKey === undefined) continue;

    const correctOption = q.prediction_options.find(
      (o) => o.option_key === correctKey,
    );
    if (!correctOption) continue;

    const userPredsForQuestion = allUserPreds.filter(
      (up) => up.question_id === q.id && up.option_id === correctOption.id,
    );

    for (const up of userPredsForQuestion) {
      userPoints[up.user_id] =
        (userPoints[up.user_id] ?? 0) + q.points_reward;
    }
  }

  // Consumible PRE_MATCH: prode_double_points (duplica puntos del Prode para ese match).
  const doubleActs = await tx.user_consumable_activations.findMany({
    where: {
      target_match_id: matchId,
      timing: "PRE_MATCH",
      status: "ACTIVE",
      consumable_key: "prode_double_points",
    },
    select: { id: true, user_id: true },
  });
  if (doubleActs.length) {
    for (const a of doubleActs) {
      if (userPoints[a.user_id] != null) {
        userPoints[a.user_id] = (userPoints[a.user_id] ?? 0) * 2;
      }
    }
    await tx.user_consumable_activations.updateMany({
      where: { id: { in: doubleActs.map((a) => a.id) } },
      data: { status: "CONSUMED" },
    });
  }

  // Consumible PRE_MATCH: prode_unlimited_picks (solo cambia el límite de picks, se consume al cerrar el match).
  await tx.user_consumable_activations.updateMany({
    where: {
      target_match_id: matchId,
      timing: "PRE_MATCH",
      status: "ACTIVE",
      consumable_key: "prode_unlimited_picks",
    },
    data: { status: "CONSUMED" },
  });

  const leagueId = match.league_id;

  // Persistir prediction_points en cada match_player (evita recalcular siempre)
  const allMatchPlayers = await tx.match_players.findMany({
    where: { match_id: matchId },
    select: { user_id: true },
  });
  await Promise.all(
    allMatchPlayers.map((mp) => {
      const points = userPoints[mp.user_id] ?? 0;
      return tx.match_players.update({
        where: {
          match_id_user_id: { match_id: matchId, user_id: mp.user_id },
        },
        data: { prediction_points: points },
      });
    }),
  );

  // Acumular puntos de esta fecha en league_members (prode por liga, suma fecha tras fecha)
  if (leagueId) {
    await Promise.all(
      allMatchPlayers.map((mp) => {
        const points = userPoints[mp.user_id] ?? 0;
        return tx.league_members.updateMany({
          where: {
            league_id: leagueId,
            user_id: mp.user_id,
          },
          data: {
            prode_points_total: { increment: points },
          },
        }        );
      }),
    );
  }

  const entries = Object.entries(userPoints);
  if (entries.length === 0) return;

  const maxPoints = Math.max(...entries.map(([, p]) => p));
  const winners = entries.filter(([, p]) => p === maxPoints);
  const winnerUserIds = winners.map(([uid]) => uid);
  if (winnerUserIds.length === 0) return;

  // Premios: ORACLE y +0.5 match_rating para TODOS los empatados en primer lugar
  for (const oracleUserId of winnerUserIds) {
    await tx.honors.create({
      data: {
        match_id: matchId,
        user_id: oracleUserId,
        league_id: leagueId,
        honor_type: "ORACLE",
      },
    });

    const member = await tx.league_members.findUnique({
      where: {
        league_id_user_id: { league_id: leagueId, user_id: oracleUserId },
      },
    });
    if (member) {
      await tx.league_members.update({
        where: {
          league_id_user_id: { league_id: leagueId, user_id: oracleUserId },
        },
        data: { honors_prediction: { increment: 1 } },
      });
    }

    const mpRow = await tx.match_players.findUnique({
      where: {
        match_id_user_id: { match_id: matchId, user_id: oracleUserId },
      },
    });
    if (mpRow?.match_rating != null) {
      const newRating = Number(mpRow.match_rating) + 0.5;
      await tx.match_players.update({
        where: {
          match_id_user_id: { match_id: matchId, user_id: oracleUserId },
        },
        data: { match_rating: newRating },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// MONTHLY: resolver y asignar puntos al cerrar el mes (por league + period_key)
// ---------------------------------------------------------------------------

function monthRangeFromPeriodKey(periodKey: string): { from: Date; to: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(String(periodKey));
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]); // 1-12
  if (!year || !month || month < 1 || month > 12) return null;
  const from = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const to = new Date(year, month, 0, 23, 59, 59, 999);
  return { from, to };
}

type MonthlyWinners = {
  bestAvg: string[];
  highestRating: string[];
  mostDuels: string[];
  mostFantasmas: string[];
  mostTroncos: string[];
  mostMvps: string[];
  mostMatches: string[];
  leastMatches: string[];
  over7ByUser: Record<string, "YES" | "NO">;
};

async function computeMonthlyWinners(
  leagueId: string,
  periodKey: string,
  tx: TxClient,
): Promise<MonthlyWinners | null> {
  const range = monthRangeFromPeriodKey(periodKey);
  if (!range) return null;

  const members = await tx.league_members.findMany({
    where: { league_id: leagueId, is_banned: false },
    select: { user_id: true },
  });
  const memberIds = members.map((m) => m.user_id);
  if (memberIds.length === 0) return null;

  const matchPlayers = await tx.match_players.findMany({
    where: {
      user_id: { in: memberIds },
      matches: {
        league_id: leagueId,
        status: { in: ["COMPLETED"] },
        date_time: { gte: range.from, lte: range.to },
      },
    },
    select: { user_id: true, match_rating: true },
  });

  const ratingsByUser = new Map<string, number[]>();
  for (const mp of matchPlayers) {
    const uid = mp.user_id;
    const r = mp.match_rating != null ? Number(mp.match_rating) : null;
    if (r == null) continue;
    const list = ratingsByUser.get(uid) ?? [];
    list.push(r);
    ratingsByUser.set(uid, list);
  }

  const avgByUser = new Map<string, number>();
  for (const uid of memberIds) {
    const arr = ratingsByUser.get(uid) ?? [];
    if (arr.length === 0) continue;
    avgByUser.set(uid, arr.reduce((a, b) => a + b, 0) / arr.length);
  }

  const bestAvgVal = Math.max(0, ...Array.from(avgByUser.values()));
  const bestAvg = Array.from(avgByUser.entries())
    .filter(([, v]) => v === bestAvgVal && bestAvgVal > 0)
    .map(([uid]) => uid);

  let highestVal = 0;
  for (const arr of ratingsByUser.values()) {
    for (const r of arr) highestVal = Math.max(highestVal, r);
  }
  const highestRating = Array.from(ratingsByUser.entries())
    .filter(([, arr]) => arr.some((r) => r === highestVal) && highestVal > 0)
    .map(([uid]) => uid);

  const duels = await tx.duels.findMany({
    where: {
      status: "COMPLETED",
      winner_id: { in: memberIds },
      matches: {
        league_id: leagueId,
        status: "COMPLETED",
        date_time: { gte: range.from, lte: range.to },
      },
    },
    select: { winner_id: true },
  });
  const duelCount = new Map<string, number>();
  for (const d of duels) {
    const uid = d.winner_id;
    if (!uid) continue;
    duelCount.set(uid, (duelCount.get(uid) ?? 0) + 1);
  }
  const maxDuels = Math.max(0, ...Array.from(duelCount.values()));
  const mostDuels = Array.from(duelCount.entries())
    .filter(([, c]) => c === maxDuels && maxDuels > 0)
    .map(([uid]) => uid);

  const honors = await tx.honors.groupBy({
    by: ["user_id", "honor_type"],
    where: {
      league_id: leagueId,
      user_id: { in: memberIds },
      honor_type: { in: ["FANTASMA", "TRONCO", "MVP"] },
      matches: {
        status: "COMPLETED",
        date_time: { gte: range.from, lte: range.to },
      },
    },
    _count: { honor_type: true },
  });
  const honorCount = (type: string) => {
    const m = new Map<string, number>();
    for (const h of honors as any[]) {
      if (String(h.honor_type).toUpperCase() !== type) continue;
      const uid = String(h.user_id);
      m.set(uid, Number(h._count?.honor_type ?? 0));
    }
    return m;
  };
  const fantasmaMap = honorCount("FANTASMA");
  const troncoMap = honorCount("TRONCO");
  const mvpMap = honorCount("MVP");

  const maxF = Math.max(0, ...Array.from(fantasmaMap.values()));
  const maxT = Math.max(0, ...Array.from(troncoMap.values()));
  const maxM = Math.max(0, ...Array.from(mvpMap.values()));
  const mostFantasmas = Array.from(fantasmaMap.entries())
    .filter(([, c]) => c === maxF && maxF > 0)
    .map(([uid]) => uid);
  const mostTroncos = Array.from(troncoMap.entries())
    .filter(([, c]) => c === maxT && maxT > 0)
    .map(([uid]) => uid);
  const mostMvps = Array.from(mvpMap.entries())
    .filter(([, c]) => c === maxM && maxM > 0)
    .map(([uid]) => uid);

  // partidos jugados (conteo de match_players en el mes)
  const playedCount = new Map<string, number>();
  for (const uid of memberIds) playedCount.set(uid, 0);
  for (const mp of matchPlayers) {
    playedCount.set(mp.user_id, (playedCount.get(mp.user_id) ?? 0) + 1);
  }
  const maxPlayed = Math.max(...Array.from(playedCount.values()));
  const minPlayed = Math.min(...Array.from(playedCount.values()));
  const mostMatches = Array.from(playedCount.entries())
    .filter(([, c]) => c === maxPlayed && maxPlayed > 0)
    .map(([uid]) => uid);
  const leastMatches = Array.from(playedCount.entries())
    .filter(([, c]) => c === minPlayed)
    .map(([uid]) => uid);

  const over7ByUser: Record<string, "YES" | "NO"> = {};
  for (const uid of memberIds) {
    const avg = avgByUser.get(uid);
    over7ByUser[uid] = avg != null && avg > 7 ? "YES" : "NO";
  }

  return {
    bestAvg,
    highestRating,
    mostDuels,
    mostFantasmas,
    mostTroncos,
    mostMvps,
    mostMatches,
    leastMatches,
    over7ByUser,
  };
}

export async function processMonthlyPredictionGroup(
  leagueId: string,
  periodKey: string,
  tx: TxClient,
): Promise<void> {
  const MONTHLY_TTP_BY_DIFFICULTY: Record<string, number> = {
    EASY: 18,
    MEDIUM: 25,
    HARD: 35,
  };

  const group = await tx.prediction_groups.findFirst({
    where: { league_id: leagueId, type: "MONTHLY", period_key: periodKey, match_id: null },
    include: {
      prediction_questions: { include: { prediction_options: true } },
    },
  });
  if (!group || group.prediction_questions.length === 0) return;

  const locked = await tx.$queryRawUnsafe<Array<{ monthly_settled_at: Date | null }>>(
    `SELECT monthly_settled_at FROM prediction_groups WHERE id = $1::uuid FOR UPDATE`,
    group.id,
  );
  if (!locked.length || locked[0]?.monthly_settled_at != null) return;

  const winners = await computeMonthlyWinners(leagueId, periodKey, tx);
  if (!winners) return;

  // Reset is_correct
  await tx.prediction_options.updateMany({
    where: { question_id: { in: group.prediction_questions.map((q) => q.id) } },
    data: { is_correct: null },
  });

  const correctKeysByQuestionId = new Map<string, string[]>();
  for (const q of group.prediction_questions) {
    const key = String(q.question_key);
    let correctKeys: string[] = [];
    if (key === "MONTHLY_BEST_AVG") correctKeys = winners.bestAvg;
    else if (key === "MONTHLY_HIGHEST_RATING") correctKeys = winners.highestRating;
    else if (key === "MONTHLY_MOST_DUELS") correctKeys = winners.mostDuels;
    else if (key === "MONTHLY_MOST_FANTASMAS") correctKeys = winners.mostFantasmas;
    else if (key === "MONTHLY_MOST_TRONCOS") correctKeys = winners.mostTroncos;
    else if (key === "MONTHLY_MOST_MVPS") correctKeys = winners.mostMvps;
    else if (key === "MONTHLY_MOST_MATCHES") correctKeys = winners.mostMatches;
    else if (key === "MONTHLY_LEAST_MATCHES") correctKeys = winners.leastMatches;
    else if (key.startsWith("MONTHLY_OVER_7|")) {
      const [, uid] = key.split("|");
      if (uid) correctKeys = [winners.over7ByUser[uid] ?? "NO"];
    }
    if (correctKeys.length === 0) continue;
    correctKeysByQuestionId.set(q.id, correctKeys);

    const correctOptionIds = q.prediction_options
      .filter((o) => correctKeys.includes(String(o.option_key)))
      .map((o) => o.id);
    if (correctOptionIds.length > 0) {
      await tx.prediction_options.updateMany({
        where: { id: { in: correctOptionIds } },
        data: { is_correct: true },
      });
      // Mark the rest as false (so UI can show)
      await tx.prediction_options.updateMany({
        where: { question_id: q.id, id: { notIn: correctOptionIds } },
        data: { is_correct: false },
      });
    }
  }

  const questionIds = group.prediction_questions.map((q) => q.id);
  const allUserPreds = await tx.user_predictions.findMany({
    where: { question_id: { in: questionIds } },
    select: { user_id: true, question_id: true, option_id: true },
  });

  const optionsById = new Map<string, { question_id: string; option_key: string }>();
  for (const q of group.prediction_questions) {
    for (const o of q.prediction_options) {
      optionsById.set(o.id, { question_id: q.id, option_key: String(o.option_key) });
    }
  }

  const monthlyTtpByUser = new Map<string, number>();
  const breakdownByUser = new Map<
    string,
    { easy: number; medium: number; hard: number; easyTtp: number; mediumTtp: number; hardTtp: number }
  >();
  const questionById = new Map(
    group.prediction_questions.map((q) => [q.id, q] as const),
  );
  for (const up of allUserPreds) {
    const meta = optionsById.get(up.option_id);
    if (!meta) continue;
    const correctKeys = correctKeysByQuestionId.get(meta.question_id);
    if (!correctKeys) continue;
    if (!correctKeys.includes(meta.option_key)) continue;
    const question = questionById.get(meta.question_id);
    const difficulty = String(question?.difficulty ?? "MEDIUM").toUpperCase();
    const ttpReward = MONTHLY_TTP_BY_DIFFICULTY[difficulty] ?? MONTHLY_TTP_BY_DIFFICULTY.MEDIUM;
    monthlyTtpByUser.set(up.user_id, (monthlyTtpByUser.get(up.user_id) ?? 0) + ttpReward);

    const prev =
      breakdownByUser.get(up.user_id) ?? {
        easy: 0,
        medium: 0,
        hard: 0,
        easyTtp: 0,
        mediumTtp: 0,
        hardTtp: 0,
      };
    if (difficulty === "EASY") {
      prev.easy += 1;
      prev.easyTtp += ttpReward;
    } else if (difficulty === "HARD") {
      prev.hard += 1;
      prev.hardTtp += ttpReward;
    } else {
      prev.medium += 1;
      prev.mediumTtp += ttpReward;
    }
    breakdownByUser.set(up.user_id, prev);
  }

  // Mensual NO suma prode_points_total.
  // En su lugar, otorga TTP por acierto con un valor mayor a FREE/partido, pero moderado.
  for (const [userId, ttpAmount] of monthlyTtpByUser.entries()) {
    if (ttpAmount <= 0) continue;
    await grantTtpInTx(tx, {
      userId,
      amount: ttpAmount,
      reason: "MONTHLY_PREDICTION_REWARD",
      refType: "prediction_group",
      refId: group.id,
      idempotencyKey: `ttp:monthly_prediction_reward:${group.id}:${userId}`,
    });
  }

  // Popup UX: crear "pendiente de ver" (1 sola vez por usuario/mes/liga).
  const popupRows = [...monthlyTtpByUser.entries()]
    .filter(([, amt]) => (amt ?? 0) > 0)
    .map(([userId, amt]) => {
      const b = breakdownByUser.get(userId);
      return {
        user_id: userId,
        league_id: leagueId,
        period_key: periodKey,
        ttp_amount: amt,
        meta: b
          ? {
              easyCorrect: b.easy,
              mediumCorrect: b.medium,
              hardCorrect: b.hard,
              easyTtp: b.easyTtp,
              mediumTtp: b.mediumTtp,
              hardTtp: b.hardTtp,
            }
          : undefined,
      };
    });
  if (popupRows.length > 0) {
    await tx.monthly_prediction_reward_popups.createMany({
      data: popupRows,
      skipDuplicates: true,
    });
  }

  await tx.prediction_groups.update({
    where: { id: group.id },
    data: { monthly_settled_at: new Date() },
  });
}

export type PredictionResultItem = {
  question_id: string;
  question_label: string;
  points_reward: number;
  options: { id: string; label: string; is_correct: boolean | null }[];
  user_option_id: string | null;
  user_option_label: string | null;
  correct_option_id: string | null;
  correct_option_label: string | null;
  correct: boolean;
  points_earned: number;
};

// ---------------------------------------------------------------------------
// Detalle de predicciones del usuario para un partido (resultados ya resueltos)
// ---------------------------------------------------------------------------
export async function getMatchPredictionsResultForUser(
  matchId: string,
  userId: string,
): Promise<{ questions: PredictionResultItem[]; totalPoints: number }> {
  const match = await prisma.matches.findUnique({
    where: { id: matchId },
    include: {
      match_players: {
        select: {
          user_id: true,
          match_rating: true,
          match_technique: true,
          has_confirmed: true,
        },
      },
      honors: { where: { user_id: { not: null } } },
      duels: { where: { status: "COMPLETED" }, take: 1 },
    },
  });
  if (!match || !match.league_id) {
    return { questions: [], totalPoints: 0 };
  }

  const group = await prisma.prediction_groups.findFirst({
    where: { match_id: matchId, type: "MATCH" },
    include: {
      prediction_questions: {
        include: { prediction_options: true },
      },
    },
  });
  if (!group || group.prediction_questions.length === 0) {
    return { questions: [], totalPoints: 0 };
  }

  const mvpId = (match as any).mvp_id ?? null;
  const playersWithRating = match.match_players.filter((p) => p.match_rating != null);
  const troncoId =
    playersWithRating.length > 0
      ? playersWithRating.reduce((min, p) =>
          Number(p.match_rating) < Number(min.match_rating) ? p : min,
        ).user_id
      : null;
  const duel = match.duels[0];
  const duelWinnerId = duel?.winner_id ?? null;
  const resultKey =
    match.team_a_score != null && match.team_b_score != null
      ? match.team_a_score > match.team_b_score
        ? "A"
        : match.team_b_score > match.team_a_score
          ? "B"
          : "DRAW"
      : null;
  const totalGoals = (match.team_a_score ?? 0) + (match.team_b_score ?? 0);
  const goalsOverKey = totalGoals > 4 ? "YES" : "NO";
  const cleanSheetKey = match.team_a_score === 0 || match.team_b_score === 0 ? "YES" : "NO";
  const fantasmaHonor = match.honors?.find((h: any) => h.honor_type === "FANTASMA");
  const fantasmaId = fantasmaHonor?.user_id ?? null;
  const confirmedCount = match.match_players.filter((p) => p.has_confirmed).length;
  const confirmedBucket =
    confirmedCount <= 4 ? "0-4" : confirmedCount <= 8 ? "5-8" : confirmedCount <= 12 ? "9-12" : "13+";
  const ratings = playersWithRating.map((p) => Number(p.match_rating));
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
  const avgRatingOver7 = avgRating > 7 ? "YES" : "NO";
  const anyOver8 = ratings.some((r) => r > 8) ? "YES" : "NO";
  const mvpPlayer = mvpId ? playersWithRating.find((p) => p.user_id === mvpId) : null;
  const mvpOver8 = mvpPlayer && Number(mvpPlayer.match_rating) > 8 ? "YES" : "NO";
  const duelDraw = duel && !duelWinnerId ? "YES" : "NO";
  const techniques = match.match_players
    .map((p) => (p.match_technique != null ? Number(p.match_technique) : null))
    .filter((t): t is number => t != null);
  const avgTech = techniques.length ? techniques.reduce((a, b) => a + b, 0) / techniques.length : 0;
  const techRange =
    avgTech <= 6 ? "5-6" : avgTech <= 7 ? "6-7" : avgTech <= 8 ? "7-8" : avgTech <= 9 ? "8-9" : "9-10";

  const ratingByUser: Record<string, number> = {};
  match.match_players.forEach((p) => {
    if (p.match_rating != null) ratingByUser[p.user_id] = Number(p.match_rating);
  });

  const correctByQuestionKey: Record<string, string> = {};
  if (mvpId) correctByQuestionKey["MVP"] = mvpId;
  if (troncoId) correctByQuestionKey["TRONCO"] = troncoId;
  if (fantasmaId) correctByQuestionKey["FANTASMA"] = fantasmaId;
  if (duelWinnerId) correctByQuestionKey["DUEL_WINNER"] = duelWinnerId;
  else if (duel) correctByQuestionKey["DUEL_WINNER"] = "DRAW";
  if (resultKey) correctByQuestionKey["RESULT"] = resultKey;
  correctByQuestionKey["GOALS_OVER"] = goalsOverKey;
  correctByQuestionKey["CLEAN_SHEET"] = cleanSheetKey;
  correctByQuestionKey["CONFIRMED_COUNT"] = confirmedBucket;
  correctByQuestionKey["AVG_RATING_OVER_7"] = avgRatingOver7;
  correctByQuestionKey["ANY_RATING_OVER_8"] = anyOver8;
  correctByQuestionKey["MVP_OVER_8"] = mvpOver8;
  correctByQuestionKey["DUEL_DRAW"] = duelDraw;
  correctByQuestionKey["AVG_TECHNIQUE_RANGE"] = techRange;

  const userPreds = await prisma.user_predictions.findMany({
    where: {
      user_id: userId,
      question_id: {
        in: group.prediction_questions.map((q) => q.id),
      },
    },
    select: { question_id: true, option_id: true },
  });
  const userPredByQuestion = new Map(
    userPreds.map((u) => [u.question_id, u.option_id]),
  );

  let totalPoints = 0;
  const questions: PredictionResultItem[] = group.prediction_questions.map(
    (q) => {
      const options = q.prediction_options.map((o) => ({
        id: o.id,
        label: o.label,
        is_correct: o.is_correct,
      }));

      let correctKey: string | undefined = correctByQuestionKey[q.question_key];
      if (correctKey === undefined && q.question_key.includes("|")) {
        const [prefix, qUserId] = q.question_key.split("|");
        if (prefix === "RATING_OVER_7" && qUserId) {
          const r = ratingByUser[qUserId];
          correctKey = r != null ? (r > 7 ? "YES" : "NO") : undefined;
        } else if (prefix === "EXACT_RATING" && qUserId) {
          const r = ratingByUser[qUserId];
          if (r != null) {
            const rounded = Math.round(r * 2) / 2;
            correctKey = String(Math.min(10, Math.max(0, rounded)));
          }
        }
      }

      const correctOption = correctKey
        ? q.prediction_options.find((o) => o.option_key === correctKey) ?? null
        : null;
      const userOptionId = userPredByQuestion.get(q.id) ?? null;
      const userOption = userOptionId
        ? q.prediction_options.find((o) => o.id === userOptionId)
        : null;
      const correct = !!(
        userOptionId &&
        correctOption &&
        userOptionId === correctOption.id
      );
      const points_earned = correct ? q.points_reward : 0;
      totalPoints += points_earned;
      return {
        question_id: q.id,
        question_label: q.label,
        points_reward: q.points_reward,
        options,
        user_option_id: userOptionId,
        user_option_label: userOption?.label ?? null,
        correct_option_id: correctOption?.id ?? null,
        correct_option_label: correctOption?.label ?? null,
        correct,
        points_earned,
      };
    },
  );

  return { questions, totalPoints };
}

// ---------------------------------------------------------------------------
// Listar grupos activos por liga (para el front)
// Si las tablas no existen o hay error, devuelve listas vacías para no devolver 500
// ---------------------------------------------------------------------------
export async function getActiveGroupsByLeague(
  leagueId: string,
  userId: string,
): Promise<{
  match: Array<GroupWithQuestions>;
  monthly: Array<GroupWithQuestions>;
  season: Array<GroupWithQuestions>;
}> {
  const empty = {
    match: [] as Array<GroupWithQuestions>,
    monthly: [] as Array<GroupWithQuestions>,
    season: [] as Array<GroupWithQuestions>,
  };

  try {
    const now = new Date();
    const closesAtMin = new Date(now.getTime() - 30 * 60 * 1000);

    // Mes actual y anterior (YYYY-MM) para seguir mostrando prodes mensuales cerrados y ver resultados.
    const ymKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthlyPeriodKeysRecent = [
      ymKey(now),
      ymKey(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
    ];

    // On-demand: asegurar grupo mensual del mes (para no depender del scheduler)
    try {
      await ensureMonthlyPredictionGroupForLeague(leagueId, now);
    } catch (err) {
      log.errorWithErr("ensureMonthlyPredictionGroupForLeague (on-demand) failed", err, { leagueId });
    }

    // Partidos OPEN o recién cerrados (timezone). Mensuales sin partido: abiertos por fecha,
    // o MONTHLY del mes actual / anterior por period_key (si no, al pasar closes_at fin de mes desaparecían todas).
    // Temporada sin partido: solo si closes_at > now.
    let groups = await prisma.prediction_groups.findMany({
      where: {
        league_id: leagueId,
        OR: [
          {
            match_id: null,
            OR: [
              { closes_at: { gt: now } },
              {
                type: "MONTHLY",
                period_key: { in: monthlyPeriodKeysRecent },
              },
            ],
          },
          {
            match_id: { not: null },
            matches: { status: { notIn: ["CANCELLED", "COMPLETED"] } },
            OR: [
              { closes_at: { gt: now } },
              { closes_at: { gte: closesAtMin } },
            ],
          },
        ],
      },
      orderBy: { closes_at: "asc" },
      include: {
        prediction_questions: {
          include: {
            prediction_options: true,
            user_predictions: { where: { user_id: userId }, take: 1 },
          },
        },
        matches: { select: { id: true, date_time: true, location_name: true } },
      },
    });

    const uuidLike =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const optionUserIds = new Set<string>();
    for (const g of groups) {
      for (const q of g.prediction_questions) {
        for (const o of q.prediction_options) {
          const key = String(o.option_key || "");
          if (uuidLike.test(key)) optionUserIds.add(key);
        }
      }
    }
    const usersById = new Map<string, string | null>();
    if (optionUserIds.size > 0) {
      const users = await prisma.users.findMany({
        where: { id: { in: Array.from(optionUserIds) } },
        select: { id: true, profile_photo_url: true },
      });
      for (const u of users) usersById.set(u.id, u.profile_photo_url ?? null);
    }

    // Si no hay predicciones por partido pero la liga tiene un próximo partido, crear el grupo
    // Solo partidos OPEN; ventana amplia (desde hace 24h) por timezone, luego tomamos el primero que no haya pasado
    const withUserChoice = (
      g: (typeof groups)[0],
    ): GroupWithQuestions => {
      const allQuestions = g.prediction_questions.map((q) => ({
        id: q.id,
        question_key: q.question_key,
        label: q.label,
        points_reward: q.points_reward,
        difficulty: q.difficulty ?? undefined,
        options: q.prediction_options.map((o) => ({
          id: o.id,
          option_key: o.option_key,
          label: o.label,
          image_url: usersById.get(String(o.option_key)) ?? null,
        })),
        user_option_id: q.user_predictions[0]?.option_id ?? null,
      }));
      let questions: typeof allQuestions;
      if (g.type === "MATCH" && Array.isArray(g.display_question_ids) && g.display_question_ids.length > 0) {
        const byId = new Map(allQuestions.map((q) => [q.id, q]));
        questions = (g.display_question_ids as string[])
          .filter((id) => byId.has(id))
          .map((id) => byId.get(id)!);
      } else if (g.type === "MATCH") {
        questions = sampleByDifficulty(
          allQuestions,
          SHOW_EASY,
          SHOW_MEDIUM,
          SHOW_HARD,
        );
      } else {
        questions = allQuestions;
      }
      return {
        id: g.id,
        type: g.type,
        period_key: g.period_key,
        closes_at: g.closes_at,
        match: g.matches
          ? {
              id: g.matches.id,
              date_time: g.matches.date_time,
              location_name: g.matches.location_name,
            }
          : null,
        questions,
      };
    };

    return {
      match: groups.filter((g) => g.type === "MATCH").map(withUserChoice),
      monthly: groups.filter((g) => g.type === "MONTHLY").map(withUserChoice),
      season: groups.filter((g) => g.type === "SEASON").map(withUserChoice),
    };
  } catch (err) {
    log.errorWithErr("getActiveGroupsByLeague failed", err, { leagueId, userId });
    return empty;
  }
}

export type GroupWithQuestions = {
  id: string;
  type: string;
  period_key: string | null;
  closes_at: Date;
  match: {
    id: string;
    date_time: Date;
    location_name: string | null;
  } | null;
  questions: Array<{
    id: string;
    question_key: string;
    label: string;
    points_reward: number;
    difficulty?: string;
    options: Array<{ id: string; option_key: string; label: string; image_url?: string | null }>;
    user_option_id: string | null;
  }>;
};

// ---------------------------------------------------------------------------
// Pool de predicciones por partido: 40-50 preguntas, solo 10 mostradas (4-4-2)
// Todas comprobables por la app. question_key compuesto: "PREFIX|userId" para por jugador.
// ---------------------------------------------------------------------------
type QDef = {
  question_key: string;
  label: string;
  points_reward: number;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  options: Array<{ key: string; label: string }>;
};

// ---------------------------------------------------------------------------
// MONTHLY: creación automática (pool grande, user elige 5)
// ---------------------------------------------------------------------------

function getPeriodKeyForDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthlyVotingCloseAt(d: Date): Date {
  // Ventana mensual: abre 1° y cierra al iniciar el día 11 (10 días completos para votar)
  const y = d.getFullYear();
  const m = d.getMonth();
  return new Date(y, m, 11, 0, 0, 0, 0);
}

export async function ensureMonthlyPredictionGroupForLeague(
  leagueId: string,
  now: Date = new Date(),
): Promise<{ groupId: string } | null> {
  const periodKey = getPeriodKeyForDate(now);
  const closesAt = monthlyVotingCloseAt(now);

  const existing = await prisma.prediction_groups.findFirst({
    where: { league_id: leagueId, type: "MONTHLY", period_key: periodKey, match_id: null },
    select: { id: true, closes_at: true },
  });
  if (existing) {
    const currentClose = new Date(existing.closes_at).getTime();
    const expectedClose = closesAt.getTime();
    if (currentClose !== expectedClose) {
      await prisma.prediction_groups.update({
        where: { id: existing.id },
        data: { closes_at: closesAt },
      });
    }
    return { groupId: existing.id };
  }

  // Opciones: todos los miembros activos de la liga
  const members = await prisma.league_members.findMany({
    where: { league_id: leagueId, is_banned: false },
    include: { users: { select: { id: true, full_name: true, username: true } } },
  });
  if (members.length === 0) return null;

  const playerOptions = members.map((m) => ({
    key: m.user_id,
    label: m.users?.full_name || m.users?.username || "Jugador",
  }));

  const group = await prisma.prediction_groups.create({
    data: {
      league_id: leagueId,
      match_id: null,
      type: "MONTHLY",
      period_key: periodKey,
      closes_at: closesAt,
    },
  });

  // Pool amplio. User elige solo 5 predicciones del pool.
  const pool: QDef[] = [
    { question_key: "MONTHLY_BEST_AVG", label: "¿Quién tendrá el mejor promedio del mes?", points_reward: 30, difficulty: "MEDIUM", options: playerOptions },
    { question_key: "MONTHLY_HIGHEST_RATING", label: "¿Quién sacará la nota más alta del mes?", points_reward: 35, difficulty: "HARD", options: playerOptions },
    { question_key: "MONTHLY_MOST_DUELS", label: "¿Quién ganará más duelos este mes?", points_reward: 30, difficulty: "MEDIUM", options: playerOptions },
    { question_key: "MONTHLY_MOST_FANTASMAS", label: "¿Quién tendrá más Fantasmas este mes?", points_reward: 25, difficulty: "EASY", options: playerOptions },
    { question_key: "MONTHLY_MOST_TRONCOS", label: "¿Quién tendrá más Troncos este mes?", points_reward: 25, difficulty: "EASY", options: playerOptions },
    { question_key: "MONTHLY_MOST_MVPS", label: "¿Quién tendrá más MVPs este mes?", points_reward: 28, difficulty: "MEDIUM", options: playerOptions },
    { question_key: "MONTHLY_MOST_MATCHES", label: "¿Quién jugará más partidos este mes?", points_reward: 22, difficulty: "EASY", options: playerOptions },
    { question_key: "MONTHLY_LEAST_MATCHES", label: "¿Quién jugará menos partidos este mes?", points_reward: 28, difficulty: "HARD", options: playerOptions },
  ];

  // “Pool” extra: top performance categories (para que haya más de 10)
  for (const o of playerOptions.slice(0, Math.min(12, playerOptions.length))) {
    pool.push({
      question_key: `MONTHLY_OVER_7|${o.key}`,
      label: `¿${o.label} cerrará el mes con promedio mayor a 7?`,
      points_reward: 18,
      difficulty: "MEDIUM",
      options: [{ key: "YES", label: "Sí" }, { key: "NO", label: "No" }],
    });
  }

  for (const q of pool) {
    const createdQ = await prisma.prediction_questions.create({
      data: {
        group_id: group.id,
        question_key: q.question_key,
        label: q.label,
        points_reward: q.points_reward,
        difficulty: q.difficulty,
      },
    });
    await prisma.prediction_options.createMany({
      data: q.options.map((o) => ({
        question_id: createdQ.id,
        option_key: o.key,
        label: o.label,
      })),
    });
  }

  return { groupId: group.id };
}

const RATING_OPTIONS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((n) => ({
  key: String(n),
  label: String(n),
}));
const TECH_RANGES = [
  { key: "5-6", label: "5.0 - 6.0" },
  { key: "6-7", label: "6.0 - 7.0" },
  { key: "7-8", label: "7.0 - 8.0" },
  { key: "8-9", label: "8.0 - 9.0" },
  { key: "9-10", label: "9.0 - 10.0" },
];

/**
 * Crea el grupo de Prode/predicciones para un partido (preguntas + opciones).
 * Debe llamarse cuando el plantel está cerrado: en la práctica, cuando todos los
 * convocados ya confirmaron asistencia (ver matchController al confirmar).
 */
export async function createMatchPredictionGroup(
  matchId: string,
): Promise<{ groupId: string } | null> {
  const match = await prisma.matches.findUnique({
    where: { id: matchId },
    include: {
      match_players: {
        include: { users: { select: { id: true, full_name: true, username: true } } },
      },
    },
  });

  if (!match || !match.league_id) return null;

  const existing = await prisma.prediction_groups.findFirst({
    where: { match_id: matchId, type: "MATCH" },
  });
  if (existing) return { groupId: existing.id };

  const closesAt = match.date_time;
  const group = await prisma.prediction_groups.create({
    data: {
      league_id: match.league_id,
      match_id: matchId,
      type: "MATCH",
      period_key: null,
      closes_at: closesAt,
    },
  });

  const playerOptions = match.match_players.map((mp) => ({
    key: mp.user_id,
    label: mp.users?.full_name || mp.users?.username || "Jugador",
  }));

  const questionsToCreate: QDef[] = [
    { question_key: "MVP", label: "¿Quién será el MVP?", points_reward: 2, difficulty: "EASY", options: playerOptions },
    { question_key: "TRONCO", label: "¿Quién será el Tronco?", points_reward: 2, difficulty: "EASY", options: playerOptions },
    { question_key: "FANTASMA", label: "¿Quién será el Fantasma?", points_reward: 3, difficulty: "MEDIUM", options: playerOptions },
    { question_key: "RESULT", label: "¿Quién gana el partido?", points_reward: 2, difficulty: "EASY", options: [{ key: "A", label: "Gana equipo A" }, { key: "B", label: "Gana equipo B" }, { key: "DRAW", label: "Empate" }] },
    { question_key: "DUEL_WINNER", label: "¿Quién gana el duelo?", points_reward: 4, difficulty: "MEDIUM", options: [...playerOptions, { key: "DRAW", label: "Empate" }] },
    { question_key: "GOALS_OVER", label: "¿Habrá más de 4 goles en total?", points_reward: 3, difficulty: "EASY", options: [{ key: "YES", label: "Sí" }, { key: "NO", label: "No" }] },
    { question_key: "CLEAN_SHEET", label: "¿Algún equipo se va en cero?", points_reward: 3, difficulty: "EASY", options: [{ key: "YES", label: "Sí" }, { key: "NO", label: "No" }] },
    { question_key: "CONFIRMED_COUNT", label: "¿Cuántos confirmarán asistencia?", points_reward: 3, difficulty: "MEDIUM", options: [{ key: "0-4", label: "0 a 4" }, { key: "5-8", label: "5 a 8" }, { key: "9-12", label: "9 a 12" }, { key: "13+", label: "13 o más" }] },
    { question_key: "AVG_RATING_OVER_7", label: "¿El promedio de rating del partido será mayor a 7?", points_reward: 4, difficulty: "MEDIUM", options: [{ key: "YES", label: "Sí" }, { key: "NO", label: "No" }] },
    { question_key: "ANY_RATING_OVER_8", label: "¿Algún jugador sacará más de 8?", points_reward: 3, difficulty: "MEDIUM", options: [{ key: "YES", label: "Sí" }, { key: "NO", label: "No" }] },
    { question_key: "MVP_OVER_8", label: "¿El MVP sacará más de 8?", points_reward: 5, difficulty: "HARD", options: [{ key: "YES", label: "Sí" }, { key: "NO", label: "No" }] },
    { question_key: "DUEL_DRAW", label: "¿El duelo terminará en empate?", points_reward: 4, difficulty: "MEDIUM", options: [{ key: "YES", label: "Sí" }, { key: "NO", label: "No" }] },
    { question_key: "AVG_TECHNIQUE_RANGE", label: "¿En qué rango quedará el promedio de técnica del partido?", points_reward: 6, difficulty: "HARD", options: TECH_RANGES },
  ];

  for (const mp of match.match_players) {
    const name = mp.users?.full_name || mp.users?.username || "Jugador";
    questionsToCreate.push({
      question_key: `RATING_OVER_7|${mp.user_id}`,
      label: `¿${name} sacará más de 7?`,
      points_reward: 4,
      difficulty: "MEDIUM",
      options: [{ key: "YES", label: "Sí" }, { key: "NO", label: "No" }],
    });
    questionsToCreate.push({
      question_key: `EXACT_RATING|${mp.user_id}`,
      label: `¿Qué rating sacará ${name}? (0 a 10)`,
      points_reward: 8,
      difficulty: "HARD",
      options: RATING_OPTIONS,
    });
  }

  const createdIdsByDifficulty: { id: string; difficulty: string }[] = [];
  for (const q of questionsToCreate) {
    const question = await prisma.prediction_questions.create({
      data: {
        group_id: group.id,
        question_key: q.question_key,
        label: q.label,
        points_reward: q.points_reward,
        difficulty: q.difficulty,
      },
    });
    createdIdsByDifficulty.push({
      id: question.id,
      difficulty: q.difficulty,
    });
    await prisma.prediction_options.createMany({
      data: q.options.map((o) => ({
        question_id: question.id,
        option_key: o.key,
        label: o.label,
      })),
    });
  }

  const sampled = sampleByDifficulty(
    createdIdsByDifficulty,
    SHOW_EASY,
    SHOW_MEDIUM,
    SHOW_HARD,
  );
  const displayIds = sampled.map((s) => s.id);
  await prisma.prediction_groups.update({
    where: { id: group.id },
    data: { display_question_ids: displayIds as unknown as Prisma.InputJsonValue },
  });

  return { groupId: group.id };
}
