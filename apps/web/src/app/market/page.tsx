'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/src/lib/auth-context';
import { ProfileMenu } from '@/src/components/ProfileMenu';
import styles from './market.module.css';

export default function TechMarketPage() {
  const router = useRouter();
  const { token, ready } = useAuth();

  useEffect(() => {
    if (ready && !token) { router.push('/'); }
  }, [ready, token, router]);

  if (!ready || !token) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingScreen}>
          <div className={styles.spinner} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.logo}>
          <Image src="/logo.png" alt="Logo" width={22} height={22} style={{ borderRadius: '4px' }} />
          <span className={styles.logoText}>inferr</span>
        </div>
        <div className={styles.navRight}>
          <ProfileMenu />
        </div>
      </nav>

      <main className={styles.main}>
        <h1>Tech Market</h1>
        <p>Tell me what you want here.</p>
      </main>
    </div>
  );
}
