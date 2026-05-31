'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE, apiFetch } from './server-status';
import { rememberSession, forgetSession, decodeUserId } from './local-store';

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
    refreshToken().then((t) => {
      if (t) scheduleProactiveRefresh(t, () => refreshToken());
    }).finally(() => setReady(true));

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setToken = useCallback((newToken: string) => {
    setTokenState(newToken);
    rememberSession(decodeUserId(newToken));
    scheduleProactiveRefresh(newToken, () => refreshToken());
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
