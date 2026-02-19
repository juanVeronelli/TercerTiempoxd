import type { Prisma } from "../generated/client/index.js";
import { prisma } from "../server.js";

export type TxClient = Prisma.TransactionClient;

/** Par normalizado para comparar "mismo duelo" (sin importar orden). */
function pairKey(id1: string, id2: string): string {
  return [id1, id2].sort().join(",");
}

/**
 * Genera un duelo para un partido: empareja 2 jugadores confirmados.
 * - No repite el mismo enfrentamiento dos fechas seguidas.
 * - Prioriza duelos donde los dos son de equipos distintos (A vs B).
 * - Mayor variedad: considera más candidatos equilibrados por rating.
 */
export async function generateMatchDuel(matchId: string): Promise<{
  duel: { id: string; match_id: string; challenger_id: string; rival_id: string; status: string | null };
  details: {
    challenger: { full_name: string | null; profile_photo_url: string | null };
    rival: { full_name: string | null; profile_photo_url: string | null };
    rating_diff: string;
  };
}> {
  const match = await prisma.matches.findUnique({
    where: { id: matchId },
    include: { match_players: true },
  });

  if (!match) {
    throw new Error("PARTIDO_NO_ENCONTRADO");
  }

  const existingDuel = await prisma.duels.findFirst({
    where: { match_id: matchId },
  });

  if (existingDuel) {
    throw new Error("YA_EXISTE_DUELO");
  }

  const confirmedPlayers = match.match_players.filter((mp) => mp.has_confirmed);
  const confirmedPlayerIds = confirmedPlayers.map((mp) => mp.user_id);

  if (confirmedPlayerIds.length < 2) {
    throw new Error("SE_NECESITAN_2_JUGADORES_CONFIRMADOS");
  }

  if (!match.league_id) {
    throw new Error("PARTIDO_SIN_LIGA");
  }

  const leagueId = match.league_id;

  // Equipo de cada jugador en ESTE partido (A, B, etc.)
  const teamByUser: Record<string, string> = {};
  confirmedPlayers.forEach((mp) => {
    teamByUser[mp.user_id] = String(mp.team || "").trim().toUpperCase();
  });

  // Último duelo de la liga (otro partido ya cerrado) para no repetir el mismo enfrentamiento
  const lastCompletedMatch = await prisma.matches.findFirst({
    where: {
      league_id: leagueId,
      status: "COMPLETED",
      id: { not: matchId },
    },
    orderBy: { date_time: "desc" },
    select: { id: true },
  });

  let lastDuelPairKey: string | null = null;
  if (lastCompletedMatch) {
    const lastDuel = await prisma.duels.findFirst({
      where: { match_id: lastCompletedMatch.id },
      select: { challenger_id: true, rival_id: true },
    });
    if (lastDuel) {
      lastDuelPairKey = pairKey(lastDuel.challenger_id, lastDuel.rival_id);
    }
  }

  const members = await prisma.league_members.findMany({
    where: {
      league_id: leagueId,
      user_id: { in: confirmedPlayerIds },
    },
    select: {
      user_id: true,
      league_overall: true,
      users: {
        select: { full_name: true, profile_photo_url: true },
      },
    },
  });

  if (members.length < 2) {
    throw new Error("DATOS_INSUFICIENTES_MIEMBROS");
  }

  interface CandidatePair {
    p1: (typeof members)[0];
    p2: (typeof members)[0];
    diff: number;
    sameTeam: boolean;
    key: string;
  }

  const allCandidates: CandidatePair[] = [];
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const p1 = members[i];
      const p2 = members[j];
      if (!p1 || !p2) continue;
      const diff = Math.abs(
        Number(p1.league_overall || 0) - Number(p2.league_overall || 0),
      );
      const t1 = teamByUser[p1.user_id] || "";
      const t2 = teamByUser[p2.user_id] || "";
      const sameTeam = t1 !== "" && t2 !== "" && t1 === t2;
      const key = pairKey(p1.user_id, p2.user_id);
      allCandidates.push({ p1, p2, diff, sameTeam, key });
    }
  }

  // Excluir el par que ya salió en la fecha anterior (no repetir dos fechas seguidas)
  const candidates = lastDuelPairKey
    ? allCandidates.filter((c) => c.key !== lastDuelPairKey)
    : allCandidates;

  if (candidates.length === 0) {
    throw new Error("NO_PAREJAS_COMPATIBLES");
  }

  // Ordenar por diff (más equilibrados primero) para tener buen pool
  candidates.sort((a, b) => a.diff - b.diff);

  const differentTeam = candidates.filter((c) => !c.sameTeam);
  const sameTeam = candidates.filter((c) => c.sameTeam);

  // Priorizar equipos distintos; si hay, elegir entre ellos con más variedad (top 6 por diff)
  const pool =
    differentTeam.length > 0 ? differentTeam : sameTeam;
  const topN = Math.min(pool.length, 6);
  const poolSlice = pool.slice(0, topN);
  const selectedPair = poolSlice[Math.floor(Math.random() * poolSlice.length)];

  if (!selectedPair?.p1?.user_id || !selectedPair?.p2?.user_id) {
    throw new Error("ERROR_SELECCION_PAREJA");
  }

  const newDuel = await prisma.duels.create({
    data: {
      match_id: matchId,
      challenger_id: selectedPair.p1.user_id,
      rival_id: selectedPair.p2.user_id,
      status: "PENDING",
    },
  });

  return {
    duel: {
      id: newDuel.id,
      match_id: newDuel.match_id,
      challenger_id: newDuel.challenger_id,
      rival_id: newDuel.rival_id,
      status: newDuel.status,
    },
    details: {
      challenger: selectedPair.p1.users,
      rival: selectedPair.p2.users,
      rating_diff: selectedPair.diff.toFixed(2),
    },
  };
}

