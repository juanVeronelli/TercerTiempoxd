import type { Request, Response } from "express";
import { prisma } from "../server.js";
import { sendNotification } from "../services/NotificationService.js";
import type { NotificationType } from "../services/NotificationService.js";
import { sendError } from "../utils/httpErrors.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("notificationController");

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * GET /notifications
 * Lista paginada orden descendente (más recientes primero).
 * Query: page (default 1), limit (default 20, max 100).
 */
export const list = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return sendError(res, 401, { error: "No autenticado" });
    }

    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(String(req.query.limit), 10) || DEFAULT_PAGE_SIZE),
    );
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.notifications.findMany({
        where: { user_id: userId },
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          data: true,
          is_read: true,
          created_at: true,
        },
      }),
      prisma.notifications.count({ where: { user_id: userId } }),
    ]);

    return res.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    log.errorWithErr("list failed", error, { userId: req.user?.userId });
    return sendError(res, 500, { error: "Error al listar notificaciones" });
  }
};

/**
 * PATCH /notifications/:id/read
 * Marca una notificación como leída (solo si pertenece al usuario).
 */
export const markRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return sendError(res, 401, { error: "No autenticado" });
    }

    const id = req.params.id as string;
    if (!id) {
      return sendError(res, 400, { error: "Falta id" });
    }

    const updated = await prisma.notifications.updateMany({
      where: { id, user_id: userId },
      data: { is_read: true },
    });

    if (updated.count === 0) {
      return sendError(res, 404, { error: "Notificación no encontrada" });
    }

    return res.json({ message: "Marcada como leída" });
  } catch (error) {
    log.errorWithErr("markRead failed", error, { userId: req.user?.userId, id: req.params.id });
    return sendError(res, 500, { error: "Error al actualizar" });
  }
};

/**
 * PATCH /notifications/read-all
 * Marca todas las notificaciones del usuario como leídas.
 */
export const markAllRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return sendError(res, 401, { error: "No autenticado" });
    }

    const result = await prisma.notifications.updateMany({
      where: { user_id: userId, is_read: false },
      data: { is_read: true },
    });

    return res.json({
      message: "Todas marcadas como leídas",
      updated: result.count,
    });
  } catch (error) {
    log.errorWithErr("markAllRead failed", error, { userId: req.user?.userId });
    return sendError(res, 500, { error: "Error al actualizar" });
  }
};

/**
 * GET /notifications/unread-count
 * Devuelve el número de notificaciones no leídas (para el badge).
 */
export const unreadCount = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return sendError(res, 401, { error: "No autenticado" });
    }

    const count = await prisma.notifications.count({
      where: { user_id: userId, is_read: false },
    });

    return res.json({ count });
  } catch (error) {
    log.errorWithErr("unreadCount failed", error, { userId: req.user?.userId });
    return sendError(res, 500, { error: "Error al contar" });
  }
};

/**
 * DELETE /notifications/:id
 * Borra una notificación (solo si pertenece al usuario).
 */
export const deleteOne = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return sendError(res, 401, { error: "No autenticado" });
    }

    const id = req.params.id as string;
    if (!id) {
      return sendError(res, 400, { error: "Falta id" });
    }

    const deleted = await prisma.notifications.deleteMany({
      where: { id, user_id: userId },
    });

    if (deleted.count === 0) {
      return sendError(res, 404, { error: "Notificación no encontrada" });
    }

    return res.status(204).send();
  } catch (error) {
    log.errorWithErr("deleteOne failed", error, { userId: req.user?.userId, id: req.params.id });
    return sendError(res, 500, { error: "Error al borrar" });
  }
};

/**
 * DELETE /notifications/read
 * Borra todas las notificaciones leídas del usuario.
 */
export const deleteAllRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return sendError(res, 401, { error: "No autenticado" });
    }

    const result = await prisma.notifications.deleteMany({
      where: { user_id: userId, is_read: true },
    });

    return res.json({ deleted: result.count });
  } catch (error) {
    log.errorWithErr("deleteAllRead failed", error, { userId: req.user?.userId });
    return sendError(res, 500, { error: "Error al borrar notificaciones leídas" });
  }
};

const TEST_MATCH_ID = "00000000-0000-0000-0000-000000000001";
const TEST_LEAGUE_ID = "00000000-0000-0000-0000-000000000002";
const TEST_DUEL_ID = "00000000-0000-0000-0000-000000000003";

/**
 * POST /notifications/test-trigger
 * Dispara una notificación de prueba para el usuario actual (mock data).
 * Body: { type: NotificationType }
 */
