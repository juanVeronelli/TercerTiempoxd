/**
 * Script para probar que el worker de logros carga y ejecuta correctamente.
 * Uso: node scripts/test-worker.mjs [matchId]
 */
import { Worker } from "node:worker_threads";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workerPath = path.join(__dirname, "..", "dist", "workers", "achievements.worker.js");
const matchId = process.argv[2] || "00000000-0000-0000-0000-000000000000";

console.log("[test-worker] Iniciando worker con matchId:", matchId);
console.log("[test-worker] Ruta:", workerPath);

const worker = new Worker(workerPath, { workerData: { matchId } });

worker.on("message", (result) => {
  console.log("[test-worker] Mensaje recibido:", result);
});

worker.on("error", (err) => {
  console.error("[test-worker] Error:", err);
  process.exit(1);
});

worker.on("exit", (code) => {
  console.log("[test-worker] Worker finalizó con código:", code);
  process.exit(code);
});
