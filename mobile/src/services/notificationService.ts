import apiClient from "../api/apiClient";
import type {
  Notification,
  NotificationsListResponse,
  UnreadCountResponse,
} from "../types/notifications";

const BASE = "/notifications";

/**
 * Lista paginada de notificaciones (orden descendente).
 */
export async function getNotifications(
  page: number = 1,
  limit: number = 20,
): Promise<NotificationsListResponse> {
  const { data } = await apiClient.get<NotificationsListResponse>(BASE, {
    params: { page, limit },
  });
  return data;
}

/**
 * Número de notificaciones no leídas (para el badge).
 */
export async function getUnreadCount(): Promise<number> {
  const { data } = await apiClient.get<UnreadCountResponse>(`${BASE}/unread-count`);
  return data.count;
}

/**
 * Marca una notificación como leída.
 */
export async function markAsRead(id: string): Promise<void> {
  await apiClient.patch(`${BASE}/${id}/read`, {});
}

/**
 * Marca todas las notificaciones como leídas.
 */
export async function markAllAsRead(): Promise<{ updated: number }> {
  const { data } = await apiClient.patch<{ message: string; updated: number }>(
    `${BASE}/read-all`,
    {},
  );
  return { updated: data.updated };
}

/**
 * Borra una notificación.
 */
export async function deleteNotification(id: string): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`);
}

/**
 * Borra todas las notificaciones leídas del usuario.
 */
export async function clearReadNotifications(): Promise<{ deleted: number }> {
  const { data } = await apiClient.delete<{ deleted: number }>(`${BASE}/read`);
  return { deleted: data.deleted };
}