/**
 * Resuelve el duelo del partido (ganador por match_rating).
 * Si se pasa `tx`, se ejecuta dentro de esa transacción.
 */
export async function resolveMatchDuel(
  matchId: string,
  tx?: TxClient,
): Promise<string | null | undefined> {
  const client = tx ?? prisma;

  try {
    const duel = await client.duels.findFirst({
      where: { match_id: matchId, status: { in: ["PENDING", "ACTIVE"] } },
    });

    if (!duel) return undefined;

    const performances = await client.match_players.findMany({
      where: {
        match_id: matchId,
        user_id: { in: [duel.challenger_id, duel.rival_id] },
      },
      select: { user_id: true, match_rating: true },
    });

    const challengerPerf = performances.find(
      (p) => p.user_id === duel.challenger_id,
    );
    const rivalPerf = performances.find((p) => p.user_id === duel.rival_id);

    const ratingA = Number(challengerPerf?.match_rating || 0);
    const ratingB = Number(rivalPerf?.match_rating || 0);

    let winnerId: string | null = null;
    let status = "COMPLETED";

    if (ratingA > ratingB) {
      winnerId = duel.challenger_id;
    } else if (ratingB > ratingA) {
      winnerId = duel.rival_id;
    } else {
      status = "DRAW";
    }

    await client.duels.update({
      where: { id: duel.id },
      data: { winner_id: winnerId, status },
    });

    if (winnerId) {
      const match = await client.matches.findUnique({
        where: { id: matchId },
        select: { league_id: true },
      });

      if (match?.league_id) {
        await client.league_members.update({
          where: {
            league_id_user_id: {
              league_id: match.league_id,
              user_id: winnerId,
            },
          },
          data: {
            honors_duel: { increment: 1 },
            league_overall: { increment: 0.1 },
          },
        });
      }
    }

    return winnerId;
  } catch (error) {
    console.error("Error resolviendo duelo:", error);
    return undefined;
  }
}
