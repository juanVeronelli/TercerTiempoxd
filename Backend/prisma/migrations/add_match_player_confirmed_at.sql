ALTER TABLE match_players
ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

CREATE INDEX IF NOT EXISTS match_players_confirmed_at_idx
ON match_players (confirmed_at);

