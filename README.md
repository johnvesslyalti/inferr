# inferr

Personalized developer news feed powered by AI. Sign in with Google, pick interest tags, get articles from Hacker News and Dev.to ranked by vector similarity. Includes an agentic RAG chat to ask questions against your feed.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15, Tailwind CSS, TypeScript |
| Backend | NestJS 11, TypeScript |
| Database | PostgreSQL 16 + pgvector (Neon in prod, Docker locally) |
| Scheduling | External cron (cron-job.org) pings `/health` every 10 min during active hours to keep the Render free-tier warm; GitHub Actions cron → `POST /scraper/run` runs the daily pipeline; `@nestjs/schedule` in-process fallback |
| ORM | Drizzle ORM |
| AI | OpenAI `gpt-4o-mini` + `text-embedding-3-small`; LangGraph agentic pipeline |
| Auth | Google OAuth 2.0 → hashed refresh token (HttpOnly cookie, 7d) + short-lived JWT access token (15m) |
| Monorepo | pnpm workspaces + Turborepo |
| Deploy | API → Render, Web → Vercel |

## Structure

```
apps/
  api/    NestJS REST API       port 3001
  web/    Next.js frontend      port 3000
packages/
  types/  shared TypeScript types
docs/     architecture notes, OAuth setup, diagrams
```

## Local Setup

**Requirements:** Node.js 22, pnpm 10, Docker

```bash
# 1. Copy env
cp .env.example .env
# Fill in GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OPENAI_API_KEY, SCRAPER_API_KEY

# 2. Start Postgres
docker compose up -d

# 3. Run migrations
cd apps/api && pnpm db:migrate

# 4. Start both apps
cd ../.. && pnpm dev
```

Docker port mapping: Postgres → `5433` (avoids conflicts with local installs).

## Environment Variables

Single `.env` at repo root, loaded by both apps.

```env
DB_HOST=localhost
DB_PORT=5433
DB_USER=postgres
DB_PASS=postgres
DB_NAME=ai_feed
DB_SSL=false

API_PORT=3001
NEXT_PUBLIC_API_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback

JWT_SECRET=
OPENAI_API_KEY=
SCRAPER_API_KEY=
```

## Database

```bash
cd apps/api
pnpm db:generate   # generate migration SQL from schema changes
pnpm db:migrate    # apply pending migrations
pnpm db:seed       # upsert test user + interests
pnpm db:studio     # Drizzle Studio at https://local.drizzle.studio
```

Migrations run automatically on API startup in production.

**Schema tables:** `users`, `articles`, `user_interests`, `document_embeddings`, `refresh_tokens`

## Ingestion Pipeline

Articles are scraped, enriched, and stored in three ordered stages. A **GitHub Actions cron** runs daily, waking the Render free-tier instance and calling `POST /scraper/run` with the `SCRAPER_API_KEY`.

```mermaid
sequenceDiagram
    participant Cron as GitHub Actions (daily)
    participant API as NestJS API
    participant Sources as HN / Dev.to APIs
    participant Sites as Article websites
    participant OpenAI
    participant DB as Postgres

    Cron->>API: POST /scraper/run (Bearer SCRAPER_API_KEY)

    rect rgb(235, 245, 255)
    Note over API,DB: Stage 1 — store metadata
    par Fetch in parallel
        API->>Sources: GET top 30 Hacker News stories
        API->>Sources: GET top 30 Dev.to articles
    end
    Sources-->>API: title, url, source, tags, publishedAt
    API->>DB: INSERT articles (metadata only)<br/>ON CONFLICT (url) DO NOTHING
    DB-->>API: ids of NEW rows (duplicates skipped)
    end

    rect rgb(235, 255, 240)
    Note over API,DB: Stage 2 — scrape content (new rows only, batches of 5)
    loop for each batch of 5 new articles
        API->>Sites: GET article HTML (10s timeout)
        Sites-->>API: HTML (or block / paywall / error)
        Note over API: cheerio extracts text<br/>article → main → p<br/>cap 8000 chars · null on failure
        API->>DB: UPDATE articles SET content, content_scraped_at
    end
    end

    rect rgb(255, 245, 235)
    Note over API,DB: Stage 3 — summarize + embed (sequential, max 50)
    API->>DB: SELECT id, title, content<br/>WHERE summary IS NULL LIMIT 50
    loop one article at a time
        API->>OpenAI: summarize(title, content) — gpt-4o-mini
        OpenAI-->>API: 3-sentence summary
        API->>OpenAI: embed(summary + tags) — text-embedding-3-small
        OpenAI-->>API: [0.021, -0.043, ...] (1536 floats)
        API->>DB: UPDATE articles SET summary, embedding
    end
    end

    API-->>Cron: { saved, summarized }
```

