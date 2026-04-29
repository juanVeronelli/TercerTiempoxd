import { randomUUID } from "node:crypto";
import { prisma } from "../server.js";
import { parsePostActivateMeta } from "./consumables/activationMeta.js";
import { EffectKey } from "./consumables/effectKeys.js";
import {
  applyPostMatchConsumableEffect,
  validateRankingHeistPreconditions,
} from "./consumables/postMatchEffects.js";
import { lockUserRow } from "../utils/locks.js";

function formatMatchWhen(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export async function listActiveShopItems() {
  return prisma.shop_items.findMany({
    where: { is_active: true },
    orderBy: [{ sort_order: "asc" }, { display_name: "asc" }],
    select: {
      id: true,
      key: true,
      display_name: true,
      description: true,
      item_type: true,
      price_ttp: true,
      cosmetic_key: true,
      consumable_key: true,
      sort_order: true,
      tooltip: true,
      consumable_timing: true,
      effect_key: true,
      meta: true,
    },
  });
}

export async function getUserConsumableStacks(userId: string) {
  return prisma.user_consumable_stacks.findMany({
    where: { user_id: userId, quantity: { gt: 0 } },
    select: { consumable_key: true, quantity: true },
  });
}

export type ConsumableStackRow = {
  consumableKey: string;
  quantity: number;
  displayName: string;
  description: string | null;
  tooltip: string | null;
  consumableTiming: string | null;
  effectKey: string | null;
};

export async function getUserConsumableStacksEnriched(
  userId: string,
): Promise<ConsumableStackRow[]> {
  const stacks = await prisma.user_consumable_stacks.findMany({
    where: { user_id: userId, quantity: { gt: 0 } },
    orderBy: { consumable_key: "asc" },
  });
  if (stacks.length === 0) return [];

  const keys = [...new Set(stacks.map((s) => s.consumable_key))];
  const shopRows = await prisma.shop_items.findMany({
    where: { consumable_key: { in: keys }, item_type: "CONSUMABLE" },
    orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
  });
  const firstByKey = new Map<string, (typeof shopRows)[0]>();
  for (const row of shopRows) {
    if (row.consumable_key && !firstByKey.has(row.consumable_key)) {
      firstByKey.set(row.consumable_key, row);
    }
  }

  return stacks.map((s) => {
    const meta = firstByKey.get(s.consumable_key);
    return {
      consumableKey: s.consumable_key,
      quantity: s.quantity,
      displayName: meta?.display_name ?? s.consumable_key,
      description: meta?.description ?? null,
      tooltip: meta?.tooltip ?? null,
      consumableTiming: meta?.consumable_timing ?? null,
      effectKey: meta?.effect_key ?? meta?.consumable_key ?? null,
    };
  });
}

export type ActivateConsumableResult =
  | {
      ok: true;
      timing: "PRE_MATCH" | "POST_MATCH";
      alertTitle: string;
      alertMessage: string;
      match: {
        id: string;
        dateTime: string;
        locationName: string | null;
        leagueName: string | null;
        status: string | null;
      };
      quantityRemaining: number;
      activationId: string;
    }
  | {
      ok: false;
      error:
        | "NOT_LEAGUE_MEMBER"
        | "ITEM_NOT_FOUND"
        | "NOT_CONSUMABLE"
        | "INSUFFICIENT_QUANTITY"
        | "NO_UPCOMING_MATCH"
        | "NO_COMPLETED_MATCH"
        | "TIMING_MISMATCH"
        | "INVALID_SWAP_TARGET"
        | "INVALID_META"
        | "HEIST_NO_PEER"
        | "HEIST_NOT_IN_MATCH";
    };

export async function activateConsumable(
  userId: string,
  consumableKey: string,
  leagueId: string,
  meta?: Record<string, unknown> | null,
): Promise<ActivateConsumableResult> {
  const metaParsed = parsePostActivateMeta(meta ?? undefined);
  if (!metaParsed.ok) {
    return { ok: false, error: "INVALID_META" };
  }
  const postMeta = metaParsed.value;

  const member = await prisma.league_members.findUnique({
    where: {
      league_id_user_id: { league_id: leagueId, user_id: userId },
    },
  });
  if (!member || member.is_banned) {
    return { ok: false, error: "NOT_LEAGUE_MEMBER" };
  }

  const item = await prisma.shop_items.findFirst({
    where: {
      consumable_key: consumableKey,
      item_type: "CONSUMABLE",
      is_active: true,
    },
  });
  if (!item || !item.consumable_key || !item.consumable_timing) {
    return { ok: false, error: "ITEM_NOT_FOUND" };
  }

  const timing = item.consumable_timing;
  if (timing !== "PRE_MATCH" && timing !== "POST_MATCH") {
    return { ok: false, error: "NOT_CONSUMABLE" };
  }

  return prisma.$transaction(async (tx) => {
    const stack = await tx.user_consumable_stacks.findUnique({
      where: {
        user_id_consumable_key: {
          user_id: userId,
          consumable_key: consumableKey,
        },
      },
    });
    if (!stack || stack.quantity < 1) {
      return { ok: false, error: "INSUFFICIENT_QUANTITY" } as ActivateConsumableResult;
    }

    const participantOr = [
      { match_players: { some: { user_id: userId } } },
      { match_spectators: { some: { user_id: userId } } },
    ];

    const match =
      timing === "PRE_MATCH"
        ? await (async () => {
            const base = {
              league_id: leagueId,
              status: { notIn: ["COMPLETED", "CANCELLED"] },
              OR: participantOr,
            };
            const now = new Date();
            const nextKickoff = await tx.matches.findFirst({
              where: { ...base, date_time: { gte: now } },
              orderBy: { date_time: "asc" },
              include: { leagues: { select: { name: true } } },
            });
            if (nextKickoff) return nextKickoff;
            return tx.matches.findFirst({
              where: { ...base, date_time: { lt: now } },
              orderBy: { date_time: "desc" },
              include: { leagues: { select: { name: true } } },
            });
          })()
        : await tx.matches.findFirst({
            where: {
              league_id: leagueId,
              status: { in: ["COMPLETED", "FINISHED"] },
              OR: participantOr,
            },
            orderBy: { date_time: "desc" },
            include: { leagues: { select: { name: true } } },
          });

    if (!match) {
      return {
        ok: false,
        error: timing === "PRE_MATCH" ? "NO_UPCOMING_MATCH" : "NO_COMPLETED_MATCH",
      } as ActivateConsumableResult;
    }

    const effectKeyResolved = String(
      item.effect_key ?? item.consumable_key ?? consumableKey,
    ).trim();

    if (timing === "POST_MATCH" && effectKeyResolved === EffectKey.RANKING_HEIST_SWAP) {
      const heist = await validateRankingHeistPreconditions(tx, match.id, userId, postMeta);
      if (!heist.ok) {
        return { ok: false, error: heist.error } as ActivateConsumableResult;
      }
    }

    const activation = await tx.user_consumable_activations.create({
      data: {
        user_id: userId,
        league_id: leagueId,
        consumable_key: consumableKey,
        timing,
        target_match_id: match.id,
        status: "ACTIVE",
        ...(Object.keys(postMeta).length > 0 ? { meta: postMeta as object } : {}),
      },
    });

    await tx.user_consumable_stacks.update({
      where: {
        user_id_consumable_key: {
          user_id: userId,
          consumable_key: consumableKey,
        },
      },
      data: { quantity: { decrement: 1 } },
    });

    const leagueName = match.leagues?.name ?? null;
    const whereLine = formatMatchWhen(match.date_time);
    const loc = match.location_name?.trim() || "Lugar a confirmar";
    const matchBlock = [leagueName, whereLine, loc].filter(Boolean).join("\n");

    const alertMessage =
      timing === "PRE_MATCH"
        ? `Este consumible se aplicará en tu próximo partido.\n\n${matchBlock}`
        : `Este consumible se aplicará al partido que ya jugaste.\n\n${matchBlock}`;

    const alertTitle =
      timing === "PRE_MATCH" ? "Próximo partido" : "Partido pasado";

    const qtyAfter = stack.quantity - 1;

    // POST_MATCH: aplicar efecto inmediatamente (el partido ya cerró) y consumir.
    if (timing === "POST_MATCH") {
      await applyPostMatchConsumableEffect({
        tx,
        effectKey: effectKeyResolved,
        userId,
        leagueId,
        matchId: match.id,
        postMeta,
      });

      await tx.user_consumable_activations.update({
        where: { id: activation.id },
        data: { status: "CONSUMED" },
      });
    }

    return {
      ok: true,
      timing,
      alertTitle,
      alertMessage,
      match: {
        id: match.id,
        dateTime: match.date_time.toISOString(),
        locationName: match.location_name,
        leagueName,
        status: match.status,
      },
      quantityRemaining: qtyAfter,
      activationId: activation.id,
    } as ActivateConsumableResult;
  });
}

export type PurchaseResult =
  | { ok: true; balanceAfter: number }
  | { ok: false; error: "ITEM_NOT_FOUND" | "INSUFFICIENT_TTP" | "ALREADY_OWNED" | "INVALID_ITEM" };

export async function purchaseShopItem(userId: string, itemId: string): Promise<PurchaseResult> {
  return prisma.$transaction(async (tx) => {
    await lockUserRow(tx, userId);

    const item = await tx.shop_items.findFirst({
      where: { id: itemId, is_active: true },
    });
    if (!item) {
      return { ok: false, error: "ITEM_NOT_FOUND" };
    }

    if (item.item_type !== "COSMETIC" && item.item_type !== "CONSUMABLE") {
      return { ok: false, error: "INVALID_ITEM" };
    }
    if (item.item_type === "COSMETIC" && !item.cosmetic_key) {
      return { ok: false, error: "INVALID_ITEM" };
    }
    if (item.item_type === "CONSUMABLE" && !item.consumable_key) {
      return { ok: false, error: "INVALID_ITEM" };
    }

    const user = await tx.users.findUnique({
      where: { id: userId },
      select: { ttp_balance: true },
    });
    if (!user || user.ttp_balance < item.price_ttp) {
      return { ok: false, error: "INSUFFICIENT_TTP" };
    }

    if (item.item_type === "COSMETIC" && item.cosmetic_key) {
      const owned = await tx.user_cosmetics.findUnique({
        where: {
          user_id_cosmetic_key: { user_id: userId, cosmetic_key: item.cosmetic_key },
        },
      });
      if (owned) {
        return { ok: false, error: "ALREADY_OWNED" };
      }
    }

    const newBal = user.ttp_balance - item.price_ttp;
    const idempotencyKey = `shop_buy:${item.id}:${userId}:${randomUUID()}`;

    await tx.ttp_ledger.create({
      data: {
        user_id: userId,
        amount: -item.price_ttp,
        balance_after: newBal,
        reason: "SHOP_PURCHASE",
        ref_type: "shop_item",
        ref_id: item.id,
        idempotency_key: idempotencyKey,
      },
    });

    await tx.users.update({
      where: { id: userId },
      data: { ttp_balance: newBal },
    });

    if (item.item_type === "COSMETIC" && item.cosmetic_key) {
      await tx.user_cosmetics.create({
        data: {
          user_id: userId,
          cosmetic_key: item.cosmetic_key,
          cosmetic_type: item.cosmetic_type ?? "FRAME",
        },
      });
    } else if (item.item_type === "CONSUMABLE" && item.consumable_key) {
      await tx.user_consumable_stacks.upsert({
        where: {
          user_id_consumable_key: {
            user_id: userId,
            consumable_key: item.consumable_key,
          },
        },
        create: {
          user_id: userId,
          consumable_key: item.consumable_key,
          quantity: 1,
        },
        update: { quantity: { increment: 1 } },
      });
    }

    return { ok: true, balanceAfter: newBal };
  });
}
