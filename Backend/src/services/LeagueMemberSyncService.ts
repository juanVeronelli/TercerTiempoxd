import type { TxClient } from "./TtpService.js";

/**
 * Recalcula `league_members` desde el historial real de partidos cerrados y honores en DB.
 * Usar tras borrar partido del CV, cambiar carta de un partido, etc.
 */
export async function syncLeagueMemberFromHistory(
  tx: TxClient,
  userId: string,
  leagueId: string,
): Promise<void> {
  const mps = await tx.match_players.findMany({
    where: {
      user_id: userId,
      matches: { league_id: leagueId, status: { in: ["COMPLETED", "FINISHED"] } },
    },
    select: {
      match_rating: true,
      match_technique: true,
      match_physical: true,
      match_pace: true,
      match_defense: true,
      match_attack: true,
      prediction_points: true,
    },
  });

  const n = mps.length;

  const mean = (pick: (m: (typeof mps)[0]) => number | null): number => {
    if (n === 0) return 5.0;
    const vals = mps
      .map(pick)
      .filter((v): v is number => v != null && Number.isFinite(v));
    if (vals.length === 0) return 5.0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  const prodeSum = mps.reduce((s, m) => s + (m.prediction_points ?? 0), 0);

  const honorsRows = await tx.honors.findMany({
    where: { league_id: leagueId, user_id: userId },
    select: { honor_type: true },
  });

  let honors_mvp = 0;
  let honors_tronco = 0;
  let honors_fantasma = 0;
  let honors_prediction = 0;
  let honors_duel = 0;

  for (const h of honorsRows) {
    const t = String(h.honor_type || "").toUpperCase();
    if (t === "MVP") honors_mvp++;
    else if (t === "TRONCO") honors_tronco++;
    else if (t === "FANTASMA") honors_fantasma++;
    else if (t === "ORACLE" || t === "CRYSTAL_BALL") honors_prediction++;
    else if (t === "DUEL_WINNER" || t.includes("DUEL")) honors_duel++;
  }

  await tx.league_members.update({
    where: { league_id_user_id: { league_id: leagueId, user_id: userId } },
    data: {
      matches_played: n,
      league_overall: mean((m) =>
        m.match_rating != null ? Number(m.match_rating) : null,
      ),
      avg_technique: mean((m) =>
        m.match_technique != null ? Number(m.match_technique) : null,
      ),
      avg_physical: mean((m) =>
        m.match_physical != null ? Number(m.match_physical) : null,
      ),
      avg_pace: mean((m) => (m.match_pace != null ? Number(m.match_pace) : null)),
      avg_defense: mean((m) =>
        m.match_defense != null ? Number(m.match_defense) : null,
      ),
      avg_attack: mean((m) =>
        m.match_attack != null ? Number(m.match_attack) : null,
      ),
      prode_points_total: prodeSum,
      honors_mvp,
      honors_tronco,
      honors_fantasma,
      honors_prediction,
      honors_duel,
    },
  });
}
