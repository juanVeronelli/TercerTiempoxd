import type { Prisma } from "../generated/client/index.js";
import type { PrismaClient } from "../generated/client/index.js";
import { sendNotificationWithDb } from "./notificationCore.js";

export type TxClient = Prisma.TransactionClient;
/** DB client para uso en main thread o worker (evita importar server en worker). */
export type DbClient = TxClient | InstanceType<typeof PrismaClient>;

/** Stats del jugador en el partido recién terminado */
export interface PlayerMatchStats {
  overall: number;
  pace: number;
  defense: number;
  technique: number;
  physical: number;
  attack: number;
}

/** Datos del partido para evaluar logros */
export interface MatchAchievementData {
  matchId: string;
  leagueId: string;
  userId: string;
  playerStats: PlayerMatchStats;
  team: string | null; // "A" | "B" | "UNASSIGNED"
  teamAScore: number;
  teamBScore: number;
  isMvp: boolean;
  isTronco: boolean;
  isFantasma: boolean;
  isDuelWinner: boolean;
  hasConfirmed: boolean;
}

type EvaluatorContext = {
  prisma: DbClient;
  userId: string;
  leagueId: string;
  matchData: MatchAchievementData;
};

const toNum = (v: unknown): number => (v != null ? Number(v) : 0);

function cap10(n: number): number {
  return Math.min(10, Math.max(0, n));
}

// ---------------------------------------------------------------------------
// Evaluadores por condition_type
// ---------------------------------------------------------------------------

async function evalMatchesPlayed(
  target: number,
  ctx: EvaluatorContext,
): Promise<{ met: boolean; progress: number }> {
  const count = await ctx.prisma.match_players.count({
    where: {
      user_id: ctx.userId,
      matches: { league_id: ctx.leagueId, status: "COMPLETED" },
    },
  });
  return { met: count >= target, progress: count };
}

async function evalMatchesWon(
  target: number,
  ctx: EvaluatorContext,
): Promise<{ met: boolean; progress: number }> {
  const matches = await ctx.prisma.match_players.findMany({
    where: {
      user_id: ctx.userId,
      matches: { league_id: ctx.leagueId, status: "COMPLETED" },
    },
    include: { matches: { select: { team_a_score: true, team_b_score: true } } },
  });
  let wins = 0;
  for (const mp of matches) {
    const m = mp.matches;
    const scoreA = toNum(m?.team_a_score);
    const scoreB = toNum(m?.team_b_score);
    const isWinner =
      (mp.team === "A" && scoreA > scoreB) || (mp.team === "B" && scoreB > scoreA);
    if (isWinner) wins++;
  }
  return { met: wins >= target, progress: wins };
}

async function evalWinStreak(
  target: number,
  ctx: EvaluatorContext,
): Promise<{ met: boolean; progress: number }> {
  const matches = await ctx.prisma.match_players.findMany({
    where: {
      user_id: ctx.userId,
      matches: { league_id: ctx.leagueId, status: "COMPLETED" },
    },
    include: { matches: { select: { team_a_score: true, team_b_score: true, date_time: true } } },
    orderBy: { matches: { date_time: "desc" } },
  });
  let streak = 0;
  for (const mp of matches) {
    const m = mp.matches;
    const scoreA = toNum(m?.team_a_score);
    const scoreB = toNum(m?.team_b_score);
    const isWinner =
      (mp.team === "A" && scoreA > scoreB) || (mp.team === "B" && scoreB > scoreA);
    if (isWinner) streak++;
    else break;
  }
  return { met: streak >= target, progress: streak };
}

async function evalLossStreak(
  target: number,
  ctx: EvaluatorContext,
): Promise<{ met: boolean; progress: number }> {
  const matches = await ctx.prisma.match_players.findMany({
    where: {
      user_id: ctx.userId,
      matches: { league_id: ctx.leagueId, status: "COMPLETED" },
    },
    include: { matches: { select: { team_a_score: true, team_b_score: true, date_time: true } } },
    orderBy: { matches: { date_time: "desc" } },
  });
  let streak = 0;
  for (const mp of matches) {
    const m = mp.matches;
    const scoreA = toNum(m?.team_a_score);
    const scoreB = toNum(m?.team_b_score);
    const isDraw = scoreA === scoreB;
    const isWinner =
      (mp.team === "A" && scoreA > scoreB) || (mp.team === "B" && scoreB > scoreA);
    if (isDraw || isWinner) break;
    streak++;
  }
  return { met: streak >= target, progress: streak };
}

