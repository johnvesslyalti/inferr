'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import styles from './page.module.css'

export default function Home() {
  const [email, setEmail] = useState('')
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }

    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -100px 0px'
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible')
        }
      })
    }, observerOptions)

    document.querySelectorAll('.reveal').forEach(el => {
      observer.observe(el)
    })

    window.addEventListener('scroll', handleScroll)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      observer.disconnect()
    }
  }, [])

  const handleSubscribe = (e: { preventDefault: () => void }) => {
    e.preventDefault()
    console.log('Subscribe:', email)
    setEmail('')
  }

  return (
    <div className={styles.container}>
      {/* Navbar */}
      <nav className={`${styles.navbar} ${scrolled ? styles.scrolled : ''}`}>
        <div className={styles.navContent}>
          <div className={styles.logo}>
            <Image src="/logo.png" alt="Logo" width={28} height={28} style={{ marginRight: '10px', borderRadius: '4px' }} />
            <span className={styles.logoText}>ai.devfeed</span>
          </div>
          <div className={styles.navRight}>
            <a href="https://github.com" className={styles.githubLink} target="_blank" rel="noopener noreferrer">
              github
            </a>
            <a href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/auth/google`} className={styles.ctaButton} style={{ textDecoration: 'none' }}>
              Sign in →
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className="noise-overlay"></div>
        <div className={styles.heroContent}>
          <div className={styles.heroLeft}>
            <div className={`${styles.eyebrow} reveal`}>
              now in beta · built in public
            </div>

            <h1 className={`${styles.headline} reveal`}>
              Your AI that reads the internet.
              <br />
              You just read what matters.
            </h1>

            <p className={`${styles.subheadline} reveal`}>
              AI Developer Feed scrapes Hacker News and Dev.to every day, summarizes each article in 3 lines using gpt-4o-mini, and surfaces only what's relevant to your stack — automatically.
            </p>

            <form onSubmit={handleSubscribe} className={`${styles.signupForm} reveal`}>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={styles.emailInput}
              />
              <button type="submit" className={styles.submitButton}>
                Join the waitlist →
              </button>
            </form>
            <p className={styles.disclaimer}>No spam. No paywall during beta.</p>
          </div>

          <div className={`${styles.heroRight} reveal`}>
            <div className={styles.terminalCard}>
              <div className={styles.terminalHeader}>
                <div className={styles.terminalDots}>
                  <div></div>
                  <div></div>
                  <div></div>
                </div>
              </div>
              <div className={styles.terminalBody}>
                <div className={styles.terminalMeta}>
                  <span className={styles.source}>HN · 847 pts · 94% match</span>
                </div>
                <div className={styles.terminalTitle}>
                  Building RAG systems with pgvector and LLMs
                </div>
                <div className={styles.terminalSummary}>
                  <p>PostgreSQL's pgvector extension enables semantic search through embeddings.</p>
                  <p>Combine with Claude for retrieval-augmented generation in production.</p>
                  <p>Real-world example: 50K docs, {'<'}1s queries, {`$${0.02}`} cost per summary.</p>
                </div>
                <div className={styles.terminalFooter}>
                  <span className={styles.tags}>NestJS · RAG · PostgreSQL</span>
                </div>
              </div>
              <div className={styles.cursor}></div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className={styles.problemSection}>
        <div className={styles.problemContent}>
          <h2 className={`${styles.sectionLabel} reveal`} style={{ fontSize: '2.5rem', marginBottom: '3rem' }}>Here's the actual problem.</h2>

          <div className={`reveal`} style={{ maxWidth: '800px', lineHeight: '1.8', fontSize: '1.1rem' }}>
            <p>
              Hacker News posts 300+ stories a day. Dev.to adds hundreds more.
              80% of it has nothing to do with your stack.
              You open 12 tabs, read 0 articles, and lose 45 minutes anyway.
            </p>
            <p style={{ marginTop: '1.5rem' }}>
              I was doing this every morning. I stopped.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className={styles.howItWorks}>
        <div className={styles.howContent}>
          <h2 className={`reveal`} style={{ fontSize: '2.5rem', marginBottom: '3rem' }}>
            Here's exactly what happens under the hood.
          </h2>

          <div className={`reveal`} style={{ maxWidth: '900px', lineHeight: '1.8', fontSize: '1.1rem', marginBottom: '3rem' }}>
            <p>
              A BullMQ job runs every 24h and scrapes the top posts from
              Hacker News and Dev.to. Each article gets sent to gpt-4o-mini
              for a 3-line summary — no fluff, just the point. Then
              text-embedding-3-small turns your interests into vectors and
              ranks the feed by relevance, not recency.
            </p>
            <p style={{ marginTop: '1.5rem' }}>
              That's it. No magic.
            </p>
          </div>

          <div className={`${styles.archDiagram} reveal`}>
            <code>BullMQ → Scraper → gpt-4o-mini → Embeddings → Ranked Feed → Chat</code>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className={styles.featuresSection}>
        <div className={styles.featuresContent}>
          <h2 className={`reveal`} style={{ fontSize: '2.5rem', marginBottom: '3rem' }}>
            What's actually working right now
          </h2>

          <div className={`reveal`} style={{ maxWidth: '900px', lineHeight: '1.8', fontSize: '1.1rem', marginBottom: '3rem' }}>
            <p><strong>What's live:</strong></p>
            <p style={{ marginTop: '1rem' }}>
              ✅  Daily scraper — HN + Dev.to, every 24h<br/>
              ✅  3-line AI summaries — gpt-4o-mini, ~$0.002 per 100 articles<br/>
              ✅  Interest-matched feed — set your stack once, stop seeing React drama<br/>
              ✅  Semantic chat — "what's new in vector databases this week?"<br/>
              🔧  Web UI — API-first for now, frontend coming
            </p>
          </div>

          <p style={{ maxWidth: '900px', lineHeight: '1.8', fontSize: '1.1rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
            API-first MVP. No dashboard yet. Just clean endpoints.
          </p>
        </div>
      </section>

      {/* Tech Stack */}
      <section className={styles.techSection}>
        <div className={styles.techContent}>
          <h2 className={`reveal`} style={{ fontSize: '2.5rem', marginBottom: '2rem' }}>Open stack</h2>
          <div className={`reveal`} style={{ maxWidth: '900px', lineHeight: '1.8', fontSize: '1.1rem' }}>
            <p>
              Built with:<br/>
              NestJS · TypeScript · PostgreSQL · pgvector · Redis · BullMQ<br/>
              gpt-4o-mini · text-embedding-3-small · Railway · Docker
            </p>
            <p style={{ marginTop: '1.5rem' }}>
              One repo. No microservice overengineering.<br/>
              The whole thing costs $7–10/month to run.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className={styles.pricingSection}>
        <div className={styles.pricingContent}>
          <div className={`${styles.pricingCard} reveal`}>
            <h2 className={styles.pricingTitle}>Cost breakdown</h2>
            <p style={{ fontSize: '1.1rem', marginBottom: '2rem', color: 'var(--text-secondary)' }}>What it actually costs me to run this.</p>

            <div className={styles.breakdown}>
              <div className={styles.breakdownItem}>
                <span>gpt-4o-mini</span>
                <span>~$2</span>
              </div>
              <div className={styles.breakdownItem}>
                <span>text-embedding-3-small</span>
                <span>~$0.015</span>
              </div>
              <div className={styles.breakdownItem}>
                <span>Railway (hosting)</span>
                <span>~$5</span>
              </div>
            </div>

            <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--border-color)' }}>
              <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
                <strong>Total: ~$7/month</strong>. I picked these models because they're
                cheap enough that the AI bill rounds to noise.
              </p>
              <p style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>
                Beta access is free while I'm building this.
              </p>
            </div>

            <button className={styles.pricingCTA} style={{ marginTop: '2rem' }}>
              DM me on X →
            </button>
          </div>
        </div>
      </section>

      {/* Build Log */}
      <section className={styles.buildLogSection} style={{ padding: '5rem 2rem', textAlign: 'center' }}>
        <div className={styles.buildLogContent} style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 className={`reveal`} style={{ fontSize: '2.5rem', marginBottom: '3rem' }}>
            Build log
          </h2>

          <div className={`reveal`} style={{ textAlign: 'left', lineHeight: '2' }}>
            <p><strong>What's shipped recently.</strong></p>
            <p style={{ marginTop: '1.5rem', fontSize: '1.05rem' }}>
              May 12 — Semantic chat endpoint live<br/>
              May 8  — Fixed BullMQ memory leak (was rough)<br/>
              May 3  — Scraper + summarizer went live<br/>
              Apr 28 — Started building this because I was tired of HN
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className={styles.finalCTA}>
        <div className={styles.finalContent}>
          <h2 className={`${styles.finalHeadline} reveal`}>
            Built by one engineer. Costs $7 to run. Might save you hours.
          </h2>

          <p className={`${styles.finalSubtext} reveal`}>
            Follow the build → <a href="https://x.com" target="_blank" rel="noopener noreferrer">@zavxai on X</a>
          </p>

          <form onSubmit={handleSubscribe} className={`${styles.finalForm} reveal`}>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={styles.emailInput}
            />
            <button type="submit" className={styles.submitButton}>
              Join →
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <p style={{ margin: '0' }}>
            Built by @zavxai · one engineer · one repo · $7/month<br/>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a> · <a href="https://x.com" target="_blank" rel="noopener noreferrer">X</a> · Made with NestJS + gpt-4o-mini + pgvector
          </p>
        </div>
      </footer>
    </div>
  )
}