Each article row is written **three times** over the pipeline: metadata on insert, then `content`, then `summary` + `embedding`. Deduplication (`ON CONFLICT`) and the `summary IS NULL` filter mean an article is only ever scraped and summarized **once**, no matter how often the pipeline runs. Tags are included in the embedding input so vector similarity captures topic signals beyond the summary text.

## Feed Flow

The feed applies a relevance threshold, recency filter, and tag-overlap bonus before returning articles. If no articles clear the threshold, a fallback set is returned alongside `hasMatches: false` so the UI can show a graceful empty state.

```mermaid
sequenceDiagram
    participant Browser
    participant Next.js
    participant NestJS
    participant OpenAI
    participant Postgres

    Browser->>Next.js: GET /feed
    Next.js->>NestJS: GET /feed (Bearer JWT)
    NestJS->>Postgres: SELECT tags FROM user_interests WHERE user_id = ?
    Postgres-->>NestJS: ["typescript", "rust"]
    NestJS->>OpenAI: embed("typescript rust")
    OpenAI-->>NestJS: [0.021, -0.043, ...] (1536 floats)
    NestJS->>Postgres: SELECT title, url, source, summary, tags, published_at<br/>FROM articles WHERE embedding IS NOT NULL<br/>ORDER BY embedding <=> query_vector
    Note over Postgres: HNSW index → O(log n) ANN search
    Postgres-->>NestJS: all ranked articles
    Note over NestJS: Apply tag-overlap bonus (−0.12 per match)<br/>Filter: cosine distance < 0.5 AND published within 48h<br/>→ matched articles OR fallback top-10
    NestJS-->>Next.js: { hasMatches, articles, fallback }
    Next.js-->>Browser: Rendered feed (or "nothing new" state)
```

## Agentic Chat

The `/chat` endpoint uses a **LangGraph** stateful pipeline instead of a flat retrieve → generate chain. Multi-turn conversation history is accepted on every request.

```mermaid
flowchart LR
    A[retrieve\nfetch top articles\nby vector similarity] --> B[grade documents\nrelevance check\ngpt-4o-mini]
    B -->|all irrelevant| C[rewrite query\nusing conversation\nhistory · max 2×]
    C --> A
    B -->|at least one relevant| D[generate\ngrounded answer\n+ cited sources]
```

If the grader rejects all retrieved articles, the query rewriter reformulates using conversation history and retries (up to 2 times). This prevents hallucinated answers when the feed has no relevant content for the question.

## Auth Flow

```
GET /auth/google
  → Google consent screen
  → GET /auth/google/callback
  → upsert user in DB
  → create hashed refresh token (stored as SHA-256 in refresh_tokens table)
  → set HttpOnly refresh_token cookie (7 days)
  → redirect to /auth/callback (no token in URL)

POST /auth/refresh (cookie)
  → rotate refresh token (old revoked, new issued)
  → reuse detection: recently-revoked tokens within 5s grace window follow
    the replacement chain (safe for multi-tab)
  → return { accessToken } (JWT, 15 min)

Protected routes: Authorization: Bearer <accessToken>
POST /auth/logout → revoke refresh token, clear cookie
```

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | — | Health check |
| GET | `/auth/google` | — | Start Google OAuth |
| GET | `/auth/google/callback` | — | OAuth callback, sets HttpOnly refresh cookie |
| POST | `/auth/refresh` | cookie | Rotate refresh token → return JWT access token |
| POST | `/auth/logout` | cookie | Revoke refresh token, clear cookie |
| GET | `/auth/me` | Bearer JWT | Current user + hasInterests flag |
| POST | `/users/interests` | Bearer JWT | Save interest tags |
| GET | `/feed` | Bearer JWT | Personalized article feed with relevance filtering |
| POST | `/chat` | Bearer JWT | Agentic RAG chat (supports conversation history) |
| POST | `/scraper/run` | `SCRAPER_API_KEY` | Run full pipeline: scrape → content → summarize |

## Deployment

**API (Render):** Set env vars, deploy from `Dockerfile`. `DATABASE_URL` overrides the individual `DB_*` vars. A daily GitHub Actions workflow (`.github/workflows/daily-scrape.yml`) calls `POST /scraper/run` with `SCRAPER_API_KEY` — add that secret to both Render and the GitHub repo.

**Keeping the free-tier API warm:** Render's free instance sleeps after 15 min idle. GitHub Actions cron is too unreliable for short-interval keep-alive pings, so an external pinger ([cron-job.org](https://cron-job.org)) does a `GET https://api.inferr.xyz/health` every 10 min, restricted to hours 0–18 UTC (~06:00–24:00 IST) to stay within the 750 hr/month budget. The instance is allowed to sleep overnight; the web app's wake overlay (`apps/web/src/lib/server-status.tsx`) covers the first cold request.

**Web (Vercel):** Set `NEXT_PUBLIC_API_URL` to the Render API URL. `vercel.json` at root handles the monorepo build pointing to `apps/web`.
