-- TTP House bets: dynamic odds + combos (up to 5 legs)

CREATE TABLE IF NOT EXISTS ttp_house_bet_markets (
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

CREATE UNIQUE INDEX IF NOT EXISTS ttp_house_bet_markets_match_market_key_uniq
  ON ttp_house_bet_markets(match_id, market_key);

CREATE INDEX IF NOT EXISTS ttp_house_bet_markets_league_match_status_idx
  ON ttp_house_bet_markets(league_id, match_id, status);

CREATE TABLE IF NOT EXISTS ttp_house_bet_slips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stake_ttp int NOT NULL,
  odds_total numeric(12,6) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'OPEN',
  placed_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz NULL,
  payout_ttp int NULL
);

CREATE INDEX IF NOT EXISTS ttp_house_bet_slips_user_placed_idx
  ON ttp_house_bet_slips(user_id, placed_at);

CREATE INDEX IF NOT EXISTS ttp_house_bet_slips_match_status_idx
  ON ttp_house_bet_slips(match_id, status);

CREATE TABLE IF NOT EXISTS ttp_house_bet_legs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slip_id uuid NOT NULL REFERENCES ttp_house_bet_slips(id) ON DELETE CASCADE,
  market_id uuid NOT NULL REFERENCES ttp_house_bet_markets(id) ON DELETE CASCADE,
  option_key varchar(80) NOT NULL,
  odds numeric(12,6) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ttp_house_bet_legs_slip_market_uniq
  ON ttp_house_bet_legs(slip_id, market_id);

CREATE INDEX IF NOT EXISTS ttp_house_bet_legs_market_idx
  ON ttp_house_bet_legs(market_id);

