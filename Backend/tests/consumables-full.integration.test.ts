/**
 * Integración: lógica de consumibles (PRE y POST) aplicada realmente.
 *
 * Nota: estos tests tocan DB real de test. Requiere DATABASE_URL.
 */
import bcrypt from "bcrypt";
import { prisma } from "../src/server.js";
import { createMatch, submitVotes } from "../src/services/MatchService.js";
import { activateConsumable } from "../src/services/ShopService.js";
import { generateMatchDuel } from "../src/services/DuelService.js";
import { submitPrediction } from "../src/services/PredictionService.js";

const describeIntegration =
  process.env.RUN_INTEGRATION_TESTS === "1" ? describe : describe.skip;

async function ensureConsumable(consumableKey: string) {
  const row = await prisma.shop_items.findFirst({
    where: { consumable_key: consumableKey, item_type: "CONSUMABLE", is_active: true },
    select: { id: true },
  });
  if (!row) throw new Error(`Falta shop_items para consumable_key=${consumableKey}`);
}

async function grantStack(userId: string, consumableKey: string, qty = 1) {
  await prisma.user_consumable_stacks.upsert({
    where: { user_id_consumable_key: { user_id: userId, consumable_key: consumableKey } },
    create: { user_id: userId, consumable_key: consumableKey, quantity: qty },
    update: { quantity: { increment: qty } },
  });
}

async function makeLeague2Users(runId: string) {
  const hash = await bcrypt.hash("TestPass123", 8);
  const [u1, u2] = await prisma.$transaction([
    prisma.users.create({
      data: {
        email: `cons-${runId}-a@test.local`,
        username: `cons_${runId}a`,
        password_hash: hash,
        full_name: "A",
        isVerified: true,
      },
    }),
    prisma.users.create({
      data: {
        email: `cons-${runId}-b@test.local`,
        username: `cons_${runId}b`,
        password_hash: hash,
        full_name: "B",
        isVerified: true,
      },
    }),
  ]);

  const league = await prisma.leagues.create({
    data: { name: `Liga cons ${runId}`, invite_code: `C${runId.slice(-6)}`, admin_id: u1.id },
  });
  await prisma.league_members.createMany({
    data: [
      { league_id: league.id, user_id: u1.id },
      { league_id: league.id, user_id: u2.id },
    ],
  });
  return { leagueId: league.id, u1: u1.id, u2: u2.id };
}

async function makeLeague3Users(runId: string) {
  const hash = await bcrypt.hash("TestPass123", 8);
  const created = await prisma.users.createManyAndReturn({
    data: [
      {
        email: `cons-${runId}-a@test.local`,
        username: `cons_${runId}a`,
        password_hash: hash,
        full_name: "A",
        isVerified: true,
      },
      {
        email: `cons-${runId}-b@test.local`,
        username: `cons_${runId}b`,
        password_hash: hash,
        full_name: "B",
        isVerified: true,
      },
      {
        email: `cons-${runId}-c@test.local`,
        username: `cons_${runId}c`,
        password_hash: hash,
        full_name: "C",
        isVerified: true,
      },
    ],
  } as any);
  const [u1, u2, u3] = created;
  if (!u1 || !u2 || !u3) throw new Error("No se pudieron crear usuarios");
  const league = await prisma.leagues.create({
    data: { name: `Liga cons ${runId}`, invite_code: `C${runId.slice(-6)}`, admin_id: u1.id },
  });
  await prisma.league_members.createMany({
    data: [
      { league_id: league.id, user_id: u1.id },
      { league_id: league.id, user_id: u2.id },
      { league_id: league.id, user_id: u3.id },
    ],
  });
  return { leagueId: league.id, u1: u1.id, u2: u2.id, u3: u3.id };
}

