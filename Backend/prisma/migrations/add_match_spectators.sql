-- =============================================================================
-- ADD: match_spectators (espectadores por partido)
-- Permite que miembros de la liga no convocados marquen asistencia como espectadores
-- y participen en la votación con ponderación (backend).
-- =============================================================================

CREATE TABLE IF NOT EXISTS match_spectators (
  match_id   UUID NOT NULL,
  user_id    UUID NOT NULL,
  attending  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (match_id, user_id),
  CONSTRAINT match_spectators_match_id_fkey FOREIGN KEY (match_id)
    REFERENCES matches(id) ON DELETE CASCADE,
  CONSTRAINT match_spectators_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_match_spectators_match_id ON match_spectators(match_id);
CREATE INDEX IF NOT EXISTS idx_match_spectators_user_id ON match_spectators(user_id);

