#!/bin/sh
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "📦 Aplicando migraciones de Prisma..."
  npx prisma migrate deploy || true
fi

exec "$@"
