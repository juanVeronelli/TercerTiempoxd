/**
 * Posiciones de jugador en español (único formato permitido).
 */
export const PLAYER_POSITIONS = [
  "Arquero",
  "Defensor",
  "Mediocampista",
  "Delantero",
] as const;

export type PlayerPosition = (typeof PLAYER_POSITIONS)[number];

/**
 * Mapeo de abreviaturas/valores legacy al español para compatibilidad.
 */
const LEGACY_TO_SPANISH: Record<string, string> = {
  GK: "Arquero",
  DEF: "Defensor",
  MID: "Mediocampista",
  FWD: "Delantero",
  PORTERO: "Arquero",
  DEFENSA: "Defensor",
  MEDIO: "Mediocampista",
  DELANTERO: "Delantero",
};

/**
 * Devuelve la etiqueta en español para mostrar en UI.
 * Soporta valores legacy (GK, DEF, etc.) y los nuevos en español.
 */
export function formatPositionForDisplay(
  pos: string | null | undefined
): string {
  if (!pos || pos.trim() === "") return "Posición no definida";
  const upper = pos.toUpperCase();
  return LEGACY_TO_SPANISH[upper] ?? pos;
}
