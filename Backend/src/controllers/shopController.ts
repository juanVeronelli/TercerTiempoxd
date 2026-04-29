import type { Request, Response } from "express";
import { z } from "zod";
import {
  activateConsumable,
  getUserConsumableStacksEnriched,
  listActiveShopItems,
  purchaseShopItem,
} from "../services/ShopService.js";
import { prisma } from "../server.js";
import { sendError } from "../utils/httpErrors.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("shopController");

export async function getShopItems(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return sendError(res, 401, { error: "Unauthorized" });
    }

    const items = await listActiveShopItems();
    const cosmeticsOwned = await prisma.user_cosmetics.findMany({
      where: { user_id: userId },
      select: { cosmetic_key: true },
    });
    const ownedSet = new Set(cosmeticsOwned.map((c) => c.cosmetic_key));

    res.json({
      items: items.map((it) => ({
        id: it.id,
        key: it.key,
        displayName: it.display_name,
        description: it.description,
        itemType: it.item_type,
        priceTtp: it.price_ttp,
        cosmeticKey: it.cosmetic_key,
        consumableKey: it.consumable_key,
        tooltip: it.tooltip,
        consumableTiming: it.consumable_timing,
        effectKey: it.effect_key,
        ownedCosmetic:
          it.item_type === "COSMETIC" && it.cosmetic_key
            ? ownedSet.has(it.cosmetic_key)
            : false,
      })),
    });
  } catch (e) {
    log.errorWithErr("getShopItems failed", e, { userId: req.user?.userId });
    return sendError(res, 500, { error: "Error interno" });
  }
}

export async function getConsumableStacks(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return sendError(res, 401, { error: "Unauthorized" });
    }

    const stacks = await getUserConsumableStacksEnriched(userId);
    res.json({
      stacks: stacks.map((s) => ({
        consumableKey: s.consumableKey,
        quantity: s.quantity,
        displayName: s.displayName,
        description: s.description,
        tooltip: s.tooltip,
        consumableTiming: s.consumableTiming,
        effectKey: s.effectKey,
      })),
    });
  } catch (e) {
    log.errorWithErr("getConsumableStacks failed", e, { userId: req.user?.userId });
    return sendError(res, 500, { error: "Error interno" });
  }
}

const purchaseBody = z.object({
  itemId: z.string().uuid(),
});

const activateBody = z.object({
  consumableKey: z.string().min(1).max(60),
  leagueId: z.string().uuid(),
  /** Ej. `{ "swapWithUserId": "<uuid>" }` para ranking_heist_swap */
  meta: z.record(z.string(), z.unknown()).optional(),
});

export async function postConsumableActivate(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return sendError(res, 401, { error: "Unauthorized" });
    }

    const parsed = activateBody.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, { error: "INVALID_BODY" });
    }

    const result = await activateConsumable(
      userId,
      parsed.data.consumableKey,
      parsed.data.leagueId,
      parsed.data.meta,
    );

    if (!result.ok) {
      const map: Record<string, number> = {
        NOT_LEAGUE_MEMBER: 403,
        ITEM_NOT_FOUND: 404,
        NOT_CONSUMABLE: 400,
        INSUFFICIENT_QUANTITY: 400,
        NO_UPCOMING_MATCH: 409,
        NO_COMPLETED_MATCH: 409,
        TIMING_MISMATCH: 400,
        INVALID_SWAP_TARGET: 400,
        INVALID_META: 400,
        HEIST_NO_PEER: 400,
        HEIST_NOT_IN_MATCH: 400,
      };
      const status = map[result.error] ?? 400;
      return sendError(res, status, { error: result.error });
    }

    res.json({
      timing: result.timing,
      alertTitle: result.alertTitle,
      alertMessage: result.alertMessage,
      match: result.match,
      quantityRemaining: result.quantityRemaining,
      activationId: result.activationId,
    });
  } catch (e) {
    log.errorWithErr("postConsumableActivate failed", e, { userId: req.user?.userId });
    return sendError(res, 500, { error: "Error interno" });
  }
}

export async function postShopPurchase(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return sendError(res, 401, { error: "Unauthorized" });
    }

    const parsed = purchaseBody.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, { error: "itemId inválido" });
    }

    const result = await purchaseShopItem(userId, parsed.data.itemId);
    if (!result.ok) {
      const status =
        result.error === "ITEM_NOT_FOUND"
          ? 404
          : result.error === "INSUFFICIENT_TTP" || result.error === "ALREADY_OWNED"
            ? 400
            : 400;
      return sendError(res, status, { error: result.error });
    }

    res.json({
      balanceAfter: result.balanceAfter,
      message: "Compra realizada",
    });
  } catch (e) {
    log.errorWithErr("postShopPurchase failed", e, { userId: req.user?.userId });
    return sendError(res, 500, { error: "Error interno" });
  }
}