async function evalMvpCount(
  target: number,
  ctx: EvaluatorContext,
): Promise<{ met: boolean; progress: number }> {
  const member = await ctx.prisma.league_members.findUnique({
    where: {
      league_id_user_id: { league_id: ctx.leagueId, user_id: ctx.userId },
    },
  });
  const count = toNum(member?.honors_mvp);
  return { met: count >= target, progress: count };
}

async function evalTroncoCount(
  target: number,
  ctx: EvaluatorContext,
): Promise<{ met: boolean; progress: number }> {
  const member = await ctx.prisma.league_members.findUnique({
    where: {
      league_id_user_id: { league_id: ctx.leagueId, user_id: ctx.userId },
    },
  });
  const count = toNum(member?.honors_tronco);
  return { met: count >= target, progress: count };
}

async function evalFantasmaCount(
  target: number,
  ctx: EvaluatorContext,
): Promise<{ met: boolean; progress: number }> {
  const member = await ctx.prisma.league_members.findUnique({
    where: {
      league_id_user_id: { league_id: ctx.leagueId, user_id: ctx.userId },
    },
  });
  const count = toNum(member?.honors_fantasma);
  return { met: count >= target, progress: count };
}

async function evalDuelWins(
  target: number,
  ctx: EvaluatorContext,
): Promise<{ met: boolean; progress: number }> {
  const member = await ctx.prisma.league_members.findUnique({
    where: {
      league_id_user_id: { league_id: ctx.leagueId, user_id: ctx.userId },
    },
  });
  const count = toNum(member?.honors_duel);
  return { met: count >= target, progress: count };
}

async function evalMatchesOrganized(
  target: number,
  ctx: EvaluatorContext,
): Promise<{ met: boolean; progress: number }> {
  const count = await ctx.prisma.matches.count({
    where: { admin_id: ctx.userId, status: "COMPLETED" },
  });
  return { met: count >= target, progress: count };
}

async function evalVotesCast(
  target: number,
  ctx: EvaluatorContext,
): Promise<{ met: boolean; progress: number }> {
  const distinct = await ctx.prisma.match_votes.groupBy({
    by: ["match_id"],
    where: { voter_id: ctx.userId },
  });
  const count = distinct.length;
  return { met: count >= target, progress: count };
}

async function evalPredictionCorrect(
  target: number,
  ctx: EvaluatorContext,
): Promise<{ met: boolean; progress: number }> {
  const total = await ctx.prisma.user_predictions.count({
    where: {
      user_id: ctx.userId,
      prediction_options: { is_correct: true },
    },
  });
  return { met: total >= target, progress: total };
}

async function evalCleanSheetCount(
  target: number,
  ctx: EvaluatorContext,
): Promise<{ met: boolean; progress: number }> {
  const matches = await ctx.prisma.match_players.findMany({
    where: {
      user_id: ctx.userId,
      matches: { league_id: ctx.leagueId, status: "COMPLETED" },
    },
    include: { matches: { select: { team_a_score: true, team_b_score: true } } },
  });
  let count = 0;
  for (const mp of matches) {
    const m = mp.matches;
    const scoreA = toNum(m?.team_a_score);
    const scoreB = toNum(m?.team_b_score);
    const cleanSheet =
      (mp.team === "A" && scoreB === 0) || (mp.team === "B" && scoreA === 0);
    if (cleanSheet) count++;
  }
  return { met: count >= target, progress: count };
}

