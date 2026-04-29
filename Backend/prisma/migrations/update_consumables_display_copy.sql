-- Tooltips directos (efecto + activación). Ejecutar: npx prisma db execute --file prisma/migrations/update_consumables_display_copy.sql

UPDATE "shop_items" SET
  "tooltip" = 'Efecto: suma ~0,5 a tu overall en la tarjeta del partido (notas de compañeros según reglas del servidor).

Activación: antes del encuentro → Mi taquilla → Activar con tu liga elegida. Aplica al próximo partido en esa liga.'
WHERE "key" = 'c_ov_soft_boost';

UPDATE "shop_items" SET
  "tooltip" = 'Efecto: suma ~0,3 a tu overall en la tarjeta.

Activación: pre-partido en Mi taquilla con la liga seleccionada; próximo partido de esa liga.'
WHERE "key" = 'c_ov_micro_boost';

UPDATE "shop_items" SET
  "tooltip" = 'Efecto: sube 1 punto tu overall en carta (ej. 5 → 6 en escala 0–10).

Activación: pre-partido en Mi taquilla. Se consolida cuando cierran las votaciones de ese partido.'
WHERE "key" = 'c_ov_plus_one';

UPDATE "shop_items" SET
  "tooltip" = 'Efecto: sube ~0,5 solo el rubro técnica de tu carta (no el overall ni otros rubros solos).

Activación: pre-partido → Mi taquilla → liga → próximo partido.'
WHERE "key" = 'c_tech_soft_boost';

UPDATE "shop_items" SET
  "tooltip" = 'Efecto: sube 1 punto solo la técnica en tu tarjeta.

Activación: pre-partido en Mi taquilla con la liga correcta.'
WHERE "key" = 'c_tech_plus_one';

UPDATE "shop_items" SET
  "tooltip" = 'Efecto: entrás al duelo del partido y uno de los dos elegidos queda fuera. No cambia tus notas de carta.

Activación: antes de que se defina el duelo → Mi taquilla + liga.'
WHERE "key" = 'c_duel_reserved';

UPDATE "shop_items" SET
  "tooltip" = 'Efecto: podés cargar todas las predicciones Prode que quieras esa fecha (se levanta el límite de 5).

Activación: pre-partido en Mi taquilla; la fecha sigue el partido que engancha al activar.'
WHERE "key" = 'c_prode_uncapped';

UPDATE "shop_items" SET
  "tooltip" = 'Efecto: los puntos que sumes en la tabla Prode de esa fecha se cuentan el doble (aciertos en predicciones).

No toca tus notas de carta ni tu saldo TTP. Activación: pre-partido en Mi taquilla.'
WHERE "key" = 'c_prode_x2_points';

UPDATE "shop_items" SET
  "tooltip" = 'Efecto: si vas de espectador, tus votos para calificar jugadores pesan igual que si hubieras jugado.

Activación: pre-partido en Mi taquilla; solo sirve si participás como espectador en ese partido.'
WHERE "key" = 'c_spec_full_weight';

UPDATE "shop_items" SET
  "tooltip" = 'Efecto: no podés ser elegido Fantasma en ese partido (bloquea la medalla).

Activación: antes del cierre de votaciones → Mi taquilla + liga.'
WHERE "key" = 'c_shield_fantasma';

UPDATE "shop_items" SET
  "tooltip" = 'Efecto: no te pueden dar la medalla Tronco en ese encuentro. Tus notas numéricas no cambian por este ítem.

Activación: pre-partido en Mi taquilla.'
WHERE "key" = 'c_shield_tronco';

UPDATE "shop_items" SET
  "tooltip" = 'Efecto: multiplica por 2 tu overall final en la tarjeta (ej. 5 → 10 si el servidor lo permite).

Activación: pre-partido en Mi taquilla; ítem muy caro.'
WHERE "key" = 'c_ov_x2_broken';

UPDATE "shop_items" SET
  "tooltip" = 'Efecto: desde tribuna, tus votos pesan más que los de los jugadores en cancha.

Activación: pre-partido en Mi taquilla; solo aplica si vas como espectador.'
WHERE "key" = 'c_spec_god_weight';

UPDATE "shop_items" SET
  "tooltip" = 'Efecto: elimina de tu tarjeta el voto negativo que te dejó un compañero en el último partido cerrado.

Activación: post-partido → Mi taquilla + liga. Consume 1 unidad del ítem.'
WHERE "key" = 'c_post_vote_rewind';

UPDATE "shop_items" SET
  "tooltip" = 'Efecto: sacá del perfil la medalla que ganaste ese día (MVP, duelo, etc.) como si no la hubieras tenido.

Activación: post-partido; último partido cerrado de la liga → Mi taquilla.'
WHERE "key" = 'c_post_medal_rip';

UPDATE "shop_items" SET
  "tooltip" = 'Efecto: tu overall del partido pasa a ser el mismo que el más alto de la tabla esa fecha (notas 0–10).

Activación: post-partido en Mi taquilla; último partido cerrado.'
WHERE "key" = 'c_post_ghost_top';

UPDATE "shop_items" SET
  "tooltip" = 'Efecto: ese partido deja de figurar en tu historial y no te arrastra el promedio visible del perfil.

Activación: post-partido; suele ser el último cerrado → Mi taquilla.'
WHERE "key" = 'c_post_match_erase';

UPDATE "shop_items" SET
  "tooltip" = 'Efecto: intercambiás tu posición/nota en el ranking del partido con la de otro jugador (valores de carta 0–10).

Activación: post-partido; último cerrado → Mi taquilla. No es intercambio de puntos Prode ni TTP.'
WHERE "key" = 'c_post_rank_heist';
