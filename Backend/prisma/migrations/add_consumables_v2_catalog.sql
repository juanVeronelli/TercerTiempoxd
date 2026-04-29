-- Catálogo consumibles PRE/POST + activaciones. Ejecutar con prisma db execute.
-- cd Backend && npx prisma db execute --file prisma/migrations/add_consumables_v2_catalog.sql

ALTER TABLE "shop_items" ADD COLUMN IF NOT EXISTS "tooltip" TEXT;
ALTER TABLE "shop_items" ADD COLUMN IF NOT EXISTS "consumable_timing" VARCHAR(20);
ALTER TABLE "shop_items" ADD COLUMN IF NOT EXISTS "effect_key" VARCHAR(80);
ALTER TABLE "shop_items" ADD COLUMN IF NOT EXISTS "meta" JSONB;

CREATE TABLE IF NOT EXISTS "user_consumable_activations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "league_id" UUID NOT NULL,
  "consumable_key" VARCHAR(50) NOT NULL,
  "timing" VARCHAR(20) NOT NULL,
  "target_match_id" UUID NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_consumable_activations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_consumable_activations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_consumable_activations_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_consumable_activations_target_match_id_fkey" FOREIGN KEY ("target_match_id") REFERENCES "matches" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "user_consumable_activations_user_id_league_id_idx"
  ON "user_consumable_activations" ("user_id", "league_id");
CREATE INDEX IF NOT EXISTS "user_consumable_activations_target_match_id_idx"
  ON "user_consumable_activations" ("target_match_id");

-- Legacy placeholders fuera de catálogo
UPDATE "shop_items"
SET "is_active" = FALSE
WHERE "key" IN ('consumable_hint', 'consumable_double_pred');

