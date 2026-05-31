'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth, API_BASE } from '@/src/lib/auth-context';
import { apiFetch } from '@/src/lib/server-status';
import styles from './market.module.css';

interface JobReport {
  totalListings: number;
  topSkills: { skill: string; count: number }[];
  roleBreakdown: { category: string; count: number }[];
  topCompanies: { company: string; count: number }[];
  generatedAt: string;
}

export default function TechMarketPage() {
  const router = useRouter();
  const { token, ready, signOut: authSignOut } = useAuth();
  const [report, setReport] = useState<JobReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !token) {
      router.push('/');
      return;
    }
    if (!ready) return;

    apiFetch(`${API_BASE}/jobs/report`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load market report');
        return r.json() as Promise<JobReport>;
      })
      .then((data) => data)
      .then(setReport)
      .catch((err) => setError(err instanceof Error ? err.message : 'Something went wrong'))
      .finally(() => setLoading(false));
  }, [ready, token, router]);

  if (!ready || !token || loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingScreen}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>
            {loading ? 'Loading market data…' : 'Authenticating…'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingScreen}>
          <p className={styles.errorText}>{error}</p>
          <button onClick={() => window.location.reload()} className={styles.retryBtn}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const maxSkill = report?.topSkills[0]?.count ?? 1;
  const maxRole = report?.roleBreakdown[0]?.count ?? 1;

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.logo}>
          <Image src="/logo.png" alt="Logo" width={22} height={22} style={{ borderRadius: '4px' }} />
          <span className={styles.logoText}>inferr</span>
        </div>
        <div className={styles.navRight}>
          <a href="/feed" className={styles.navLink}>feed</a>
          <a href="/chat" className={styles.navLink}>chat</a>
          <a href="/onboarding" className={styles.navLink}>interests</a>
          <button
            onClick={async () => { await authSignOut(); router.push('/'); }}
            className={styles.signOut}
          >
            sign out
          </button>
        </div>
      </nav>

      <main className={styles.main}>
        <div className={styles.header}>
          <div className={styles.marketBadge}>TECH MARKET • LIVE DATA</div>
          <h1 className={styles.title}>Tech Market</h1>
          <p className={styles.subtitle}>
            {report?.totalListings ?? 0} active remote tech listings ·{' '}
            updated {report ? new Date(report.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
          </p>
        </div>

        <div className={styles.sections}>
          {/* Top Skills */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Top Skills in Demand</h2>
            <div className={styles.skillsList}>
              {report?.topSkills.map((s, i) => (
                <div key={s.skill} className={styles.skillRow}>
                  <span className={styles.skillRank}>{String(i + 1).padStart(2, '0')}</span>
                  <span className={styles.skillName}>{s.skill}</span>
                  <div className={styles.barWrap}>
                    <div
                      className={styles.bar}
                      style={{ width: `${Math.round((s.count / maxSkill) * 100)}%` }}
                    />
                  </div>
                  <span className={styles.skillCount}>{s.count}</span>
                </div>
              ))}
            </div>
          </section>

          <div className={styles.rightCol}>
            {/* Role Breakdown */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Role Breakdown</h2>
              <div className={styles.rolesList}>
                {report?.roleBreakdown.map((r) => (
                  <div key={r.category} className={styles.roleRow}>
                    <span className={styles.roleName}>{r.category}</span>
                    <div className={styles.barWrap}>
                      <div
                        className={`${styles.bar} ${styles.barAlt}`}
                        style={{ width: `${Math.round((r.count / maxRole) * 100)}%` }}
                      />
                    </div>
                    <span className={styles.roleCount}>{r.count}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Top Companies */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Top Hiring Companies</h2>
              <div className={styles.companyGrid}>
                {report?.topCompanies.map((c) => (
                  <div key={c.company} className={styles.companyChip}>
                    <span className={styles.companyName}>{c.company}</span>
                    <span className={styles.companyCount}>{c.count}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
