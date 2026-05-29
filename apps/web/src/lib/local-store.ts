'use client';

// Synchronous localStorage helpers powering the optimistic "instant app shell":
// we render the last-seen feed before the (possibly asleep) API responds, then
// revalidate in the background.
//
// These store NO secrets. The session hint is just a boolean + user id used to
// decide whether to optimistically render; the real session lives in the
// httpOnly refresh cookie and is always validated server-side.

const HINT_KEY = 'inferr:hasSession';
const UID_KEY = 'inferr:uid';
const FEED_PREFIX = 'inferr:feed:';

function safeGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage full or disabled — hydration is best-effort, ignore
  }
}

function safeRemove(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Decodes the `sub` (user id) claim from a JWT without verifying it. */
export function decodeUserId(jwt: string): string | null {
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1])) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export interface SessionHint {
  hasSession: boolean;
  userId: string | null;
}

/** Reads the local login hint synchronously (no network). */
export function getSessionHint(): SessionHint {
  return {
    hasSession: safeGet(HINT_KEY) === '1',
    userId: safeGet(UID_KEY),
  };
}

/** Records that the user is logged in (called after a successful refresh/login). */
export function rememberSession(userId: string | null): void {
  safeSet(HINT_KEY, '1');
  if (userId) safeSet(UID_KEY, userId);
}

/**
 * Clears the login hint and every cached feed. Dropping all feed caches on
 * logout keeps a shared device from showing a prior user's articles.
 */
export function forgetSession(): void {
  safeRemove(HINT_KEY);
  safeRemove(UID_KEY);
  if (typeof window === 'undefined') return;
  try {
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith(FEED_PREFIX))
      .forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

/** Reads the cached feed for a user (keyed per-user to avoid cross-user leaks). */
export function readFeedCache<T>(userId: string | null): T | null {
  const raw = safeGet(FEED_PREFIX + (userId ?? 'anon'));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Persists the latest feed for a user so the next visit can hydrate instantly. */
export function writeFeedCache<T>(userId: string | null, data: T): void {
  safeSet(FEED_PREFIX + (userId ?? 'anon'), JSON.stringify(data));
}
