CREATE TABLE IF NOT EXISTS action_now_seen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_key varchar(140) NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, action_key)
);

CREATE INDEX IF NOT EXISTS action_now_seen_user_seen_at_idx
  ON action_now_seen (user_id, seen_at DESC);

