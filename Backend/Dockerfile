# ---- Build ----
FROM node:20-alpine AS builder

WORKDIR /app

# Dependencias (solo production + prisma para generate/migrate)
COPY package.json package-lock.json* ./
RUN npm ci

COPY prisma ./prisma/
COPY prisma.config.ts ./
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src/

# Prisma 7 usa prisma.config.ts; DATABASE_URL debe existir para generate/migrate (solo validación en build).
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate && npm run build && cp -r src/generated dist/

# ---- Production ----
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Solo dependencias de producción (sin devDependencies)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Prisma CLI para migrate deploy en entrypoint (Prisma 7 genera el client en src/generated, no en node_modules/.prisma)
RUN npm install prisma --no-save

# Schema, migraciones y app compilada (el client generado ya está dentro de dist/generated)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/dist ./dist

# Script de arranque: migrar y levantar servidor (convertir CRLF→LF por si se editó en Windows)
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
