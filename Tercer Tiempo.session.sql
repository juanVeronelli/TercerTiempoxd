-- 0. BORRÓN Y CUENTA NUEVA (Elimina errores previos)
DROP TABLE IF EXISTS friend_stats_cache, honors, predictions, match_votes, match_players, matches, league_members, leagues, users CASCADE;

-- 1. ACTIVAR EXTENSIÓN DE UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLA PADRE: USUARIOS (No depende de nadie)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100),
    bio TEXT,
    profile_photo_url TEXT,
    banner_url TEXT,
    main_position VARCHAR(10),
    plan_type VARCHAR(10) DEFAULT 'FREE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- 3. TABLA: LIGAS (Depende de Users para el Admin)
CREATE TABLE leagues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    invite_code VARCHAR(10) UNIQUE NOT NULL,
    admin_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. TABLA: MIEMBROS DE LIGA (Une Users con Leagues)
CREATE TABLE league_members (
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    league_overall DECIMAL(3,2) DEFAULT 0.0,
    is_banned BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (league_id, user_id)
);

-- 5. TABLA: PARTIDOS (Depende de Leagues)
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES users(id),
    date_time TIMESTAMP NOT NULL,
    location_name VARCHAR(255),
    price_per_player DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'OPEN',
    team_a_score INT DEFAULT 0,
    team_b_score INT DEFAULT 0,
    ai_journal TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. TABLA: CONVOCADOS (Une Users con Matches)
CREATE TABLE match_players (
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    team VARCHAR(10) DEFAULT 'UNASSIGNED',
    has_confirmed BOOLEAN DEFAULT FALSE,
    self_vote_overall DECIMAL(3,2),
    PRIMARY KEY (match_id, user_id)
);

-- 7. TABLA: VOTOS (Depende de Matches y Users)
CREATE TABLE match_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    voter_id UUID REFERENCES users(id),
    target_id UUID REFERENCES users(id),
    league_id UUID REFERENCES leagues(id),
    overall DECIMAL(3,2) NOT NULL,
    technique DECIMAL(3,2),
    physical DECIMAL(3,2),
    pace DECIMAL(3,2),
    defense DECIMAL(3,2),
    attack DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. TABLA: PREDICCIONES
CREATE TABLE predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    predicted_winner VARCHAR(10),
    is_correct BOOLEAN DEFAULT NULL
);

-- 9. TABLA: CUADRO DE HONOR
CREATE TABLE honors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    honor_type VARCHAR(20),
    league_id UUID REFERENCES leagues(id)
);

-- 10. TABLA: CACHÉ DE VERSUS
CREATE TABLE friend_stats_cache (
    user_id UUID REFERENCES users(id),
    opponent_id UUID REFERENCES users(id),
    league_id UUID REFERENCES leagues(id),
    matches_played INT DEFAULT 0,
    wins INT DEFAULT 0,
    PRIMARY KEY (user_id, opponent_id, league_id)
);