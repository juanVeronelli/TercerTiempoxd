import type { Request, Response } from "express";
import { prisma } from "../server.js";
import { sendError } from "../utils/httpErrors.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("iapController");

/**
 * Actualiza el usuario a PRO tras una compra IAP validada por RevenueCat.
 * El cliente debe llamar este endpoint solo cuando RevenueCat confirma el entitlement.
 * En producción, considera validar la compra server-side (webhook de RevenueCat).
 */
export const iapUpgradeToPro = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return sendError(res, 401, { error: "No autenticado" });
    }

    await prisma.users.update({
      where: { id: userId },
      data: { plan_type: "PRO" },
    });

    res.json({ message: "Plan actualizado a PRO correctamente" });
  } catch (error) {
    log.errorWithErr("iapUpgradeToPro failed", error, { userId: req.user?.userId });
    return sendError(res, 500, { error: "Error al actualizar el plan" });
  }
};
