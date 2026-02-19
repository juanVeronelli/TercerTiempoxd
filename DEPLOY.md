# Despliegue (GitHub → Railway)

## 1. Antes de subir a GitHub

- **No subas la carpeta `Backend/dist/`.** Es build compilado; debe estar en `.gitignore` (ya lo está). Si en algún momento la commiteaste, quítala del repo:

  ```bash
  git rm -r --cached Backend/dist
  git commit -m "chore: stop tracking Backend/dist"
  ```

- No hace falta hacer `npm run build` para subir a GitHub. Solo sube código fuente; el build se hace en el servidor.

## 2. En Railway

- **Build Command:** `npm run build` (genera `dist/` en el servidor).
- **Start Command:** `npm start` (ejecuta `node dist/server.js`).
- **Variables de entorno:** configura en el panel de Railway todas las que uses en `Backend/.env` (DATABASE_URL, JWT_SECRET, CLOUDINARY_*, RESEND_API_KEY, etc.). No subas el archivo `.env` al repo.
- **Base de datos:** si usas PostgreSQL de Railway, copia la `DATABASE_URL` que te da Railway y úsala como variable de entorno.
- **Migraciones:** en el primer deploy (o al cambiar el schema), ejecuta migraciones. En Railway puedes añadir un paso de build tipo `npx prisma generate && npx prisma migrate deploy && npm run build`, o usar un job/script aparte. Lo mínimo es `npx prisma generate` antes del build (para que el cliente Prisma exista) y `npx prisma migrate deploy` una vez antes de arrancar (o desde el dashboard de Railway en "Run Command").

## 3. Resumen

| Acción              | Dónde              |
|---------------------|--------------------|
| No subir `dist/`    | GitHub (ignorado)  |
| No hacer build local para “subir” | Solo subes código |
| Build               | Railway (en cada deploy) |
| Variables de entorno | Panel de Railway |
