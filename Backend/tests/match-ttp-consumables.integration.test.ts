/**
 * Integración: crear partido, activar consumible PRE_MATCH, cerrar con votos.
 * Verifica:
 * - se aplica el efecto del consumible (si está implementado en MatchService)
 * - se consume la activación (status CONSUMED)
 * - se acredita TTP por MATCH_PLAYED (15)
 *
 * Requiere DATABASE_URL (p. ej. .env.test) y catálogo shop_items con los consumibles del test.
 */
import bcrypt from "bcrypt";
import { prisma } from "../src/server.js";
import { createMatch, submitVotes } from "../src/services/MatchService.js";
import { activateConsumable } from "../src/services/ShopService.js";

const describeIntegration =
  process.env.RUN_INTEGRATION_TESTS === "1" ? describe : describe.skip;

const voteSubs = {
  technique: 7,
  pace: 7,
  defense: 7,
  attack: 7,
  physical: 7,
} as const;

type Scenario = {
  label: string;
  consumableKey: string;
  /** Valor esperado para match_rating (overall) del usuario boosteado. */
  expectedOverall?: number;
  /** Valor esperado para match_technique del usuario boosteado. */
  expectedTechnique?: number;
};

async function expectShopConsumableExists(consumableKey: string) {
  const shopRow = await prisma.shop_items.findFirst({
    where: { consumable_key: consumableKey, item_type: "CONSUMABLE", is_active: true },
    select: { id: true },
  });
  if (!shopRow) {
    throw new Error(
      `Falta shop_items consumable_key=${consumableKey} en la DB. Ejecutá las migraciones SQL del catálogo de consumibles.`,
    );
  }
}

async function setupMatch(consumableKey: string) {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const hash = await bcrypt.hash("TestPass123", 8);
  const [uBoost, uOther] = await prisma.$transaction([
    prisma.users.create({
      data: {
        email: `ttp-int-${runId}-a@test.local`,
        username: `ttpinta_${runId}a`,
        password_hash: hash,
        full_name: "Boost Player",
        isVerified: true,
      },
    }),
    prisma.users.create({
      data: {
        email: `ttp-int-${runId}-b@test.local`,
        username: `ttpinta_${runId}b`,
        password_hash: hash,
        full_name: "Other Player",
        isVerified: true,
      },
    }),
  ]);

  const league = await prisma.leagues.create({
    data: {
      name: `Liga int ${runId}`,
      invite_code: `X${runId.slice(-6)}`,
      admin_id: uBoost.id,
    },
  });

  await prisma.league_members.createMany({
    data: [
      { league_id: league.id, user_id: uBoost.id },
      { league_id: league.id, user_id: uOther.id },
    ],
  });

  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const created = await createMatch({
    leagueId: league.id,
    adminId: uBoost.id,
    location: "Cancha test",
    dateTime: nextWeek,
    price: 0,
    players: [
      { id: uBoost.id, team: "A" },
      { id: uOther.id, team: "B" },
    ],
  });

  await prisma.match_players.updateMany({
    where: { match_id: created.id },
    data: { has_confirmed: true },
  });

  await expectShopConsumableExists(consumableKey);

  await prisma.user_consumable_stacks.upsert({
    where: {
      user_id_consumable_key: {
        user_id: uBoost.id,
        consumable_key: consumableKey,
      },
    },
    create: {
      user_id: uBoost.id,
      consumable_key: consumableKey,
      quantity: 1,
    },
    update: { quantity: { increment: 1 } },
  });

  const act = await activateConsumable(uBoost.id, consumableKey, league.id);
  if (!act.ok) {
    throw new Error(`activateConsumable falló: ${JSON.stringify(act)}`);
  }
  expect(act.match.id).toBe(created.id);

  return {
    leagueId: league.id,
    matchId: created.id,
    userBoostId: uBoost.id,
    userOtherId: uOther.id,
  };
}

