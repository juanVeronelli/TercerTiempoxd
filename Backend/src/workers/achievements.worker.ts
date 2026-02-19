/**
 * Worker Thread para procesar logros de un partido sin bloquear el Event Loop.
 * Usa su propia conexión Prisma/pg para evitar compartir estado con el main thread.
 */
import { parentPort, workerData } from "node:worker_threads";
import * as dotenv from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client/index.js";
import { processAchievementsForMatch } from "../services/AchievementService.js";

dotenv.config();

interface WorkerInput {
  matchId: string;
  playerIds?: string[]; // opcional, la lógica obtiene jugadores del partido
}

async function run(): Promise<void> {
  const { matchId } = workerData as WorkerInput;
  if (!matchId || typeof matchId !== "string") {
    parentPort?.postMessage({ status: "error", message: "matchId requerido" });
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    parentPort?.postMessage({
      status: "error",
      message: "DATABASE_URL no configurado",
    });
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const { processed } = await processAchievementsForMatch(prisma, matchId);
    parentPort?.postMessage({ status: "success", processed });
  } catch (err) {
    console.error("[achievements.worker] Error:", err);
    parentPort?.postMessage({
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    });
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    pool.end();
    process.exit(process.exitCode ?? 0);
  }
}

run();
