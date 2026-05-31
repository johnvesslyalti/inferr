'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth, API_BASE } from '@/src/lib/auth-context';
import { apiFetch } from '@/src/lib/server-status';
import { getSessionHint, readFeedCache, writeFeedCache } from '@/src/lib/local-store';
import { ProfileMenu } from '@/src/components/ProfileMenu';
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

// Two feeds are equal when they list the same articles in the same order —
// lets us skip a repaint when the background revalidation finds nothing new.
function sameFeed(a: Article[], b: Article[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((article, i) => article.url === b[i].url);
}

export default function FeedPage() {
  const router = useRouter();
  const { token, ready } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const hasCacheRef = useRef(false);

  // Hydrate from the last-seen feed instantly (no network) so a returning user
  // sees content immediately, even while the Render instance is still waking.
  useEffect(() => {
    const { userId } = getSessionHint();
    userIdRef.current = userId;
    const cached = readFeedCache<Article[]>(userId);
    if (cached && cached.length > 0) {
      // One-time hydration from the local cache before any network call.
      /* eslint-disable react-hooks/set-state-in-effect */
      setArticles(cached);
      hasCacheRef.current = true;
      setLoading(false);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, []);

  // Revalidate in the background once auth resolves (stale-while-revalidate):
  // fetch fresh data, repaint only if it changed, and persist for next visit.
  useEffect(() => {
    if (!ready) return;
    if (!token) { router.push('/'); return; }

    let cancelled = false;
    const revalidate = async () => {
      try {
        const res = await apiFetch(`${API_BASE}/feed`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        });

        if (!res.ok) throw new Error('Failed to load feed');
        const fresh = (await res.json()) as Article[];
        if (cancelled) return;

        setArticles((prev) => (sameFeed(prev, fresh) ? prev : fresh));
        writeFeedCache(userIdRef.current, fresh);
        setError(null);
      } catch (err) {
        // Only surface an error if we have nothing cached to fall back on.
        if (!cancelled && !hasCacheRef.current) {
          setError(err instanceof Error ? err.message : 'Something went wrong');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    revalidate();
    return () => { cancelled = true; };
  }, [router, token, ready]);

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
