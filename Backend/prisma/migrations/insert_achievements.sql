-- =============================================================================
-- SEED: LOGROS Y MISIONES (~70 misiones variadas)
-- Plan FREE: STAT_BOOST (+1 stat, +0.5 promedio)
-- Plan PRO: COSMETIC (marcos, banners, colores) + items vitrina
-- is_pro_exclusive=true → Free ven la misión pero con candado en la recompensa
-- =============================================================================
--
-- CONDITION_TYPES (para el backend):
--   MATCHES_PLAYED, MATCHES_WON, WIN_STREAK, LOSS_STREAK
--   DEFENSE_SINGLE, ATTACK_SINGLE, PACE_SINGLE, TECHNIQUE_SINGLE, PHYSICAL_SINGLE, OVERALL_SINGLE
--   MVP_COUNT, TRONCO_COUNT, FANTASMA_COUNT, CLEAN_SHEET_COUNT
--   TRONCO_THEN_MVP, SAME_PARTNER_WINS, MATCHES_ORGANIZED, WEEKS_ACTIVE_STREAK
--   VOTES_CAST, DUEL_WINS, PREDICTION_CORRECT
--   LEAGUE_RANK_REACHED, AVG_RATING_OVER_MATCHES, RANK_OVERTAKE
--   ACHIEVEMENTS_UNLOCKED, COSMETIC_ACHIEVEMENTS_CLAIMED
--   MULTI_STAT_8_SINGLE, COMEBACK_WIN, MATCHES_CONFIRMED, MATCHES_NO_FANTASMA_STREAK
--
-- COSMÉTICOS: BADGE incluye accent colors (accent_gold, accent_emerald...) y showcase items.
-- Default frame: "simple". Marcos/banners desbloqueables vía logros.
--
-- =============================================================================

-- Requiere que la tabla achievements exista (ejecutar achievements_system.sql primero)

INSERT INTO achievements (title, description, category, condition_type, condition_value, reward_type, reward_value, is_pro_exclusive, sort_order) VALUES

-- =============================================================================
-- CATEGORÍA: RENDIMIENTO / MATCH (Partidos)
-- =============================================================================

-- Fácil - FREE
('Debutante', 'Juega tu primer partido', 'MATCH', 'MATCHES_PLAYED', 1, 'STAT_BOOST', '{"pace": 0.5}', false, 101),
('Primer Gol (figurado)', 'Participa en 3 partidos', 'MATCH', 'MATCHES_PLAYED', 3, 'STAT_BOOST', '{"league_overall": 0.25}', false, 102),
('Regular', 'Juega 10 partidos en una liga', 'MATCH', 'MATCHES_PLAYED', 10, 'STAT_BOOST', '{"technique": 0.5}', false, 103),
('Frecuente', 'Juega 25 partidos', 'MATCH', 'MATCHES_PLAYED', 25, 'STAT_BOOST', '{"physical": 0.5}', false, 104),
('Veterano', 'Juega 50 partidos', 'MATCH', 'MATCHES_PLAYED', 50, 'STAT_BOOST', '{"defense": 0.5, "attack": 0.5}', false, 105),

-- Racha Ganadora - FREE hasta III, PRO después
('Racha Ganadora I', 'Gana 3 partidos seguidos', 'STREAK', 'WIN_STREAK', 3, 'STAT_BOOST', '{"pace": 1}', false, 111),
('Racha Ganadora II', 'Gana 5 partidos seguidos', 'STREAK', 'WIN_STREAK', 5, 'STAT_BOOST', '{"league_overall": 0.5}', false, 112),
('Racha Ganadora III', 'Gana 7 partidos seguidos', 'STREAK', 'WIN_STREAK', 7, 'STAT_BOOST', '{"defense": 1, "attack": 1}', false, 113),
('Racha Ganadora IV', 'Gana 10 partidos seguidos', 'STREAK', 'WIN_STREAK', 10, 'COSMETIC', '{"cosmetic_key": "streak_frame", "cosmetic_type": "FRAME"}', true, 114),
('Invencible', 'Gana 15 partidos seguidos', 'STREAK', 'WIN_STREAK', 15, 'COSMETIC', '{"cosmetic_key": "gold_frame", "cosmetic_type": "FRAME"}', true, 115),