async function evalTroncoThenMvp(
  _target: number,
  ctx: EvaluatorContext,
): Promise<{ met: boolean; progress: number }> {
  if (!ctx.matchData.isMvp) return { met: false, progress: 0 };
  const prevMatch = await ctx.prisma.honors.findFirst({
    where: {
      user_id: ctx.userId,
      honor_type: "TRONCO",
      match_id: { not: ctx.matchData.matchId },
      matches: { league_id: ctx.leagueId, status: "COMPLETED" },
    },
    orderBy: { matches: { date_time: "desc" } },
    include: { matches: { select: { date_time: true } } },
  });
  const thisMatch = await ctx.prisma.matches.findUnique({
    where: { id: ctx.matchData.matchId },
    select: { date_time: true },
  });
  if (!prevMatch?.matches || !thisMatch) return { met: false, progress: 0 };
  if (prevMatch.matches.date_time >= thisMatch.date_time) return { met: false, progress: 0 };
  const matchesBetween = await ctx.prisma.match_players.count({
    where: {
      user_id: ctx.userId,
      matches: {
        league_id: ctx.leagueId,
        status: "COMPLETED",
        date_time: { gt: prevMatch.matches.date_time, lte: thisMatch.date_time },
      },
    },
  });
  return { met: matchesBetween === 1, progress: matchesBetween === 1 ? 1 : 0 };
}

async function evalSamePartnerWins(
  target: number,
  ctx: EvaluatorContext,
): Promise<{ met: boolean; progress: number }> {
  const myMatches = await ctx.prisma.match_players.findMany({
    where: {
      user_id: ctx.userId,
      matches: { league_id: ctx.leagueId, status: "COMPLETED" },
    },
    include: {
      matches: {
        select: {
          team_a_score: true,
          team_b_score: true,
          match_players: {
            where: { user_id: { not: ctx.userId } },
            select: { user_id: true, team: true },
          },
        },
      },
    },
  });
  const partnerWins = new Map<string, number>();
  for (const mp of myMatches) {
    const m = mp.matches as any;
    const scoreA = toNum(m?.team_a_score);
    const scoreB = toNum(m?.team_b_score);
    const isWinner =
      (mp.team === "A" && scoreA > scoreB) || (mp.team === "B" && scoreB > scoreA);
    if (!isWinner) continue;
    const teammates = m?.match_players ?? [];
    for (const t of teammates) {
      const pid = t.user_id;
      if (pid) partnerWins.set(pid, (partnerWins.get(pid) ?? 0) + 1);
    }
  }
  const maxWins = Math.max(0, ...partnerWins.values());
  return { met: maxWins >= target, progress: maxWins };
}

async function evalWeeksActiveStreak(
  target: number,
  ctx: EvaluatorContext,
): Promise<{ met: boolean; progress: number }> {
  const matches = await ctx.prisma.match_players.findMany({
    where: {
      user_id: ctx.userId,
      matches: { league_id: ctx.leagueId, status: "COMPLETED" },
    },
    select: { matches: { select: { date_time: true } } },
    orderBy: { matches: { date_time: "desc" } },
  });
  const weekKeys = new Set<string>();
  for (const mp of matches) {
    const d = (mp.matches as any)?.date_time;
    if (!d) continue;
    const date = new Date(d);
    const y = date.getFullYear();
    const w = getWeekNumber(date);
    weekKeys.add(`${y}-W${w}`);
  }
  const sorted = [...weekKeys].sort().reverse();
  let streak = 0;
  const now = new Date();
  let check = getWeekKey(now);
  for (let i = 0; i < target; i++) {
    if (sorted.includes(check)) {
      streak++;
      check = prevWeekKey(check);
    } else break;
  }
  return { met: streak >= target, progress: streak };
}

function getWeekNumber(d: Date): number {
  const first = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - first.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + first.getDay() + 1) / 7);
}

function getWeekKey(d: Date): string {
  return `${d.getFullYear()}-W${getWeekNumber(d)}`;
}

function prevWeekKey(key: string): string {
  const parts = key.split("-W").map(Number);
  const y = parts[0] ?? 0;
  const w = parts[1] ?? 1;
  if (w <= 1) return `${y - 1}-W52`;
  return `${y}-W${w - 1}`;
}

