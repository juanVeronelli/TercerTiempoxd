## Migraciones (manual SQL)

Este proyecto aplica cambios de base de datos con **SQL versionado** en `prisma/migrations/` y se ejecutan con:

```bash
cd Backend
prisma db execute --file prisma/migrations/<archivo>.sql
```

### Convención

- **Nombre del archivo**: `snake_case.sql`
- **Prefijo recomendado**:
  - `add_...` para agregar tablas/columnas/índices
  - `alter_...` para cambios de columnas/defaults
  - `insert_...` para seeds de catálogo
- **Siempre idempotente**:
  - Columnas: `ADD COLUMN IF NOT EXISTS`
  - Índices: `CREATE INDEX IF NOT EXISTS`
  - Tablas: `CREATE TABLE IF NOT EXISTS`
  - Seeds: `ON CONFLICT DO NOTHING`

### Checklist al agregar una migración

- El SQL corre 2 veces sin romperse (idempotencia).
- Si agregás campos usados por Prisma, recordá:
  - `npx prisma generate --schema prisma/schema.prisma`
  - Reiniciar `npm run dev`
- Si agregás un script de npm, sumarlo en `Backend/package.json` bajo `scripts.db:*`.

