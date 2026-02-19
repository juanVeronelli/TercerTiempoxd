import type { Request, Response } from "express";
import { prisma } from "../server.js";

/**
 * Actualiza el usuario a PRO tras una compra IAP validada por RevenueCat.
 * El cliente debe llamar este endpoint solo cuando RevenueCat confirma el entitlement.
 * En producción, considera validar la compra server-side (webhook de RevenueCat).
 */
export const iapUpgradeToPro = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "No autenticado" });
    }

    await prisma.users.update({
      where: { id: userId },
      data: { plan_type: "PRO" },
    });

    res.json({ message: "Plan actualizado a PRO correctamente" });
  } catch (error) {
    console.error("Error en iap-upgrade:", error);
    res.status(500).json({ error: "Error al actualizar el plan" });
  }
};