async function cleanupMatch(ctx: {
  leagueId: string;
  matchId: string;
  userBoostId: string;
  userOtherId: string;
}) {
  await prisma.user_consumable_activations.deleteMany({
    where: { target_match_id: ctx.matchId },
  });
  await prisma.user_consumable_stacks.deleteMany({
    where: { user_id: { in: [ctx.userBoostId, ctx.userOtherId] } },
  });
  await prisma.ttp_ledger.deleteMany({
    where: { user_id: { in: [ctx.userBoostId, ctx.userOtherId] } },
  });
  await prisma.match_votes.deleteMany({ where: { match_id: ctx.matchId } });
  await prisma.honors.deleteMany({ where: { match_id: ctx.matchId } });
  await prisma.match_players.deleteMany({ where: { match_id: ctx.matchId } });
  await prisma.matches.deleteMany({ where: { id: ctx.matchId } });
  await prisma.league_members.deleteMany({ where: { league_id: ctx.leagueId } });
  await prisma.leagues.deleteMany({ where: { id: ctx.leagueId } });
  await prisma.users.deleteMany({
    where: { id: { in: [ctx.userBoostId, ctx.userOtherId] } },
  });
}

describeIntegration("Partido + TTP + consumibles PRE_MATCH", () => {
  jest.setTimeout(60000);

  const scenarios: Scenario[] = [
    { label: "overall +0,5", consumableKey: "overall_soft_boost", expectedOverall: 8 },
    { label: "overall +0,3", consumableKey: "overall_micro_boost", expectedOverall: 8 }, // 7,5 + 0,3 => 7,8 -> 8,0 por half-step
    { label: "overall +1", consumableKey: "overall_plus_one", expectedOverall: 8.5 }, // 7,5 + 1 => 8,5
    { label: "técnica +0,5", consumableKey: "tech_soft_boost", expectedTechnique: 7.5 },
    { label: "técnica +1", consumableKey: "tech_plus_one", expectedTechnique: 8 },
    { label: "overall ×2 (cap 10)", consumableKey: "overall_multiplier_x2", expectedOverall: 10 },
  ];

  for (const s of scenarios) {
    it(`aplica ${s.label} y consume activación (${s.consumableKey})`, async () => {
      const ctx = await setupMatch(s.consumableKey);
      try {
        const balBefore = await prisma.users.findUnique({
          where: { id: ctx.userBoostId },
          select: { ttp_balance: true },
        });

        await submitVotes(ctx.matchId, ctx.leagueId, ctx.userBoostId, [
          { voted_user_id: ctx.userBoostId, overall: 7 },
          { voted_user_id: ctx.userOtherId, overall: 6, ...voteSubs },
        ]);

        const r2 = await submitVotes(ctx.matchId, ctx.leagueId, ctx.userOtherId, [
          { voted_user_id: ctx.userOtherId, overall: 8 },
          { voted_user_id: ctx.userBoostId, overall: 8, ...voteSubs },
        ]);
        expect(r2.matchClosed).toBe(true);

        const match = await prisma.matches.findUnique({
          where: { id: ctx.matchId },
          select: { status: true },
        });
        expect(match?.status).toBe("COMPLETED");

        const rowBoost = await prisma.match_players.findUnique({
          where: {
            match_id_user_id: { match_id: ctx.matchId, user_id: ctx.userBoostId },
          },
          select: { match_rating: true, match_technique: true },
        });

        if (s.expectedOverall != null) {
          expect(Number(rowBoost?.match_rating)).toBe(s.expectedOverall);
        }
        if (s.expectedTechnique != null) {
          expect(Number(rowBoost?.match_technique)).toBe(s.expectedTechnique);
        }

        const activation = await prisma.user_consumable_activations.findFirst({
          where: {
            user_id: ctx.userBoostId,
            target_match_id: ctx.matchId,
            consumable_key: s.consumableKey,
          },
          select: { status: true },
        });
        expect(activation?.status).toBe("CONSUMED");

        const balAfter = await prisma.users.findUnique({
          where: { id: ctx.userBoostId },
          select: { ttp_balance: true },
        });
        expect((balAfter?.ttp_balance ?? 0) > (balBefore?.ttp_balance ?? 0)).toBe(true);

        const played = await prisma.ttp_ledger.findFirst({
          where: {
            user_id: ctx.userBoostId,
            reason: "MATCH_PLAYED",
            ref_id: ctx.matchId,
          },
          select: { amount: true },
        });
        expect(played?.amount).toBe(15);
      } finally {
        await cleanupMatch(ctx);
      }
    });
  }
});
