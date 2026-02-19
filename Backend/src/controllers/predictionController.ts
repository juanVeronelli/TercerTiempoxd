import type { Request, Response } from "express";
import * as PredictionService from "../services/PredictionService.js";

export const getLeaguePredictions = async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string;
    const userId = req.user?.userId;

    if (!leagueId) {
      return res.status(400).json({ error: "Falta leagueId." });
    }
    if (!userId) {
      return res.status(401).json({ error: "Usuario no autenticado." });
    }

    const data = await PredictionService.getActiveGroupsByLeague(
      leagueId,
      userId,
    );
    return res.json(data);
  } catch (error) {
    console.error("Error getLeaguePredictions:", error);
    return res
      .status(500)
      .json({ error: "Error al cargar las predicciones de la liga." });
  }
};

export const submitPrediction = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { questionId, optionId } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Usuario no autenticado." });
    }
    if (!questionId || !optionId) {
      return res
        .status(400)
        .json({ error: "Faltan questionId u optionId en el cuerpo." });
    }

    const result = await PredictionService.submitPrediction(
      userId,
      questionId,
      optionId,
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error ?? "Error al enviar." });
    }

    return res.json({ message: "Predicción registrada.", success: true });
  } catch (error) {
    console.error("Error submitPrediction:", error);
    return res
      .status(500)
      .json({ error: "Error al guardar la predicción." });
  }
};
