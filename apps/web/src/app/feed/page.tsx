'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth, API_BASE } from '@/src/lib/auth-context';
import { apiFetch } from '@/src/lib/server-status';
import { getSessionHint, readFeedCache, writeFeedCache } from '@/src/lib/local-store';
import { InterestsDialog } from '@/src/components/InterestsDialog';
import styles from './feed.module.css';

interface Article {
  title: string;
  summary: string | null;
  url: string;
  source: string;
}

interface FeedResponse {
  hasMatches: boolean;
  articles: Article[];
  fallback: Article[];
}

const SOURCE_LABEL: Record<string, string> = {
  hn: 'Hacker News',
  devto: 'Dev.to',
};

const EMPTY_FEED: FeedResponse = { hasMatches: false, articles: [], fallback: [] };

function normalizeFeedResponse(input: unknown): FeedResponse {
  if (!input || typeof input !== 'object') return EMPTY_FEED;
  // Migrate old Article[] cache written before the FeedResponse shape was introduced
  if (Array.isArray(input)) {
    const articles = input as Article[];
    return { hasMatches: articles.length > 0, articles, fallback: [] };
  }
  const d = input as Record<string, unknown>;
  return {
    hasMatches: Boolean(d.hasMatches),
    articles: Array.isArray(d.articles) ? (d.articles as Article[]) : [],
    fallback: Array.isArray(d.fallback) ? (d.fallback as Article[]) : [],
  };
}

function sameFeed(a: FeedResponse, b: FeedResponse): boolean {
  const aArts = a?.articles ?? [];
  const bArts = b?.articles ?? [];
  const aFall = a?.fallback ?? [];
  const bFall = b?.fallback ?? [];
  if ((a?.hasMatches ?? false) !== (b?.hasMatches ?? false)) return false;
  if (aArts.length !== bArts.length) return false;
  if (aFall.length !== bFall.length) return false;
  return (
    aArts.every((art, i) => art.url === bArts[i]?.url) &&
    aFall.every((art, i) => art.url === bFall[i]?.url)
  );
}

function ArticleCard({ article, dim = false }: { article: Article; dim?: boolean }) {
  return (
    <article className={`${styles.card} ${dim ? styles.cardDim : ''}`}>
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
  );
}

export default function FeedPage() {
  const router = useRouter();
  const { token, ready, signOut: authSignOut } = useAuth();
  const [feed, setFeed] = useState<FeedResponse>(EMPTY_FEED);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInterests, setShowInterests] = useState(false);
  const userIdRef = useRef<string | null>(null);
  const hasCacheRef = useRef(false);

  useEffect(() => {
    const { userId } = getSessionHint();
    userIdRef.current = userId;
    const cached = readFeedCache<unknown>(userId);
    const safe = cached ? normalizeFeedResponse(cached) : null;
    if (safe && (safe.articles.length > 0 || safe.fallback.length > 0)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFeed(safe);
      hasCacheRef.current = true;
      setLoading(false);
    }
  }, []);

  const [refetchKey, setRefetchKey] = useState(0);

  const revalidate = useCallback(async (signal: AbortSignal) => {
    if (!token) return;
    try {
      const res = await apiFetch(`${API_BASE}/feed`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
        signal,
      });

      if (signal.aborted) return;
      if (!res.ok) throw new Error('Failed to load feed');
      const raw = await res.json();
      const fresh = normalizeFeedResponse(raw);
      if (signal.aborted) return;

      setFeed((prev) => (sameFeed(prev, fresh) ? prev : fresh));
      writeFeedCache(userIdRef.current, fresh);
      setError(null);
    } catch (err) {
      if (signal.aborted) return;
      if (!hasCacheRef.current) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      }
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      router.push('/');
      return;
    }

    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    revalidate(controller.signal);
    return () => controller.abort();
  }, [revalidate, router, token, ready, refetchKey]);

  const isEmpty = !loading && !error &&
    (feed?.articles?.length ?? 0) === 0 &&
    (feed?.fallback?.length ?? 0) === 0;

  return (
    <div className={styles.page}>
      {showInterests && (
        <InterestsDialog
          onClose={() => setShowInterests(false)}
          onSaved={() => {
            // Re-fetch the feed after interests are saved.
            // Incrementing refetchKey causes the useEffect to re-run revalidate.
            setLoading(true);
            setFeed(EMPTY_FEED);
            setRefetchKey((k) => k + 1);
          }}
        />
      )}
      <nav className={styles.nav}>
        <div className={styles.logo}>
          <Image src="/logo.png" alt="Logo" width={22} height={22} style={{ borderRadius: '4px' }} />
          <span className={styles.logoText}>inferr</span>
        </div>
        <div className={styles.navRight}>
          <a href="/chat" className={styles.navLink}>chat</a>
          <button onClick={() => setShowInterests(true)} className={styles.navLink}>edit interests</button>
          <button onClick={async () => { await authSignOut(); router.push('/'); }} className={styles.signOut}>sign out</button>
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

        {isEmpty && (
          <div className={styles.empty}>
            <p className={styles.emptyText}>No articles yet — run the scraper first.</p>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setShowInterests(true);
              }}
              className={styles.emptyLink}
            >
              Update your interests →
            </a>
          </div>
        )}

        {/* Matched articles — new + relevant */}
        {!loading && !error && feed?.hasMatches && (
          <div className={styles.list}>
            {(feed?.articles ?? []).map((article, i) => (
              <ArticleCard key={i} article={article} />
            ))}
          </div>
        )}

        {/* Nothing new today — show fallback */}
        {!loading && !error && !feed?.hasMatches && (feed?.fallback?.length ?? 0) > 0 && (
          <>
            <div className={styles.nothingNew}>
              <span className={styles.nothingNewIcon}>○</span>
              <p className={styles.nothingNewText}>Nothing new matching your interests today.</p>
            </div>

            <div className={styles.fallbackSection}>
              <p className={styles.fallbackLabel}>Based on your interests</p>
              <div className={styles.list}>
                {(feed?.fallback ?? []).map((article, i) => (
                  <ArticleCard key={i} article={article} dim />
                ))}
              </div>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setShowInterests(true); }}
                className={styles.emptyLink}
              >Update your interests →</a>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
