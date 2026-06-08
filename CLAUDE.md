# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Root (runs across all apps via Turbo)
```bash
npm run dev          # Start all apps in parallel
npm run build        # Build all apps
npm run lint         # Lint all apps
npm run test         # Run all tests
```

### API (`apps/api/`)
```bash
npm run dev          # NestJS watch mode (port 3001)
npm run build        # Compile to dist/
npm run test         # Jest
npm run test:watch   # Jest watch mode
npm run test:e2e     # E2E tests

npm run db:generate  # Generate Drizzle migration SQL from schema changes
npm run db:migrate   # Apply pending migrations to Postgres
npm run db:seed      # Upsert test user + interests
npm run db:studio    # Open Drizzle Studio at https://local.drizzle.studio
```

### Web (`apps/web/`)
```bash
npm run dev          # Next.js dev server (port 3000)
npm run build        # Production build
npm run lint         # ESLint via next lint
```

### Infrastructure
```bash
docker compose up -d    # Start Postgres (5433) + Redis (6380)
docker compose ps       # Verify healthy
```

## Architecture

### Monorepo layout
- `apps/api` — NestJS REST API, port 3001
- `apps/web` — Next.js 15 frontend, port 3000
- `packages/types` — shared TypeScript types (minimal usage currently)
- Turbo orchestrates tasks; pnpm workspaces link packages

### Database
PostgreSQL with **pgvector** extension via `pgvector/pgvector:pg16` Docker image. Drizzle ORM is used throughout — no TypeORM, no Prisma.

**Schema tables:** `users`, `articles`, `user_interests`, `document_embeddings`

The `articles.embedding` and `document_embeddings.embedding` columns are `vector(1536)` (OpenAI `text-embedding-3-small`). Vector similarity search uses the native `<=>` operator via raw SQL.

**Column naming:** The Drizzle schema uses snake_case column names (e.g. `google_id`, `created_at`). The pre-existing `users` table had camelCase columns which were manually renamed — keep all new columns snake_case.

**Drizzle config** lives at `apps/api/drizzle.config.ts` with `ssl: false` for local Docker Postgres. Migration files output to `apps/api/drizzle/`.

#### Migration discipline (IMPORTANT)

**Never edit, renumber, or backdate a migration once it has been applied anywhere (local, CI, or prod). Only ever add a NEW migration.** If a migration is wrong, fix it forward with a new one.

Why this matters here: production and local already have **drifted migration history** because earlier migrations were edited after the fact (e.g. `0006` was rewritten to add `DROP TABLE IF EXISTS`, `0003`/`0007` were backdated, `0007_jobs_table` was renumbered when merged from another branch). Each database froze a different snapshot, so neither `__drizzle_migrations` log perfectly matches the repo journal. This is currently **cosmetic and safe** — `drizzle-kit migrate` decides what to apply by the journal `when` *timestamp*, not by hash, and all real tables/data are correct. Editing applied migrations is what caused the drift; keep doing it and you risk "table already exists" failures or silently-skipped migrations.

Rules of thumb:
- Schema change → `npm run db:generate` (creates a new file), then `npm run db:migrate`. Don't hand-edit generated SQL for already-applied versions.
- New migrations always get a `when = Date.now()` greater than the current max, so they apply cleanly to both drifted databases.
- For prod (Neon), run migrations against `DATABASE_URL` pointed at Neon with `DB_SSL=true`. Verify the target and that the change is additive before applying.

### NestJS API modules

| Module | Responsibility |
|---|---|
| `DrizzleModule` | Global, provides the `DRIZZLE` symbol (single `NodePgDatabase` instance) |
| `AuthModule` | Google OAuth 2.0 via Passport, `/auth/google`, `/auth/google/callback`, `/auth/me` |
| `UsersModule` | DB upsert/lookup for users; used by AuthModule |
| `RAGModule` | OpenAI embeddings + pgvector similarity search + GPT-4o-mini generation |
| `ScraperModule` | Fetches top 30 articles from HN Algolia API and Dev.to, deduplicates by URL |

**DB injection pattern** — every service that needs the DB injects it the same way:
```typescript
constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}
```

**No repository layer** — services query Drizzle directly. This is intentional and consistent across all modules.

### Auth flow
1. Browser → `GET /auth/google` → Google consent screen
2. Google → `GET /auth/google/callback` → upserts user in DB → redirects to `${FRONTEND_URL}/auth/callback?token=<user.id>`
3. Frontend stores `user.id` UUID as the auth token in `localStorage` + `google_id_token` cookie
4. Protected API calls send `Authorization: Bearer <user.id>`; `GoogleTokenGuard` validates by DB lookup (no JWT)

### Next.js web app
- `app/page.tsx` — public landing page; Sign In links to `${NEXT_PUBLIC_API_URL}/auth/google`
- `app/auth/callback/page.tsx` — receives `?token=` from API redirect, stores token, redirects to `/dashboard`
- `app/dashboard/page.tsx` — fetches `/auth/me` with Bearer token; redirects to `/` if unauthenticated
- `middleware.ts` — blocks `/dashboard` if `google_id_token` cookie is absent

### Environment variables
Single `.env` at the repo root, loaded by both apps. Key values:

```
DB_PORT=5433              # Docker maps postgres to 5433 (not 5432)
REDIS_PORT=6380           # Docker maps redis to 6380 (not 6379)
API_PORT=3001
NEXT_PUBLIC_API_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000
OPENAI_API_KEY=           # Required for embeddings and RAG
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback
```

### Bruno API collection
Requests live in `bruno/`. To manually trigger the scraper: **Run Scraper** (`POST /scraper/run`). The collection also includes RAG init/query requests and a health check.
