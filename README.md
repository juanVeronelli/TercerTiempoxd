# ⚽ Tercer Tiempo

**Plataforma social para organizar partidos de fútbol, ligas privadas, votaciones entre compañeros y predicciones (Prode).**

Aplicación full-stack con **backend REST en Node.js/Express** y **app móvil multiplataforma** (iOS, Android y Web) construida con **Expo** y **React Native**. Incluye sistema de logros, duelos 1v1, notificaciones push, monetización (suscripciones y anuncios) y panel de estadísticas por liga.

---

## 📋 Tabla de contenidos

- [Descripción del proyecto](#-descripción-del-proyecto)
- [Arquitectura](#-arquitectura)
- [Tecnologías](#-tecnologías)
- [Requisitos previos](#-requisitos-previos)
- [Instalación](#-instalación)
- [Configuración de variables de entorno](#-configuración-de-variables-de-entorno)
- [Ejecución](#-ejecución)
- [Estructura del repositorio](#-estructura-del-repositorio)
- [API (Backend)](#-api-backend)
- [App móvil](#-app-móvil)
- [Base de datos](#-base-de-datos)
- [Testing](#-testing)
- [Despliegue](#-despliegue)
- [Contribución y licencia](#-contribución-y-licencia)

---

## 🎯 Descripción del proyecto

**Tercer Tiempo** permite a grupos de amigos o equipos:

| Funcionalidad            | Descripción                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ligas**                | Crear ligas con código de invitación, miembros y estadísticas históricas.                                                                         |
| **Partidos**             | Crear partidos, convocar jugadores, confirmar asistencia y registrar resultado (goles).                                                           |
| **Votaciones**           | Tras cada partido, los jugadores votan a compañeros (MVP, Tronco, etc.) con puntuaciones por categoría (técnica, físico, ritmo, defensa, ataque). |
| **Rankings**             | Tabla por liga con promedios, medallero (MVP, Tronco, Fantasma, Oracle, Duelos) y estadísticas avanzadas.                                         |
| **Prode / Predicciones** | Preguntas por partido (quién será MVP, tronco, resultado, ganador de duelo) con cierre programado y puntos.                                       |
| **Duelos 1v1**           | Retos entre dos jugadores en un partido; se registra ganador y se actualizan logros.                                                              |
| **Logros y cosméticos**  | Sistema de achievements (partidos jugados, rachas, MVPs, duelos, predicciones) con recompensas en stats o cosméticos (marcos, banners).           |
| **Notificaciones**       | Push (Expo) e in-app: convocatorias, recordatorios de voto, resultados, logros desbloqueados.                                                     |
| **Monetización**         | Plan Pro vía **RevenueCat** (IAP) y anuncios con **Google Mobile Ads**.                                                                           |
| **Perfiles**             | Foto, banner, posición, color de acento, marcos desbloqueados y vitrina de logros.                                                                |

La app está pensada para que cualquier persona pueda entender el flujo (unirse a una liga → ser convocado → jugar → votar → ver ranking y predicciones) y para mostrar el proyecto de forma profesional en portfolio o entrevistas.

---

## 🏗 Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                        TERCER TIEMPO                             │
├─────────────────────────────────────────────────────────────────┤
│  Mobile (Expo / React Native)                                    │
│  • iOS, Android, Web                                             │
│  • Expo Router (file-based routing)                              │
│  • Auth: JWT en Expo Secure Store                                │
│  • RevenueCat, AdMob, Sentry                                     │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS / REST
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Backend (Node.js + Express)                                     │
│  • API REST (/api/auth, /api/leagues, /api/match, …)             │
│  • Prisma + PostgreSQL (driver pg + adapter PrismaPg)            │
│  • JWT, bcrypt, Zod, Helmet, rate-limit                         │
│  • Cloudinary (fotos), Resend (emails), cron (tareas)           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  PostgreSQL (ej. Railway)                                       │
└─────────────────────────────────────────────────────────────────┘
```

- **Monorepo**: dos proyectos independientes (`Backend/` y `mobile/`) que se ejecutan por separado.
- La app móvil consume la API del backend; la URL base se configura con `EXPO_PUBLIC_API_URL`.

---

## 🛠 Tecnologías

### Backend

| Tecnología             | Uso                                                           |
| ---------------------- | ------------------------------------------------------------- |
| **Node.js**            | Runtime                                                       |
| **TypeScript**         | Lenguaje (ESM, `nodenext`)                                    |
| **Express 5**          | Servidor HTTP y rutas                                         |
| **Prisma 7**           | ORM + migraciones (PostgreSQL)                                |
| **PostgreSQL**         | Base de datos (ej. Railway)                                   |
| **JWT**                | Autenticación (jsonwebtoken)                                  |
| **bcrypt**             | Hash de contraseñas                                           |
| **Zod**                | Validación de esquemas en body/query                          |
| **Helmet**             | Cabeceras HTTP seguras                                        |
| **express-rate-limit** | Límite de peticiones                                          |
| **Cloudinary**         | Almacenamiento de imágenes (perfil, banner)                   |
| **Resend**             | Envío de emails (verificación, reset password)                |
| **node-cron**          | Tareas programadas (cierre de votaciones, predicciones, etc.) |
| **Jest + Supertest**   | Tests de integración                                          |

### Mobile (Expo / React Native)

| Tecnología                              | Uso                                   |
| --------------------------------------- | ------------------------------------- |
| **Expo SDK 54**                         | Framework multiplataforma             |
| **React Native**                        | UI nativa                             |
| **Expo Router**                         | Navegación file-based (app directory) |
| **React 19**                            | UI library                            |
| **TypeScript**                          | Lenguaje                              |
| **Axios**                               | Cliente HTTP hacia el backend         |
| **Expo Secure Store**                   | Almacenamiento seguro (tokens)        |
| **Expo Notifications**                  | Push notifications                    |
| **React Native Reanimated**             | Animaciones                           |
| **RevenueCat**                          | Suscripciones in-app (plan Pro)       |
| **react-native-google-mobile-ads**      | Anuncios (AdMob)                      |
| **Sentry (React Native)**               | Monitoreo de errores                  |
| **Zod**                                 | Validación en formularios             |
| **date-fns**                            | Fechas y formatos                     |
| **Jest + React Native Testing Library** | Tests unitarios                       |

### Infra y herramientas

- **Git** – Control de versiones
- **EAS (Expo Application Services)** – Builds y despliegue de la app
- **Prisma Migrate** – Esquema y migraciones de BD

---

## 📌 Requisitos previos

- **Node.js** ≥ 18 (recomendado 20 LTS)
- **npm** o **yarn**
- **Cuenta de PostgreSQL** (local o en la nube, ej. [Railway](https://railway.app), Supabase, Neon)
- **Cuenta Expo** (para EAS y builds)
- Opcional: **Cuentas en Cloudinary, Resend, RevenueCat, AdMob, Sentry** para todas las funcionalidades

---

## 📥 Instalación

### 1. Clonar el repositorio

```bash
git clone <url-del-repositorio>
cd "Tercer Tiempo"
```

### 2. Instalar dependencias del Backend

```bash
cd Backend
npm install
```

### 3. Instalar dependencias de la app móvil

```bash
cd ../mobile
npm install
```

### 4. Configurar variables de entorno

Crear los archivos `.env` en `Backend/` y opcionalmente en `mobile/` según la sección [Configuración de variables de entorno](#-configuración-de-variables-de-entorno).

### 5. Base de datos (Backend)

Asegúrate de tener `DATABASE_URL` en `Backend/.env`. Luego:

```bash
cd Backend
npx prisma generate
npx prisma migrate deploy
# Opcional: poblar logros y datos iniciales
npx prisma db seed
```

---

## 🔐 Configuración de variables de entorno

### Backend (`Backend/.env`)

| Variable                | Obligatorio | Descripción                                                         |
| ----------------------- | ----------- | ------------------------------------------------------------------- |
| `DATABASE_URL`          | ✅          | URL de conexión PostgreSQL (`postgresql://user:pass@host:port/db`)  |
| `JWT_SECRET`            | ✅          | Clave secreta para firmar tokens JWT                                |
| `CLOUDINARY_CLOUD_NAME` | Recomendado | Cloudinary: nombre de la nube                                       |
| `CLOUDINARY_API_KEY`    | Recomendado | Cloudinary: API key                                                 |
| `CLOUDINARY_API_SECRET` | Recomendado | Cloudinary: API secret                                              |
| `RESEND_API_KEY`        | Recomendado | Resend: API key para envío de emails                                |
| `EMAIL_FROM`            | Opcional    | Remitente de emails (ej. `"Tercer Tiempo <soporte@tudominio.com>"`) |
| `PORT`                  | Opcional    | Puerto del servidor (por defecto `3000`)                            |
| `NODE_ENV`              | Opcional    | `development` \| `test` \| `production`                             |

**Importante:** No subas `.env` al repositorio. Usa `.env.example` (sin valores reales) para documentar las claves necesarias.

### Mobile (`mobile/.env`)

| Variable                         | Obligatorio | Descripción                                                                      |
| -------------------------------- | ----------- | -------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL`            | ✅          | URL base del backend (ej. `http://localhost:3000` o `https://api.tudominio.com`) |
| `EXPO_PUBLIC_SENTRY_DSN`         | Opcional    | DSN de Sentry para la app                                                        |
| `EXPO_PUBLIC_REVENUECAT_API_KEY` | Opcional    | API key pública de RevenueCat (para suscripciones)                               |

En Expo, solo las variables con prefijo `EXPO_PUBLIC_` están disponibles en el cliente.

---

## ▶ Ejecución

### Backend (modo desarrollo)

```bash
cd Backend
npm run dev
```

- Servidor con hot-reload (`tsx watch`).
- Por defecto en `http://localhost:3000`.
- Endpoint de salud: `GET http://localhost:3000/health`.

### Mobile (Expo)

```bash
cd mobile
npm start
```

- Abre el bundler de Expo. Desde ahí puedes:
  - **iOS**: `i` o escanear QR con cámara (Expo Go).
  - **Android**: `a` o escanear QR con Expo Go.
  - **Web**: `w` para abrir en el navegador.

Para ejecutar en simulador/emulador con dev client:

```bash
npm run ios
# o
npm run android
```

**Consejo:** En desarrollo, si el backend está en tu PC, usa la IP local en `EXPO_PUBLIC_API_URL` (ej. `http://192.168.1.10:3000`) para que el dispositivo/emulador pueda conectarse.

---

## 📁 Estructura del repositorio

```
Tercer Tiempo/
├── .gitignore
├── README.md
├── Backend/
│   ├── .env                    # No versionado
│   ├── .gitignore
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.build.json
│   ├── prisma/
│   │   ├── schema.prisma       # Modelos y enums
│   │   ├── migrations/
│   │   └── seed.ts            # Logros y datos iniciales
│   └── src/
│       ├── server.ts           # Entrada, Express, CORS, rutas
│       ├── scheduler.ts       # Cron jobs
│       ├── config/            # Cloudinary, etc.
│       ├── controllers/       # auth, league, match, user, notification, prediction, achievement, webhook
│       ├── middlewares/       # auth, rateLimit, validation
│       ├── routes/            # Montaje de rutas por dominio
│       ├── schemas/            # Zod (auth, match, prediction)
│       ├── services/          # Lógica de negocio (Match, Prediction, Notification, Achievement, Duel, etc.)
│       ├── utils/
│       ├── workers/            # Worker de logros (opcional)
│       └── generated/          # Prisma Client (generado)
└── mobile/
    ├── .env                    # No versionado
    ├── app.json
    ├── app.config.js          # Config dinámica (Expo, Sentry, AdMob, RevenueCat)
    ├── package.json
    ├── app/                    # Expo Router (app directory)
    │   ├── _layout.tsx
    │   ├── index.tsx
    │   ├── (auth)/             # login, register, verification, forgot-password, reset-password, privacy-policy
    │   └── (main)/             # Pantallas tras login
    │       ├── _layout.tsx
    │       ├── index.tsx
    │       ├── user/[id].tsx
    │       ├── paywall.tsx
    │       ├── create-league.tsx
    │       └── league/
    │           ├── home.tsx
    │           ├── settings.tsx
    │           ├── notifications.tsx
    │           ├── predictions.tsx
    │           ├── profile/
    │           ├── ranking/
    │           ├── stats/
    │           └── match/
    └── assets/
```

---

## 🔌 API (Backend)

Base URL (ejemplo): `http://localhost:3000`

| Prefijo              | Descripción                                                                 |
| -------------------- | --------------------------------------------------------------------------- |
| `GET /health`        | Estado del servidor (sin auth)                                              |
| `/api/auth`          | Registro, login, verificación, recuperación de contraseña                   |
| `/api/users`         | Perfil, actualización, foto, banner, token push                             |
| `/api/leagues`       | CRUD ligas, miembros, invitación por código                                 |
| `/api/match`         | Partidos: crear, listar, convocar, confirmar, resultado, votaciones, duelos |
| `/api/notifications` | Listar, marcar leídas, preferencias                                         |
| `/api/predictions`   | Grupos, preguntas, opciones, enviar y resolver predicciones                 |
| `/api/achievements`  | Logros del usuario, progreso, reclamar cosméticos                           |
| `/api/webhooks`      | Webhooks (ej. RevenueCat para IAP)                                          |

- Autenticación: header `Authorization: Bearer <token>`.
- Respuestas en JSON; códigos HTTP estándar (200, 201, 400, 401, 403, 404, 429, 500).

---

## 📱 App móvil

- **Navegación:** Expo Router con rutas en `app/`. Grupos `(auth)` y `(main)` para flujos no autenticado y autenticado.
- **Estado:** Tokens en Secure Store; datos de usuario/liga en estado local o contexto según pantalla.
- **Builds:** EAS Build para generar `.ipa` / `.aab` (configuración en `app.config.js` y `eas.json` si existe).
- **Monetización:** RevenueCat para suscripción Pro; Google Mobile Ads para anuncios (IDs de prueba en desarrollo).

---

## 🗄 Base de datos

- **Motor:** PostgreSQL.
- **ORM:** Prisma 7 con `prisma generate` y migraciones en `Backend/prisma/`.

Entidades principales (resumen):

- **users** – Perfil, auth, plan (FREE/PRO), push token, logros y cosméticos.
- **leagues** – Ligas con código de invitación y admin.
- **league_members** – Miembros con estadísticas (partidos, promedios, medallero).
- **matches** – Partidos (fecha, lugar, estado, resultado, MVP).
- **match_players** – Participación y puntuaciones por partido.
- **match_votes** – Votos entre jugadores (overall, técnica, físico, etc.).
- **duels** – Duelos 1v1 (challenger, rival, winner).
- **prediction_groups**, **prediction_questions**, **prediction_options**, **user_predictions** – Prode.
- **honors** – MVP, Tronco, Fantasma, Oracle, Duel, etc.
- **notifications** – Notificaciones in-app (tipo, título, cuerpo, leída).
- **achievements**, **user_achievements**, **user_cosmetics** – Logros y recompensas.

Después de clonar y configurar `DATABASE_URL`:

```bash
cd Backend
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
```

---

## 🧪 Testing

### Backend

```bash
cd Backend
npm test
```

- Entorno `NODE_ENV=test`; usa la BD definida en `DATABASE_URL` (recomendado usar una BD de pruebas).
- Script: `jest --runInBand --forceExit` (ver `package.json`).

### Mobile

```bash
cd mobile
npm test
```

- Jest con preset `jest-expo` y React Native Testing Library.

---

## 🚀 Despliegue

- **Backend:** Desplegar en un PaaS (Railway, Render, Fly.io, etc.) con Node, `DATABASE_URL` y el resto de variables. Build: `npm run build`; inicio: `npm start` (ejecuta `dist/server.js`).
- **Base de datos:** Usar el mismo PostgreSQL en la nube; ejecutar `prisma migrate deploy` en el pipeline o manualmente.
- **Mobile:** Usar **EAS Build** para generar binarios; **EAS Submit** para stores. Configurar secrets en EAS para `EXPO_PUBLIC_*` y claves de servicios (Sentry, RevenueCat, etc.).

---

## 🤝 Contribución y licencia

- El proyecto está preparado para mostrarse como trabajo profesional o portfolio.
- Para contribuir: fork, rama, commits descriptivos y pull request hacia la rama principal.
- Licencia: revisar el archivo `LICENSE` en el repositorio si existe

---

**Tercer Tiempo** — Organiza partidos, vota a tus compañeros y lleva el ranking de tu liga. ⚽
