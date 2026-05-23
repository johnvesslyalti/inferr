'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/lib/auth-context';

function AuthCallbackContent() {
  const router = useRouter();
  const { ready, token } = useAuth();

  useEffect(() => {
    if (!ready) return;

    if (!token) {
      router.push('/');
      return;
    }

    const api = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/+$/, '');
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
  }, [ready, token, router]);

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
