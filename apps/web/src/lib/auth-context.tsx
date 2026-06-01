'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE, apiFetch } from './server-status';
import { rememberSession, forgetSession, decodeUserId } from './local-store';

export { API_BASE } from './server-status';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  ready: boolean;
  setToken: (token: string) => void;
  signOut: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const refreshing = useRef(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

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
          // Fetch profile once per session so all navbars share user data.
          apiFetch(`${API_BASE}/auth/me`, {
            headers: { Authorization: `Bearer ${data.accessToken}` },
            credentials: 'include',
          }).then((r) => r.ok ? r.json() : null)
            .then((u) => { if (u) setUser(u as AuthUser); })
            .catch(() => {});
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
    mountedRef.current = true;
    refreshToken().then((t) => {
      if (!mountedRef.current) return;
      if (t) scheduleProactiveRefresh(t, () => refreshToken());
    }).finally(() => {
      if (mountedRef.current) setReady(true);
    });

    return () => {
      mountedRef.current = false;
      refreshing.current = false;
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
    setUser(null);
    setTokenState(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, ready, setToken, signOut, refreshToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