-- Stats individuales en un partido - FREE
('La Muralla', 'Saca 9 o más en Defensa en un partido', 'MATCH', 'DEFENSE_SINGLE', 9, 'STAT_BOOST', '{"defense": 1}', false, 121),
('Muro de Hierro', 'Saca 10 en Defensa en un partido', 'MATCH', 'DEFENSE_SINGLE', 10, 'STAT_BOOST', '{"defense": 1, "physical": 0.5}', false, 122),
('El Francotirador', 'Saca 9 o más en Ataque en un partido', 'MATCH', 'ATTACK_SINGLE', 9, 'STAT_BOOST', '{"attack": 1}', false, 123),
('Romperredes', 'Saca 10 en Ataque en un partido', 'MATCH', 'ATTACK_SINGLE', 10, 'STAT_BOOST', '{"attack": 1, "pace": 0.5}', false, 124),
('Relámpago', 'Saca 9 o más en Ritmo en un partido', 'MATCH', 'PACE_SINGLE', 9, 'STAT_BOOST', '{"pace": 1}', false, 125),
('Técnica Pura', 'Saca 9 o más en Técnica en un partido', 'MATCH', 'TECHNIQUE_SINGLE', 9, 'STAT_BOOST', '{"technique": 1}', false, 126),
('Fuerza Bruta', 'Saca 9 o más en Físico en un partido', 'MATCH', 'PHYSICAL_SINGLE', 9, 'STAT_BOOST', '{"physical": 1}', false, 127),
('Equilibrado', 'Saca 8 o más en Promedio General en un partido', 'MATCH', 'OVERALL_SINGLE', 8, 'STAT_BOOST', '{"league_overall": 0.5}', false, 128),
('Estrella del Partido', 'Saca 9 o más en Promedio General en un partido', 'MATCH', 'OVERALL_SINGLE', 9, 'STAT_BOOST', '{"league_overall": 0.5, "technique": 0.5}', false, 129),

-- MVP - FREE hasta 3, PRO después
('MVP Novato', 'Gana tu primer MVP', 'MATCH', 'MVP_COUNT', 1, 'STAT_BOOST', '{"league_overall": 0.5}', false, 131),
('MVP Recurrente', 'Gana 3 MVPs', 'MATCH', 'MVP_COUNT', 3, 'STAT_BOOST', '{"technique": 1, "attack": 0.5}', false, 132),
('MVP Consagrado', 'Gana 5 MVPs', 'MATCH', 'MVP_COUNT', 5, 'COSMETIC', '{"cosmetic_key": "mvp_frame", "cosmetic_type": "FRAME"}', true, 133),
('MVP Legendario', 'Gana 10 MVPs', 'MATCH', 'MVP_COUNT', 10, 'COSMETIC', '{"cosmetic_key": "gold_frame", "cosmetic_type": "FRAME"}', true, 134),
('MVP Épico', 'Gana 25 MVPs', 'MATCH', 'MVP_COUNT', 25, 'COSMETIC', '{"cosmetic_key": "crown_frame", "cosmetic_type": "FRAME"}', true, 135),

-- Valla invicta (Clean Sheet / Portero)
('Portero Firme', 'Gana la valla invicta 1 vez (equipo no recibe goles)', 'MATCH', 'CLEAN_SHEET_COUNT', 1, 'STAT_BOOST', '{"defense": 0.5}', false, 141),
('El Muro', 'Gana la valla invicta 3 veces', 'MATCH', 'CLEAN_SHEET_COUNT', 3, 'STAT_BOOST', '{"defense": 1}', false, 142),
('Muralla Impenetrable', 'Gana la valla invicta 5 veces', 'MATCH', 'CLEAN_SHEET_COUNT', 5, 'COSMETIC', '{"cosmetic_key": "wall_banner", "cosmetic_type": "BANNER"}', true, 143),

-- =============================================================================
-- CATEGORÍA: SOCIAL / LEALTAD
-- =============================================================================

('Socio Ideal', 'Juega 5 partidos con el mismo compañero ganando', 'SOCIAL', 'SAME_PARTNER_WINS', 5, 'STAT_BOOST', '{"technique": 0.5, "physical": 0.5}', false, 201),
('Dúo Dinámico', 'Juega 10 partidos ganando con el mismo compañero', 'SOCIAL', 'SAME_PARTNER_WINS', 10, 'STAT_BOOST', '{"league_overall": 0.5}', false, 202),
('Hermanos de Cancha', 'Juega 20 partidos ganando con el mismo compañero', 'SOCIAL', 'SAME_PARTNER_WINS', 20, 'COSMETIC', '{"cosmetic_key": "duo_frame", "cosmetic_type": "FRAME"}', true, 203),

