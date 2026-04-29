-- =============================================================================
-- CHANGE: restaurar default de users.ttp_balance a 0
-- Motivo: el bonus de bienvenida se acredita vía ledger (WELCOME_BONUS) al registrarse.
-- =============================================================================

ALTER TABLE "users"
  ALTER COLUMN "ttp_balance" SET DEFAULT 0;

