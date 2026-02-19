/**
 * Servicio de balanceo de equipos por rating.
 * Reparte jugadores en dos equipos minimizando la diferencia de promedio.
 */

export interface PlayerWithRating {
  id: string;
  rating: number;
  [key: string]: unknown;
}

/**
 * Genera dos equipos balanceados por rating (greedy).
 * Ordena por rating descendente y asigna cada jugador al equipo con menor suma actual.
 */
export function generateTeams(
  players: PlayerWithRating[],
): [PlayerWithRating[], PlayerWithRating[]] {
  if (players.length === 0) {
    return [[], []];
  }

  const sorted = [...players].sort((a, b) => b.rating - a.rating);
  const teamA: PlayerWithRating[] = [];
  const teamB: PlayerWithRating[] = [];
  let sumA = 0;
  let sumB = 0;

  for (const p of sorted) {
    if (sumA <= sumB) {
      teamA.push(p);
      sumA += p.rating;
    } else {
      teamB.push(p);
      sumB += p.rating;
    }
  }

  return [teamA, teamB];
}
