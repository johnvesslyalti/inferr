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

**Schema tables:** `users`, `articles`, `user_interests`, `document_embeddings`, `mcp_tokens`

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
| `McpModule` | MCP server over Streamable HTTP at `POST/GET/DELETE /mcp`; exposes 3 tools |
| `McpAuthModule` | Standalone OAuth 2.1 provider (`McpOAuthProvider`); breaks circular dep between `AuthModule` ↔ `McpModule` |

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

### MCP auth flow (OAuth 2.1 + Google)
1. MCP client (Claude Desktop / Claude Code) registers at `POST /register` → gets a `client_id`
2. Client opens `GET /authorize` (PKCE) → `McpOAuthProvider` redirects to `GET /auth/google/mcp?state=…`
3. `GoogleMcpStrategy` (separate from the web-app strategy) carries the MCP `state` through Google consent
4. Google → `GET /auth/google/mcp-callback` → upserts user → `completeMcpAuthorization()` issues a single-use auth code
5. Client exchanges code for tokens at `POST /token` (PKCE verified) → receives a 1h JWT access token + 7d refresh token
6. MCP requests hit `POST /GET /DELETE /mcp` with `Authorization: Bearer <jwt>`; `McpOAuthProvider.verifyAccessToken()` validates and extracts `userId`
7. Each session gets a per-user `McpServer` instance — tools close over `userId` so one user cannot read another's feed

**MCP tools exposed:**

| Tool | Description |
|---|---|
| `search_articles` | pgvector semantic search over the article corpus |
| `get_personalized_feed` | Returns the authenticated user's personalised feed |
| `ask_inferr` | Agentic RAG pipeline (retrieve → grade → rewrite → generate) |

**Security notes:** Refresh tokens are rotated on every use and stored SHA-256-hashed in `mcp_tokens`. Reuse of an already-rotated token nukes the entire chain for that user. MCP JWTs carry `type: 'mcp_access'` to prevent cross-use with web-app tokens.

**Single-instance caveat:** Active MCP SSE session transports are stored in-memory (in `McpService`'s `transports` Map), meaning horizontal scaling requires sticky sessions at the load balancer/gateway level so that subsequent requests with a given session ID route to the container holding that socket. Registered OAuth clients, tokens, and pending PKCE authorization states are fully database-backed and cluster-safe.


### Next.js web app
- `app/page.tsx` — public landing page; Sign In links to `${NEXT_PUBLIC_API_URL}/auth/google`
- `app/auth/callback/page.tsx` — receives `?token=` from API redirect, stores token, redirects to `/dashboard`
- `app/dashboard/page.tsx` — fetches `/auth/me` with Bearer token; redirects to `/` if unauthenticated
- `middleware.ts` — blocks `/dashboard` if `google_id_token` cookie is absent
- `src/lib/server-status.tsx` — thin wrapper: exports `API_BASE` constant and `apiFetch` (plain `fetch` pass-through). The former wake overlay and `ServerStatusProvider` have been removed.

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
GOOGLE_MCP_CALLBACK_URL=http://localhost:3001/auth/google/mcp-callback  # MCP OAuth flow
API_URL=http://localhost:3001  # Used by mcpAuthRouter (issuerUrl/baseUrl) and MCP WWW-Authenticate headers
```

In production set `API_URL=https://api.inferr.xyz` and `GOOGLE_MCP_CALLBACK_URL=https://api.inferr.xyz/auth/google/mcp-callback`. Also add the production callback URL to Google Cloud Console → OAuth 2.0 Client → Authorized redirect URIs.

### Bruno API collection
Requests live in `bruno/`. To manually trigger the scraper: **Run Scraper** (`POST /scraper/run`). The collection also includes RAG init/query requests and a health check.