export const testTrigger = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return sendError(res, 401, { error: "No autenticado" });
    }

    const type = (req.body?.type ?? "") as NotificationType;
    if (!type || typeof type !== "string") {
      return sendError(res, 400, { error: "Falta type en el body" });
    }

    const validTypes: NotificationType[] = [
      "MATCH_SUMMON", "MATCH_UNSUMMON", "MATCH_CANCELLED",
      "MATCH_FINISHED_VOTE", "VOTING_CLOSED_RESULTS", "PREDICTIONS_OPEN",
      "PREDICTION_DEADLINE", "DUEL_PARTICIPANT", "DUEL_RESULT_WIN", "DUEL_RESULT_LOSS",
      "AWARD_MVP", "AWARD_GHOST", "AWARD_TRUNK", "AWARD_ORACLE",
      "RANKING_OVERTAKE", "REMINDER_VOTE", "REMINDER_CONFIRM",
      "ACHIEVEMENT_UNLOCKED",
    ];
    if (!validTypes.includes(type)) {
      return sendError(res, 400, { error: "type inválido" });
    }

    let title: string;
    let body: string;
    let data: Record<string, unknown> = { matchId: TEST_MATCH_ID, leagueId: TEST_LEAGUE_ID };

    switch (type) {
      case "MATCH_SUMMON":
        title = "¡Convocado!";
        body = "Te citaron para el partido vs Los Troncos FC 🪵";
        data = { matchId: TEST_MATCH_ID, leagueId: TEST_LEAGUE_ID };
        break;
      case "MATCH_UNSUMMON":
        title = "Desconvocado";
        body = "Fuiste desconvocado del partido del sábado.";
        break;
      case "MATCH_CANCELLED":
        title = "Partido cancelado";
        body = "El partido del domingo fue cancelado.";
        break;
      case "MATCH_FINISHED_VOTE":
        title = "Final del Partido";
        body = "Entra a votar a tus compañeros ahora.";
        break;
      case "VOTING_CLOSED_RESULTS":
        title = "Resultados listos";
        body = "Las votaciones cerraron. Mirá los resultados.";
        break;
      case "PREDICTIONS_OPEN":
        title = "Predicciones abiertas";
        body = "Ya podés hacer tus predicciones para el próximo partido.";
        break;
      case "PREDICTION_DEADLINE":
        title = "Cierra pronto";
        body = "Las predicciones cierran en 1 hora. No te quedes sin votar.";
        data = { ...data, predictionGroupId: "test-pred-group" };
        break;
      case "DUEL_PARTICIPANT":
        title = "Estás en el duelo";
        body = "Te tocó el duelo esta fecha. ¡Dale con todo!";
        data = { ...data, duelId: TEST_DUEL_ID };
        break;
      case "DUEL_RESULT_WIN":
        title = "Ganaste el duelo";
        body = "La rompiste en el duelo. ¡Felicitaciones!";
        data = { ...data, duelId: TEST_DUEL_ID };
        break;
      case "DUEL_RESULT_LOSS":
        title = "Resultado del duelo";
        body = "Perdiste el duelo esta fecha. La próxima es tuya.";
        data = { ...data, duelId: TEST_DUEL_ID };
        break;
      case "AWARD_MVP":
        title = "🏆 ¡Eres el MVP!";
        body = "La rompiste en el último partido con 8.5 puntos.";
        break;
      case "AWARD_GHOST":
        title = "👻 Premio Fantasma";
        body = "Nadie te vio en la cancha hoy...";
        break;
      case "AWARD_TRUNK":
        title = "🪵 Tronco del partido";
        body = "Te llevaste el tronco. A entrenar más.";
        break;
      case "AWARD_ORACLE":
        title = "🔮 Oracle";
        body = "Acertaste las predicciones. ¡Sos un vidente!";
        break;
      case "RANKING_OVERTAKE":
        title = "🚀 Subiste de Nivel";
        body = "Acabas de superar a Juan en el ranking global.";
        break;
      case "REMINDER_VOTE":
        title = "Solo faltas vos";
        body = "Todos ya votaron. Entrá a dejar tus votos.";
        break;
      case "REMINDER_CONFIRM":
        title = "Confirmá tu asistencia";
        body = "Falta 1 hora para el partido. ¿Vas?";
        break;
      case "ACHIEVEMENT_UNLOCKED":
        title = "¡Misión completada!";
        body = "Desbloqueaste: MVP x3";
        data = { screen: "profile", achievementTitle: "MVP x3", leagueId: TEST_LEAGUE_ID };
        break;
      default:
        title = "Notificación de prueba";
        body = `Tipo: ${type}. Generada desde el Playground.`;
    }

    await sendNotification(userId, type, title, body, data);
    return res.json({ message: "Notificación de prueba enviada", type });
  } catch (error) {
    log.errorWithErr("testTrigger failed", error, { userId: req.user?.userId });
    return sendError(res, 500, { error: "Error al enviar notificación de prueba" });
  }
};
