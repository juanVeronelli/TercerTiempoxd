import express from "express";
import cors from "cors";
import helmet from "helmet";
import * as dotenv from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client/index.js";
import { generalLimiter } from "./middlewares/rateLimiters.js";

dotenv.config();

const app = express();

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Detrás de proxies (Railway, etc.) Express debe confiar en X-Forwarded-For
// para que express-rate-limit pueda identificar bien al cliente.
app.set("trust proxy", 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.disable("x-powered-by");
app.use(generalLimiter);

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  }),
);

app.use(express.json());

import authRoutes from "./routes/authRoutes.js";
import leagueRoutes from "./routes/leagueRoutes.js";
import matchRoutes from "./routes/matchRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import predictionRoutes from "./routes/predictionRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import achievementRoutes from "./routes/achievementRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";

app.use("/api/auth", authRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/leagues", leagueRoutes);
app.use("/api/match", matchRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/predictions", predictionRoutes);
app.use("/api/users", userRoutes);
app.use("/api/achievements", achievementRoutes);

app.get("/health", (req, res) => {
  res.json({
    status: "online",
    project: "Tercer Tiempo",
    timestamp: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 3000;

import { startScheduler } from "./scheduler.js";

if (process.env.NODE_ENV !== "test") {
  app.listen(Number(PORT), "0.0.0.0", () => {
    startScheduler();
    console.log(`Tercer Tiempo API running at http://localhost:${PORT}`);
  });
}

export { app, prisma };