('Capitán', 'Organiza 10 partidos', 'SOCIAL', 'MATCHES_ORGANIZED', 10, 'STAT_BOOST', '{"league_overall": 0.5}', false, 211),
('Director de Cancha', 'Organiza 25 partidos', 'SOCIAL', 'MATCHES_ORGANIZED', 25, 'STAT_BOOST', '{"technique": 1}', false, 212),
('Anfitrión de Leyenda', 'Organiza 50 partidos', 'SOCIAL', 'MATCHES_ORGANIZED', 50, 'COSMETIC', '{"cosmetic_key": "captain_frame", "cosmetic_type": "FRAME"}', true, 213),

('Fiel', 'Juega al menos 1 partido por semana durante 4 semanas seguidas', 'SOCIAL', 'WEEKS_ACTIVE_STREAK', 4, 'STAT_BOOST', '{"pace": 1}', false, 221),
('Comprometido', 'Juega al menos 1 partido por semana durante 8 semanas', 'SOCIAL', 'WEEKS_ACTIVE_STREAK', 8, 'STAT_BOOST', '{"league_overall": 0.5, "physical": 0.5}', false, 222),
('Imparable', 'Juega al menos 1 partido por semana durante 12 semanas', 'SOCIAL', 'WEEKS_ACTIVE_STREAK', 12, 'COSMETIC', '{"cosmetic_key": "loyalty_banner", "cosmetic_type": "BANNER"}', true, 223),

('Votante Activo', 'Emite 20 votos en partidos', 'SOCIAL', 'VOTES_CAST', 20, 'STAT_BOOST', '{"technique": 0.5}', false, 231),
('Crítico Justo', 'Emite 50 votos en partidos', 'SOCIAL', 'VOTES_CAST', 50, 'STAT_BOOST', '{"league_overall": 0.25}', false, 232),

-- =============================================================================
-- CATEGORÍA: RANKING
-- =============================================================================

('Subiendo', 'Alcanza el Top 10 del ranking de tu liga', 'RANKING', 'LEAGUE_RANK_REACHED', 10, 'STAT_BOOST', '{"pace": 0.5}', false, 301),
('Top 5', 'Alcanza el Top 5 del ranking de tu liga', 'RANKING', 'LEAGUE_RANK_REACHED', 5, 'STAT_BOOST', '{"league_overall": 0.5}', false, 302),
('Podio', 'Alcanza el Top 3 del ranking de tu liga', 'RANKING', 'LEAGUE_RANK_REACHED', 3, 'STAT_BOOST', '{"technique": 1, "attack": 0.5}', false, 303),
('Campeón', 'Lidera el ranking de tu liga', 'RANKING', 'LEAGUE_RANK_REACHED', 1, 'COSMETIC', '{"cosmetic_key": "champion_frame", "cosmetic_type": "FRAME"}', true, 304),

('Rating Constante', 'Mantén un promedio de 7.0 en 5 partidos seguidos', 'RANKING', 'AVG_RATING_OVER_MATCHES', 7, 'STAT_BOOST', '{"league_overall": 0.5}', false, 311),
('Rating Estrella', 'Mantén un promedio de 8.0 en 5 partidos seguidos', 'RANKING', 'AVG_RATING_OVER_MATCHES', 8, 'STAT_BOOST', '{"technique": 1}', false, 312),
('Rating Legendario', 'Mantén un promedio de 8.5 en 10 partidos seguidos', 'RANKING', 'AVG_RATING_OVER_MATCHES', 8.5, 'COSMETIC', '{"cosmetic_key": "accent_gold", "cosmetic_type": "BADGE"}', true, 313),

-- =============================================================================
-- CATEGORÍA: ANTI-LOGROS (Divertidos)
-- =============================================================================

('Fénix', 'Gana un MVP justo después de haber sido Tronco en el partido anterior', 'MATCH', 'TRONCO_THEN_MVP', 1, 'STAT_BOOST', '{"physical": 1}', false, 401),
('Resurrección', 'Fénix: de Tronco a MVP. Desbloquea marco especial.', 'MATCH', 'TRONCO_THEN_MVP', 1, 'COSMETIC', '{"cosmetic_key": "phoenix_frame", "cosmetic_type": "FRAME"}', true, 402),

