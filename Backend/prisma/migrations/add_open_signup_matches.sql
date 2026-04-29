-- =============================================================================
-- ADD: matches.is_open_signup + matches.max_players
-- Permite crear partidos sin convocados donde los miembros se anotan con cupos.
-- =============================================================================

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS is_open_signup BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS max_players INTEGER NULL;

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS match_mode VARCHAR(10) NOT NULL DEFAULT 'INTERNAL';

-- Índices útiles para feed/calendario
CREATE INDEX IF NOT EXISTS idx_matches_open_signup ON matches(is_open_signup);
CREATE INDEX IF NOT EXISTS idx_matches_league_status_date ON matches(league_id, status, date_time);