async function evalLeagueRankReached(
  target: number,
  ctx: EvaluatorContext,
): Promise<{ met: boolean; progress: number }> {
  const members = await ctx.prisma.league_members.findMany({
    where: { league_id: ctx.leagueId },
    include: {
      users: {
        select: {
          id: true,
          match_players: {
            where: {
              matches: { league_id: ctx.leagueId, status: "COMPLETED" },
            },
            select: { match_rating: true },
          },
        },
      },
    },
  });
  const ranking = members
    .map((m) => {
      const mps = (m.users as any)?.match_players ?? [];
      const avg =
        mps.length > 0
          ? mps.reduce((s: number, mp: any) => s + Number(mp.match_rating || 0), 0) / mps.length
          : 0;
      return { userId: m.user_id, avg };
    })
    .sort((a, b) => b.avg - a.avg);
  const rank = ranking.findIndex((r) => r.userId === ctx.userId) + 1;
  return { met: rank > 0 && rank <= target, progress: rank > 0 ? rank : 999 };
}

async function evalAvgRatingOverMatches(
  target: number,
  ctx: EvaluatorContext,
): Promise<{ met: boolean; progress: number }> {
  const matches = await ctx.prisma.match_players.findMany({
    where: {
      user_id: ctx.userId,
      matches: { league_id: ctx.leagueId, status: "COMPLETED" },
    },
    orderBy: { matches: { date_time: "desc" } },
    take: 20,
    include: { matches: { select: { date_time: true } } },
  });
  if (matches.length < 5) return { met: false, progress: 0 };
  const last5 = matches.slice(0, 5);
  const avg =
    last5.reduce((s, mp) => s + Number(mp.match_rating || 0), 0) / last5.length;
  return { met: avg >= target, progress: Math.round(avg * 100) / 100 };
}

async function evalMatchesConfirmed(
  target: number,
  ctx: EvaluatorContext,
): Promise<{ met: boolean; progress: number }> {
  const count = await ctx.prisma.match_players.count({
    where: {
      user_id: ctx.userId,
      has_confirmed: true,
      matches: { league_id: ctx.leagueId, status: "COMPLETED" },
    },
  });
  return { met: count >= target, progress: count };
}

async function evalAchievementsUnlocked(
  target: number,
  ctx: EvaluatorContext,
): Promise<{ met: boolean; progress: number }> {
  const count = await ctx.prisma.user_achievements.count({
    where: { user_id: ctx.userId, is_completed: true },
  });
  return { met: count >= target, progress: count };
}

async function evalCosmeticAchievementsClaimed(
  target: number,
  ctx: EvaluatorContext,
): Promise<{ met: boolean; progress: number }> {
  const count = await ctx.prisma.user_achievements.count({
    where: {
      user_id: ctx.userId,
      is_completed: true,
      claimed_at: { not: null },
      achievements: { reward_type: "COSMETIC" },
    },
  });
  return { met: count >= target, progress: count };
}

async function evalMatchesNoFantasmaStreak(
  target: number,
  ctx: EvaluatorContext,
): Promise<{ met: boolean; progress: number }> {
  const honors = await ctx.prisma.honors.findMany({
    where: { user_id: ctx.userId, honor_type: "FANTASMA" },
    include: { matches: { select: { league_id: true, date_time: true } } },
  });
  const fantasmaDates = honors
    .filter((h) => (h.matches as any)?.league_id === ctx.leagueId)
    .map((h) => new Date((h.matches as any)?.date_time ?? 0))
    .sort((a, b) => b.getTime() - a.getTime());

  const matches = await ctx.prisma.match_players.findMany({
    where: {
      user_id: ctx.userId,
      matches: { league_id: ctx.leagueId, status: "COMPLETED" },
    },
    orderBy: { matches: { date_time: "desc" } },
    include: { matches: { select: { date_time: true } } },
  });
  let streak = 0;
  for (const mp of matches) {
    const m = (mp as any).matches;
    const d = m?.date_time ? new Date(m.date_time) : null;
    if (!d) continue;
    const wasFantasma = fantasmaDates.some(
      (fd) => Math.abs(fd.getTime() - d.getTime()) < 24 * 60 * 60 * 1000,
    );
    if (wasFantasma) break;
    streak++;
  }
  return { met: streak >= target, progress: streak };
}

