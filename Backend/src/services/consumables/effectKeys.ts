/**
 * Claves de efecto alineadas con `shop_items.effect_key` (catálogo v2).
 * Un solo sitio de verdad para evitar typos y bifurcaciones.
 */
export const EffectKey = {
  // PRE — carta
  OVERALL_SOFT_BOOST: "overall_soft_boost",
  OVERALL_MICRO_BOOST: "overall_micro_boost",
  OVERALL_PLUS_ONE: "overall_plus_one",
  TECH_SOFT_BOOST: "tech_soft_boost",
  TECH_PLUS_ONE: "tech_plus_one",
  OVERALL_MULTIPLIER_X2: "overall_multiplier_x2",
  // PRE — otros
  DUEL_RESERVED_SLOT: "duel_reserved_slot",
  PRODE_UNLIMITED_PICKS: "prode_unlimited_picks",
  PRODE_DOUBLE_POINTS: "prode_double_points",
  SPECTATOR_VOTE_PLAYER: "spectator_vote_player",
  SPECTATOR_OVERVOTE: "spectator_overvote",
  SHIELD_VS_FANTASMA: "shield_vs_fantasma",
  SHIELD_VS_TRONCO: "shield_vs_tronco",
  // POST
  REWIND_TEAMMATE_VOTE: "rewind_teammate_vote",
  MEDAL_FORFEIT_TOKEN: "medal_forfeit_token",
  GHOST_TOP_SCORE_TIE: "ghost_top_score_tie",
  HISTORY_DELETE_MATCH: "history_delete_match",
  RANKING_HEIST_SWAP: "ranking_heist_swap",
} as const;

export type EffectKeyType = (typeof EffectKey)[keyof typeof EffectKey];

/** Efectos numéricos PRE que se resuelven en `applyPreMatchConsumableStatBoosts` y consumen ahí. */
export const PRE_STAT_EFFECT_KEYS: ReadonlySet<string> = new Set([
  EffectKey.OVERALL_SOFT_BOOST,
  EffectKey.OVERALL_MICRO_BOOST,
  EffectKey.OVERALL_PLUS_ONE,
  EffectKey.TECH_SOFT_BOOST,
  EffectKey.TECH_PLUS_ONE,
  EffectKey.OVERALL_MULTIPLIER_X2,
]);

/** PRE que se consumen al cerrar el partido (voto / escudo), no en stat boost. */
export const PRE_CLOSE_CONSUME_EFFECT_KEYS: ReadonlySet<string> = new Set([
  EffectKey.SPECTATOR_VOTE_PLAYER,
  EffectKey.SPECTATOR_OVERVOTE,
  EffectKey.SHIELD_VS_FANTASMA,
  EffectKey.SHIELD_VS_TRONCO,
]);