('Mala Racha', 'Pierde 3 partidos seguidos', 'STREAK', 'LOSS_STREAK', 3, 'COSMETIC', '{"cosmetic_key": "ghost_frame", "cosmetic_type": "FRAME"}', false, 411),
('Cuesta Arriba', 'Pierde 5 partidos seguidos (pero no te rindas)', 'STREAK', 'LOSS_STREAK', 5, 'COSMETIC', '{"cosmetic_key": "ghost_frame", "cosmetic_type": "FRAME"}', true, 412),

('Tronco Honesto', 'Recibe 3 votos de Tronco (con orgullo)', 'MATCH', 'TRONCO_COUNT', 3, 'STAT_BOOST', '{"physical": 0.5}', false, 421),
('Tronco Profesional', 'Recibe 5 votos de Tronco', 'MATCH', 'TRONCO_COUNT', 5, 'COSMETIC', '{"cosmetic_key": "trunk_badge", "cosmetic_type": "BADGE"}', true, 422),

('Fantasma', 'No te presentes a un partido al que fuiste convocado', 'MATCH', 'FANTASMA_COUNT', 1, 'STAT_BOOST', '{"pace": 0.25}', false, 431),
('Fantasma Recurrente', 'Acumula 3 Fantasmas (el equipo te recuerda)', 'MATCH', 'FANTASMA_COUNT', 3, 'COSMETIC', '{"cosmetic_key": "ghost_frame", "cosmetic_type": "FRAME"}', true, 432),

-- =============================================================================
-- CATEGORÍA: DUELOS
-- =============================================================================

('Duelista', 'Gana tu primer duelo 1v1', 'MATCH', 'DUEL_WINS', 1, 'STAT_BOOST', '{"attack": 0.5}', false, 501),
('Duelista Consagrado', 'Gana 5 duelos', 'MATCH', 'DUEL_WINS', 5, 'STAT_BOOST', '{"technique": 1}', false, 502),
('Rey del Duelo', 'Gana 10 duelos', 'MATCH', 'DUEL_WINS', 10, 'COSMETIC', '{"cosmetic_key": "duel_frame", "cosmetic_type": "FRAME"}', true, 503),
('Gladiador', 'Gana 25 duelos', 'MATCH', 'DUEL_WINS', 25, 'COSMETIC', '{"cosmetic_key": "gladiator_banner", "cosmetic_type": "BANNER"}', true, 504),

-- =============================================================================
-- CATEGORÍA: PRODE / PREDICCIONES
-- =============================================================================

('Adivino', 'Acierta 5 predicciones correctas', 'MATCH', 'PREDICTION_CORRECT', 5, 'STAT_BOOST', '{"technique": 0.5}', false, 601),
('Oráculo', 'Acierta 15 predicciones correctas', 'MATCH', 'PREDICTION_CORRECT', 15, 'STAT_BOOST', '{"league_overall": 0.5}', false, 602),
('Bola de Cristal', 'Acierta 30 predicciones correctas', 'MATCH', 'PREDICTION_CORRECT', 30, 'COSMETIC', '{"cosmetic_key": "oracle_frame", "cosmetic_type": "FRAME"}', true, 603),
('Vidente', 'Acierta 50 predicciones correctas', 'MATCH', 'PREDICTION_CORRECT', 50, 'COSMETIC', '{"cosmetic_key": "crystal_ball_banner", "cosmetic_type": "BANNER"}', true, 604),

-- =============================================================================
-- COSMÉTICOS PRO ADICIONALES (Colores de acento, Marcos premium)
-- =============================================================================

('Coleccionista', 'Desbloquea 5 logros de cualquier tipo', 'RANKING', 'ACHIEVEMENTS_UNLOCKED', 5, 'COSMETIC', '{"cosmetic_key": "accent_emerald", "cosmetic_type": "BADGE"}', true, 701),
('Maestro', 'Desbloquea 15 logros', 'RANKING', 'ACHIEVEMENTS_UNLOCKED', 15, 'COSMETIC', '{"cosmetic_key": "neon_frame", "cosmetic_type": "FRAME"}', true, 702),
('Leyenda', 'Desbloquea 25 logros', 'RANKING', 'ACHIEVEMENTS_UNLOCKED', 25, 'COSMETIC', '{"cosmetic_key": "neon_banner", "cosmetic_type": "BANNER"}', true, 703),
('Ícono', 'Desbloquea 40 logros', 'RANKING', 'ACHIEVEMENTS_UNLOCKED', 40, 'COSMETIC', '{"cosmetic_key": "accent_crimson", "cosmetic_type": "BADGE"}', true, 704),

