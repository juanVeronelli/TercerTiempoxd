/**
 * Tipos de notificación (alineados con el enum del backend).
 * Usados para navegación y estilo en la app.
 */
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
  | "REMINDER_CONFIRM";

/**
 * Payload opcional para deep link (matchId, leagueId, duelId, etc.).
 */
export interface NotificationData {
  matchId?: string;
  leagueId?: string;
  duelId?: string;
  predictionGroupId?: string;
}

/**
 * Item de notificación tal como viene del API.
 */
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: NotificationData | null;
  is_read: boolean;
  created_at: string;
}

/**
 * Respuesta paginada del GET /notifications.
 */
export interface NotificationsListResponse {
  items: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Respuesta del GET /notifications/unread-count.
 */
export interface UnreadCountResponse {
  count: number;
}
