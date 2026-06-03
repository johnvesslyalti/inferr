# Google OAuth Setup

## Prerequisites

A Google Cloud project with OAuth 2.0 credentials.

## Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable the **Google People API**
4. Go to **Credentials → Create Credentials → OAuth client ID**
5. Choose **Web application**
6. Add authorized redirect URIs:
   - `http://localhost:3001/auth/google/callback` (development)
   - `https://your-api.onrender.com/auth/google/callback` (production)
7. Copy the Client ID and Client Secret

## Step 2: Configure Environment Variables

Edit `.env` at the repo root:

```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback
FRONTEND_URL=http://localhost:3000
JWT_SECRET=a-long-random-string
```

## Step 3: Run the Application

```bash
# From the monorepo root
pnpm dev
```

Opens the API on port 3001 and the web app on port 3000.

## Step 4: Test the OAuth Flow

1. Open `http://localhost:3000`
2. Click **Sign in with Google**
3. Complete the Google consent screen
4. You'll be redirected to `/dashboard`
5. Refresh the page — session persists via the HttpOnly cookie

---

## Auth Architecture

### Token Model

inferr uses a **two-token** auth model:

| Token | Storage | Lifetime | Purpose |
|---|---|---|---|
| Refresh token | HttpOnly cookie (`refresh_token`) | 7 days | Long-lived session credential |
| Access token (JWT) | Memory / `localStorage` | 15 minutes | Short-lived API credential |

The raw refresh token is **never stored in the database**. Only its SHA-256 hash is persisted in the `refresh_tokens` table. This means a database breach does not expose active sessions.

### Flow

```
GET /auth/google
  → Google consent screen
  → GET /auth/google/callback
  → upsert user in DB (google_id lookup)
  → generate random 64-byte refresh token
  → store SHA-256(token) in refresh_tokens table
  → set HttpOnly refresh_token cookie (7 days, SameSite=Lax in dev / None in prod)
  → redirect to /auth/callback (no token in URL)

POST /auth/refresh  (cookie required, rate-limited to 10/min)
  → hash incoming token, look up in DB
  → revoke old token, issue new token (rotation)
  → return { accessToken } — JWT signed with JWT_SECRET (15 min)

Protected routes: Authorization: Bearer <accessToken>
  → JwtAuthGuard verifies signature + expiry

POST /auth/logout
  → revoke refresh token in DB
  → clear cookie
```

### Refresh Token Reuse Detection

If a revoked token is presented within a **5-second grace window**, the API follows the replacement chain to find the current live token and rotates it. This handles the multi-tab race condition where a second tab sends the old token before receiving the rotated cookie.

Outside the grace window, a revoked token triggers an `UnauthorizedException` — this indicates token theft, and the session is invalidated.

### Database Tables

**`users`**
- `id` (uuid, PK)
- `google_id` (unique)
- `email` (unique)
- `name`, `avatar`, `created_at`

**`refresh_tokens`**
- `id` (uuid, PK)
- `user_id` → `users.id` (cascade delete)
- `token` (SHA-256 hash, unique, indexed)
- `expires_at`, `revoked`, `revoked_at`, `replaced_by_hash`

---

## Troubleshooting

### "Invalid or expired refresh token"
- Cookie may have expired (7-day TTL). Sign out and sign back in.
- Check that `GOOGLE_CLIENT_ID` matches the one registered for your redirect URI.

### CORS errors
- Ensure `FRONTEND_URL` in `.env` matches your actual frontend origin exactly (no trailing slash).

### OAuth callback fails
- Verify the redirect URI is registered in Google Cloud Console.
- Confirm `GOOGLE_CALLBACK_URL` matches the registered URI exactly.

### Cookie not set in development
- The cookie is `SameSite=Lax` in development. Make sure the frontend and API are on `localhost` (not `127.0.0.1` vs `localhost` mismatch).