// Stats en un solo partido (este partido)
function evalDefenseSingle(target: number, ctx: EvaluatorContext): { met: boolean; progress: number } {
  const v = ctx.matchData.playerStats.defense;
  return { met: v >= target, progress: v };
}

function evalAttackSingle(target: number, ctx: EvaluatorContext): { met: boolean; progress: number } {
  const v = ctx.matchData.playerStats.attack;
  return { met: v >= target, progress: v };
}

function evalPaceSingle(target: number, ctx: EvaluatorContext): { met: boolean; progress: number } {
  const v = ctx.matchData.playerStats.pace;
  return { met: v >= target, progress: v };
}

function evalTechniqueSingle(target: number, ctx: EvaluatorContext): { met: boolean; progress: number } {
  const v = ctx.matchData.playerStats.technique;
  return { met: v >= target, progress: v };
}

function evalPhysicalSingle(target: number, ctx: EvaluatorContext): { met: boolean; progress: number } {
  const v = ctx.matchData.playerStats.physical;
  return { met: v >= target, progress: v };
}

function evalOverallSingle(target: number, ctx: EvaluatorContext): { met: boolean; progress: number } {
  const v = ctx.matchData.playerStats.overall;
  return { met: v >= target, progress: v };
}

function evalMultiStat8Single(target: number, ctx: EvaluatorContext): { met: boolean; progress: number } {
  const s = ctx.matchData.playerStats;
  const stats = [s.defense, s.attack, s.pace, s.technique, s.physical];
  const count = stats.filter((x) => x >= 8).length;
  return { met: count >= target, progress: count };
}

function evalComebackWin(_target: number, ctx: EvaluatorContext): { met: boolean; progress: number } {
  const { team, teamAScore, teamBScore } = ctx.matchData;
  const userWon =
    (team === "A" && teamAScore > teamBScore) || (team === "B" && teamBScore > teamAScore);
  if (!userWon) return { met: false, progress: 0 };
  return { met: true, progress: 1 };
}

async function evalRankOvertake(
  _target: number,
  ctx: EvaluatorContext,
): Promise<{ met: boolean; progress: number }> {
  return { met: false, progress: 0 };
}

// ---------------------------------------------------------------------------
// Router de evaluadores
// ---------------------------------------------------------------------------

const EVALUATORS: Record<
  string,
  (target: number, ctx: EvaluatorContext) => Promise<{ met: boolean; progress: number }> | { met: boolean; progress: number }
> = {
  MATCHES_PLAYED: evalMatchesPlayed,
  MATCHES_WON: evalMatchesWon,
  WIN_STREAK: evalWinStreak,
  LOSS_STREAK: evalLossStreak,
  MVP_COUNT: evalMvpCount,
  TRONCO_COUNT: evalTroncoCount,
  FANTASMA_COUNT: evalFantasmaCount,
  DUEL_WINS: evalDuelWins,
  MATCHES_ORGANIZED: evalMatchesOrganized,
  VOTES_CAST: evalVotesCast,
  PREDICTION_CORRECT: evalPredictionCorrect,
  CLEAN_SHEET_COUNT: evalCleanSheetCount,
  TRONCO_THEN_MVP: evalTroncoThenMvp,
  SAME_PARTNER_WINS: evalSamePartnerWins,
  WEEKS_ACTIVE_STREAK: evalWeeksActiveStreak,
  LEAGUE_RANK_REACHED: evalLeagueRankReached,
  AVG_RATING_OVER_MATCHES: evalAvgRatingOverMatches,
  MATCHES_CONFIRMED: evalMatchesConfirmed,
  ACHIEVEMENTS_UNLOCKED: evalAchievementsUnlocked,
  COSMETIC_ACHIEVEMENTS_CLAIMED: evalCosmeticAchievementsClaimed,
  MATCHES_NO_FANTASMA_STREAK: evalMatchesNoFantasmaStreak,
  DEFENSE_SINGLE: (t, c) => evalDefenseSingle(t, c),
  ATTACK_SINGLE: (t, c) => evalAttackSingle(t, c),
  PACE_SINGLE: (t, c) => evalPaceSingle(t, c),
  TECHNIQUE_SINGLE: (t, c) => evalTechniqueSingle(t, c),
  PHYSICAL_SINGLE: (t, c) => evalPhysicalSingle(t, c),
  OVERALL_SINGLE: (t, c) => evalOverallSingle(t, c),
  MULTI_STAT_8_SINGLE: (t, c) => evalMultiStat8Single(t, c),
  COMEBACK_WIN: (t, c) => evalComebackWin(t, c),
  RANK_OVERTAKE: evalRankOvertake,
};

