-- TTP Bets: MVP market (pari-mutuel jackpot)

CREATE TABLE IF NOT EXISTS ttp_bet_markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  market_key varchar(40) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'OPEN',
  closes_at timestamptz NULL,
  settled_at timestamptz NULL,
  winning_option_key varchar(80) NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ttp_bet_markets_match_market_key_uniq
  ON ttp_bet_markets(match_id, market_key);

CREATE INDEX IF NOT EXISTS ttp_bet_markets_league_match_status_idx
  ON ttp_bet_markets(league_id, match_id, status);

CREATE TABLE IF NOT EXISTS ttp_bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES ttp_bet_markets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  option_key varchar(80) NOT NULL,
  stake_ttp int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ttp_bets_market_user_uniq
  ON ttp_bets(market_id, user_id);

CREATE INDEX IF NOT EXISTS ttp_bets_market_idx
  ON ttp_bets(market_id);

CREATE INDEX IF NOT EXISTS ttp_bets_user_idx
  ON ttp_bets(user_id);

