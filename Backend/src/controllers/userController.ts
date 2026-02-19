import type { Request, Response } from "express";
import { prisma } from "../server.js";
import crypto from "crypto";

/**
 * DELETE /api/users/me
 * Elimina o anonimiza la cuenta del usuario autenticado.
 * Anonimiza para mantener integridad referencial (partidos, votos, etc.).
 * El cliente debe desloguear tras recibir 200.
 */
export async function deleteMyAccount(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, email: true, username: true },
    });

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const deletedEmail = `deleted-${user.id}@deleted.local`;
    const deletedUsername = `deleted_${user.id.replace(/-/g, "").slice(0, 20)}`;
    const randomHash = crypto.randomBytes(32).toString("hex");

    await prisma.users.update({
      where: { id: userId },
      data: {
        email: deletedEmail,
        username: deletedUsername,
        full_name: null,
        password_hash: randomHash,
        profile_photo_url: null,
        banner_url: null,
        bio: null,
        is_active: false,
        verificationCode: null,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    return res.status(200).json({
      message: "Cuenta eliminada correctamente. Sesión cerrada.",
    });
  } catch (error) {
    console.error("Error deleteMyAccount:", error);
    return res
      .status(500)
      .json({ error: "Error al eliminar la cuenta. Inténtalo más tarde." });
  }
}
