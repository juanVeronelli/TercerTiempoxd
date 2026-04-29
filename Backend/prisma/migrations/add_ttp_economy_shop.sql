-- TTP balance + ledger + tienda consumibles/cosméticos
-- Ejecutar: cd Backend && npx prisma db execute --file prisma/migrations/add_ttp_economy_shop.sql

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ttp_balance" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "ttp_ledger" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "amount" INTEGER NOT NULL,
  "balance_after" INTEGER NOT NULL,
  "reason" VARCHAR(40) NOT NULL,
  "ref_type" VARCHAR(24),
  "ref_id" VARCHAR(80),
  "idempotency_key" VARCHAR(160) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ttp_ledger_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ttp_ledger_idempotency_key_key" UNIQUE ("idempotency_key"),
  CONSTRAINT "ttp_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ttp_ledger_user_id_created_at_idx" ON "ttp_ledger" ("user_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "shop_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" VARCHAR(80) NOT NULL,
  "display_name" VARCHAR(120) NOT NULL,
  "description" TEXT,
  "item_type" VARCHAR(20) NOT NULL,
  "price_ttp" INTEGER NOT NULL,
  "cosmetic_key" VARCHAR(50),
  "cosmetic_type" VARCHAR(20) DEFAULT 'FRAME',
  "consumable_key" VARCHAR(50),
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shop_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shop_items_key_key" UNIQUE ("key")
);

CREATE TABLE IF NOT EXISTS "user_consumable_stacks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "consumable_key" VARCHAR(50) NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "user_consumable_stacks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_consumable_stacks_user_id_consumable_key_key" UNIQUE ("user_id", "consumable_key"),
  CONSTRAINT "user_consumable_stacks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "user_consumable_stacks_user_id_idx" ON "user_consumable_stacks" ("user_id");

INSERT INTO "shop_items" ("key", "display_name", "description", "item_type", "price_ttp", "cosmetic_key", "consumable_key", "sort_order")
VALUES
  ('frame_gold_shop', 'Marco dorado', 'Marco dorado para tu avatar.', 'COSMETIC', 800, 'gold', NULL, 10),
  ('consumable_hint', 'Pista extra', 'Próximamente: ayuda en una predicción.', 'CONSUMABLE', 150, NULL, 'hint_single', 20),
  ('consumable_double_pred', 'Predicción x2', 'Próximamente: duplica puntos en una fecha.', 'CONSUMABLE', 400, NULL, 'double_prediction', 30)
ON CONFLICT ("key") DO NOTHING;
