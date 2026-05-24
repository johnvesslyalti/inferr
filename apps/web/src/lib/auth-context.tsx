'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

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

  const api = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/+$/, '');

  const refreshToken = useCallback(async (): Promise<string | null> => {
    if (refreshing.current) return null;
    refreshing.current = true;

    try {
      const res = await fetch(`${api}/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // sends the HttpOnly refresh_token cookie
      });

      if (!res.ok) return null;

      const data = await res.json();
      setTokenState(data.accessToken);
      return data.accessToken;
    } catch {
      return null;
    } finally {
      refreshing.current = false;
    }
  }, [api]);

  // On mount: restore session from HttpOnly cookie via silent refresh
  useEffect(() => {
    refreshToken().finally(() => setReady(true));
  }, [refreshToken]);

  const setToken = useCallback((newToken: string) => {
    setTokenState(newToken);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fetch(`${api}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {}
    setTokenState(null);
  }, [api]);

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
