'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, API_BASE } from '@/src/lib/auth-context';
import { apiFetch } from '@/src/lib/server-status';

function AuthCallbackContent() {
  const router = useRouter();
  const { ready, token, refreshToken } = useAuth();

  useEffect(() => {
    if (!ready) return;

    const complete = async () => {
      // AuthProvider's mount-time refresh may have already run before OAuth
      // (e.g. user clicked login from the landing page). In that case token is
      // null here even though the OAuth cookie is now set. Retry explicitly.
      let accessToken = token;
      if (!accessToken) {
        accessToken = await refreshToken();
      }
      if (!accessToken) {
        router.push('/');
        return;
      }
      try {
        const r = await apiFetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          credentials: 'include',
        });
        const user = await r.json() as { hasInterests: boolean };
        router.push(user.hasInterests ? '/feed' : '/onboarding');
      } catch {
        router.push('/onboarding');
      }
    };

    complete();
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
        <p className="text-white text-lg">Completing sign in...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return <AuthCallbackContent />;
}
