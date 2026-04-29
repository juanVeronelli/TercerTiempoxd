-- Parámetros opcionales al activar consumibles POST (ej. canje con otro jugador).
-- Ejecutar: cd Backend && npx prisma db execute --file prisma/migrations/add_user_consumable_activation_meta.sql

ALTER TABLE "user_consumable_activations" ADD COLUMN IF NOT EXISTS "meta" JSONB;
