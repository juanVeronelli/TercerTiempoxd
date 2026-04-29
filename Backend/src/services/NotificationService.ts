import { prisma } from "../server.js";
import { sendNotificationWithDb, type NotificationType } from "./notificationCore.js";

export type { NotificationType };

/**
 * Envía una notificación unificada (usa prisma del servidor).
 * Para workers, usar sendNotificationWithDb desde notificationCore.
 */
export async function sendNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<{ id: string; created_at: Date }> {
  return sendNotificationWithDb(prisma, userId, type, title, body, data);
}
