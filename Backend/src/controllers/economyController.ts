import type { Request, Response } from "express";
import { prisma } from "../server.js";
import { grantTtpInTx } from "../services/TtpService.js";
import { sendError } from "../utils/httpErrors.js";
import { lockUserRow } from "../utils/locks.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("economyController");

const LEDGER_PAGE = 40;
const DAILY_FREE_TTP_AMOUNT = 20;
const DAILY_FREE_REASON = "DAILY_FREE_TTP";
const DAILY_FREE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function msUntilNextClaim(last: Date | null): number {
  if (!last) return 0;
  const elapsed = Date.now() - last.getTime();
  return Math.max(0, DAILY_FREE_COOLDOWN_MS - elapsed);
}

async function getLastDailyClaimAt(userId: string): Promise<Date | null> {
  const row = await prisma.ttp_ledger.findFirst({
    where: { user_id: userId, reason: DAILY_FREE_REASON },
    orderBy: { created_at: "desc" },
    select: { created_at: true },
  });
  return row?.created_at ?? null;
}

export async function getTtpSummary(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return sendError(res, 401, { error: "Unauthorized" });
    }

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { ttp_balance: true },
    });
    if (!user) {
      return sendError(res, 404, { error: "Usuario no encontrado" });
    }

    const entries = await prisma.ttp_ledger.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: LEDGER_PAGE,
      select: {
        amount: true,
        balance_after: true,
        reason: true,
        ref_type: true,
        ref_id: true,
        created_at: true,
      },
    });
    const lastDailyClaimAt = await getLastDailyClaimAt(userId);
    const remainingMs = msUntilNextClaim(lastDailyClaimAt);

    res.json({
      balance: user.ttp_balance,
      dailyFree: {
        amount: DAILY_FREE_TTP_AMOUNT,
        canClaim: remainingMs <= 0,
        remainingMs,
        lastClaimAt: lastDailyClaimAt?.toISOString() ?? null,
      },
      ledger: entries.map((e) => ({
        amount: e.amount,
        balanceAfter: e.balance_after,
        reason: e.reason,
        refType: e.ref_type,
        refId: e.ref_id,
        createdAt: e.created_at.toISOString(),
      })),
    });
  } catch (e) {
    log.errorWithErr("getTtpSummary failed", e, { userId: req.user?.userId });
    return sendError(res, 500, { error: "Error interno" });
  }
}

export async function claimDailyFreeTtp(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return sendError(res, 401, { error: "Unauthorized" });
    }

    const result = await prisma.$transaction(async (tx) => {
      await lockUserRow(tx, userId);

      const last = await tx.ttp_ledger.findFirst({
        where: { user_id: userId, reason: DAILY_FREE_REASON },
        orderBy: { created_at: "desc" },
        select: { created_at: true },
      });
      const remainingMs = msUntilNextClaim(last?.created_at ?? null);
      if (remainingMs > 0) {
        const user = await tx.users.findUnique({
          where: { id: userId },
          select: { ttp_balance: true },
        });
        return {
          ok: false as const,
          error: "COOLDOWN_ACTIVE" as const,
          remainingMs,
          amount: DAILY_FREE_TTP_AMOUNT,
          balance: user?.ttp_balance ?? 0,
          lastClaimAt: last?.created_at?.toISOString() ?? null,
        };
      }

      const idempotencyKey = `daily-free:${userId}:${Date.now()}`;
      const grant = await grantTtpInTx(tx, {
        userId,
        amount: DAILY_FREE_TTP_AMOUNT,
        reason: DAILY_FREE_REASON,
        refType: "daily_free",
        refId: userId,
        idempotencyKey,
      });
      return {
        ok: true as const,
        amount: DAILY_FREE_TTP_AMOUNT,
        balanceAfter: grant.balanceAfter ?? 0,
        nextClaimInMs: DAILY_FREE_COOLDOWN_MS,
      };
    });

    if (!result.ok) {
      return res.status(409).json(result);
    }
    return res.json(result);
  } catch (e) {
    log.errorWithErr("claimDailyFreeTtp failed", e, { userId: req.user?.userId });
    return sendError(res, 500, { error: "Error interno" });
  }
}
