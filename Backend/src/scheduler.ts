import cron from "node-cron";
import { prisma } from "./server.js";
import { sendNotification } from "./services/NotificationService.js";
import { ensureMonthlyPredictionGroupForLeague, processMonthlyPredictionGroup } from "./services/PredictionService.js";
import { runScheduledMatchRulesForToday } from "./services/ScheduledMatchRuleService.js";
import { createLogger } from "./utils/logger.js";
import { MatchStatus } from "./constants/domain.js";

const ONE_HOUR_MS = 60 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000; // 15 min window: notificar si el evento es en 45–75 min
const log = createLogger("scheduler");

/**
 * Cada hora: partidos que empiezan en ~1h y jugadores que no confirmaron.
 */
async function runReminderConfirm(): Promise<void> {
  const now = new Date();
  const from = new Date(now.getTime() + ONE_HOUR_MS - WINDOW_MS);
  const to = new Date(now.getTime() + ONE_HOUR_MS + WINDOW_MS);

  const matches = await prisma.matches.findMany({
    where: {
      date_time: { gte: from, lte: to },
      status: { in: [MatchStatus.OPEN, MatchStatus.ACTIVE] },
    },
    select: {
      id: true,
      location_name: true,
      date_time: true,
      league_id: true,
      match_players: {
        where: { has_confirmed: false },
        select: { user_id: true },
      },
    },
  });

  for (const match of matches) {
    const location = match.location_name ?? "Partido";
    const dateStr = match.date_time.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const title = "Falta 1 hora";
    const body = `${location} a las ${dateStr}. Confirmá tu asistencia.`;
    const data = { matchId: match.id, leagueId: match.league_id ?? undefined };

    for (const mp of match.match_players) {
      if (mp.user_id) {
        sendNotification(mp.user_id, "REMINDER_CONFIRM", title, body, data).catch((err) =>
          log.errorWithErr("REMINDER_CONFIRM failed", err, { userId: mp.user_id, matchId: match.id }),
        );
      }
    }
  }

}

/**
 * Cada hora: predicciones que cierran en ~1h y usuarios que no votaron.
 */
async function runPredictionDeadline(): Promise<void> {
  const now = new Date();
  const from = new Date(now.getTime() + ONE_HOUR_MS - WINDOW_MS);
  const to = new Date(now.getTime() + ONE_HOUR_MS + WINDOW_MS);

  const groups = await prisma.prediction_groups.findMany({
    where: { closes_at: { gte: from, lte: to } },
    select: {
      id: true,
      league_id: true,
      match_id: true,
      closes_at: true,
      prediction_questions: { select: { id: true } },
    },
  });

  for (const group of groups) {
    let eligibleUserIds: string[] = [];

    if (group.match_id) {
      const players = await prisma.match_players.findMany({
        where: { match_id: group.match_id },
        select: { user_id: true },
      });
      eligibleUserIds = players.map((p) => p.user_id);
    } else {
      const members = await prisma.league_members.findMany({
        where: { league_id: group.league_id },
        select: { user_id: true },
      });
      eligibleUserIds = members.map((m) => m.user_id);
    }

    const questionIds = group.prediction_questions.map((q) => q.id);
    if (questionIds.length === 0) continue;

    const whoVoted = await prisma.user_predictions.findMany({
      where: { question_id: { in: questionIds } },
      select: { user_id: true },
    });
    const votedSet = new Set(whoVoted.map((v) => v.user_id));
    const notVoted = eligibleUserIds.filter((uid) => !votedSet.has(uid));

    const closeStr = group.closes_at.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const title = "Cierra pronto";
    const body = `Las predicciones cierran a las ${closeStr}. No te quedes sin votar.`;
    const data = {
      predictionGroupId: group.id,
      leagueId: group.league_id,
      matchId: group.match_id ?? undefined,
    };

    for (const userId of notVoted) {
      sendNotification(userId, "PREDICTION_DEADLINE", title, body, data).catch((err) =>
        log.errorWithErr("PREDICTION_DEADLINE failed", err, { userId, leagueId: group.league_id, predictionGroupId: group.id }),
      );
    }
  }

}

