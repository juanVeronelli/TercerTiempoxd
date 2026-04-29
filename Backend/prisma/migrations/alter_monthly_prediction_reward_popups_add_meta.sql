-- Extend popup UX payload: store breakdown meta (jsonb)
ALTER TABLE monthly_prediction_reward_popups
  ADD COLUMN IF NOT EXISTS meta jsonb NULL;

