import type { Request, Response } from "express";
import { prisma } from "../server.js";
import { grantTtpInTx } from "../services/TtpService.js";
import { sendError } from "../utils/httpErrors.js";
import { lockUserRow } from "../utils/locks.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("economyController");

const LEDGER_PAGE = 40;
const DAILY_FREE_REASON = "DAILY_FREE_TTP";
const DAILY_FREE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const DAILY_FREE_STREAK_MAX_TTP = 300;
const DAILY_FREE_STREAK_DAYS_TO_MAX = 60; // ~2 meses

function dailyFreeAmountForStreak(streakAfterClaim: number): number {
  const s = Math.max(1, Math.floor(Number(streakAfterClaim) || 1));
  if (s >= DAILY_FREE_STREAK_DAYS_TO_MAX) return DAILY_FREE_STREAK_MAX_TTP;
  // 1..300 lineal en 60 días (con rounding hacia abajo estable)
  const steps = DAILY_FREE_STREAK_DAYS_TO_MAX - 1; // 59
  const inc = Math.floor(((s - 1) * (DAILY_FREE_STREAK_MAX_TTP - 1)) / steps);
  return Math.min(DAILY_FREE_STREAK_MAX_TTP, 1 + inc);
}

function msUntilNextClaim(last: Date | null): number {
  if (!last) return 0;
  const elapsed = Date.now() - last.getTime();
  return Math.max(0, DAILY_FREE_COOLDOWN_MS - elapsed);
}

function nextStreakFromLastClaim(
  prevStreak: number,
  lastClaimAt: Date | null,
  now: Date,
): number {
  if (!lastClaimAt) return 1;
  const diffMs = now.getTime() - lastClaimAt.getTime();
  const diffHours = diffMs / (60 * 60 * 1000);
  // Ya controlamos cooldown por 24h; acá definimos continuidad.
  // Si pasaron más de 48h, se cortó la racha.
  if (diffHours > 48) return 1;
  return Math.max(1, Math.floor(Number(prevStreak) || 0) + 1);
}

function utcDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function getTtpSummary(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return sendError(res, 401, { error: "Unauthorized" });
    }

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        ttp_balance: true,
        daily_free_ttp_streak: true,
        daily_free_ttp_last_claim_at: true,
      },
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
    const lastDailyClaimAt = user.daily_free_ttp_last_claim_at ?? null;
    const remainingMs = msUntilNextClaim(lastDailyClaimAt);
    const currentStreak = Number(user.daily_free_ttp_streak ?? 0);
    const now = new Date();
    const streakAfter =
      remainingMs <= 0 ? nextStreakFromLastClaim(currentStreak, lastDailyClaimAt, now) : currentStreak;
    const nextAmount =
      remainingMs <= 0
        ? dailyFreeAmountForStreak(streakAfter)
        : dailyFreeAmountForStreak(Math.max(1, currentStreak));

    res.json({
      balance: user.ttp_balance,
      dailyFree: {
        amount: nextAmount,
        canClaim: remainingMs <= 0,
        remainingMs,
        lastClaimAt: lastDailyClaimAt?.toISOString() ?? null,
        streak: currentStreak,
        maxAmount: DAILY_FREE_STREAK_MAX_TTP,
        daysToMax: DAILY_FREE_STREAK_DAYS_TO_MAX,
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

      const user = await tx.users.findUnique({
        where: { id: userId },
        select: {
          ttp_balance: true,
          daily_free_ttp_streak: true,
          daily_free_ttp_last_claim_at: true,
        },
      });
      if (!user) {
        return {
          ok: false as const,
          error: "NOT_FOUND" as const,
        };
      }

      const now = new Date();
      const lastClaimAt = user.daily_free_ttp_last_claim_at ?? null;
      const remainingMs = msUntilNextClaim(lastClaimAt);
      if (remainingMs > 0) {
        return {
          ok: false as const,
          error: "COOLDOWN_ACTIVE" as const,
          remainingMs,
          amount: dailyFreeAmountForStreak(Math.max(1, Number(user.daily_free_ttp_streak ?? 0))),
          balance: user.ttp_balance ?? 0,
          lastClaimAt: lastClaimAt?.toISOString() ?? null,
          streak: Number(user.daily_free_ttp_streak ?? 0),
        };
      }

      const streakAfter = nextStreakFromLastClaim(
        Number(user.daily_free_ttp_streak ?? 0),
        lastClaimAt,
        now,
      );
      const amount = dailyFreeAmountForStreak(streakAfter);
      const idempotencyKey = `ttp:daily_free:${userId}:${utcDateKey(now)}`;
      const grant = await grantTtpInTx(tx, {
        userId,
        amount,
        reason: DAILY_FREE_REASON,
        refType: "daily_free",
        refId: userId,
        idempotencyKey,
      });

      await tx.users.update({
        where: { id: userId },
        data: {
          daily_free_ttp_streak: streakAfter,
          daily_free_ttp_last_claim_at: now,
        },
      });
      return {
        ok: true as const,
        amount,
        balanceAfter: grant.balanceAfter ?? 0,
        nextClaimInMs: DAILY_FREE_COOLDOWN_MS,
        streakAfter,
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
