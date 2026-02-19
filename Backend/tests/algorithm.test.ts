/**
 * Unit tests: algoritmo de balanceo de equipos (generateTeams).
 */
import { generateTeams } from "../src/services/teamBalancingService.js";
import type { PlayerWithRating } from "../src/services/teamBalancingService.js";

describe("generateTeams", () => {
  const mockPlayers: PlayerWithRating[] = [
    { id: "1", rating: 9 },
    { id: "2", rating: 8 },
    { id: "3", rating: 7 },
    { id: "4", rating: 6 },
    { id: "5", rating: 5 },
    { id: "6", rating: 5 },
    { id: "7", rating: 4 },
    { id: "8", rating: 4 },
    { id: "9", rating: 3 },
    { id: "10", rating: 2 },
  ];

  it("devuelve dos arrays de longitud 5", () => {
    const [teamA, teamB] = generateTeams(mockPlayers);
    expect(Array.isArray(teamA)).toBe(true);
    expect(Array.isArray(teamB)).toBe(true);
    expect(teamA).toHaveLength(5);
    expect(teamB).toHaveLength(5);
  });

  it("la diferencia de promedio entre equipos es menor a 2 puntos", () => {
    const [teamA, teamB] = generateTeams(mockPlayers);
    const avg = (arr: PlayerWithRating[]) =>
      arr.reduce((s, p) => s + p.rating, 0) / arr.length;
    const avgA = avg(teamA);
    const avgB = avg(teamB);
    const diff = Math.abs(avgA - avgB);
    expect(diff).toBeLessThan(2);
  });

  it("reparte todos los jugadores sin duplicados", () => {
    const [teamA, teamB] = generateTeams(mockPlayers);
    const ids = [...teamA.map((p) => p.id), ...teamB.map((p) => p.id)];
    const unique = new Set(ids);
    expect(unique.size).toBe(10);
    expect(ids).toHaveLength(10);
  });

  it("con array vacío devuelve dos arrays vacíos", () => {
    const [teamA, teamB] = generateTeams([]);
    expect(teamA).toEqual([]);
    expect(teamB).toEqual([]);
  });
});
