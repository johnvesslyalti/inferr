'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth, useAuthFetch, API_BASE, SessionExpiredError } from '@/src/lib/auth-context';
import { ProfileMenu } from '@/src/components/ProfileMenu';
import { InterestsDialog } from '@/src/components/InterestsDialog';
import styles from './market.module.css';

interface TrendingRole {
  role: string;
  demand: number;
  trend: string;
}

interface MarketReport {
  roles: TrendingRole[];
  generatedAt: string;
}

function DemandDots({ level }: { level: number }) {
  return (
    <div className={styles.dots}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < level ? styles.dotFilled : styles.dotEmpty} />
      ))}
    </div>
  );
}

export default function TechMarketPage() {
  const router = useRouter();
  const { token, ready } = useAuth();
  const authFetch = useAuthFetch();
  const [report, setReport] = useState<MarketReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInterests, setShowInterests] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!token) { router.push('/'); return; }

    const controller = new AbortController();

    authFetch(`${API_BASE}/jobs/market`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load market data');
        return r.json() as Promise<MarketReport>;
      })
      .then(setReport)
      .catch((err) => {
        if (err instanceof SessionExpiredError) return;
        if ((err as { name?: string }).name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Something went wrong');
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [ready, token, router, authFetch]);

  if (!ready || !token || loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingScreen}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>analysing market data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingScreen}>
          <p className={styles.errorText}>{error}</p>
          <button onClick={() => window.location.reload()} className={styles.retryBtn}>Retry</button>
        </div>
      </div>
    );
  }

  const updatedAt = report
    ? new Date(report.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '—';

  return (
    <div className={`${styles.page} pageGlow`}>
      {showInterests && (
        <InterestsDialog onClose={() => setShowInterests(false)} />
      )}
      <nav className={`${styles.nav} glassNav`}>
        <div className={styles.logo}>
          <Image src="/logo.png" alt="Logo" width={22} height={22} style={{ borderRadius: '4px' }} />
          <span className={styles.logoText}>inferr</span>
        </div>
        <div className={styles.navRight}>
          <ProfileMenu onEditInterests={() => setShowInterests(true)} />
        </div>
      </nav>

      <main className={styles.main}>
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <span className={styles.liveDot} />
            <span className={styles.label}>AI-analysed · Updated {updatedAt}</span>
          </div>
          <h1 className={styles.title}>Tech Market</h1>
          <p className={styles.subtitle}>Trending tech domains based on real remote job postings</p>
        </div>

        <div className={styles.roleList}>
          {report?.roles.map((r, i) => (
            <div key={r.role} className={styles.roleCard}>
              <span className={styles.roleIndex}>{String(i + 1).padStart(2, '0')}</span>
              <div className={styles.roleInfo}>
                <p className={styles.roleName}>{r.role}</p>
                <span className={styles.roleTrend}>{r.trend}</span>
              </div>
              <DemandDots level={r.demand} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
