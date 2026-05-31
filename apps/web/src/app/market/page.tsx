'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth, API_BASE } from '@/src/lib/auth-context';
import { apiFetch } from '@/src/lib/server-status';
import { ProfileMenu } from '@/src/components/ProfileMenu';
import styles from './market.module.css';

interface JobReport {
  totalListings: number;
  topSkills: { skill: string; count: number }[];
  roleBreakdown: { category: string; count: number }[];
  generatedAt: string;
}

export default function TechMarketPage() {
  const router = useRouter();
  const { token, ready, signOut: authSignOut } = useAuth();
  const [report, setReport] = useState<JobReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !token) { router.push('/'); return; }
    if (!ready) return;

    apiFetch(`${API_BASE}/jobs/report`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load market report');
        return r.json() as Promise<JobReport>;
      })
      .then(setReport)
      .catch((err) => setError(err instanceof Error ? err.message : 'Something went wrong'))
      .finally(() => setLoading(false));
  }, [ready, token, router]);

  if (!ready || !token || loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingScreen}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>fetching market data…</p>
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
    ? new Date(report.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

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
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <span className={styles.liveDot} />
            <span className={styles.label}>Live · Remote Tech Jobs</span>
          </div>
          <h1 className={styles.title}>Tech Market</h1>
          <p className={styles.meta}>updated {updatedAt}</p>
        </div>

        {/* Stat strip */}
        <div className={styles.statStrip}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{report?.topSkills.length}</span>
            <span className={styles.statLabel}>Skills tracked</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{report?.roleBreakdown.length}</span>
            <span className={styles.statLabel}>Role categories</span>
          </div>
        </div>

        {/* Data grid */}
        <div className={styles.grid}>

          {/* Top Skills — full width, chips */}
          <div className={`${styles.card} ${styles.colFull}`}>
            <p className={styles.cardTitle}>Top Skills in Demand</p>
            <div className={styles.skillChips}>
              {report?.topSkills.map((s, i) => (
                <div key={s.skill} className={styles.skillChip}>
                  <span className={styles.chipRank}>{i + 1}</span>
                  <span className={styles.chipName}>{s.skill}</span>
                  <span className={styles.chipCount}>{s.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Role breakdown */}
          <div className={styles.card}>
            <p className={styles.cardTitle}>Role Breakdown</p>
            <div className={styles.rolesList}>
              {report?.roleBreakdown.map((r) => (
                <div key={r.category} className={styles.roleRow}>
                  <div className={styles.roleTop}>
                    <span className={styles.roleName}>{r.category}</span>
                    <span className={styles.roleCount}>{r.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>


        </div>
      </main>
    </div>
  );
}
