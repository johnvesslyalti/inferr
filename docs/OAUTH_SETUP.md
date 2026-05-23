# Google OAuth Setup Guide

## Prerequisites

You need a Google Cloud project with OAuth 2.0 credentials configured.

## Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the "Google+ API"
4. Go to "Credentials" → "Create Credentials" → "OAuth client ID"
5. Choose "Web application"
6. Add authorized redirect URIs:
   - `http://localhost:3001/auth/google/callback` (development)
   - Add your production URL later
7. Copy the Client ID and Client Secret

## Step 2: Configure Environment Variables

Edit `.env` in the monorepo root:

```env
GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback
FRONTEND_URL=http://localhost:3000
```

## Step 3: Run the Application

```bash
# From the monorepo root
export PATH="$HOME/.npm-global/bin:$PATH"
pnpm dev
```

This starts both the API (port 3001) and web app (port 3000).

## Step 4: Test the OAuth Flow

1. Open `http://localhost:3000/login`
2. Click "Sign in with Google"
3. Complete the Google consent screen
4. You'll be redirected to `/dashboard` with your profile info
5. Refresh the page — you should stay logged in
6. Click "Sign Out" to clear the session

## Architecture

### Backend Flow
```
GET /auth/google → Google OAuth redirect
                 → User completes consent
                 → GET /auth/google/callback
                 → Upsert user in PostgreSQL
                 → Redirect to frontend with Google ID token
                 → Frontend stores token
```

### Frontend Flow
```
/login → User clicks "Sign in with Google"
      → Redirects to API
      → Returns to /auth/callback with token
      → Stores token in localStorage + cookie
      → Redirects to /dashboard
```

### Protected Route Flow
```
GET /auth/me (with Bearer token)
          → Lookup user in PostgreSQL by ID
          → Return user profile
          → No external API calls needed
```

## How It Works

- **Simple & Secure**: Uses user's database UUID as token. No external verification needed.
- **PostgreSQL**: Stores user profile data (id, googleId, name, email, avatar).
- **Token Verification**: Each request verifies token by database lookup. Fast and secure.
- **Credentials**: Secure httpOnly cookie + localStorage for fallback.

## Troubleshooting

### "Invalid or expired token"
- Token may have expired. Sign out and sign back in.
- Check that `GOOGLE_CLIENT_ID` matches what Google has for your redirect URI.

### CORS errors
- Ensure `FRONTEND_URL` in `.env` matches your actual frontend URL.
- Backend should have CORS enabled for the frontend origin.

### OAuth callback fails
- Verify the redirect URI is registered in Google Cloud Console.
- Check that `GOOGLE_CALLBACK_URL` matches the registered URI.

## Database

The PostgreSQL `users` table is auto-created by TypeORM with these fields:
- `id` (uuid, PK)
- `googleId` (unique)
- `email` (unique)
- `name`
- `avatar` (nullable)
- `createdAt`

## API Endpoints

### Public
- `GET /auth/google` — Start OAuth flow
- `GET /auth/google/callback` — OAuth callback (redirects)

### Protected (requires Bearer token)
- `GET /auth/me` — Get current user profile

## Security Notes

- Tokens are verified against Google's public keys (no local secret needed)
- Tokens expire after ~1 hour (Google's default)
- httpOnly cookies prevent XSS access to tokens
- CORS is enabled only for the configured frontend origin
