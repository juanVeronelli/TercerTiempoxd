/**
 * Constantes de dominio (backend).
 * Objetivo: evitar strings mágicos repetidos y normalizar valores usados por negocio.
 */

export const MatchStatus = {
  OPEN: "OPEN",
  ACTIVE: "ACTIVE",
  FINISHED: "FINISHED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  COMPLETING: "COMPLETING",
} as const;

export type MatchStatus = (typeof MatchStatus)[keyof typeof MatchStatus];

export const MatchMode = {
  INTERNAL: "INTERNAL",
  EXTERNAL: "EXTERNAL",
} as const;

export type MatchMode = (typeof MatchMode)[keyof typeof MatchMode];

export const LeagueRole = {
  MEMBER: "MEMBER",
  ADMIN: "ADMIN",
  OWNER: "OWNER",
} as const;

export type LeagueRole = (typeof LeagueRole)[keyof typeof LeagueRole];

export const Team = {
  A: "A",
  B: "B",
} as const;

export type Team = (typeof Team)[keyof typeof Team];

export function isLeagueStaffRole(role: unknown): boolean {
  const upper = normalizeUpper(role);
  return upper === LeagueRole.ADMIN || upper === LeagueRole.OWNER;
}

export function normalizeUpper(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

