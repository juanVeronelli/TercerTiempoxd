-- Rebalance precios de consumibles (más alcanzables F2P)
-- Ejecutar: cd Backend && npm run db:shop-prices-balanced

-- PRE_MATCH (boosts chicos)
UPDATE "shop_items" SET "price_ttp" = 120 WHERE "key" = 'c_ov_soft_boost';      -- 260 -> 120
UPDATE "shop_items" SET "price_ttp" = 90  WHERE "key" = 'c_ov_micro_boost';     -- 190 -> 90
UPDATE "shop_items" SET "price_ttp" = 320 WHERE "key" = 'c_ov_plus_one';        -- 720 -> 320
UPDATE "shop_items" SET "price_ttp" = 150 WHERE "key" = 'c_tech_soft_boost';    -- 340 -> 150
UPDATE "shop_items" SET "price_ttp" = 360 WHERE "key" = 'c_tech_plus_one';      -- 820 -> 360

-- PRE_MATCH (impacto alto / “meta”)
UPDATE "shop_items" SET "price_ttp" = 1400 WHERE "key" = 'c_duel_reserved';       -- 4800 -> 1400
UPDATE "shop_items" SET "price_ttp" = 1600 WHERE "key" = 'c_prode_uncapped';      -- 5600 -> 1600
UPDATE "shop_items" SET "price_ttp" = 1900 WHERE "key" = 'c_prode_x2_points';     -- 6400 -> 1900
UPDATE "shop_items" SET "price_ttp" = 1100 WHERE "key" = 'c_spec_full_weight';    -- 3800 -> 1100

-- PRE_MATCH (escudos)
UPDATE "shop_items" SET "price_ttp" = 2200 WHERE "key" = 'c_shield_fantasma';     -- 9200 -> 2200
UPDATE "shop_items" SET "price_ttp" = 2200 WHERE "key" = 'c_shield_tronco';       -- 9200 -> 2200

-- PRE_MATCH (ultra raros)
UPDATE "shop_items" SET "price_ttp" = 5500 WHERE "key" = 'c_ov_x2_broken';        -- 28500 -> 5500
UPDATE "shop_items" SET "price_ttp" = 4800 WHERE "key" = 'c_spec_god_weight';     -- 24500 -> 4800

-- POST_MATCH
UPDATE "shop_items" SET "price_ttp" = 1600 WHERE "key" = 'c_post_vote_rewind';    -- 5400 -> 1600
UPDATE "shop_items" SET "price_ttp" = 850  WHERE "key" = 'c_post_medal_rip';      -- 2900 -> 850
UPDATE "shop_items" SET "price_ttp" = 4200 WHERE "key" = 'c_post_ghost_top';      -- 22800 -> 4200
UPDATE "shop_items" SET "price_ttp" = 3600 WHERE "key" = 'c_post_match_erase';    -- 19200 -> 3600
UPDATE "shop_items" SET "price_ttp" = 4800 WHERE "key" = 'c_post_rank_heist';     -- 26800 -> 4800