async function cleanupLeague(ctx: { leagueId: string; userIds: string[]; matchIds: string[] }) {
  await prisma.user_consumable_activations.deleteMany({ where: { league_id: ctx.leagueId } });
  await prisma.user_consumable_stacks.deleteMany({ where: { user_id: { in: ctx.userIds } } });
  await prisma.user_predictions.deleteMany({ where: { user_id: { in: ctx.userIds } } });
  await prisma.prediction_options.deleteMany({ where: { prediction_questions: { prediction_groups: { league_id: ctx.leagueId } } } } as any);
  await prisma.prediction_questions.deleteMany({ where: { prediction_groups: { league_id: ctx.leagueId } } } as any);
  await prisma.prediction_groups.deleteMany({ where: { league_id: ctx.leagueId } } as any);
  await prisma.match_votes.deleteMany({ where: { match_id: { in: ctx.matchIds } } });
  await prisma.honors.deleteMany({ where: { match_id: { in: ctx.matchIds } } });
  await prisma.duels.deleteMany({ where: { match_id: { in: ctx.matchIds } } });
  await prisma.match_spectators.deleteMany({ where: { match_id: { in: ctx.matchIds } } });
  await prisma.match_players.deleteMany({ where: { match_id: { in: ctx.matchIds } } });
  await prisma.matches.deleteMany({ where: { id: { in: ctx.matchIds } } });
  await prisma.league_members.deleteMany({ where: { league_id: ctx.leagueId } });
  await prisma.leagues.deleteMany({ where: { id: ctx.leagueId } });
  await prisma.users.deleteMany({ where: { id: { in: ctx.userIds } } });
}

