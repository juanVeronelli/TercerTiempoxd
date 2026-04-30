ALTER TABLE match_players
  ADD COLUMN IF NOT EXISTS injured boolean NOT NULL DEFAULT false;

ALTER TABLE match_players
  ADD COLUMN IF NOT EXISTS left_early boolean NOT NULL DEFAULT false;

