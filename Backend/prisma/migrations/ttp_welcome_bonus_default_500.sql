-- =============================================================================
-- CHANGE: default de users.ttp_balance a 500
-- Motivo: cada cuenta nueva arranca con 500 TTP (bonus de bienvenida).
-- Nota: esto NO actualiza usuarios existentes; solo afecta nuevas filas.
-- =============================================================================

ALTER TABLE "users"
  ALTER COLUMN "ttp_balance" SET DEFAULT 500;

