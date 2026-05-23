'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/src/lib/auth-context';
import styles from './feed.module.css';

interface Article {
  title: string;
  summary: string | null;
  url: string;
  source: string;
}

const SOURCE_LABEL: Record<string, string> = {
  hn: 'Hacker News',
  devto: 'Dev.to',
};

export default function FeedPage() {
  const router = useRouter();
  const { token, ready, signOut: authSignOut } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!token) { router.push('/'); return; }

    const fetchFeed = async () => {
      try {
        const api = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/+$/, '');
        const res = await fetch(`${api}/feed`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        });

        if (!res.ok) throw new Error('Failed to load feed');
        setArticles(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setLoading(false);
      }
    };

    fetchFeed();
  }, [router, token, ready]);

  const signOut = async () => {
    await authSignOut();
    router.push('/');
  };

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.logo}>
          <Image src="/logo.png" alt="Logo" width={22} height={22} style={{ borderRadius: '4px' }} />
          <span className={styles.logoText}>inferr</span>
        </div>
        <div className={styles.navRight}>
          <a href="/chat" className={styles.navLink}>chat</a>
          <a href="/onboarding" className={styles.navLink}>edit interests</a>
          <button onClick={signOut} className={styles.signOut}>sign out</button>
        </div>
      </nav>

      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>Your Feed</h1>
          <p className={styles.subtitle}>Ranked by relevance to your stack</p>
        </div>

        {loading && (
          <div className={styles.center}>
            <div className={styles.spinner} />
            <p className={styles.loadingText}>Building your feed…</p>
          </div>
        )}

        {error && !loading && (
          <div className={styles.errorCard}>
            <p className={styles.errorText}>{error}</p>
            <button onClick={() => window.location.reload()} className={styles.retryBtn}>Retry</button>
          </div>
        )}

        {!loading && !error && articles.length === 0 && (
          <div className={styles.empty}>
            <p className={styles.emptyText}>No articles yet — run the scraper first.</p>
            <a href="/onboarding" className={styles.emptyLink}>Update your interests →</a>
          </div>
        )}

        {!loading && !error && articles.length > 0 && (
          <div className={styles.list}>
            {articles.map((article, i) => (
              <article key={i} className={styles.card}>
                <div className={styles.cardTop}>
                  <span className={`${styles.badge} ${styles[`badge_${article.source}`]}`}>
                    {SOURCE_LABEL[article.source] ?? article.source}
                  </span>
                </div>
                <a href={article.url} target="_blank" rel="noopener noreferrer" className={styles.cardTitle}>
                  {article.title}
                </a>
                {article.summary && (
                  <p className={styles.cardSummary}>{article.summary}</p>
                )}
                <a href={article.url} target="_blank" rel="noopener noreferrer" className={styles.readMore}>
                  Read article →
                </a>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
