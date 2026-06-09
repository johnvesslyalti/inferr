'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useAuthFetch, API_BASE, SessionExpiredError } from '@/src/lib/auth-context';
import { InterestsDialog } from '@/src/components/InterestsDialog';
import { Navbar } from '@/src/components/Navbar';
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

interface TopSkill {
  skill: string;
  count: number;
}

interface RoleCategory {
  category: string;
  count: number;
}

interface TopCompany {
  company: string;
  count: number;
}

interface JobReport {
  totalListings: number;
  topSkills: TopSkill[];
  roleBreakdown: RoleCategory[];
  topCompanies: TopCompany[];
  generatedAt: string;
}

function DemandDots({ level }: { level: number }) {
  return (
    <div className={styles.dots} aria-label={`Demand level ${level} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={i < level ? styles.dotFilled : styles.dotEmpty}
        />
      ))}
    </div>
  );
}

export default function TechMarketPage() {
  const router = useRouter();
  const { token, ready } = useAuth();
  const authFetch = useAuthFetch();
  const [marketReport, setMarketReport] = useState<MarketReport | null>(null);
  const [jobReport, setJobReport] = useState<JobReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInterests, setShowInterests] = useState(false);
  const [activeTab, setActiveTab] = useState<'skills' | 'companies' | 'categories'>('skills');

  useEffect(() => {
    if (!ready) return;
    if (!token) { router.push('/'); return; }

    const controller = new AbortController();

    const fetchData = async () => {
      try {
        const [marketRes, reportRes] = await Promise.all([
          authFetch(`${API_BASE}/jobs/market`, { signal: controller.signal }),
          authFetch(`${API_BASE}/jobs/report`, { signal: controller.signal }),
        ]);

        if (!marketRes.ok || !reportRes.ok) {
          throw new Error('Failed to load market statistics');
        }

        const marketData = await marketRes.json() as MarketReport;
        const reportData = await reportRes.json() as JobReport;

        setMarketReport(marketData);
        setJobReport(reportData);
      } catch (err) {
        if (err instanceof SessionExpiredError) return;
        if ((err as { name?: string }).name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    return () => controller.abort();
  }, [ready, token, router, authFetch]);

  if (!ready || !token || loading) {
    return (
      <div className={`${styles.page} pageGlow`}>
        <Navbar onEditInterests={() => setShowInterests(true)} />
        <main className={styles.main}>
          <div className={styles.header}>
            <div className={styles.skeletonPulse} style={{ width: '120px', height: '18px', marginBottom: '10px', borderRadius: '4px' }} />
            <div className={styles.skeletonPulse} style={{ width: '250px', height: '36px', marginBottom: '10px', borderRadius: '6px' }} />
            <div className={styles.skeletonPulse} style={{ width: '380px', height: '16px', borderRadius: '4px' }} />
          </div>

          {/* Skeleton Grid */}
          <div className={styles.statsRow}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={styles.skeletonStatsCard} />
            ))}
          </div>

          <div className={styles.dashboardGrid}>
            <div className={styles.skeletonColumn}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={styles.skeletonRoleCard} />
              ))}
            </div>
            <div className={styles.skeletonColumn}>
              <div className={styles.skeletonWidgetCard} />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${styles.page} pageGlow`}>
        <Navbar onEditInterests={() => setShowInterests(true)} />
        <div className={styles.errorScreen}>
          <div className={styles.errorCard}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.errorIcon}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className={styles.errorText}>{error}</p>
            <button onClick={() => window.location.reload()} className={styles.retryBtn}>Retry</button>
          </div>
        </div>
      </div>
    );
  }

  const updatedAt = marketReport
    ? new Date(marketReport.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '—';

  // Stats derived from jobReport
  const totalListings = jobReport?.totalListings ?? 0;
  
  // Format tags correctly for display
  const formatTagName = (tag: string) => {
    if (tag.toLowerCase() === 'javascript') return 'JavaScript';
    if (tag.toLowerCase() === 'typescript') return 'TypeScript';
    if (tag.toLowerCase() === 'react') return 'React';
    if (tag.toLowerCase() === 'aws') return 'AWS';
    if (tag.toLowerCase() === 'node') return 'Node.js';
    if (tag.toLowerCase() === 'python') return 'Python';
    if (tag.toLowerCase() === 'go') return 'Go';
    if (tag.toLowerCase() === 'rust') return 'Rust';
    return tag.charAt(0).toUpperCase() + tag.slice(1);
  };

  const topSkill = jobReport?.topSkills?.[0] 
    ? formatTagName(jobReport.topSkills[0].skill) 
    : '—';
    
  const topCompany = jobReport?.topCompanies?.[0]
    ? jobReport.topCompanies[0].company
    : '—';

  const maxSkillCount = jobReport?.topSkills?.[0]?.count ?? 1;

  return (
    <div className={`${styles.page} pageGlow`}>
      {showInterests && (
        <InterestsDialog onClose={() => setShowInterests(false)} />
      )}

      {/* Persistent floating glass navbar */}
      <Navbar onEditInterests={() => setShowInterests(true)} />

      <main className={styles.main}>
        <div className={styles.header}>
          <div className={styles.headerGlow} />
          <div className={styles.headerTop}>
            <span className={styles.liveDot} />
            <span className={styles.label}>AI-analysed · Updated {updatedAt}</span>
          </div>
          <h1 className={styles.title}>Tech Market</h1>
          <p className={styles.subtitle}>Insights and trending tech domains aggregated from real-time software postings</p>
        </div>

        {/* Stats summary section */}
        <section className={styles.statsRow}>
          <div className={styles.statsCard}>
            <span className={styles.statsLabel}>Scraped Volume</span>
            <div className={styles.statsValueContainer}>
              <span className={styles.statsValue}>{totalListings}</span>
              <span className={styles.statsTrend}>Listings</span>
            </div>
            <span className={styles.statsDesc}>Software jobs analyzed (30d)</span>
          </div>
          <div className={styles.statsCard}>
            <span className={styles.statsLabel}>Hottest Skill</span>
            <div className={styles.statsValueContainer}>
              <span className={styles.statsValue}>{topSkill}</span>
            </div>
            <span className={styles.statsDesc}>Most frequent keyword tag</span>
          </div>
          <div className={styles.statsCard}>
            <span className={styles.statsLabel}>Hiring Leader</span>
            <div className={styles.statsValueContainer}>
              <span className={styles.statsValue} title={topCompany}>{topCompany}</span>
            </div>
            <span className={styles.statsDesc}>Company with highest postings</span>
          </div>
        </section>

        {/* Interactive Dashboard grid layout */}
        <div className={styles.dashboardGrid}>
          {/* Left Column: Trending Domains */}
          <section className={styles.leftCol}>
            <h2 className={styles.sectionTitle}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={styles.secIcon}>
                <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
              Trending Domains
            </h2>
            <div className={styles.roleList}>
              {marketReport?.roles.map((r, i) => (
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
          </section>

          {/* Right Column: Interactive secondary widgets */}
          <section className={styles.rightCol}>
            <div className={styles.widgetCard}>
              <div className={styles.widgetTabs}>
                <button
                  onClick={() => setActiveTab('skills')}
                  className={`${styles.tabBtn} ${activeTab === 'skills' ? styles.tabActive : ''}`}
                >
                  Top Skills
                </button>
                <button
                  onClick={() => setActiveTab('companies')}
                  className={`${styles.tabBtn} ${activeTab === 'companies' ? styles.tabActive : ''}`}
                >
                  Top Companies
                </button>
                <button
                  onClick={() => setActiveTab('categories')}
                  className={`${styles.tabBtn} ${activeTab === 'categories' ? styles.tabActive : ''}`}
                >
                  Categories
                </button>
              </div>

              <div className={styles.tabContent}>
                {/* Tab: Skills */}
                {activeTab === 'skills' && (
                  <div className={styles.skillsList}>
                    {jobReport?.topSkills.slice(0, 8).map((s, idx) => (
                      <div key={s.skill} className={styles.skillRow}>
                        <span className={styles.skillRank}>{String(idx + 1).padStart(2, '0')}</span>
                        <span className={styles.skillName}>{formatTagName(s.skill)}</span>
                        <div className={styles.barWrap}>
                          <div
                            className={styles.bar}
                            style={{ width: `${Math.max(5, Math.round((s.count / maxSkillCount) * 100))}%` }}
                          />
                        </div>
                        <span className={styles.skillCount}>{s.count}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab: Companies */}
                {activeTab === 'companies' && (
                  <div className={styles.companiesList}>
                    {jobReport?.topCompanies.slice(0, 8).map((c, idx) => (
                      <div key={c.company} className={styles.companyRow}>
                        <span className={styles.companyRank}>{String(idx + 1).padStart(2, '0')}</span>
                        <span className={styles.companyName} title={c.company}>{c.company}</span>
                        <span className={styles.companyCountBadge}>{c.count} {c.count === 1 ? 'job' : 'jobs'}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab: Categories */}
                {activeTab === 'categories' && (
                  <div className={styles.categoriesList}>
                    {jobReport?.roleBreakdown.map((cat, idx) => (
                      <div key={cat.category} className={styles.categoryRow}>
                        <span className={styles.categoryRank}>{String(idx + 1).padStart(2, '0')}</span>
                        <span className={styles.categoryName}>{cat.category}</span>
                        <div className={styles.categoryCountBadge}>{cat.count}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
