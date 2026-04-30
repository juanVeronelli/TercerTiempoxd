-- Misiones FREE/PRO con recompensas y reclamo manual

CREATE TABLE IF NOT EXISTS missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key varchar(80) NOT NULL UNIQUE,
  title varchar(120) NOT NULL,
  description text,
  branch varchar(10) NOT NULL DEFAULT 'FREE',
  metric_key varchar(50) NOT NULL,
  target numeric(10,2) NOT NULL DEFAULT 1,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  reward_ttp int NOT NULL DEFAULT 0,
  reward_cosmetic_key varchar(50),
  reward_cosmetic_type varchar(20) DEFAULT 'FRAME',
  reward_consumable_key varchar(50),
  reward_consumable_qty int DEFAULT 1
);

CREATE INDEX IF NOT EXISTS missions_active_sort_idx
  ON missions (is_active, sort_order);

CREATE TABLE IF NOT EXISTS user_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  progress numeric(10,2) NOT NULL DEFAULT 0,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  claimed_at timestamptz,
  popup_shown_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, mission_id)
);

CREATE INDEX IF NOT EXISTS user_missions_user_idx ON user_missions(user_id);
CREATE INDEX IF NOT EXISTS user_missions_mission_idx ON user_missions(mission_id);
CREATE INDEX IF NOT EXISTS user_missions_user_state_idx ON user_missions(user_id, is_completed, claimed_at);

