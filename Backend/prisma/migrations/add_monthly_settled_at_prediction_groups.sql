-- Idempotencia del cierre mensual del Prode: evita duplicar prode_points_total si el job corre más de una vez.
ALTER TABLE prediction_groups ADD COLUMN IF NOT EXISTS monthly_settled_at TIMESTAMP(6);
