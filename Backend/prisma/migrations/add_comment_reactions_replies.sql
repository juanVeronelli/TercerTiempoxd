-- Add likes/dislikes + replies for match vote comments ("Voces del vestuario")

CREATE TABLE IF NOT EXISTS match_vote_comment_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_id uuid NOT NULL,
  user_id uuid NOT NULL,
  value int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_vote_comment_reactions_vote_fk
    FOREIGN KEY (vote_id) REFERENCES match_votes(id) ON DELETE CASCADE,
  CONSTRAINT match_vote_comment_reactions_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT match_vote_comment_reactions_value_chk
    CHECK (value IN (1, -1))
);

CREATE UNIQUE INDEX IF NOT EXISTS match_vote_comment_reactions_vote_user_uq
  ON match_vote_comment_reactions (vote_id, user_id);
CREATE INDEX IF NOT EXISTS match_vote_comment_reactions_vote_idx
  ON match_vote_comment_reactions (vote_id);
CREATE INDEX IF NOT EXISTS match_vote_comment_reactions_user_idx
  ON match_vote_comment_reactions (user_id);

CREATE TABLE IF NOT EXISTS match_vote_comment_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_id uuid NOT NULL,
  user_id uuid NOT NULL,
  reply text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_vote_comment_replies_vote_fk
    FOREIGN KEY (vote_id) REFERENCES match_votes(id) ON DELETE CASCADE,
  CONSTRAINT match_vote_comment_replies_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS match_vote_comment_replies_vote_idx
  ON match_vote_comment_replies (vote_id);
CREATE INDEX IF NOT EXISTS match_vote_comment_replies_user_idx
  ON match_vote_comment_replies (user_id);

