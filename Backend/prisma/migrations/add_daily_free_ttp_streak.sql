-- Daily free TTP streak (shop): incremental reward with reset on missed day
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS daily_free_ttp_streak int NOT NULL DEFAULT 0;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS daily_free_ttp_last_claim_at timestamptz NULL;