/**
 * Cada minuto: abrir partido automáticamente cuando llega la hora.
 * OPEN -> ACTIVE al alcanzar date_time.
 */
async function runMatchStatusTransitions(): Promise<void> {
  const now = new Date();
  // Evitar updates gigantes: sólo transicionar OPEN -> ACTIVE.
  const result = await prisma.matches.updateMany({
    where: {
      status: MatchStatus.OPEN,
      date_time: { lte: now },
    },
    data: { status: MatchStatus.ACTIVE },
  });

  if (result.count > 0) {
    log.info("OPEN->ACTIVE matches actualizados", { count: result.count });
  }
}

/**
 * Ejecuta todos los jobs programados (cada hora en el minuto 0).
 */
async function runScheduledJobs(): Promise<void> {
  try {
    await runReminderConfirm();
    await runPredictionDeadline();
    await ensureMonthlyPredictionsOpened();
    await runScheduledMatchRulesForToday();
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P1001") {
      log.warn("DB no alcanzable (sin red / PC dormido). Se reintentará en la próxima hora.");
      return;
    }
    log.errorWithErr("Error en jobs", err);
  }
}

/**
 * Diario: asegurar que exista el grupo MONTHLY del mes para cada liga.
 * (Se crea si falta; ventana de voto 1->10 del mes.)
 */
async function ensureMonthlyPredictionsOpened(): Promise<void> {
  const leagues = await prisma.leagues.findMany({ select: { id: true } });
  for (const l of leagues) {
    try {
      await ensureMonthlyPredictionGroupForLeague(l.id);
    } catch (err) {
      log.errorWithErr("ensureMonthlyPredictionGroupForLeague failed", err, { leagueId: l.id });
    }
  }
}

/**
 * Liquidar premios del prode mensual SOLO cuando arranca un nuevo mes.
 * Regla negocio: se otorgan el día 1 del mes siguiente.
 */
async function processClosedMonthlyPredictions(): Promise<void> {
  const today = new Date();
  if (today.getDate() !== 1) return;

  const now = new Date();
  const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevPeriodKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const closedGroups = await prisma.prediction_groups.findMany({
    where: {
      type: "MONTHLY",
      match_id: null,
      period_key: prevPeriodKey,
      closes_at: { lt: now },
      monthly_settled_at: null,
    },
    select: { league_id: true, period_key: true },
  });
  for (const g of closedGroups) {
    if (!g.league_id || !g.period_key) continue;
    try {
      await prisma.$transaction((tx) =>
        processMonthlyPredictionGroup(g.league_id!, g.period_key!, tx),
      );
    } catch (err) {
      log.errorWithErr("processClosedMonthlyPredictions failed", err, { leagueId: g.league_id, periodKey: g.period_key });
    }
  }
}

export function startScheduler(): void {
  const hourlyTask = cron.schedule("0 * * * *", runScheduledJobs);
  // Diario 00:05: asegura grupos mensuales (idempotente) y, si es día 1, liquida el mes anterior.
  cron.schedule("5 0 * * *", async () => {
    try {
      await ensureMonthlyPredictionsOpened();
      await processClosedMonthlyPredictions();
    } catch (err) {
      log.errorWithErr("ensureMonthlyPredictionsOpened daily failed", err);
    }
  });
  const minuteTask = cron.schedule("* * * * *", async () => {
    try {
      await runMatchStatusTransitions();
    } catch (err) {
      log.errorWithErr("Error en transiciones de match", err);
    }
  });
  // Si se perdió una ejecución (o varias), ejecutar UNA sola vez al recuperar
  let recoveryTimeout: ReturnType<typeof setTimeout> | null = null;
  hourlyTask.on("execution:missed", () => {
    if (recoveryTimeout) return;
    recoveryTimeout = setTimeout(() => {
      recoveryTimeout = null;
      runScheduledJobs().catch(() => {});
    }, 500);
  });

  // Si se perdió una ejecución del job de minuto, ejecutar una vez al recuperar.
  minuteTask.on("execution:missed", () => {
    runMatchStatusTransitions().catch(() => {});
  });
}
