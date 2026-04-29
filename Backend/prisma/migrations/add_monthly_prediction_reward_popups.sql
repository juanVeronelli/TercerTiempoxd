-- Popup UX: recompensa mensual (mostrar 1 sola vez por usuario/mes/liga)
-- Se crea cuando se liquida el prode mensual y el usuario ganó TTP.
-- El cliente lo consume (y marca visto) al entrar a la liga.

CREATE TABLE IF NOT EXISTS monthly_prediction_reward_popups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  period_key varchar(20) NOT NULL,
  ttp_amount int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  seen_at timestamptz NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS monthly_prediction_reward_popups_uniq
  ON monthly_prediction_reward_popups(user_id, league_id, period_key);

CREATE INDEX IF NOT EXISTS monthly_prediction_reward_popups_user_league_seen
  ON monthly_prediction_reward_popups(user_id, league_id, seen_at);

