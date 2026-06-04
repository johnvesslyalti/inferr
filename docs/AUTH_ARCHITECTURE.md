# Authentication Architecture

inferr uses a **two-token** OAuth system. Google OAuth 2.0 is the only identity provider. There are no passwords.

---

## Two-Token Model

| Token | Type | Storage | Lifetime | Stored in DB |
|---|---|---|---|---|
| **Refresh token** | 64-byte random hex | httpOnly cookie (`refresh_token`) | 7 days | SHA-256 hash only |
| **Access token** | Signed JWT (HS256) | React state (memory only) | 15 min | Not stored |

The raw refresh token is never persisted. Only `SHA-256(token)` is written to the database, so a DB breach does not expose live sessions.

The access token lives only in React state — it is lost on page refresh and silently re-issued via the refresh cookie on every mount.

---

## Flow A — Initial Sign-In

```
Browser                     Next.js (3000)            NestJS API (3001)         Google OAuth
──────────                  ──────────────            ─────────────────         ────────────
Click "Sign In"
  │
  ├── wakeServer() ──────────────────────────────────► GET /health
  │                                                      { status: "ok" }
  │
  ├── window.location.href ────────────────────────────► GET /auth/google
  │                                                      AuthGuard('google')
  │                                                            │
  │                                                            └─────────────────► Google consent
  │                                                                                      │
  │◄────────────────────────────────────────────────────────────────────────────── redirect
  │                                                      GET /auth/google/callback
  │                                                      AuthGuard('google')
  │                                                            │
  │                                                      GoogleStrategy.validate()
  │                                                      upsert user in DB
  │                                                      createRefreshToken():
  │                                                        raw = randomBytes(64)
  │                                                        store SHA-256(raw) in refresh_tokens
  │                                                      Set-Cookie: refresh_token=<raw>
  │                                                        (httpOnly, SameSite=Lax dev / None prod)
  │                                                            │
  │◄─────── redirect to /auth/callback ────────────────────────┘
  │
  │  /auth/callback page mounts
  ├── await ready (AuthProvider)
  ├── POST /auth/refresh ──────────────────────────────► cookie sent automatically
  │   credentials: 'include'                             hash token → lookup in DB
  │                                                      rotate: revoke old, insert new
  │                                                      Set-Cookie: refresh_token=<new raw>
  │◄───────────────────────────────────────────────────── { accessToken: <JWT> }
  │
  ├── setToken(JWT) → React state only
  ├── GET /auth/me ─────────────────────────────────────► JwtAuthGuard verifies JWT
  │   Authorization: Bearer <JWT>                         returns { hasInterests, ... }
  │◄─────────────────────────────────────────────────────
  │
  └── router.push('/feed') or router.push('/onboarding')
```

> **Why `AuthGuard('google')` on the OAuth routes, not `JwtAuthGuard`?**
> The user has no JWT yet at this point. `AuthGuard('google')` is the Passport strategy that drives the Google redirect and processes the callback code exchange. `JwtAuthGuard` is only used on routes that require an already-authenticated user (e.g. `/auth/me`).

---

## Flow B — Page Refresh / Session Restore

```
Browser                                              NestJS API (3001)
──────────                                           ─────────────────
User refreshes page
  │
  React state cleared (token = null)
  AuthProvider mounts
  │
  ├── POST /auth/refresh ────────────────────────────► browser auto-sends httpOnly cookie
  │   credentials: 'include'                           hash → lookup → rotate
  │                                                    Set-Cookie: refresh_token=<new raw>
  │◄───────────────────────────────────────────────── { accessToken: <new JWT> }
  │
  ├── setToken(new JWT)
  ├── schedule proactive refresh timer
  └── ready = true  →  protected pages render
```

---

## Flow C — Proactive Token Refresh (background)

```
Browser (AuthProvider timer)                         NestJS API (3001)
─────────────────────────────                        ─────────────────
JWT acquired (exp = T + 15min)
  │
  schedule timer at T + 14min  (exp − 60s)
  │
  ... 14 minutes pass ...
  │
  timer fires
  ├── POST /auth/refresh ────────────────────────────► rotate refresh token
  │   credentials: 'include'                           return new JWT
  │◄─────────────────────────────────────────────────
  ├── setToken(new JWT)
  └── schedule next timer
      (if fails → retry once after 1.5s, then sign out)
```

---

## Flow D — Logout

```
Browser                                              NestJS API (3001)
──────────                                           ─────────────────
User clicks "Sign Out"
  │
  clearTimeout(refreshTimer)
  │
  ├── POST /auth/logout ──────────────────────────────► extract cookie
  │   credentials: 'include'                            hash → find in DB
  │                                                     mark revoked = true
  │                                                     Set-Cookie: refresh_token=; Max-Age=0
  │◄─────────────────────────────────────────────────
  │
  ├── setToken(null)
  ├── clear localStorage hints (inferr:hasSession, inferr:uid)
  └── router.push('/')
```

---

## Multi-Tab Race Condition (Reuse Detection)

When two tabs both hold refresh token `R1` and both try to refresh at the same time:

```
Tab A                         Tab B                    NestJS API
──────                        ──────                   ──────────
Both tabs hold refresh_token = R1
  │                             │
  ├── POST /auth/refresh ────────────────────────────► rotate R1 → R2
  │                                                    revoked_at = now
  │                                                    replaced_by_hash = SHA-256(R2)
  │◄────────────────────────────────────────────────── Set-Cookie: R2
  │
  │  Tab B sends old R1 within the 5s grace window
  │                             ├── POST /auth/refresh ► R1 revoked, but revoked_at < 5s
  │                             │                        follow replaced_by_hash → R2
  │                             │                        rotate R2 → R3
  │                             │◄────────────────────── Set-Cookie: R3
  │
  │  Tab B sends old R1 AFTER the 5s grace window (signals possible token theft)
  │                             ├── POST /auth/refresh ► UnauthorizedException
  │                             │                        session invalidated
```

The grace window is 5 seconds. Outside it, a reuse attempt is treated as a stolen token and the session is killed.

---

## API Routes

| Route | Guard | Input | What it does |
|---|---|---|---|
| `GET /auth/google` | `AuthGuard('google')` | — | Redirects to Google consent screen |
| `GET /auth/google/callback` | `AuthGuard('google')` | Google code (query param) | Upserts user, sets refresh cookie, redirects to `/auth/callback` |
| `POST /auth/refresh` | `ThrottlerGuard` (10/min) | httpOnly refresh cookie | Rotates refresh token, returns new JWT |
| `GET /auth/me` | `JwtAuthGuard` | `Authorization: Bearer <JWT>` | Returns user profile + `hasInterests` flag |
| `POST /auth/logout` | — | httpOnly refresh cookie | Revokes token in DB, clears cookie |

All other protected routes (`/feed/*`, `/users/interests`, `/ai/*`, `/chat/*`) use `JwtAuthGuard`.

---

## JwtAuthGuard

Stateless — no database hit on every request.

1. Extracts `Bearer <token>` from the `Authorization` header.
2. Calls `JwtService.verifyAsync(token, { secret: JWT_SECRET })` — checks signature and expiry in-memory.
3. Sets `req.user = { id: payload.sub, email: payload.email, name: payload.name }`.
4. Throws `UnauthorizedException` if the token is missing, malformed, or expired.

Because JWTs are stateless, a revoked session's access token remains valid until it expires (max 15 min). The refresh token revocation on logout prevents issuing any new access tokens.

---

## Frontend: AuthProvider

`apps/web/src/lib/auth-context.tsx`

- **`token`** — the JWT, held in React state only. Never written to `localStorage`.
- **`ready`** — becomes `true` after the mount-time silent refresh completes (success or failure).
- **`localStorage` hints** — `inferr:hasSession` and `inferr:uid` store no secrets. They are used only to decide whether to show a loading skeleton optimistically before the refresh completes.
- **Proactive refresh** — once a token is obtained, the provider decodes the `exp` claim and schedules a refresh 60 seconds before expiry.
- **Retry** — if refresh fails, it retries once after 1.5 seconds, then clears the session.
- **`signOut()`** — calls `POST /auth/logout`, clears React state, clears localStorage hints.

---

## Frontend: Route Protection

All protection is **client-side**. There is no Next.js middleware. Each protected page checks:

```typescript
useEffect(() => {
  if (!ready) return;
  if (!token) { router.push('/'); return; }
  // fetch data...
}, [ready, token, router]);
```

Pages covered: `/feed`, `/dashboard`, `/chat`. `/onboarding` checks `ready` but does not redirect on missing token.

---

## Database Schema

```
users
├── id          uuid          PK
├── google_id   text          UNIQUE
├── email       text          UNIQUE
├── name        text
├── avatar      text
└── created_at  timestamptz

refresh_tokens
├── id               uuid          PK
├── user_id          uuid          FK → users.id  ON DELETE CASCADE
├── token            text          UNIQUE INDEX   (SHA-256 hash of raw token)
├── expires_at       timestamptz
├── revoked          boolean
├── revoked_at       timestamptz
└── replaced_by_hash text          (SHA-256 hash of successor token — used for reuse detection chain)
```

Deleting a user cascades to all their refresh tokens.

---

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `JWT_SECRET` | Secret used to sign and verify JWTs | `openssl rand -hex 32` output |
| `GOOGLE_CLIENT_ID` | Google OAuth app client ID | `123456-abc.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth app client secret | `GOCSPX-...` |
| `GOOGLE_CALLBACK_URL` | Must match a registered redirect URI in Google Cloud Console | `http://localhost:3001/auth/google/callback` |
| `FRONTEND_URL` | Where the API redirects after OAuth (no trailing slash) | `http://localhost:3000` |

---

## Security Properties

**What the design protects against:**

- **XSS token theft** — the refresh token is in an httpOnly cookie; JavaScript cannot read it.
- **Token replay after theft** — reuse detection invalidates the session if a revoked token is presented outside the grace window.
- **DB breach** — only SHA-256 hashes are stored; raw tokens cannot be recovered from the database.
- **Long-lived credential exposure** — access tokens are short-lived (15 min); even if intercepted, the blast radius is bounded.
- **Cookie leakage to other origins** — `SameSite=Lax` in development, `Secure + SameSite=None` in production (required for cross-origin OAuth redirect).

**Known limitations:**

- **No server-side middleware** — route protection is client-side only. A user with JS disabled can load the page shell, though all API calls will fail without a valid JWT.
- **JWT cannot be revoked mid-flight** — logging out revokes the refresh token (preventing new JWTs) but an in-flight access token remains valid for up to 15 minutes.
- **Logout is fire-and-forget** — if `POST /auth/logout` fails silently, the refresh cookie remains valid on the server until it naturally expires.
