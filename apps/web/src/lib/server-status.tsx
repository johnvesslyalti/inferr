'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import styles from './wake-overlay.module.css';

export const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
).replace(/\/+$/, '');

// How long a request may run before we assume the Render free instance is
// cold (asleep) and surface the wake overlay.
const SLOW_THRESHOLD_MS = 1500;

type Status = 'idle' | 'waking';

// ---- module-level store -------------------------------------------------
// apiFetch() lives outside React (any module can call it), so the "waking"
// state is held here and pushed to subscribed components.
let current: Status = 'idle';
let pending = 0;
let slowTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<(s: Status) => void>();

function emit(next: Status) {
  if (next === current) return;
  current = next;
  listeners.forEach((l) => l(next));
}

function subscribe(listener: (s: Status) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function onRequestStart() {
  pending += 1;
  if (current === 'idle' && slowTimer === null) {
    slowTimer = setTimeout(() => emit('waking'), SLOW_THRESHOLD_MS);
  }
}

function onRequestEnd() {
  pending = Math.max(0, pending - 1);
  if (pending === 0) {
    if (slowTimer) {
      clearTimeout(slowTimer);
      slowTimer = null;
    }
    emit('idle');
  }
}

/**
 * Drop-in replacement for fetch(). Identical signature, but if any request
 * stays in flight longer than SLOW_THRESHOLD_MS it flips global status to
 * "waking" so the overlay appears; it clears once all requests settle.
 */
export async function apiFetch(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  onRequestStart();
  try {
    return await fetch(input, init);
  } finally {
    onRequestEnd();
  }
}

/**
 * Pings /health until the Render instance answers (or maxWaitMs elapses).
 * Used to pre-warm the server BEFORE a full-page navigation (sign-in), so the
 * browser never lands on Render's own cold-start page. Drives the same overlay
 * via apiFetch.
 */
export async function wakeServer(maxWaitMs = 90_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await apiFetch(`${API_BASE}/health`, { cache: 'no-store' });
      if (res.ok) return true;
    } catch {
      // network error while the instance is cold — keep retrying
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

// ---- React surface ------------------------------------------------------
const ServerStatusContext = createContext<Status>('idle');

export function useServerStatus(): Status {
  return useContext(ServerStatusContext);
}

export function ServerStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('idle');
  useEffect(() => subscribe(setStatus), []);

  return (
    <ServerStatusContext.Provider value={status}>
      {children}
      {status === 'waking' && <WakeOverlay />}
    </ServerStatusContext.Provider>
  );
}

function WakeOverlay() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, []);

  const progress = Math.min(95, Math.round((elapsed / 50) * 95));
  const message =
    elapsed < 8
      ? 'Loading your feed…'
      : elapsed < 25
        ? 'Fetching the latest articles…'
        : 'Almost ready, just a moment more…';

  return (
    <div className={styles.overlay} role="status" aria-live="polite">
      <div className={styles.card}>
        <div className={styles.dots}>
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
        </div>
        <p className={styles.message}>{message}</p>
        <div className={styles.barTrack}>
          <div className={styles.barFill} style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}
