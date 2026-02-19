import cron from "node-cron";
import { prisma } from "./server.js";
import { sendNotification } from "./services/NotificationService.js";

const ONE_HOUR_MS = 60 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000; // 15 min window: notificar si el evento es en 45–75 min

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
      status: { in: ["OPEN", "ACTIVE"] },
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
          console.error("[scheduler] REMINDER_CONFIRM failed:", err),
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
        console.error("[scheduler] PREDICTION_DEADLINE failed:", err),
      );
    }
  }

}

/**
 * Ejecuta todos los jobs programados (cada hora en el minuto 0).
 */
async function runScheduledJobs(): Promise<void> {
  try {
    await runReminderConfirm();
    await runPredictionDeadline();
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P1001") {
      console.warn("[scheduler] DB no alcanzable (sin red / PC dormido). Se reintentará en la próxima hora.");
      return;
    }
    console.error("[scheduler] Error en jobs:", err);
  }
}

export function startScheduler(): void {
  const task = cron.schedule("0 * * * *", runScheduledJobs);
  // Si se perdió una ejecución (o varias), ejecutar UNA sola vez al recuperar
  let recoveryTimeout: ReturnType<typeof setTimeout> | null = null;
  task.on("execution:missed", () => {
    if (recoveryTimeout) return;
    recoveryTimeout = setTimeout(() => {
      recoveryTimeout = null;
      runScheduledJobs().catch(() => {});
    }, 500);
  });
}
