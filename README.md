# AI Developer Feed

A personalized news feed for developers powered by AI. Sign in with Google, pick your interests, and get a curated feed of articles from Hacker News and Dev.to with a RAG-based chat interface to ask questions about your feed.

## Features

- **Personalized feed** — pgvector similarity search against your interest tags, top 5 articles per visit
- **RAG chat** — embed your question → retrieve top 3 relevant articles → GPT-4o-mini grounded answer with source links
- **Daily scraper** — Bull queue cron (07:00 IST) fetches HN Algolia + Dev.to, deduplicates by URL, generates summaries and embeddings
- **Google OAuth** — sign in, onboard with tag chips, get redirected to your feed

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, Tailwind CSS, TypeScript |
| Backend | NestJS 11, TypeScript |
| Database | PostgreSQL 16 + pgvector |
| Queue | Redis + Bull |
| ORM | Drizzle ORM |
| AI | OpenAI `gpt-4o-mini` + `text-embedding-3-small` |
| Auth | Google OAuth 2.0 (Passport) |
| Monorepo | pnpm workspaces + Turborepo |
| Deploy | API → Railway (Docker), Web → Vercel |

## Project Structure

```
.
├── apps/
│   ├── api/          # NestJS REST API (port 3001)
│   └── web/          # Next.js frontend (port 3000)
├── packages/
│   └── types/        # Shared TypeScript types
├── Dockerfile        # Multi-stage build for the API
├── railway.json      # Railway deploy config
├── vercel.json       # Vercel deploy config
└── docker-compose.yml
```

## Prerequisites

- Node.js 22.x
- pnpm 10.x (`npm install -g pnpm`)
- Docker + Docker Compose

## Environment Variables

Create a single `.env` file at the repo root:

```env
# Database (Docker maps postgres to 5433)
DB_HOST=localhost
DB_PORT=5433
DB_USER=postgres
DB_PASS=postgres
DB_NAME=ai_feed
DB_SSL=false          # set to true on Railway

# Redis (Docker maps redis to 6380)
REDIS_HOST=localhost
REDIS_PORT=6380

# API
API_PORT=3001
NEXT_PUBLIC_API_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback

# OpenAI
OPENAI_API_KEY=
```

## Local Development

One command starts everything — Docker (Postgres, Redis, API) and the Next.js dev server:

```bash
pnpm dev
```

To stop:
```bash
docker compose down        # stop containers, keep DB data
docker compose down -v     # stop and wipe DB (fresh start)
```

After a fresh DB wipe, re-seed the test user:
```bash
npm run db:seed
```

### Running apps individually

```bash
# API (NestJS watch mode, port 3001)
cd apps/api && pnpm dev

# Web (Next.js, port 3000)
cd apps/web && pnpm dev
```

### Database commands (from apps/api/)

```bash
pnpm db:generate   # generate Drizzle migration from schema changes
pnpm db:migrate    # apply pending migrations
pnpm db:seed       # upsert test user + interests
pnpm db:studio     # open Drizzle Studio at https://local.drizzle.studio
```

### Docker commands

```bash
docker compose ps                    # check service status
docker compose logs -f api           # tail API logs
docker compose up -d --build api     # rebuild API image after code changes
```

## Deployment

### API → Railway

1. Create a Railway project → Deploy from GitHub repo
2. Add **Postgres** and **Redis** plugins
3. Set environment variables (use the Railway Postgres connection details for `DB_*` vars, set `DB_SSL=true`)
4. Railway auto-detects `railway.json` and builds from `Dockerfile`

Migrations run automatically on startup — no manual step needed.

### Web → Vercel

1. Import the repo on Vercel
2. Set `NEXT_PUBLIC_API_URL` to your Railway API URL
3. `vercel.json` at root handles the monorepo build

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | — | Health check |
| GET | `/auth/google` | — | Start Google OAuth |
| GET | `/auth/google/callback` | — | OAuth callback |
| GET | `/auth/me` | Bearer | Current user |
| POST | `/users/interests` | Bearer | Save interest tags |
| GET | `/feed` | Bearer | Personalized article feed |
| POST | `/chat` | Bearer | RAG chat query |
| POST | `/scraper/run` | Bearer | Manually trigger scrape |
| POST | `/ai/process` | Bearer | Embed + summarize articles |
| POST | `/scheduler/trigger` | Bearer | Trigger scrape pipeline job |

Auth token is the user's UUID returned from OAuth, sent as `Authorization: Bearer <uuid>`.

## License

UNLICENSED
