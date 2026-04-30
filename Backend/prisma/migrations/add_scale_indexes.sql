-- Índices extra para escalar a miles de usuarios (hot paths).
-- Ejecutar: cd Backend && npm run db:scale-indexes

-- match_players: misiones (partidos jugados), top-stats, first-confirm, rankings.
CREATE INDEX IF NOT EXISTS match_players_user_confirmed_idx
  ON match_players (user_id, has_confirmed);

CREATE INDEX IF NOT EXISTS match_players_user_confirmed_rating_idx
  ON match_players (user_id, has_confirmed, match_rating);

CREATE INDEX IF NOT EXISTS match_players_match_confirmed_rating_idx
  ON match_players (match_id, has_confirmed, match_rating DESC);

CREATE INDEX IF NOT EXISTS match_players_match_confirmed_at_idx
  ON match_players (match_id, confirmed_at);

CREATE INDEX IF NOT EXISTS match_players_user_confirmed_at_idx
  ON match_players (user_id, confirmed_at);

-- Top stats: ayudar a búsquedas por match_id + has_confirmed + stat (5 índices, uno por stat).
CREATE INDEX IF NOT EXISTS match_players_match_defense_idx
  ON match_players (match_id, has_confirmed, match_defense DESC);
CREATE INDEX IF NOT EXISTS match_players_match_pace_idx
  ON match_players (match_id, has_confirmed, match_pace DESC);
CREATE INDEX IF NOT EXISTS match_players_match_technique_idx
  ON match_players (match_id, has_confirmed, match_technique DESC);
CREATE INDEX IF NOT EXISTS match_players_match_physical_idx
  ON match_players (match_id, has_confirmed, match_physical DESC);
CREATE INDEX IF NOT EXISTS match_players_match_attack_idx
  ON match_players (match_id, has_confirmed, match_attack DESC);

-- user_missions: pantalla misiones + acciones (completadas sin reclamar).
CREATE INDEX IF NOT EXISTS user_missions_user_completed_claimed_idx
  ON user_missions (user_id, is_completed, claimed_at);

-- ttp_ledger: timeline y debugging (ya hay índice por user_id+created_at, sumamos reason/ref para filtros).
CREATE INDEX IF NOT EXISTS ttp_ledger_user_reason_idx
  ON ttp_ledger (user_id, reason, created_at DESC);

-- prode: grupos por liga y apertura/cierre.
CREATE INDEX IF NOT EXISTS prediction_groups_league_closes_idx
  ON prediction_groups (league_id, closes_at);

-- prode: respuestas de usuario (reminders / "ya votó").
CREATE INDEX IF NOT EXISTS user_predictions_user_idx
  ON user_predictions (user_id);