-- Showcase / Vitrina (items para exhibir en perfil)
('Exhibicionista', 'Completa 10 misiones con recompensa cosmética', 'RANKING', 'COSMETIC_ACHIEVEMENTS_CLAIMED', 10, 'COSMETIC', '{"cosmetic_key": "trophy_showcase", "cosmetic_type": "BADGE"}', true, 711),
('Vitrina de Oro', 'Completa 20 misiones con recompensa cosmética', 'RANKING', 'COSMETIC_ACHIEVEMENTS_CLAIMED', 20, 'COSMETIC', '{"cosmetic_key": "gold_showcase", "cosmetic_type": "BADGE"}', true, 712),

-- =============================================================================
-- VARIACIONES EXTRA (Rellenar hasta ~70)
-- =============================================================================

('Primera Victoria', 'Gana tu primer partido', 'MATCH', 'MATCHES_WON', 1, 'STAT_BOOST', '{"attack": 0.5}', false, 801),
('Diez Victorias', 'Gana 10 partidos', 'MATCH', 'MATCHES_WON', 10, 'STAT_BOOST', '{"pace": 0.5}', false, 802),
('Cincuenta Victorias', 'Gana 50 partidos', 'MATCH', 'MATCHES_WON', 50, 'STAT_BOOST', '{"league_overall": 0.5, "defense": 0.5}', false, 803),
('Centenario', 'Gana 100 partidos', 'MATCH', 'MATCHES_WON', 100, 'COSMETIC', '{"cosmetic_key": "century_banner", "cosmetic_type": "BANNER"}', true, 804),

('Todo Terreno', 'Saca 8 o más en 3 stats diferentes en un mismo partido', 'MATCH', 'MULTI_STAT_8_SINGLE', 3, 'STAT_BOOST', '{"league_overall": 0.5}', false, 811),
('Pentacampeón', 'Saca 8 o más en los 5 stats en un mismo partido', 'MATCH', 'MULTI_STAT_8_SINGLE', 5, 'COSMETIC', '{"cosmetic_key": "all_rounder_frame", "cosmetic_type": "FRAME"}', true, 812),

('Remontada', 'Gana un partido después de ir perdiendo a mitad de tiempo', 'MATCH', 'COMEBACK_WIN', 1, 'STAT_BOOST', '{"physical": 1}', false, 821),
('Rey de la Remontada', 'Gana 5 partidos remontando', 'MATCH', 'COMEBACK_WIN', 5, 'COSMETIC', '{"cosmetic_key": "comeback_frame", "cosmetic_type": "FRAME"}', true, 822),

('Confirmado', 'Confirma asistencia a 10 partidos', 'SOCIAL', 'MATCHES_CONFIRMED', 10, 'STAT_BOOST', '{"technique": 0.5}', false, 831),
('Siempre Listo', 'Confirma asistencia a 25 partidos', 'SOCIAL', 'MATCHES_CONFIRMED', 25, 'STAT_BOOST', '{"pace": 0.5}', false, 832),

('Superador', 'Supera a un rival en el ranking que iba por encima de ti', 'RANKING', 'RANK_OVERTAKE', 1, 'STAT_BOOST', '{"attack": 0.5}', false, 841),
('Cazador de Puestos', 'Supera a 5 rivales en el ranking en una temporada', 'RANKING', 'RANK_OVERTAKE', 5, 'COSMETIC', '{"cosmetic_key": "accent_neon_blue", "cosmetic_type": "BADGE"}', true, 842),

('Sin Faltar', 'Juega 5 partidos seguidos sin ser Fantasma', 'STREAK', 'MATCHES_NO_FANTASMA_STREAK', 5, 'STAT_BOOST', '{"physical": 0.5}', false, 851),
('Fiabilidad Total', 'Juega 15 partidos seguidos sin ser Fantasma', 'STREAK', 'MATCHES_NO_FANTASMA_STREAK', 15, 'STAT_BOOST', '{"league_overall": 0.5}', false, 852);
