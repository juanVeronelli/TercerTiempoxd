/**
 * Lógica pura de envío de notificaciones (DB + Push).
 * No importa server, para que pueda usarse desde workers con su propio Prisma.
 */
import type { PrismaClient, Prisma } from "../generated/client/index.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("notificationCore");

export type NotificationType =
  | "MATCH_SUMMON"
  | "MATCH_UNSUMMON"
  | "MATCH_CANCELLED"
  | "MATCH_FINISHED_VOTE"
  | "VOTING_CLOSED_RESULTS"
  | "PREDICTIONS_OPEN"
  | "PREDICTION_DEADLINE"
  | "DUEL_PARTICIPANT"
  | "DUEL_RESULT_WIN"
  | "DUEL_RESULT_LOSS"
  | "AWARD_MVP"
  | "AWARD_GHOST"
  | "AWARD_TRUNK"
  | "AWARD_ORACLE"
  | "RANKING_OVERTAKE"
  | "REMINDER_VOTE"
  | "REMINDER_CONFIRM"
  | "ACHIEVEMENT_UNLOCKED";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/** Mismo id que en la app: `setNotificationChannelAsync("default", ...)` */
const ANDROID_CHANNEL_ID = "default";

/**
 * Envía una notificación usando el Prisma proporcionado (válido para workers).
 */
export async function sendNotificationWithDb(
  db: PrismaClient,
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<{ id: string; created_at: Date }> {
  const record = await db.notifications.create({
    data: {
      user_id: userId,
      type,
      title,
      body,
      data: data != null ? (data as Prisma.InputJsonValue) : undefined,
    },
    select: { id: true, created_at: true },
  });

  // Logros: solo se guardan en DB para la campanita in-app. No se envía push al celular.
  if (type !== "ACHIEVEMENT_UNLOCKED") {
    sendPushIfEligible(db, userId, title, body, data).catch((err) => {
      log.errorWithErr("Push delivery failed", err, { userId, type });
    });
  }

  return record;
}

async function sendPushIfEligible(
  db: PrismaClient,
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const user = await db.users.findUnique({
    where: { id: userId },
    select: { expo_push_token: true, notifications_enabled: true },
  });

  if (!user?.expo_push_token || !user.notifications_enabled) return;

  const token = user.expo_push_token.trim();
  if (!token) return;

  const payload: Record<string, unknown> = {
    to: token,
    title,
    body,
    sound: "default",
    priority: "high",
    // Android: sin channelId coherente con la app, el sistema puede no mostrar la notificación en el centro.
    channelId: ANDROID_CHANNEL_ID,
    ...(data && Object.keys(data).length > 0 && { data }),
  };

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Content-Type": "application/json",
  };
  const accessToken = process.env.EXPO_ACCESS_TOKEN?.trim();
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Expo Push API error ${res.status}: ${text}`);
  }

  const json = (await res.json()) as {
    data?: { status?: string; message?: string } | Array<{ status?: string; message?: string }>;
    errors?: Array<{ code?: string; message?: string }>;
  };

  if (json?.errors?.length) {
    const err = json.errors[0];
    throw new Error(err?.message ?? err?.code ?? "Expo Push API error");
  }

  const tickets = json?.data;
  if (!tickets) return;

  const list = Array.isArray(tickets) ? tickets : [tickets];
  for (const t of list) {
    if (t?.status === "error") {
      const msg = (t as { message?: string }).message ?? "Unknown Expo error";
      throw new Error(`Expo Push ticket error: ${msg}`);
    }
  }
}