INSERT INTO "shop_items" (
  "id", "key", "display_name", "description", "tooltip", "item_type", "price_ttp",
  "consumable_key", "consumable_timing", "effect_key", "sort_order"
) VALUES
-- PRE_MATCH (accesible → caro)
(
  gen_random_uuid(),
  'c_ov_soft_boost',
  'Refuerzo plateado · Overall +0,5',
  'Suma alrededor de medio punto (0,5) a tu overall sobre las valoraciones (cada compañero puede ponerte hasta 10). Ejemplo: si cerrabas en 6,0, podrías quedar ~6,5.',
  'Efecto: suma ~0,5 a tu overall en la tarjeta del partido (notas de compañeros según reglas del servidor).

Activación: antes del encuentro → Mi taquilla → Activar con tu liga elegida. Aplica al próximo partido en esa liga.',
  'CONSUMABLE', 260,
  'overall_soft_boost', 'PRE_MATCH', 'overall_soft_boost', 100
),
(
  gen_random_uuid(),
  'c_ov_micro_boost',
  'Toque quirúrgico · Overall +0,3',
  'Mini bonus de +0,3 sobre tu overall de la fecha (notas de compañeros 0 a 10). Ejemplo: base 6,0 → ~6,3.',
  'Efecto: suma ~0,3 a tu overall en la tarjeta.

Activación: pre-partido en Mi taquilla con la liga seleccionada; próximo partido de esa liga.',
  'CONSUMABLE', 190,
  'overall_micro_boost', 'PRE_MATCH', 'overall_micro_boost', 101
),
(
  gen_random_uuid(),
  'c_ov_plus_one',
  'Salto de categoría · Overall +1',
  'Empuje fuerte: +1 en la nota de overall de la carta (escala 0–10). Ejemplo: 5,0 → ~6,0.',
  'Efecto: sube 1 punto tu overall en carta (ej. 5 → 6 en escala 0–10).

Activación: pre-partido en Mi taquilla. Se consolida cuando cierran las votaciones de ese partido.',
  'CONSUMABLE', 720,
  'overall_plus_one', 'PRE_MATCH', 'overall_plus_one', 102
),
(
  gen_random_uuid(),
  'c_tech_soft_boost',
  'Manos calientes · Técnica +0,5',
  'Sube ~0,5 el rubro técnica (cada compañero te puede poner hasta 10 en técnica). Ejemplo: técnica 6,0 → ~6,5 en la tarjeta.',
  'Efecto: sube ~0,5 solo el rubro técnica de tu carta (no el overall ni otros rubros solos).

Activación: pre-partido → Mi taquilla → liga → próximo partido.',
  'CONSUMABLE', 340,
  'tech_soft_boost', 'PRE_MATCH', 'tech_soft_boost', 103
),
(
  gen_random_uuid(),
  'c_tech_plus_one',
  'Clase A · Técnica +1',
  'Sube 1 punto el rubro técnica en la carta (valoraciones 0–10). Ejemplo: 5,5 → 6,5 en técnica.',
  'Efecto: sube 1 punto solo la técnica en tu tarjeta.

Activación: pre-partido en Mi taquilla con la liga correcta.',
  'CONSUMABLE', 820,
  'tech_plus_one', 'PRE_MATCH', 'tech_plus_one', 104
),
(
  gen_random_uuid(),
  'c_duel_reserved',
  'Cartel de duelo · Tu lugar asegurado',
  'Entrás al duelo del partido aunque no hubieras salido en el sorteo: desplazás a uno de los dos elegidos. No cambia números de carta; solo cupo en el duelo.',
  'Efecto: entrás al duelo del partido y uno de los dos elegidos queda fuera. No cambia tus notas de carta.

Activación: antes de que se defina el duelo → Mi taquilla + liga.',
  'CONSUMABLE', 4800,
  'duel_reserved_slot', 'PRE_MATCH', 'duel_reserved_slot', 105
),
(
  gen_random_uuid(),
  'c_prode_uncapped',
  'Libreta XL · Más de 5 apuestas Prode',
  'Levanta el tope de 5 predicciones en el Prode de esa fecha. Ejemplo: en vez de quedarte en 5 picks, podés mandar 8, 10 o las que quieras.',
  'Efecto: podés cargar todas las predicciones Prode que quieras esa fecha (se levanta el límite de 5).

Activación: pre-partido en Mi taquilla; la fecha sigue el partido que engancha al activar.',
  'CONSUMABLE', 5600,
  'prode_unlimited_picks', 'PRE_MATCH', 'prode_unlimited_picks', 106
),
(
  gen_random_uuid(),
  'c_prode_x2_points',
  'Racha dorada · Prode ×2 puntos',
  'Duplica los puntos del ranking Prode de esa fecha (suman aciertos en predicciones; no son las notas del 1 al 10). Ejemplo: 8 puntos Prode en la tabla → cuentan como 16 esa jornada.',
  'Efecto: los puntos que sumes en la tabla Prode de esa fecha se cuentan el doble (aciertos en predicciones).

No toca tus notas de carta ni tu saldo TTP. Activación: pre-partido en Mi taquilla.',
  'CONSUMABLE', 6400,
  'prode_double_points', 'PRE_MATCH', 'prode_double_points', 107
),
(
  gen_random_uuid(),
  'c_spec_full_weight',
  'Tribuna con peso de titular',
  'Como espectador, tus votos valen lo mismo que si hubieras jugado (peso 1×). Ejemplo: antes el sistema te daba ~0,7×; con esto pasás a 1×.',
  'Efecto: si vas de espectador, tus votos para calificar jugadores pesan igual que si hubieras jugado.

Activación: pre-partido en Mi taquilla; solo sirve si participás como espectador en ese partido.',
  'CONSUMABLE', 3800,
  'spectator_vote_player', 'PRE_MATCH', 'spectator_vote_player', 108
),
(
  gen_random_uuid(),
  'c_shield_fantasma',
  'Escudo anti-Fantasma',
  'Probabilidad 0 de salir Fantasma en ese partido aunque el rendimiento iría a eso. No suma puntos; solo bloquea la medalla.',
  'Efecto: no podés ser elegido Fantasma en ese partido (bloquea la medalla).

Activación: antes del cierre de votaciones → Mi taquilla + liga.',
  'CONSUMABLE', 9200,
  'shield_vs_fantasma', 'PRE_MATCH', 'shield_vs_fantasma', 109
),
(
  gen_random_uuid(),
  'c_shield_tronco',
  'Escudo anti-Tronco',
  'No te pueden asignar la medalla Tronco en ese encuentro. Sin cambios en tus notas numéricas.',
  'Efecto: no te pueden dar la medalla Tronco en ese encuentro. Tus notas numéricas no cambian por este ítem.

Activación: pre-partido en Mi taquilla.',
  'CONSUMABLE', 9200,
  'shield_vs_tronco', 'PRE_MATCH', 'shield_vs_tronco', 110
),
(
  gen_random_uuid(),
  'c_ov_x2_broken',
  'Modo récord · Overall ×2',
  'Multiplica por 2 tu overall final del partido en la tarjeta (escala 0–10). Ejemplo: si tu overall cerraba en 5,0, el efecto apunta a 10,0; cada voto individual sigue capado en 10.',
  'Efecto: multiplica por 2 tu overall final en la tarjeta (ej. 5 → 10 si el servidor lo permite).

Activación: pre-partido en Mi taquilla; ítem muy caro.',
  'CONSUMABLE', 28500,
  'overall_multiplier_x2', 'PRE_MATCH', 'overall_multiplier_x2', 199
),
(
  gen_random_uuid(),
  'c_spec_god_weight',
  'Megáfono · Tu voto manda más',
  'Desde tribuna, tus votos pesan más que los de un jugador en cancha. Ejemplo orientativo: peso ~1,3× vs 1,0× del jugador (el servidor fija el valor exacto).',
  'Efecto: desde tribuna, tus votos pesan más que los de los jugadores en cancha.

Activación: pre-partido en Mi taquilla; solo aplica si vas como espectador.',
  'CONSUMABLE', 24500,
  'spectator_overvote', 'PRE_MATCH', 'spectator_overvote', 200
),
-- POST_MATCH
(
  gen_random_uuid(),
  'c_post_vote_rewind',
  'Borrón de veneno · Anular voto',
  'Sacás de tu tarjeta el voto malo que te dejó un compañero en el último partido cerrado. Ejemplo: te habían dejado 3,0 en overall desde ese voto → queda anulado.',
  'Efecto: elimina de tu tarjeta el voto negativo que te dejó un compañero en el último partido cerrado.

Activación: post-partido → Mi taquilla + liga. Consume 1 unidad del ítem.',
  'CONSUMABLE', 5400,
  'rewind_teammate_vote', 'POST_MATCH', 'rewind_teammate_vote', 300
),
(
  gen_random_uuid(),
  'c_post_medal_rip',
  'Chapa fuera · Sin medalla',
  'Eliminá del palmarés la medalla que ganaste ese día (MVP, duelo, etc.). Ejemplo: tenías “estrella” en ese partido → deja de figurar en tu vitrina.',
  'Efecto: sacá del perfil la medalla que ganaste ese día (MVP, duelo, etc.) como si no la hubieras tenido.

Activación: post-partido; último partido cerrado de la liga → Mi taquilla.',
  'CONSUMABLE', 2900,
  'medal_forfeit_token', 'POST_MATCH', 'medal_forfeit_token', 301
),
(
  gen_random_uuid(),
  'c_post_ghost_top',
  'Al nivel del puntero · Mismo puntaje',
  'Tu valoración de carta (overall 0–10 de ese partido) puede igualar la más alta de la fecha. Ejemplo: vos cerrabas en 6,5 y el mejor en 9,0 → podés quedar en 9,0.',
  'Efecto: tu overall del partido pasa a ser el mismo que el más alto de la tabla esa fecha (notas 0–10).

Activación: post-partido en Mi taquilla; último partido cerrado.',
  'CONSUMABLE', 22800,
  'ghost_top_score_tie', 'POST_MATCH', 'ghost_top_score_tie', 302
),
(
  gen_random_uuid(),
  'c_post_match_erase',
  'Borrón en el CV · Partido fuera',
  'Sacá un partido de tu historial: no ensucia promedios. Ejemplo: promedio 6,2 con un 4,0 que te baja; al borrar ese partido el promedio mostrado sube.',
  'Efecto: ese partido deja de figurar en tu historial y no te arrastra el promedio visible del perfil.

Activación: post-partido; suele ser el último cerrado → Mi taquilla.',
  'CONSUMABLE', 19200,
  'history_delete_match', 'POST_MATCH', 'history_delete_match', 303
),
(
  gen_random_uuid(),
  'c_post_rank_heist',
  'Canje de tabla · Intercambio de puntaje',
  'Intercambiás tu nota agregada del partido con la de otro jugador en esa tabla (escala 0–10 como las valoraciones). Ejemplo: vos 6,0 y otro 9,5 → tras el canje vos 9,5 y él 6,0.',
  'Efecto: intercambiás tu posición/nota en el ranking del partido con la de otro jugador (valores de carta 0–10).

Activación: post-partido; último cerrado → Mi taquilla. No es intercambio de puntos Prode ni TTP.',
  'CONSUMABLE', 26800,
  'ranking_heist_swap', 'POST_MATCH', 'ranking_heist_swap', 304
)
ON CONFLICT ("key") DO UPDATE SET
  "display_name" = EXCLUDED."display_name",
  "description" = EXCLUDED."description",
  "tooltip" = EXCLUDED."tooltip",
  "price_ttp" = EXCLUDED."price_ttp",
  "consumable_key" = EXCLUDED."consumable_key",
  "consumable_timing" = EXCLUDED."consumable_timing",
  "effect_key" = EXCLUDED."effect_key",
  "sort_order" = EXCLUDED."sort_order",
  "item_type" = 'CONSUMABLE',
  "is_active" = TRUE;
