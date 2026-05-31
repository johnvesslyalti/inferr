'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/src/lib/auth-context';
import { ProfileMenu } from '@/src/components/ProfileMenu';
import styles from './market.module.css';

const PREVIEW_SKILLS = [
  { skill: 'TypeScript', count: 42 },
  { skill: 'React', count: 38 },
  { skill: 'AWS', count: 31 },
  { skill: 'Python', count: 27 },
  { skill: 'Node.js', count: 24 },
  { skill: 'Docker', count: 19 },
];

const PREVIEW_ROLES = [
  { category: 'Software Development', count: 84 },
  { category: 'DevOps / SRE', count: 31 },
  { category: 'Data / ML', count: 22 },
  { category: 'Design', count: 14 },
];

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

  const maxSkill = PREVIEW_SKILLS[0].count;
  const maxRole = PREVIEW_ROLES[0].count;

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
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <span className={styles.comingSoonBadge}>COMING SOON</span>
          </div>
          <h1 className={styles.title}>Tech Market</h1>
          <p className={styles.subtitle}>
            Daily snapshot of what the industry is hiring for — trending skills, hot roles, and top companies from live job data.
          </p>
        </div>

        {/* Preview blurred out */}
        <div className={styles.previewWrap}>
          <div className={styles.previewOverlay}>
            <div className={styles.overlayInner}>
              <div className={styles.overlayIcon}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              </div>
              <p className={styles.overlayTitle}>Market data is being wired up</p>
              <p className={styles.overlayDesc}>Live job trends from Remotive — refreshed daily. Check back soon.</p>
            </div>
          </div>

          <div className={styles.previewBlur}>
            {/* Skills preview */}
            <div className={styles.card}>
              <p className={styles.cardTitle}>Top Skills in Demand</p>
              <div className={styles.skillsList}>
                {PREVIEW_SKILLS.map((s, i) => (
                  <div key={s.skill} className={styles.skillRow}>
                    <span className={styles.skillRank}>{String(i + 1).padStart(2, '0')}</span>
                    <span className={styles.skillName}>{s.skill}</span>
                    <div className={styles.barWrap}>
                      <div className={styles.bar} style={{ width: `${Math.round((s.count / maxSkill) * 100)}%` }} />
                    </div>
                    <span className={styles.skillCount}>{s.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Roles preview */}
            <div className={styles.card}>
              <p className={styles.cardTitle}>Role Breakdown</p>
              <div className={styles.rolesList}>
                {PREVIEW_ROLES.map((r) => (
                  <div key={r.category} className={styles.roleRow}>
                    <span className={styles.roleName}>{r.category}</span>
                    <div className={styles.barWrap}>
                      <div className={`${styles.bar} ${styles.barAlt}`} style={{ width: `${Math.round((r.count / maxRole) * 100)}%` }} />
                    </div>
                    <span className={styles.roleCount}>{r.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
