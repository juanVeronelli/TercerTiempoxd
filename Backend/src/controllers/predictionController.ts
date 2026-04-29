import type { Request, Response } from "express";
import * as PredictionService from "../services/PredictionService.js";
import { sendError } from "../utils/httpErrors.js";
import { validateBody } from "../utils/validate.js";
import { z } from "zod";
import { createLogger } from "../utils/logger.js";

const log = createLogger("predictionController");

const submitBodySchema = z.object({
  questionId: z.string().uuid(),
  optionId: z.string().uuid(),
});

const removeBodySchema = z.object({
  questionId: z.string().uuid(),
});

export const getLeaguePredictions = async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string;
    const userId = req.user?.userId;

    if (!leagueId) {
      return sendError(res, 400, { error: "Falta leagueId." });
    }
    if (!userId) {
      return sendError(res, 401, { error: "Usuario no autenticado." });
    }

    const data = await PredictionService.getActiveGroupsByLeague(
      leagueId,
      userId,
    );
    return res.json(data);
  } catch (error) {
    log.errorWithErr("getLeaguePredictions failed", error, { leagueId: req.params.leagueId, userId: req.user?.userId });
    return sendError(res, 500, { error: "Error al cargar las predicciones de la liga." });
  }
};

export const submitPrediction = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return sendError(res, 401, { error: "Usuario no autenticado." });
    }
    const parsed = validateBody(req, submitBodySchema);
    if (!parsed.ok) {
      return sendError(res, 400, { error: "INVALID_BODY", details: parsed.details });
    }

    const result = await PredictionService.submitPrediction(
      userId,
      parsed.data.questionId,
      parsed.data.optionId,
    );

    if (!result.success) {
      return sendError(res, 400, { error: result.error ?? "Error al enviar." });
    }

    return res.json({ message: "Predicción registrada.", success: true });
  } catch (error) {
    log.errorWithErr("submitPrediction failed", error, { userId: req.user?.userId });
    return sendError(res, 500, { error: "Error al guardar la predicción." });
  }
};

export const removePrediction = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return sendError(res, 401, { error: "Usuario no autenticado." });
    }
    const parsed = validateBody(req, removeBodySchema);
    if (!parsed.ok) {
      return sendError(res, 400, { error: "INVALID_BODY", details: parsed.details });
    }

    const result = await PredictionService.removePrediction(userId, parsed.data.questionId);
    if (!result.success) {
      return sendError(res, 400, { error: result.error ?? "Error al eliminar." });
    }
    return res.json({ message: "Predicción eliminada.", success: true });
  } catch (error) {
    log.errorWithErr("removePrediction failed", error, { userId: req.user?.userId });
    return sendError(res, 500, { error: "Error al eliminar la predicción." });
  }
};
