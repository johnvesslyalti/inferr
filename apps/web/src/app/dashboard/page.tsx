'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/src/lib/auth-context';
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
  const { token, ready, signOut } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!token) { router.push('/'); return; }

    const fetchProfile = async () => {
      try {
        const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/+$/, '');
        const res = await fetch(`${apiUrl}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        });

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
  }, [router, token, ready]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingInner}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>authenticating</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.errorCard}>
          <p className={styles.errorTitle}>access denied</p>
          <p className={styles.errorMsg}>{error}</p>
          <p className={styles.errorRedirect}>redirecting...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const initials = user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className={styles.container}>
      {/* Navbar */}
      <nav className={styles.navbar}>
        <div className={styles.navContent}>
          <div className={styles.logo}>
            <Image src="/logo.png" alt="Logo" width={24} height={24} style={{ borderRadius: '4px' }} />
            <span className={styles.logoText}>inferr</span>
          </div>
          <button onClick={handleSignOut} className={styles.signOutBtn}>
            sign out →
          </button>
        </div>
      </nav>

      {/* Main */}
      <main className={styles.main}>

        {/* Profile block */}
        <section className={styles.profileSection}>
          <div className={styles.profileCard}>
            <div className={styles.avatar}>
              {user.avatar ? (
                <Image src={user.avatar} alt={user.name} className={styles.avatarImg} width={40} height={40} />
              ) : (
                <span className={styles.avatarInitials}>{initials}</span>
              )}
              <span className={styles.onlineDot} />
            </div>
            <div className={styles.profileInfo}>
              <div className={styles.profileBadge}>early access</div>
              <h1 className={styles.profileName}>{user.name}</h1>
              <p className={styles.profileEmail}>{user.email}</p>
            </div>
          </div>
        </section>

        {/* Status block */}
        <section className={styles.statusSection}>
          <div className={styles.terminalCard}>
            <div className={styles.terminalHeader}>
              <div className={styles.terminalDots}>
                <div /><div /><div />
              </div>
              <span className={styles.terminalTitle}>status.log</span>
            </div>
            <div className={styles.terminalBody}>
              <p className={styles.terminalLine}>
                <span className={styles.prompt}>$</span>
                <span className={styles.cmd}>status --user {user.name.split(' ')[0].toLowerCase()}</span>
              </p>
              <p className={styles.terminalOutput}>
                ✓ &nbsp;account confirmed · early access granted
              </p>
              <p className={styles.terminalOutput}>
                ✓ &nbsp;workspace queued · building your feed now
              </p>
              <p className={styles.terminalOutput}>
                ✓ &nbsp;you&apos;ll be notified when it&apos;s ready
              </p>
              <p className={styles.terminalCursor}>
                <span className={styles.prompt}>$</span>
                <span className="cursor" />
              </p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className={styles.featuresSection}>
          <p className={styles.sectionLabel}>{`// what's coming`}</p>
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

        {/* Follow */}
        <section className={styles.followSection}>
          <p className={styles.followText}>
            follow the build →&nbsp;
            <a href="https://x.com" target="_blank" rel="noopener noreferrer">@zavxai on X</a>
          </p>
        </section>

      </main>

      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          built by @zavxai · one engineer · $7/month ·{' '}
          <a href="https://github.com" target="_blank" rel="noopener noreferrer">github</a>
        </div>
      </footer>
    </div>
  );
}
