import type { Request, Response } from "express";
import { prisma } from "../server.js";

const PRO_ENTITLEMENT_ID = "tercer_tiempo_pro";

interface RevenueCatWebhookPayload {
  type: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  entitlement_ids?: string[] | null;
  entitlement_id?: string | null; // deprecated
  transferred_to?: string[];
  transferred_from?: string[];
  expiration_reason?: string;
}

/**
 * Valida opcionalmente el webhook con un secret (Bearer token).
 * En RevenueCat Dashboard, al crear el webhook, puedes añadir "Authorization: Bearer TU_SECRET".
 * En .env del backend: REVENUECAT_WEBHOOK_AUTHORIZATION=Bearer TU_SECRET
 */
function validateWebhookAuth(req: Request): boolean {
  const expected = process.env.REVENUECAT_WEBHOOK_AUTHORIZATION?.trim();
  if (!expected) return true; // Sin config = aceptar todo (útil en dev)
  const auth = req.headers.authorization;
  return typeof auth === "string" && auth === expected;
}

/**
 * Webhook de RevenueCat para mantener plan_type sincronizado.
 *
 * URL a configurar en RevenueCat Dashboard → Project → Integrations → Webhooks:
 *   https://TU_DOMINIO.com/api/webhooks/revenuecat
 *
 * Eventos que suben a PRO: INITIAL_PURCHASE, RENEWAL, UNCANCELLATION, TEMPORARY_ENTITLEMENT_GRANT
 * Evento que baja a FREE (quitar PRO): EXPIRATION
 */
export const revenueCatWebhook = async (req: Request, res: Response) => {
  if (!validateWebhookAuth(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  res.status(200).json({ received: true });

  try {
    const payload = req.body as RevenueCatWebhookPayload;
    const eventType = payload?.type;
    if (!eventType) return;

    const userId = payload.app_user_id ?? payload.original_app_user_id;
    const idsToCheck = userId ? [userId] : [];
    if (payload.aliases?.length) idsToCheck.push(...payload.aliases);
    if (payload.transferred_to?.length) idsToCheck.push(...payload.transferred_to);

    const entitlementIds =
      payload.entitlement_ids ?? (payload.entitlement_id ? [payload.entitlement_id] : []);
    const hasProEntitlement = entitlementIds.includes(PRO_ENTITLEMENT_ID);

    switch (eventType) {
      case "INITIAL_PURCHASE":
      case "RENEWAL":
      case "UNCANCELLATION":
      case "TEMPORARY_ENTITLEMENT_GRANT":
        if (hasProEntitlement && idsToCheck.length > 0) {
          for (const id of idsToCheck) {
            await prisma.users.updateMany({
              where: { id },
              data: { plan_type: "PRO" },
            });
          }
        }
        break;

      case "EXPIRATION":
        // Suscripción expirada: quitar PRO (bajar a FREE)
        if (idsToCheck.length > 0) {
          for (const id of idsToCheck) {
            await prisma.users.updateMany({
              where: { id },
              data: { plan_type: "FREE" },
            });
          }
        }
        break;

      case "CANCELLATION":
        // El usuario canceló; sigue con PRO hasta que llegue EXPIRATION
        break;

      case "TEST":
        break;

      default:
        break;
    }
  } catch (error) {
    console.error("[Webhook RevenueCat] Error:", error);
  }
};
