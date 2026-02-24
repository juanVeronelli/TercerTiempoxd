/**
 * Claves de AsyncStorage para coachmarks (onboarding contextual).
 * Se usan con prefijo para evitar colisiones.
 */

/** En true: el coachmark aparece cada vez (modo test). En false: solo la primera vez que el usuario entra (o cuando desbloquea la pantalla). */
export const COACHMARK_ALWAYS_SHOW = false;

export const COACHMARK_PREFIX = "@tercer_tiempo_coachmark_";

export const CoachmarkKeys = {
  RANKING: `${COACHMARK_PREFIX}has_seen_ranking`,
  STATS: `${COACHMARK_PREFIX}has_seen_stats`,
  TABLE: `${COACHMARK_PREFIX}has_seen_table`,
  HONORS: `${COACHMARK_PREFIX}has_seen_honors`,
  MATCH: `${COACHMARK_PREFIX}has_seen_match`,
  HOME: `${COACHMARK_PREFIX}has_seen_home`,
  PROFILE: `${COACHMARK_PREFIX}has_seen_profile`,
  RESULTS: `${COACHMARK_PREFIX}has_seen_results`,
} as const;

export type CoachmarkKey = (typeof CoachmarkKeys)[keyof typeof CoachmarkKeys];
