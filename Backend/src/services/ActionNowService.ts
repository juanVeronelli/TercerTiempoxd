import { prisma } from "../db.js";

export type ActionNowCard = {
  key: string; // stable per user for "seen"
  kind:
    | "MISSION_CLAIM"
    | "HOUSE_BET_SETTLED"
    | "PRODE_OPEN"
    | "RESULTS_READY";
  title: string;
  subtitle: string;
  primary: { label: string; screen: string; params?: Record<string, string> };
};

async function getSeenKeys(userId: string) {
  const rows = await prisma.action_now_seen.findMany({
    where: { user_id: userId },
    select: { action_key: true },
  });
  return new Set(rows.map((r) => r.action_key));
}

export async function markActionsSeen(userId: string, keys: string[]) {
  const unique = Array.from(new Set(keys.map((k) => String(k)).filter(Boolean)));
  if (unique.length === 0) return;
  await prisma.action_now_seen.createMany({
    data: unique.map((k) => ({ user_id: userId, action_key: k })),
    skipDuplicates: true,
  });
}

export async function getActionsNow(params: { userId: string; leagueId?: string | null }) {
  const { userId, leagueId } = params;
  const seen = await getSeenKeys(userId);
  const now = new Date();

  const actions: ActionNowCard[] = [];

  // 1) Misiones completadas y sin reclamar
  const missions = await prisma.user_missions.findMany({
    where: {
      user_id: userId,
      is_completed: true,
      claimed_at: null,
    } as any,
    take: 5,
    orderBy: { completed_at: "desc" } as any,
    select: {
      id: true,
      missions: { select: { key: true, title: true, branch: true, reward_ttp: true } } as any,
    },
  });
  for (const um of missions as any[]) {
    const m = um.missions;
    const key = `mission_claim:${m.key}`;
    if (seen.has(key)) continue;
    actions.push({
      key,
      kind: "MISSION_CLAIM",
      title: "MISIÓN COMPLETADA",
      subtitle: `${m.title} · +${Number(m.reward_ttp ?? 0)} TTP`,
      primary: { label: "RECLAMAR", screen: "/(main)/league/profile/missions" },
    });
  }

  // 2) Apuestas asentadas (house slips) que todavía no viste
  if (leagueId) {
    const slips = await prisma.ttp_house_bet_slips.findMany({
      where: {
        user_id: userId,
        league_id: leagueId,
        status: { in: ["WON", "LOST", "VOID"] },
        settled_at: { not: null },
      } as any,
      take: 4,
      orderBy: { settled_at: "desc" } as any,
      select: { id: true, status: true, payout_ttp: true, match_id: true },
    });
    for (const s of slips as any[]) {
      const key = `house_slip_settled:${s.id}`;
      if (seen.has(key)) continue;
      const status = String(s.status).toUpperCase();
      const title = status === "WON" ? "APUESTA GANADA" : status === "LOST" ? "APUESTA PERDIDA" : "APUESTA ANULADA";
      const payout = Number(s.payout_ttp ?? 0);
      actions.push({
        key,
        kind: "HOUSE_BET_SETTLED",
        title,
        subtitle: payout > 0 ? `Cobrás +${payout} TTP` : "Resultado actualizado",
        primary: {
          label: "VER APUESTAS",
          screen: "/(main)/league/predictions",
          params: { leagueId, matchId: String(s.match_id) },
        },
      });
    }
  }

  // 3) Prode abierto (MATCH o MONTHLY) en esta liga
  if (leagueId) {
    const groups = await prisma.prediction_groups.findMany({
      where: { league_id: leagueId, closes_at: { gt: now } } as any,
      orderBy: { closes_at: "asc" } as any,
      take: 2,
      select: { id: true, type: true, match_id: true, period_key: true, closes_at: true },
    });
    for (const g of groups as any[]) {
      const key = `prode_open:${g.id}`;
      if (seen.has(key)) continue;
      const type = String(g.type).toUpperCase();
      actions.push({
        key,
        kind: "PRODE_OPEN",
        title: type === "MONTHLY" ? "PRODE MENSUAL" : "PRODE ABIERTO",
        subtitle: "Tenés predicciones para hacer.",
        primary: {
          label: "IR AL PRODE",
          screen: "/(main)/league/predictions",
          params: { leagueId },
        },
      });
    }
  }

  // 4) Resultados listos (último partido COMPLETED) — empuja a resultados
  if (leagueId) {
    const lastCompleted = await prisma.matches.findFirst({
      where: { league_id: leagueId, status: "COMPLETED" } as any,
      orderBy: { date_time: "desc" } as any,
      select: { id: true, location_name: true },
    });
    if (lastCompleted) {
      const key = `results_ready:${lastCompleted.id}`;
      if (!seen.has(key)) {
        actions.push({
          key,
          kind: "RESULTS_READY",
          title: "RESULTADOS DISPONIBLES",
          subtitle: lastCompleted.location_name ?? "Partido cerrado",
          primary: {
            label: "VER INFORME",
            screen: "/(main)/league/match/results",
            params: { matchId: lastCompleted.id, returnTo: "/(main)/league/home" },
          },
        });
      }
    }
  }

  // Orden: misiones y apuestas arriba, luego prode y resultados
  const order: Record<ActionNowCard["kind"], number> = {
    MISSION_CLAIM: 1,
    HOUSE_BET_SETTLED: 2,
    PRODE_OPEN: 3,
    RESULTS_READY: 4,
  };
  actions.sort((a, b) => order[a.kind] - order[b.kind]);

  return actions.slice(0, 8);
}

