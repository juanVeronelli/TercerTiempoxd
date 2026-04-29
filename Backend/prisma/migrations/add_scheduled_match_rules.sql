-- =============================================================================
-- ADD: scheduled match rules + occurrences (idempotencia)
-- Permite programar partidos recurrentes (ej: cada jueves crear partido para sábado).
-- Cancelar un partido NO cancela la regla (se mantiene la ocurrencia registrada).
-- =============================================================================

-- 1) Extender matches para trazabilidad e idempotencia
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS scheduled_rule_id UUID NULL;

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS scheduled_occurrence_key VARCHAR(80) NULL;

-- Una ocurrencia no debe duplicarse
CREATE UNIQUE INDEX IF NOT EXISTS ux_matches_scheduled_occurrence_key
  ON matches(scheduled_occurrence_key)
  WHERE scheduled_occurrence_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_matches_scheduled_rule_id
  ON matches(scheduled_rule_id);

-- FK (si ya existe, no falla por IF NOT EXISTS en PG no aplica a constraints)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_matches_scheduled_rule'
  ) THEN
    ALTER TABLE matches
      ADD CONSTRAINT fk_matches_scheduled_rule
      FOREIGN KEY (scheduled_rule_id)
      REFERENCES scheduled_match_rules(id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN undefined_table THEN
  -- La tabla scheduled_match_rules se crea debajo; el constraint se intentará al final.
END $$;

-- 2) Tabla de reglas
CREATE TABLE IF NOT EXISTS scheduled_match_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMP(6) NOT NULL DEFAULT now(),

  create_on_weekday INTEGER NOT NULL, -- 0=Dom ... 6=Sáb
  target_weekday INTEGER NOT NULL,    -- 0=Dom ... 6=Sáb
  target_time VARCHAR(5) NOT NULL,    -- "HH:mm"

  location_name VARCHAR(255) NULL,
  price_per_player NUMERIC(10,2) NULL,
  is_open_signup BOOLEAN NOT NULL DEFAULT FALSE,
  max_players INTEGER NULL,
  match_mode VARCHAR(10) NOT NULL DEFAULT 'INTERNAL',

  convoked_user_ids JSONB NULL
);

CREATE INDEX IF NOT EXISTS idx_scheduled_rules_league_active
  ON scheduled_match_rules(league_id, is_active);

CREATE INDEX IF NOT EXISTS idx_scheduled_rules_create_weekday_active
  ON scheduled_match_rules(create_on_weekday, is_active);

-- 3) Tabla de ocurrencias (para idempotencia y excepciones)
CREATE TABLE IF NOT EXISTS scheduled_match_rule_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES scheduled_match_rules(id) ON DELETE CASCADE,
  match_date DATE NOT NULL,
  match_id UUID NULL REFERENCES matches(id) ON DELETE SET NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT now(),
  UNIQUE(rule_id, match_date)
);

CREATE INDEX IF NOT EXISTS idx_scheduled_occ_rule_id
  ON scheduled_match_rule_occurrences(rule_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_occ_match_date
  ON scheduled_match_rule_occurrences(match_date);

-- 4) Reintentar FK de matches -> rules ahora que existe la tabla
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_matches_scheduled_rule'
  ) THEN
    ALTER TABLE matches
      ADD CONSTRAINT fk_matches_scheduled_rule
      FOREIGN KEY (scheduled_rule_id)
      REFERENCES scheduled_match_rules(id)
      ON DELETE SET NULL;
  END IF;
END $$;

