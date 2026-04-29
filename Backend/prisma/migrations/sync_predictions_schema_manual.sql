-- Alinear tablas del Prode con schema.prisma (idempotente).
-- Ejecutar si aparece P2022 / ColumnNotFound al listar predicciones.

ALTER TABLE prediction_groups ADD COLUMN IF NOT EXISTS monthly_settled_at TIMESTAMP(6);
ALTER TABLE prediction_groups ADD COLUMN IF NOT EXISTS display_question_ids JSONB;

ALTER TABLE prediction_questions ADD COLUMN IF NOT EXISTS difficulty VARCHAR(10);

ALTER TABLE prediction_options ADD COLUMN IF NOT EXISTS is_correct BOOLEAN;
