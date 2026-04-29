import type { Prisma } from "../generated/client/index.js";

export type TxClient = Prisma.TransactionClient;

export async function lockUserRow(tx: TxClient, userId: string) {
  await tx.$executeRaw`SELECT 1 FROM users WHERE id = ${userId} FOR UPDATE`;
}

export async function lockMatchRow(tx: TxClient, matchId: string) {
  await tx.$executeRaw`SELECT 1 FROM matches WHERE id = ${matchId} FOR UPDATE`;
}

