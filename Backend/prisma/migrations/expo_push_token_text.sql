-- Ampliar columna: tokens de Expo Push pueden exceder VARCHAR(255) y quedaban truncados.
ALTER TABLE users
  ALTER COLUMN expo_push_token TYPE TEXT;
