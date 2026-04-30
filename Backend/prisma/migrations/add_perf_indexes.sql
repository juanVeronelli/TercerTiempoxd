-- Índices de performance para Misiones / ActionNow / Apuestas / Comentarios.
-- Ejecutar: cd Backend && npm run db:perf-indexes

-- Misiones (lookup por branch+active y key)
CREATE INDEX IF NOT EXISTS missions_active_branch_sort_idx
  ON missions (is_active, branch, sort_order);

-- Comentarios (misión "comentar a todos")
CREATE INDEX IF NOT EXISTS match_votes_match_voter_idx
  ON match_votes (match_id, voter_id);

-- Replies (misión "responder comentarios")
CREATE INDEX IF NOT EXISTS match_vote_comment_replies_user_id_idx
  ON match_vote_comment_replies (user_id);

-- Espectadores (misión "ser espectador")
CREATE INDEX IF NOT EXISTS match_spectators_user_attending_idx
  ON match_spectators (user_id, attending);

-- Apuestas: acciones de slip settled
CREATE INDEX IF NOT EXISTS ttp_house_bet_slips_user_league_settled_idx
  ON ttp_house_bet_slips (user_id, league_id, settled_at DESC);