// ---------------------------------------------------------------------------
// Aplicar recompensas
// ---------------------------------------------------------------------------

async function applyStatBoost(
  userId: string,
  _leagueId: string,
  rewardValue: Record<string, number>,
  tx: DbClient,
): Promise<void> {
  // Las misiones que dan STAT_BOOST son globales (no por liga).
  // Para evitar inconsistencias, aplicamos el boost a TODAS las ligas donde juega el usuario.
  const members = await tx.league_members.findMany({
    where: { user_id: userId },
  });
  if (!members.length) return;

  for (const member of members) {
    const updates: Record<string, number> = {};
    if (rewardValue.league_overall != null) {
      updates.league_overall = cap10(
        toNum(member.league_overall) + rewardValue.league_overall,
      );
    }
    if (rewardValue.pace != null) {
      updates.avg_pace = cap10(toNum(member.avg_pace) + rewardValue.pace);
    }
    if (rewardValue.defense != null) {
      updates.avg_defense = cap10(
        toNum(member.avg_defense) + rewardValue.defense,
      );
    }
    if (rewardValue.attack != null) {
      updates.avg_attack = cap10(toNum(member.avg_attack) + rewardValue.attack);
    }
    if (rewardValue.technique != null) {
      updates.avg_technique = cap10(
        toNum(member.avg_technique) + rewardValue.technique,
      );
    }
    if (rewardValue.physical != null) {
      updates.avg_physical = cap10(
        toNum(member.avg_physical) + rewardValue.physical,
      );
    }
    if (Object.keys(updates).length === 0) continue;

    await tx.league_members.update({
      where: {
        league_id_user_id: {
          league_id: member.league_id,
          user_id: userId,
        },
      },
      data: updates as any,
    });
  }
}

async function applyCosmetic(
  userId: string,
  achievementId: string,
  rewardValue: any,
  isPro: boolean,
  tx: DbClient,
): Promise<void> {
  const key = rewardValue?.cosmetic_key ?? rewardValue;
  const type = (rewardValue?.cosmetic_type ?? "FRAME") as string;
  if (!key || typeof key !== "string") return;
  // PRO recibe todos los cosméticos; usuarios FREE solo reciben tipo SHOWCASE (slots de vitrina)
  if (!isPro && type !== "SHOWCASE") return;
  await tx.user_cosmetics.upsert({
    where: {
      user_id_cosmetic_key: { user_id: userId, cosmetic_key: key },
    },
    create: {
      user_id: userId,
      cosmetic_key: key,
      cosmetic_type: type,
      source_achievement_id: achievementId,
    },
    update: {},
  });
}

// ---------------------------------------------------------------------------
// Función principal: checkMatchAchievements
// ---------------------------------------------------------------------------

