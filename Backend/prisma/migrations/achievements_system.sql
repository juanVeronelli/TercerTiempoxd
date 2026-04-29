-- =============================================================================
-- SISTEMA DE LOGROS Y RECOMPENSAS (Achievements System)
-- Postgres + RLS (Row Level Security)
-- Compatible con Supabase (auth.uid()) o con app.current_user_id para Prisma
-- =============================================================================

-- Extensión UUID (si no existe)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. TABLA: achievements (Catálogo de Misiones)
-- =============================================================================
CREATE TABLE achievements (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title           VARCHAR(100) NOT NULL,
    description     TEXT NOT NULL,
    category        VARCHAR(20) NOT NULL CHECK (category IN ('MATCH', 'STREAK', 'SOCIAL', 'RANKING')),
    condition_type  VARCHAR(50) NOT NULL,  -- Clave para el código: WIN_STREAK, MVP_COUNT, AVG_RATING, etc.
    condition_value DECIMAL(10, 2) NOT NULL,  -- Meta numérica: 3, 5, 8.5
    reward_type     VARCHAR(20) NOT NULL CHECK (reward_type IN ('STAT_BOOST', 'COSMETIC')),
    reward_value    JSONB NOT NULL,  -- {"defense": 1} para STAT_BOOST, "gold_frame" como string en JSON
    is_pro_exclusive BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order      INT DEFAULT 0,  -- Para ordenar en UI
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE achievements IS 'Catálogo de misiones/logros del juego';
COMMENT ON COLUMN achievements.condition_type IS 'Clave usada por el código para evaluar progreso';
COMMENT ON COLUMN achievements.reward_value IS 'JSON: {"defense": 1} para STAT_BOOST, o {"cosmetic_key": "gold_frame"} para COSMETIC';
COMMENT ON COLUMN achievements.is_pro_exclusive IS 'Si true, solo usuarios PRO pueden reclamar; todos ven el logro';

-- =============================================================================
-- 2. TABLA: user_achievements (Progreso del Usuario)
-- =============================================================================
CREATE TABLE user_achievements (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id   UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    current_progress DECIMAL(10, 2) NOT NULL DEFAULT 0,
    is_completed     BOOLEAN NOT NULL DEFAULT FALSE,
    claimed_at       TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_achievement_id ON user_achievements(achievement_id);
CREATE INDEX idx_user_achievements_is_completed ON user_achievements(user_id, is_completed);

COMMENT ON TABLE user_achievements IS 'Progreso de cada usuario en cada logro';
COMMENT ON COLUMN user_achievements.claimed_at IS 'NULL si no ha reclamado la recompensa';

-- =============================================================================
-- 3. TABLA: user_cosmetics (Inventario de Marcos/Banners)
-- =============================================================================
CREATE TABLE user_cosmetics (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cosmetic_key         VARCHAR(50) NOT NULL,  -- 'gold_frame', 'silver_banner', etc.
    cosmetic_type        VARCHAR(20) DEFAULT 'FRAME' CHECK (cosmetic_type IN ('FRAME', 'BANNER', 'BADGE')),
    source_achievement_id UUID REFERENCES achievements(id) ON DELETE SET NULL,  -- Origen (nullable si regalo/default)
    unlocked_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, cosmetic_key)
);

CREATE INDEX idx_user_cosmetics_user_id ON user_cosmetics(user_id);
CREATE INDEX idx_user_cosmetics_cosmetic_key ON user_cosmetics(cosmetic_key);

COMMENT ON TABLE user_cosmetics IS 'Inventario de marcos, banners y badges desbloqueados por el usuario';

-- =============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- --- achievements: todos pueden LEER, nadie INSERT/UPDATE/DELETE (solo admin/backend) ---
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

-- Lectura pública (cualquiera puede ver el catálogo de logros)
CREATE POLICY "achievements_select_all"
    ON achievements FOR SELECT
    USING (true);

-- Insert/Update/Delete: SIN policy = solo roles con BYPASSRLS (ej. service_role en Supabase, o el usuario de Prisma si le otorgas BYPASSRLS) pueden escribir.

-- --- user_achievements: solo el usuario ve/edita su progreso ---
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- SELECT: solo tus propias filas
CREATE POLICY "user_achievements_select_own"
    ON user_achievements FOR SELECT
    USING (
        user_id = auth.uid()
        -- Alternativa para Prisma/app: user_id = current_setting('app.current_user_id', true)::uuid
    );

-- INSERT: solo puedes insertar para ti mismo
CREATE POLICY "user_achievements_insert_own"
    ON user_achievements FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
    );

-- UPDATE: solo tus propias filas (claim, actualizar progreso)
CREATE POLICY "user_achievements_update_own"
    ON user_achievements FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- DELETE: solo tus propias filas (o prohibir delete, según negocio)
CREATE POLICY "user_achievements_delete_own"
    ON user_achievements FOR DELETE
    USING (user_id = auth.uid());

-- --- user_cosmetics: solo el usuario ve/edita su inventario ---
ALTER TABLE user_cosmetics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_cosmetics_select_own"
    ON user_cosmetics FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "user_cosmetics_insert_own"
    ON user_cosmetics FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_cosmetics_update_own"
    ON user_cosmetics FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_cosmetics_delete_own"
    ON user_cosmetics FOR DELETE
    USING (user_id = auth.uid());

-- =============================================================================
-- 5. TRIGGER: updated_at automático
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER achievements_updated_at
    BEFORE UPDATE ON achievements
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER user_achievements_updated_at
    BEFORE UPDATE ON user_achievements
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- =============================================================================
-- 6. SEED: Ejemplos de logros (opcional)
-- =============================================================================
-- INSERT INTO achievements (title, description, category, condition_type, condition_value, reward_type, reward_value, is_pro_exclusive, sort_order)
-- VALUES
--     ('El Muro', 'Gana la valla invicta 3 veces', 'MATCH', 'WIN_STREAK', 3, 'COSMETIC', '"gold_frame"', false, 1),
--     ('MVP en Serie', 'Obtén 5 MVPs en una temporada', 'STREAK', 'MVP_COUNT', 5, 'STAT_BOOST', '{"defense": 1}', false, 2),
--     ('Rating Estrella', 'Mantén un promedio de 8.5 en 10 partidos', 'RANKING', 'AVG_RATING', 8.5, 'COSMETIC', '"silver_frame"', true, 3);

-- =============================================================================
-- NOTA: RLS con Prisma
-- =============================================================================
-- Si usas solo Prisma (sin Supabase client), auth.uid() no estará definido y RLS
-- bloqueará las consultas. Opciones:
--
-- A) Usar Supabase: auth.uid() se llena automáticamente desde el JWT.
-- B) Deshabilitar RLS para estas tablas (seguridad vía backend):
--    ALTER TABLE achievements DISABLE ROW LEVEL SECURITY;
--    ALTER TABLE user_achievements DISABLE ROW LEVEL SECURITY;
--    ALTER TABLE user_cosmetics DISABLE ROW LEVEL SECURITY;
-- C) En cada request del backend, antes de las queries Prisma, ejecutar:
--    SELECT set_config('app.current_user_id', 'tu-user-uuid', true);
--    Y cambiar en las policies: user_id = current_setting('app.current_user_id', true)::uuid
