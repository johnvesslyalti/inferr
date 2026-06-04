'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE, apiFetch } from './server-status';
import { rememberSession, forgetSession, decodeUserId } from './local-store';

// Shared across all useAuthFetch instances: if multiple requests 401 at the
// same time, they all await the same promise instead of each rotating the
// refresh token independently (which would invalidate each other).
let inflightRefresh: Promise<string | null> | null = null;

export { API_BASE } from './server-status';

interface AuthContextValue {
  token: string | null;
  ready: boolean;
  setToken: (token: string) => void;
  signOut: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const refreshing = useRef(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleProactiveRefresh = useCallback((accessToken: string, doRefresh: () => void) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    try {
      const { exp } = JSON.parse(atob(accessToken.split('.')[1])) as { exp: number };
      const msUntilExpiry = exp * 1000 - Date.now();
      const delay = Math.max(msUntilExpiry - 60_000, 10_000);
      refreshTimerRef.current = setTimeout(doRefresh, delay);
    } catch {
      // malformed token — skip scheduling
    }
  }, []);

  const refreshToken = useCallback(async (): Promise<string | null> => {
    if (refreshing.current) return null;
    refreshing.current = true;
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await apiFetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json() as { accessToken: string };
          setTokenState(data.accessToken);
          rememberSession(decodeUserId(data.accessToken));
          return data.accessToken;
        }
        if (attempt === 0) await new Promise(r => setTimeout(r, 1500));
      }
      return null;
    } catch {
      return null;
    } finally {
      refreshing.current = false;
    }
  }, []);

  // On mount: restore session via silent refresh
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!inflightRefresh) {
      inflightRefresh = refreshToken().finally(() => { inflightRefresh = null; });
    }
    inflightRefresh.then((t) => {
      if (t) scheduleProactiveRefresh(t, () => {
        if (!inflightRefresh) {
          inflightRefresh = refreshToken().finally(() => { inflightRefresh = null; });
        }
      });
    }).finally(() => setReady(true));

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setToken = useCallback((newToken: string) => {
    setTokenState(newToken);
    rememberSession(decodeUserId(newToken));
    scheduleProactiveRefresh(newToken, () => {
      if (!inflightRefresh) {
        inflightRefresh = refreshToken().finally(() => { inflightRefresh = null; });
      }
    });
  }, [scheduleProactiveRefresh, refreshToken]);

  const signOut = useCallback(async () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    try {
      await apiFetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {}
    forgetSession();
    setTokenState(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, ready, setToken, signOut, refreshToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function useAuthFetch() {
  const { token, refreshToken, signOut } = useAuth();
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  return useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    const { signal, ...optionsWithoutSignal } = options;

    const withBearer = (t: string | null, includeSignal: boolean): RequestInit => ({
      ...(includeSignal ? options : optionsWithoutSignal),
      credentials: 'include' as const,
      headers: {
        ...(options.headers as Record<string, string> | undefined),
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
      },
    });

    const res = await apiFetch(url, withBearer(tokenRef.current, true));
    if (res.status !== 401) return res;

    if (!inflightRefresh) {
      inflightRefresh = refreshToken().finally(() => { inflightRefresh = null; });
    }
    const newToken = await inflightRefresh;
    if (!newToken) { await signOut(); throw new Error('Session expired'); }

    // Strip signal from retry: the original signal may already be aborted while
    // the refresh was in-flight, and we still want the retry to reach the server.
    const retry = await apiFetch(url, withBearer(newToken, false));
    if (retry.status === 401) { await signOut(); throw new Error('Session expired'); }

    return retry;
  }, [refreshToken, signOut]);
}
