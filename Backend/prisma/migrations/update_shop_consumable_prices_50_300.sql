-- Ajuste de precios de consumibles para incentivar IAP:
-- - consumable_hint (hint_single): 50 TTP
-- - consumable_double_pred (double_prediction): 300 TTP
--
-- Ejecutar: cd Backend && npx prisma db execute --file prisma/migrations/update_shop_consumable_prices_50_300.sql

UPDATE "shop_items"
SET "price_ttp" = 50
WHERE "key" = 'consumable_hint';

UPDATE "shop_items"
SET "price_ttp" = 300
WHERE "key" = 'consumable_double_pred';

