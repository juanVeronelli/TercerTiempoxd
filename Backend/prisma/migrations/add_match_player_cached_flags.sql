ALTER TABLE match_players
ADD COLUMN IF NOT EXISTS was_first_confirm boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_top_defense boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_top_pace boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_top_technique boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_top_physical boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_top_attack boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS match_players_user_first_confirm_idx
  ON match_players (user_id, was_first_confirm);

CREATE INDEX IF NOT EXISTS match_players_user_top_flags_idx
  ON match_players (user_id, is_top_defense, is_top_pace, is_top_technique, is_top_physical, is_top_attack);

