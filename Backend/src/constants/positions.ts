/**
 * Posiciones válidas de jugador (español).
 */
export const VALID_POSITIONS = [
  "Arquero",
  "Defensor",
  "Mediocampista",
  "Delantero",
] as const;

export function isValidPosition(pos: string | null | undefined): boolean {
  if (!pos || pos.trim() === "") return false;
  return VALID_POSITIONS.includes(pos as (typeof VALID_POSITIONS)[number]);
}