export async function checkMatchAchievements(
  userId: string,
  matchData: MatchAchievementData,
  db: DbClient,
): Promise<{ completed: string[] }> {
  const completed: string[] = [];
  const user = await db.users.findUnique({
    where: { id: userId },
    select: { plan_type: true },
  });
  const isPro = user?.plan_type === "PRO";

  const achievements = await db.achievements.findMany({
    orderBy: { sort_order: "asc" },
  });
  if (achievements.length === 0) {
    console.warn("[Achievements] No hay logros en la base de datos. Ejecutá: npx prisma db seed");
  }

  const ctx: EvaluatorContext = { prisma: db, userId, leagueId: matchData.leagueId, matchData };

  for (const ach of achievements) {
    let ua = await db.user_achievements.findUnique({
      where: {
        user_id_achievement_id: { user_id: userId, achievement_id: ach.id },
      },
    });
    if (!ua) {
      ua = await db.user_achievements.create({
        data: {
          user_id: userId,
          achievement_id: ach.id,
          current_progress: 0,
          is_completed: false,
        },
      });
    }
    if (ua.is_completed) continue;

    const evaluator = EVALUATORS[ach.condition_type];
    if (!evaluator) continue;
    const target = Number(ach.condition_value);
    const result = await (async () => {
      const r = evaluator(target, ctx);
      return r instanceof Promise ? r : Promise.resolve(r);
    })();

    // Siempre actualizar current_progress (para que las barritas muestren el avance real)
    await db.user_achievements.update({
      where: { id: ua.id },
      data: {
        current_progress: result.progress,
        ...(result.met && {
          is_completed: true,
          claimed_at: new Date(),
        }),
      },
    });

    if (!result.met) continue;

    const rewardVal = ach.reward_value as Record<string, unknown>;

    // Notificación push: misión desbloqueada → lleva al perfil
    sendNotificationWithDb(
      db as PrismaClient,
      userId,
      "ACHIEVEMENT_UNLOCKED",
      "¡Misión completada!",
      `Desbloqueaste: ${ach.title}`,
      { screen: "profile", achievementTitle: ach.title, leagueId: matchData.leagueId },
    ).catch((err) => console.error("[AchievementService] Error enviando notificación:", err));

    if (ach.reward_type === "STAT_BOOST") {
      await applyStatBoost(userId, matchData.leagueId, rewardVal as Record<string, number>, db);
    } else if (ach.reward_type === "COSMETIC") {
      await applyCosmetic(userId, ach.id, rewardVal, isPro, db);
    }

    completed.push(ach.title);
  }

  return { completed };
}

// ---------------------------------------------------------------------------
// Procesar logros de un partido (usado desde worker o main thread)
// ---------------------------------------------------------------------------

export async function processAchievementsForMatch(
  db: DbClient,
  matchId: string,
): Promise<{ processed: number }> {
  const match = await db.matches.findUnique({
    where: { id: matchId },
    include: {
      match_players: {
        include: { users: { select: { id: true } } },
      },
      honors: { where: { user_id: { not: null } } },
      duels: { where: { status: "COMPLETED" } },
    },
  });
  if (!match || !match.league_id) {
    return { processed: 0 };
  }
  if (match.match_players.length === 0) {
    return { processed: 0 };
  }

  const teamAScore = Number(match.team_a_score ?? 0);
  const teamBScore = Number(match.team_b_score ?? 0);
  const mvpIds = new Set(
    match.honors.filter((h) => h.honor_type === "MVP").map((h) => h.user_id!),
  );
  const troncoIds = new Set(
    match.honors.filter((h) => h.honor_type === "TRONCO").map((h) => h.user_id!),
  );
  const fantasmaIds = new Set(
    match.honors
      .filter((h) => h.honor_type === "FANTASMA")
      .map((h) => h.user_id!),
  );
  const duelWinnerId = match.duels[0]?.winner_id ?? null;

  let processed = 0;
  for (const mp of match.match_players) {
    const userId = mp.user_id;
    const matchData: MatchAchievementData = {
      matchId,
      leagueId: match.league_id,
      userId,
      playerStats: {
        overall: Number(mp.match_rating ?? 0),
        pace: Number(mp.match_pace ?? 0),
        defense: Number(mp.match_defense ?? 0),
        technique: Number(mp.match_technique ?? 0),
        physical: Number(mp.match_physical ?? 0),
        attack: Number(mp.match_attack ?? 0),
      },
      team: mp.team,
      teamAScore,
      teamBScore,
      isMvp: mvpIds.has(userId),
      isTronco: troncoIds.has(userId),
      isFantasma: fantasmaIds.has(userId),
      isDuelWinner: duelWinnerId === userId,
      hasConfirmed: mp.has_confirmed ?? false,
    };
    await checkMatchAchievements(userId, matchData, db);
    processed++;
  }
  return { processed };
}
