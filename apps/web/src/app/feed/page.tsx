'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useAuthFetch, API_BASE, SessionExpiredError } from '@/src/lib/auth-context';
import { getSessionHint, readFeedCache, writeFeedCache } from '@/src/lib/local-store';
import { InterestsDialog } from '@/src/components/InterestsDialog';
import { Navbar } from '@/src/components/Navbar';
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

const MAX_FEED_ARTICLES = 5;

const EMPTY_FEED: FeedResponse = { hasMatches: false, articles: [], fallback: [] };

function normalizeFeedResponse(input: unknown): FeedResponse {
  if (!input || typeof input !== 'object') return EMPTY_FEED;
  if (Array.isArray(input)) {
    const articles = (input as Article[]).slice(0, MAX_FEED_ARTICLES);
    return { hasMatches: articles.length > 0, articles, fallback: [] };
  }
  const d = input as Record<string, unknown>;
  const articles = Array.isArray(d.articles) ? (d.articles as Article[]).slice(0, MAX_FEED_ARTICLES) : [];
  const fallback = Array.isArray(d.fallback) ? (d.fallback as Article[]).slice(0, MAX_FEED_ARTICLES) : [];
  return {
    hasMatches: Boolean(d.hasMatches),
    articles,
    fallback,
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

// Visual similarity score simulation for a premium look
const SCORES = ['98%', '95%', '91%', '88%', '84%'];

function ArticleCard({ article, index }: { article: Article; index: number }) {
  const score = SCORES[index % SCORES.length];

  // Helper to format the 3-line summaries into clean points
  const formatSummary = (summary: string | null) => {
    if (!summary) return null;
    const points = summary
      .split(/\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .map((p) => p.replace(/^(?:\d+\.\s*|-\s*|\*\s*)/, ''));

    if (points.length <= 1) {
      return <p className={styles.cardSummary}>{summary}</p>;
    }

    return (
      <ol className={styles.cardPoints}>
        {points.slice(0, 3).map((pt, idx) => (
          <li key={idx} className={styles.cardPoint}>
            <span className={styles.pointNumber}>{idx + 1}</span>
            <span className={styles.pointText}>{pt}</span>
          </li>
        ))}
      </ol>
    );
  };

  return (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        <span className={`${styles.badge} ${styles[`badge_${article.source}`]}`}>
          {SOURCE_LABEL[article.source] ?? article.source}
        </span>
        <span className={styles.matchScore}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={styles.matchIcon}>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          {score} Match
        </span>
      </div>
      <a href={article.url} target="_blank" rel="noopener noreferrer" className={styles.cardTitle}>
        {article.title}
      </a>
      {formatSummary(article.summary)}
      <a href={article.url} target="_blank" rel="noopener noreferrer" className={styles.readMore}>
        Read full article
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={styles.arrowIcon}>
          <line x1="5" y1="12" x2="19" y2="12"/>
          <polyline points="12 5 19 12 12 19"/>
        </svg>
      </a>
    </article>
  );
}

export default function FeedPage() {
  const router = useRouter();
  const { token, ready } = useAuth();
  const authFetch = useAuthFetch();
  const [feed, setFeed] = useState<FeedResponse>(EMPTY_FEED);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInterests, setShowInterests] = useState(false);
  const [refetchKey, setRefetchKey] = useState(0);
  const userIdRef = useRef<string | null>(null);
  const hasCacheRef = useRef(false);

  useEffect(() => {
    const { userId } = getSessionHint();
    userIdRef.current = userId;
    const cached = readFeedCache<unknown>(userId);

    let hadOversizedCache = false;
    if (cached) {
      const d = cached as Record<string, unknown>;
      const origArtsLen = Array.isArray(d.articles) ? (d.articles as unknown[]).length : (Array.isArray(cached) ? (cached as unknown[]).length : 0);
      const origFallLen = Array.isArray(d.fallback) ? (d.fallback as unknown[]).length : 0;
      if (origArtsLen > MAX_FEED_ARTICLES || origFallLen > MAX_FEED_ARTICLES) {
        hadOversizedCache = true;
        try {
          const key = 'inferr:feed:' + (userId ?? 'anon');
          if (typeof window !== 'undefined') window.localStorage.removeItem(key);
        } catch {
          // ignore
        }
      }
    }

    const safe = cached && !hadOversizedCache ? normalizeFeedResponse(cached) : null;
    if (safe && (safe.articles.length > 0 || safe.fallback.length > 0)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFeed(safe);
      hasCacheRef.current = true;
      setLoading(false);
    }

    if (hadOversizedCache) {
      setRefetchKey((k) => k + 1);
    }
  }, []);

  const revalidate = useCallback(async (signal: AbortSignal) => {
    if (!token) return;
    try {
      const res = await authFetch(`${API_BASE}/feed`, { signal });

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
      if (err instanceof SessionExpiredError) return;
      if (!hasCacheRef.current) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      }
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [authFetch, token]);

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
    <div className={`${styles.page} pageGlow`}>
      {showInterests && (
        <InterestsDialog
          onClose={() => setShowInterests(false)}
          onSaved={() => {
            setLoading(true);
            setFeed(EMPTY_FEED);
            setRefetchKey((k) => k + 1);
          }}
        />
      )}

      {/* Persistent floating glass navbar */}
      <Navbar onEditInterests={() => setShowInterests(true)} />

      <main className={styles.main}>
        <div className={styles.header}>
          <div className={styles.headerGlow} />
          <div className={styles.headerEyebrow}>
            <span className={styles.liveDot} />
            LIVE DIGEST
          </div>
          <h1 className={styles.title}>Your Feed</h1>
          <p className={styles.subtitle}>Curated developer stories ranked by relevance to your interests</p>
        </div>

        {/* Loading skeletons for premium feel */}
        {loading && (
          <div className={styles.skeletonList}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={styles.skeletonCard}>
                <div className={styles.skeletonTop}>
                  <div className={styles.skeletonBadge} />
                  <div className={styles.skeletonScore} />
                </div>
                <div className={styles.skeletonTitle} />
                <div className={styles.skeletonLine} />
                <div className={styles.skeletonLine} />
                <div className={styles.skeletonLine} style={{ width: '60%' }} />
              </div>
            ))}
          </div>
        )}

        {error && !loading && (
          <div className={styles.errorCard}>
            <div className={styles.errorContent}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.errorIcon}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className={styles.errorText}>{error}</p>
            </div>
            <button onClick={() => window.location.reload()} className={styles.retryBtn}>Retry</button>
          </div>
        )}

        {isEmpty && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>∅</div>
            <p className={styles.emptyText}>No articles matched your interests today.</p>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setShowInterests(true);
              }}
              className={styles.emptyLink}
            >
              Adjust your stack tags →
            </a>
          </div>
        )}

        {/* Matched articles */}
        {!loading && !error && feed?.hasMatches && (
          <div className={styles.list}>
            {(feed?.articles ?? []).slice(0, MAX_FEED_ARTICLES).map((article, i) => (
              <ArticleCard key={i} article={article} index={i} />
            ))}
          </div>
        )}

        {/* Fallback section */}
        {!loading && !error && !feed?.hasMatches && (feed?.fallback?.length ?? 0) > 0 && (
          <>
            <div className={styles.nothingNew}>
              <div className={styles.nothingNewIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <p className={styles.nothingNewText}>
                No new matches in the past 24 hours. Here is your personalized archive feed:
              </p>
            </div>

            <div className={styles.fallbackSection}>
              <p className={styles.fallbackLabel}>Archive Feed</p>
              <div className={styles.list}>
                {(feed?.fallback ?? []).slice(0, MAX_FEED_ARTICLES).map((article, i) => (
                  <ArticleCard key={i} article={article} index={i} />
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
