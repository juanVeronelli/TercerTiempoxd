import type { Prisma } from "../generated/client/index.js";
import { lockUserRow } from "../utils/locks.js";

export type TxClient = Prisma.TransactionClient;

const DUPLICATE_KEY = "P2002";

/**
 * Acredita TTP dentro de una transacción existente (idempotente por idempotency_key).
 * Bloquea la fila del usuario para serializarBalance + movimiento ledger.
 */
export async function grantTtpInTx(
  tx: TxClient,
  params: {
    userId: string;
    amount: number;
    reason: string;
    refType?: string | null;
    refId?: string | null;
    idempotencyKey: string;
  },
): Promise<{ granted: boolean; balanceAfter?: number }> {
  const amount = Math.floor(params.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { granted: false };
  }

  await lockUserRow(tx, params.userId);

  const user = await tx.users.findUnique({
    where: { id: params.userId },
    select: { ttp_balance: true },
  });
  if (!user) return { granted: false };

  const balanceAfter = user.ttp_balance + amount;

  try {
    await tx.ttp_ledger.create({
      data: {
        user_id: params.userId,
        amount,
        balance_after: balanceAfter,
        reason: params.reason,
        ref_type: params.refType ?? undefined,
        ref_id: params.refId ?? undefined,
        idempotency_key: params.idempotencyKey,
      },
    });
  } catch (e: unknown) {
    const code = typeof e === "object" && e !== null ? (e as { code?: string }).code : undefined;
    if (code === DUPLICATE_KEY) {
      const row = await tx.users.findUnique({
        where: { id: params.userId },
        select: { ttp_balance: true },
      });
      return { granted: false, balanceAfter: row?.ttp_balance ?? undefined };
    }
    throw e;
  }

  await tx.users.update({
    where: { id: params.userId },
    data: { ttp_balance: balanceAfter },
  });

  return { granted: true, balanceAfter };
}
