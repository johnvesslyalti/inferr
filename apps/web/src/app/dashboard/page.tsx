'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth, useAuthFetch, API_BASE } from '@/src/lib/auth-context';
import { Navbar } from '@/src/components/Navbar';
import { InterestsDialog } from '@/src/components/InterestsDialog';
import styles from './dashboard.module.css';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

const features = [
  {
    label: '01',
    title: 'Curated Daily Feeds',
    desc: 'Top posts from HN & Dev.to scraped every 24h. Ranked by relevance to your stack, not by recency.',
  },
  {
    label: '02',
    title: 'Smart AI Filtering',
    desc: 'text-embedding-3-small turns your interests into vectors. No more React drama if you write Go.',
  },
  {
    label: '03',
    title: 'Semantic Chat',
    desc: 'Ask "what\'s new in vector DBs this week?" — get answers from actual articles, not hallucinations.',
  },
  {
    label: '04',
    title: 'Always Free',
    desc: 'Early supporters keep free access forever. The whole thing costs $7/month to run.',
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const { token, ready } = useAuth();
  const authFetch = useAuthFetch();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInterests, setShowInterests] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!token) { router.push('/'); return; }

    const fetchProfile = async () => {
      try {
        const res = await authFetch(`${API_BASE}/auth/me`);

        if (!res.ok) throw new Error('Failed to fetch profile');
        setUser(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setTimeout(() => router.push('/'), 2000);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [router, token, ready, authFetch]);

  if (loading) {
    return (
      <div className={`${styles.loadingScreen} pageGlow`}>
        <div className={styles.loadingInner}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>Authenticating account...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${styles.loadingScreen} pageGlow`}>
        <div className={styles.errorCard}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.errorIcon}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className={styles.errorTitle}>Access Denied</p>
          <p className={styles.errorMsg}>{error}</p>
          <p className={styles.errorRedirect}>Redirecting to home page...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const initials = user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className={`${styles.container} pageGlow`}>
      {showInterests && (
        <InterestsDialog onClose={() => setShowInterests(false)} />
      )}

      {/* Persistent floating glass navbar */}
      <Navbar onEditInterests={() => setShowInterests(true)} />

      {/* Main */}
      <main className={styles.main}>
        {/* Profile Card Section */}
        <section className={styles.profileSection}>
          <div className={styles.profileCard}>
            <div className={styles.profileBgGlow} />
            <div className={styles.avatarWrapper}>
              {user.avatar ? (
                <Image
                  src={user.avatar}
                  alt={user.name}
                  className={styles.avatarImg}
                  width={56}
                  height={56}
                />
              ) : (
                <span className={styles.avatarInitials}>{initials}</span>
              )}
              <span className={styles.onlineDot} />
            </div>
            <div className={styles.profileInfo}>
              <div className={styles.badgeContainer}>
                <span className={styles.profileBadge}>Early Access Support</span>
              </div>
              <h1 className={styles.profileName}>{user.name}</h1>
              <p className={styles.profileEmail}>{user.email}</p>
            </div>
          </div>
        </section>

        {/* Status log Terminal card */}
        <section className={styles.statusSection}>
          <div className={styles.terminalCard}>
            <div className={styles.terminalHeader}>
              <div className={styles.terminalDots}>
                <div /><div /><div />
              </div>
              <span className={styles.terminalTitle}>status.sh</span>
            </div>
            <div className={styles.terminalBody}>
              <p className={styles.terminalLine}>
                <span className={styles.prompt}>$</span>
                <span className={styles.cmd}>inferr --info --user {user.name.split(' ')[0].toLowerCase()}</span>
              </p>
              <p className={styles.terminalOutput}>
                <span className={styles.outputCheck}>[OK]</span> Account verified successfully · Early access tier
              </p>
              <p className={styles.terminalOutput}>
                <span className={styles.outputCheck}>[OK]</span> Personalized query vector generated
              </p>
              <p className={styles.terminalOutput}>
                <span className={styles.outputCheck}>[OK]</span> Daily indexing queues active
              </p>
              <p className={styles.terminalLine}>
                <span className={styles.prompt}>$</span>
                <span className="cursor" />
              </p>
            </div>
          </div>
        </section>

        {/* Features list */}
        <section className={styles.featuresSection}>
          <p className={styles.sectionLabel}>{`// Features Overview`}</p>
          <div className={styles.featuresGrid}>
            {features.map((f) => (
              <div key={f.label} className={styles.featureCard}>
                <span className={styles.featureLabel}>{f.label}</span>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Follow zavxai on X */}
        <section className={styles.followSection}>
          <p className={styles.followText}>
            Follow the project build →&nbsp;
            <a href="https://x.com/zavxai" target="_blank" rel="noopener noreferrer" className={styles.followLink}>
              @zavxai on X
            </a>
          </p>
        </section>
      </main>

    </div>
  );
}
