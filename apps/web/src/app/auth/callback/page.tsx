'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/lib/auth-context';

function AuthCallbackContent() {
  const router = useRouter();
  const { setToken } = useAuth();

  useEffect(() => {
    // Read access token from short-lived cookie set by the API — not from the URL
    const token = document.cookie
      .split('; ')
      .find((row) => row.startsWith('access_token='))
      ?.split('=')[1];

    // Clear the cookie immediately after reading
    document.cookie = 'access_token=; path=/auth/callback; max-age=0;';

    if (!token) {
      router.push('/');
      return;
    }

    setToken(token);

    const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    fetch(`${api}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((user) => {
        router.push(user.hasInterests ? '/feed' : '/onboarding');
      })
      .catch(() => {
        router.push('/onboarding');
      });
  }, [router, setToken]);

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