describeIntegration("Consumibles: efectos PRE y POST", () => {
  jest.setTimeout(180000);

  it("PRE: duel_reserved_slot fuerza al usuario a entrar al duelo", async () => {
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const { leagueId, u1, u2 } = await makeLeague2Users(runId);
    const matchIds: string[] = [];
    try {
      await ensureConsumable("duel_reserved_slot");
      const created = await createMatch({
        leagueId,
        adminId: u1,
        location: "Cancha",
        dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        price: 0,
        players: [
          { id: u1, team: "A" },
          { id: u2, team: "B" },
        ],
      });
      matchIds.push(created.id);
      await prisma.match_players.updateMany({ where: { match_id: created.id }, data: { has_confirmed: true } });
      await grantStack(u1, "duel_reserved_slot", 1);
      const act = await activateConsumable(u1, "duel_reserved_slot", leagueId);
      expect(act.ok).toBe(true);

      const res = await generateMatchDuel(created.id);
      expect([res.duel.challenger_id, res.duel.rival_id]).toContain(u1);
    } finally {
      await cleanupLeague({ leagueId, userIds: [u1, u2], matchIds });
    }
  });

  it("PRE: prode_unlimited_picks permite superar 5 picks", async () => {
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const { leagueId, u1, u2 } = await makeLeague2Users(runId);
    const matchIds: string[] = [];
    try {
      await ensureConsumable("prode_unlimited_picks");
      const created = await createMatch({
        leagueId,
        adminId: u1,
        location: "Cancha",
        dateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        price: 0,
        players: [
          { id: u1, team: "A" },
          { id: u2, team: "B" },
        ],
      });
      matchIds.push(created.id);
      await prisma.match_players.updateMany({ where: { match_id: created.id }, data: { has_confirmed: true } });

      // Crear grupo MATCH + 6 preguntas con 2 opciones cada una.
      const g = await prisma.prediction_groups.create({
        data: {
          league_id: leagueId,
          match_id: created.id,
          type: "MATCH",
          closes_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        } as any,
      });
      for (let i = 0; i < 6; i++) {
        const q = await prisma.prediction_questions.create({
          data: { group_id: g.id, question_key: `Q${i}_${runId}`, label: `Q${i}`, points_reward: 1 },
        } as any,
        );
        const o1 = await prisma.prediction_options.create({
          data: { question_id: q.id, option_key: "A", label: "A" },
        } as any,
        );
        await prisma.prediction_options.create({
          data: { question_id: q.id, option_key: "B", label: "B" },
        } as any,
        );

        if (i === 0) {
          await grantStack(u1, "prode_unlimited_picks", 1);
          const act = await activateConsumable(u1, "prode_unlimited_picks", leagueId);
          expect(act.ok).toBe(true);
        }
        const r = await submitPrediction(u1, q.id, o1.id);
        expect(r.success).toBe(true);
      }
    } finally {
      await cleanupLeague({ leagueId, userIds: [u1, u2], matchIds });
    }
  });

  it("PRE: prode_double_points duplica prediction_points", async () => {
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const { leagueId, u1, u2 } = await makeLeague2Users(runId);
    const matchIds: string[] = [];
    try {
      await ensureConsumable("prode_double_points");
      const created = await createMatch({
        leagueId,
        adminId: u1,
        location: "Cancha",
        dateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        price: 0,
        players: [
          { id: u1, team: "A" },
          { id: u2, team: "B" },
        ],
      });
      matchIds.push(created.id);
      await prisma.match_players.updateMany({ where: { match_id: created.id }, data: { has_confirmed: true } });

      const g = await prisma.prediction_groups.create({
        data: {
          league_id: leagueId,
          match_id: created.id,
          type: "MATCH",
          closes_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        } as any,
      });
      const q = await prisma.prediction_questions.create({
        data: { group_id: g.id, question_key: `EXACT_RATING|${u1}`, label: "Exact rating", points_reward: 10 },
      } as any);
      const opt8 = await prisma.prediction_options.create({
        data: { question_id: q.id, option_key: "8", label: "8" },
      } as any);
      await prisma.prediction_options.create({
        data: { question_id: q.id, option_key: "7.5", label: "7,5" },
      } as any);

      await grantStack(u1, "prode_double_points", 1);
      const act = await activateConsumable(u1, "prode_double_points", leagueId);
      expect(act.ok).toBe(true);

      const r = await submitPrediction(u1, q.id, opt8.id);
      expect(r.success).toBe(true);

      // Cerrar: forzar rating exacto 8 para u1
      await submitVotes(created.id, leagueId, u1, [
        { voted_user_id: u1, overall: 8 },
        { voted_user_id: u2, overall: 6, technique: 7, pace: 7, defense: 7, attack: 7, physical: 7 },
      ]);
      await submitVotes(created.id, leagueId, u2, [
        { voted_user_id: u2, overall: 8 },
        { voted_user_id: u1, overall: 8, technique: 7, pace: 7, defense: 7, attack: 7, physical: 7 },
      ]);

      const mp = await prisma.match_players.findUnique({
        where: { match_id_user_id: { match_id: created.id, user_id: u1 } },
        select: { prediction_points: true },
      });
      expect(mp?.prediction_points).toBe(20);
    } finally {
      await cleanupLeague({ leagueId, userIds: [u1, u2], matchIds });
    }
  });

  it("PRE: spectator_vote_player sube peso del espectador a 1×", async () => {
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const { leagueId, u1, u2, u3 } = await makeLeague3Users(runId);
    const matchIds: string[] = [];
    try {
      await ensureConsumable("spectator_vote_player");
      const created = await createMatch({
        leagueId,
        adminId: u1,
        location: "Cancha",
        dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        price: 0,
        players: [
          { id: u1, team: "A" },
          { id: u2, team: "B" },
        ],
      });
      matchIds.push(created.id);
      await prisma.match_players.updateMany({ where: { match_id: created.id }, data: { has_confirmed: true } });
      await prisma.match_spectators.create({ data: { match_id: created.id, user_id: u3, attending: true } } as any);

      await grantStack(u3, "spectator_vote_player", 1);
      const act = await activateConsumable(u3, "spectator_vote_player", leagueId);
      expect(act.ok).toBe(true);

      // u3 espectador vota 10 a u1 (solo insert manual; los jugadores votan vía submitVotes).
      await prisma.match_votes.create({
        data: { match_id: created.id, league_id: leagueId, voter_id: u3, target_id: u1, overall: 10 },
      } as any);

      // Cerrar por el servicio (closeMatch se dispara desde submitVotes cuando totalVoters>=confirmed)
      await submitVotes(created.id, leagueId, u1, [
        { voted_user_id: u1, overall: 6 },
        { voted_user_id: u2, overall: 6, technique: 7, pace: 7, defense: 7, attack: 7, physical: 7 },
      ]);
      await submitVotes(created.id, leagueId, u2, [
        { voted_user_id: u2, overall: 6 },
        { voted_user_id: u1, overall: 6, technique: 7, pace: 7, defense: 7, attack: 7, physical: 7 },
      ]);

      const mp = await prisma.match_players.findUnique({
        where: { match_id_user_id: { match_id: created.id, user_id: u1 } },
        select: { match_rating: true },
      });
      // Con peso 1× del espectador, el 10 pesa como voto de jugador → promedio ~ (10 + 6 + 6)/3 = 7.33
      expect(Number(mp?.match_rating || 0)).toBeGreaterThan(7.2);
    } finally {
      await cleanupLeague({ leagueId, userIds: [u1, u2, u3], matchIds });
    }
  });

  it("PRE: spectator_overvote aumenta peso del espectador", async () => {
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const { leagueId, u1, u2, u3 } = await makeLeague3Users(runId);
    const matchIds: string[] = [];
    try {
      await ensureConsumable("spectator_overvote");
      const created = await createMatch({
        leagueId,
        adminId: u1,
        location: "Cancha",
        dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        price: 0,
        players: [
          { id: u1, team: "A" },
          { id: u2, team: "B" },
        ],
      });
      matchIds.push(created.id);
      await prisma.match_players.updateMany({ where: { match_id: created.id }, data: { has_confirmed: true } });
      await prisma.match_spectators.create({ data: { match_id: created.id, user_id: u3, attending: true } } as any);

      await grantStack(u3, "spectator_overvote", 1);
      const act = await activateConsumable(u3, "spectator_overvote", leagueId);
      expect(act.ok).toBe(true);

      await prisma.match_votes.create({
        data: { match_id: created.id, league_id: leagueId, voter_id: u3, target_id: u1, overall: 10 },
      } as any);

      await submitVotes(created.id, leagueId, u1, [
        { voted_user_id: u1, overall: 6 },
        { voted_user_id: u2, overall: 6, technique: 7, pace: 7, defense: 7, attack: 7, physical: 7 },
      ]);
      await submitVotes(created.id, leagueId, u2, [
        { voted_user_id: u2, overall: 6 },
        { voted_user_id: u1, overall: 6, technique: 7, pace: 7, defense: 7, attack: 7, physical: 7 },
      ]);

      const mp = await prisma.match_players.findUnique({
        where: { match_id_user_id: { match_id: created.id, user_id: u1 } },
        select: { match_rating: true },
      });
      expect(Number(mp?.match_rating || 0)).toBeGreaterThan(7.5);
    } finally {
      await cleanupLeague({ leagueId, userIds: [u1, u2, u3], matchIds });
    }
  });

  it("PRE: shield_vs_tronco impide ganar Tronco", async () => {
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const { leagueId, u1, u2 } = await makeLeague2Users(runId);
    const matchIds: string[] = [];
    try {
      await ensureConsumable("shield_vs_tronco");
      const created = await createMatch({
        leagueId,
        adminId: u1,
        location: "Cancha",
        dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        price: 0,
        players: [
          { id: u1, team: "A" },
          { id: u2, team: "B" },
        ],
      });
      matchIds.push(created.id);
      await prisma.match_players.updateMany({ where: { match_id: created.id }, data: { has_confirmed: true } });
      await grantStack(u1, "shield_vs_tronco", 1);
      const act = await activateConsumable(u1, "shield_vs_tronco", leagueId);
      expect(act.ok).toBe(true);

      // Hacer que u1 sea el mínimo (tronco) pero con escudo.
      await submitVotes(created.id, leagueId, u1, [
        { voted_user_id: u1, overall: 1 },
        { voted_user_id: u2, overall: 9, technique: 7, pace: 7, defense: 7, attack: 7, physical: 7 },
      ]);
      await submitVotes(created.id, leagueId, u2, [
        { voted_user_id: u2, overall: 9 },
        { voted_user_id: u1, overall: 1, technique: 7, pace: 7, defense: 7, attack: 7, physical: 7 },
      ]);

      const tronco = await prisma.honors.findFirst({
        where: { match_id: created.id, honor_type: "TRONCO" },
        select: { user_id: true },
      });
      expect(tronco?.user_id).toBe(u2);
    } finally {
      await cleanupLeague({ leagueId, userIds: [u1, u2], matchIds });
    }
  });

  it("PRE: shield_vs_fantasma impide ganar Fantasma", async () => {
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const { leagueId, u1, u2 } = await makeLeague2Users(runId);
    const matchIds: string[] = [];
    try {
      await ensureConsumable("shield_vs_fantasma");
      const created = await createMatch({
        leagueId,
        adminId: u1,
        location: "Cancha",
        dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        price: 0,
        players: [
          { id: u1, team: "A" },
          { id: u2, team: "B" },
        ],
      });
      matchIds.push(created.id);
      await prisma.match_players.updateMany({ where: { match_id: created.id }, data: { has_confirmed: true } });
      await grantStack(u1, "shield_vs_fantasma", 1);
      const act = await activateConsumable(u1, "shield_vs_fantasma", leagueId);
      expect(act.ok).toBe(true);

      // Forzar "fantasmaScore" alto: u1 se vota 10, u2 le pone 1 -> diferencia positiva grande.
      await submitVotes(created.id, leagueId, u1, [
        { voted_user_id: u1, overall: 10 },
        { voted_user_id: u2, overall: 6, technique: 7, pace: 7, defense: 7, attack: 7, physical: 7 },
      ]);
      await submitVotes(created.id, leagueId, u2, [
        { voted_user_id: u2, overall: 6 },
        { voted_user_id: u1, overall: 1, technique: 7, pace: 7, defense: 7, attack: 7, physical: 7 },
      ]);

      const ghost = await prisma.honors.findFirst({
        where: { match_id: created.id, honor_type: "FANTASMA" },
        select: { user_id: true },
      });
      // Con escudo activado por el único candidato real a Fantasma, puede quedar sin Fantasma asignado.
      expect(ghost?.user_id ?? null).toBeNull();
    } finally {
      await cleanupLeague({ leagueId, userIds: [u1, u2], matchIds });
    }
  });

  it("POST: history_delete_match elimina tu match_players del último partido cerrado", async () => {
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const { leagueId, u1, u2 } = await makeLeague2Users(runId);
    const matchIds: string[] = [];
    try {
      await ensureConsumable("history_delete_match");
      const created = await createMatch({
        leagueId,
        adminId: u1,
        location: "Cancha",
        dateTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        price: 0,
        players: [
          { id: u1, team: "A" },
          { id: u2, team: "B" },
        ],
      });
      matchIds.push(created.id);
      await prisma.match_players.updateMany({ where: { match_id: created.id }, data: { has_confirmed: true } });
      await submitVotes(created.id, leagueId, u1, [
        { voted_user_id: u1, overall: 6 },
        { voted_user_id: u2, overall: 6, technique: 7, pace: 7, defense: 7, attack: 7, physical: 7 },
      ]);
      await submitVotes(created.id, leagueId, u2, [
        { voted_user_id: u2, overall: 6 },
        { voted_user_id: u1, overall: 6, technique: 7, pace: 7, defense: 7, attack: 7, physical: 7 },
      ]);

      await grantStack(u1, "history_delete_match", 1);
      const act = await activateConsumable(u1, "history_delete_match", leagueId);
      expect(act.ok).toBe(true);

      const mp = await prisma.match_players.findUnique({
        where: { match_id_user_id: { match_id: created.id, user_id: u1 } },
        select: { user_id: true },
      });
      expect(mp).toBeNull();
    } finally {
      await cleanupLeague({ leagueId, userIds: [u1, u2], matchIds });
    }
  });

  it("POST: medal_forfeit_token borra una medalla del partido", async () => {
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const { leagueId, u1, u2 } = await makeLeague2Users(runId);
    const matchIds: string[] = [];
    try {
      await ensureConsumable("medal_forfeit_token");
      const created = await createMatch({
        leagueId,
        adminId: u1,
        location: "Cancha",
        dateTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        price: 0,
        players: [
          { id: u1, team: "A" },
          { id: u2, team: "B" },
        ],
      });
      matchIds.push(created.id);
      await prisma.match_players.updateMany({ where: { match_id: created.id }, data: { has_confirmed: true } });
      // u1 MVP: puntaje alto consistente.
      await submitVotes(created.id, leagueId, u1, [
        { voted_user_id: u1, overall: 9 },
        { voted_user_id: u2, overall: 4, technique: 7, pace: 7, defense: 7, attack: 7, physical: 7 },
      ]);
      await submitVotes(created.id, leagueId, u2, [
        { voted_user_id: u2, overall: 4 },
        { voted_user_id: u1, overall: 9, technique: 7, pace: 7, defense: 7, attack: 7, physical: 7 },
      ]);

      const before = await prisma.honors.count({ where: { match_id: created.id, user_id: u1 } });
      expect(before).toBeGreaterThan(0);

      await grantStack(u1, "medal_forfeit_token", 1);
      const act = await activateConsumable(u1, "medal_forfeit_token", leagueId);
      expect(act.ok).toBe(true);

      const after = await prisma.honors.count({ where: { match_id: created.id, user_id: u1 } });
      expect(after).toBe(before - 1);
    } finally {
      await cleanupLeague({ leagueId, userIds: [u1, u2], matchIds });
    }
  });

  it("POST: ghost_top_score_tie sube tu overall al máximo de la fecha", async () => {
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const { leagueId, u1, u2 } = await makeLeague2Users(runId);
    const matchIds: string[] = [];
    try {
      await ensureConsumable("ghost_top_score_tie");
      const created = await createMatch({
        leagueId,
        adminId: u1,
        location: "Cancha",
        dateTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        price: 0,
        players: [
          { id: u1, team: "A" },
          { id: u2, team: "B" },
        ],
      });
      matchIds.push(created.id);
      await prisma.match_players.updateMany({ where: { match_id: created.id }, data: { has_confirmed: true } });
      await submitVotes(created.id, leagueId, u1, [
        { voted_user_id: u1, overall: 5 },
        { voted_user_id: u2, overall: 9, technique: 7, pace: 7, defense: 7, attack: 7, physical: 7 },
      ]);
      await submitVotes(created.id, leagueId, u2, [
        { voted_user_id: u2, overall: 9 },
        { voted_user_id: u1, overall: 5, technique: 7, pace: 7, defense: 7, attack: 7, physical: 7 },
      ]);

      const max = await prisma.match_players.findMany({
        where: { match_id: created.id },
        select: { match_rating: true },
      });
      const maxVal = Math.max(...max.map((r) => Number(r.match_rating || 0)));

      await grantStack(u1, "ghost_top_score_tie", 1);
      const act = await activateConsumable(u1, "ghost_top_score_tie", leagueId);
      expect(act.ok).toBe(true);

      const me = await prisma.match_players.findUnique({
        where: { match_id_user_id: { match_id: created.id, user_id: u1 } },
        select: { match_rating: true },
      });
      expect(Number(me?.match_rating || 0)).toBe(maxVal);
    } finally {
      await cleanupLeague({ leagueId, userIds: [u1, u2], matchIds });
    }
  });

  it("POST: ranking_heist_swap intercambia cartas entre dos jugadores", async () => {
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const { leagueId, u1, u2 } = await makeLeague2Users(runId);
    const matchIds: string[] = [];
    try {
      await ensureConsumable("ranking_heist_swap");
      const created = await createMatch({
        leagueId,
        adminId: u1,
        location: "Cancha",
        dateTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        price: 0,
        players: [
          { id: u1, team: "A" },
          { id: u2, team: "B" },
        ],
      });
      matchIds.push(created.id);
      await prisma.match_players.updateMany({ where: { match_id: created.id }, data: { has_confirmed: true } });
      await submitVotes(created.id, leagueId, u1, [
        { voted_user_id: u1, overall: 3 },
        { voted_user_id: u2, overall: 9, technique: 8, pace: 8, defense: 8, attack: 8, physical: 8 },
      ]);
      await submitVotes(created.id, leagueId, u2, [
        { voted_user_id: u2, overall: 9 },
        { voted_user_id: u1, overall: 5, technique: 6, pace: 6, defense: 6, attack: 6, physical: 6 },
      ]);

      const beforeA = await prisma.match_players.findUnique({
        where: { match_id_user_id: { match_id: created.id, user_id: u1 } },
        select: { match_rating: true },
      });
      const beforeB = await prisma.match_players.findUnique({
        where: { match_id_user_id: { match_id: created.id, user_id: u2 } },
        select: { match_rating: true },
      });

      await grantStack(u1, "ranking_heist_swap", 1);
      const act = await activateConsumable(u1, "ranking_heist_swap", leagueId);
      expect(act.ok).toBe(true);

      const afterA = await prisma.match_players.findUnique({
        where: { match_id_user_id: { match_id: created.id, user_id: u1 } },
        select: { match_rating: true },
      });
      const afterB = await prisma.match_players.findUnique({
        where: { match_id_user_id: { match_id: created.id, user_id: u2 } },
        select: { match_rating: true },
      });

      expect(Number(afterA?.match_rating)).toBe(Number(beforeB?.match_rating));
      expect(Number(afterB?.match_rating)).toBe(Number(beforeA?.match_rating));
    } finally {
      await cleanupLeague({ leagueId, userIds: [u1, u2], matchIds });
    }
  });

  it("POST: rewind_teammate_vote elimina el peor voto recibido de un compañero", async () => {
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const { leagueId, u1, u2 } = await makeLeague2Users(runId);
    const matchIds: string[] = [];
    try {
      await ensureConsumable("rewind_teammate_vote");
      const created = await createMatch({
        leagueId,
        adminId: u1,
        location: "Cancha",
        dateTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        price: 0,
        players: [
          { id: u1, team: "A" },
          { id: u2, team: "B" },
        ],
      });
      matchIds.push(created.id);
      await prisma.match_players.updateMany({ where: { match_id: created.id }, data: { has_confirmed: true } });
      await submitVotes(created.id, leagueId, u1, [
        { voted_user_id: u1, overall: 8 },
        { voted_user_id: u2, overall: 2, technique: 7, pace: 7, defense: 7, attack: 7, physical: 7 },
      ]);
      await submitVotes(created.id, leagueId, u2, [
        { voted_user_id: u2, overall: 8 },
        { voted_user_id: u1, overall: 8, technique: 7, pace: 7, defense: 7, attack: 7, physical: 7 },
      ]);

      await grantStack(u1, "rewind_teammate_vote", 1);
      const act = await activateConsumable(u1, "rewind_teammate_vote", leagueId);
      expect(act.ok).toBe(true);

      const mp = await prisma.match_players.findUnique({
        where: { match_id_user_id: { match_id: created.id, user_id: u1 } },
        select: { match_rating: true },
      });
      expect(Number(mp?.match_rating || 0)).toBe(8);
    } finally {
      await cleanupLeague({ leagueId, userIds: [u1, u2], matchIds });
    }
  });
});

