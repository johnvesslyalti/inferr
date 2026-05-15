'use client'

import { useEffect, useState } from 'react'
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
            <span className={styles.terminal}>⌘</span>
            <span className={styles.logoText}>ai.devfeed</span>
          </div>
          <div className={styles.navRight}>
            <a href="https://github.com" className={styles.githubLink} target="_blank" rel="noopener noreferrer">
              github
            </a>
            <button className={styles.ctaButton}>
              Get early access →
            </button>
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
              AI Developer Feed scrapes Hacker News and Dev.to every day, summarizes each article in 3 lines using Claude, and surfaces only what's relevant to your stack — automatically.
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
                  <span className={styles.source}>HN · 847 pts</span>
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
                  <span className={styles.relevance}>94% match</span>
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
          <h2 className={`${styles.sectionLabel} reveal`}>The developer content problem</h2>

          <div className={styles.problemGrid}>
            <div className={`${styles.problemCard} reveal`}>
              <div className={styles.problemIcon}>◆</div>
              <h3>The firehose</h3>
              <p>Hacker News, Dev.to, GitHub Trending. Hundreds of posts daily. Impossible to keep up.</p>
            </div>

            <div className={`${styles.problemCard} reveal`}>
              <div className={styles.problemIcon}>◇</div>
              <h3>Irrelevant noise</h3>
              <p>80% of content has nothing to do with your stack. You're reading React posts when you ship NestJS.</p>
            </div>

            <div className={`${styles.problemCard} reveal`}>
              <div className={styles.problemIcon}>■</div>
              <h3>Context switching</h3>
              <p>12 browser tabs open. 0 articles actually finished. Your flow state? Gone.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className={styles.howItWorks}>
        <div className={styles.howContent}>
          <h2 className={`reveal`} style={{ fontSize: '2.5rem', marginBottom: '3rem', fontFamily: 'var(--font-mono)' }}>
            Three steps. Zero effort.
          </h2>

          <div className={styles.stepsGrid}>
            <div className={`${styles.stepCard} reveal`}>
              <div className={styles.stepNumber}>01</div>
              <h3 className={styles.stepTitle}>Scrape</h3>
              <p className={styles.stepDesc}>
                Pulls top posts from Hacker News and Dev.to automatically every 24h via a BullMQ scheduler.
              </p>
            </div>

            <div className={styles.stepConnector}></div>

            <div className={`${styles.stepCard} reveal`}>
              <div className={styles.stepNumber}>02</div>
              <h3 className={styles.stepTitle}>Summarize</h3>
              <p className={styles.stepDesc}>
                Claude Haiku reads each article and writes a 3-line summary. No fluff. Just signal.
              </p>
            </div>

            <div className={styles.stepConnector}></div>

            <div className={`${styles.stepCard} reveal`}>
              <div className={styles.stepNumber}>03</div>
              <h3 className={styles.stepTitle}>Personalize</h3>
              <p className={styles.stepDesc}>
                OpenAI embeddings match articles to your interests. Your feed ranks by relevance, not recency.
              </p>
            </div>
          </div>

          <div className={`${styles.archDiagram} reveal`}>
            <code>BullMQ → Scraper → Summarizer → Embeddings → Feed → Chat</code>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className={styles.featuresSection}>
        <div className={styles.featuresContent}>
          <h2 className={`reveal`} style={{ fontSize: '2.5rem', marginBottom: '3rem', fontFamily: 'var(--font-mono)' }}>
            What you actually get
          </h2>

          <div className={styles.featuresGrid}>
            <div className={`${styles.featureCard} reveal`}>
              <div className={styles.featureIcon}>⚡</div>
              <h3>Daily AI summaries</h3>
              <p>Every article reduced to 3 clear lines. Read 10 articles in 2 minutes.</p>
            </div>

            <div className={`${styles.featureCard} reveal`}>
              <div className={styles.featureIcon}>🎯</div>
              <h3>Interest-matched feed</h3>
              <p>Set your stack once. Get only NestJS, RAG, TypeScript, pgvector content. Not JavaScript framework drama.</p>
            </div>

            <div className={`${styles.featureCard} reveal`}>
              <div className={styles.featureIcon}>💬</div>
              <h3>Chat with your feed</h3>
              <p>Ask "what's new in vector databases this week?" — it queries your stored articles semantically.</p>
            </div>

            <div className={`${styles.featureCard} reveal`}>
              <div className={styles.featureIcon}>🔌</div>
              <h3>API-first, no fluff</h3>
              <p>No frontend UI for MVP. Just a clean REST API. Integrate how you want.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className={styles.techSection}>
        <div className={styles.techContent}>
          <h2 className={styles.techLabel}>Open stack. No magic.</h2>
          <div className={styles.techBadges}>
            {[
              'NestJS',
              'TypeScript',
              'PostgreSQL',
              'pgvector',
              'Redis',
              'BullMQ',
              'Claude Haiku',
              'OpenAI',
              'Railway',
              'Docker'
            ].map(tech => (
              <span key={tech} className={styles.badge}>
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className={styles.pricingSection}>
        <div className={styles.pricingContent}>
          <div className={`${styles.pricingCard} reveal`}>
            <h2 className={styles.pricingTitle}>Transparent cost. No VC burn.</h2>

            <div className={styles.price}>$7–10 / month</div>
            <p className={styles.priceSubtitle}>That's what it actually costs to run.</p>

            <div className={styles.breakdown}>
              <div className={styles.breakdownItem}>
                <span>Claude Haiku</span>
                <span>~$2</span>
              </div>
              <div className={styles.breakdownItem}>
                <span>OpenAI Embeddings</span>
                <span>~$0.015</span>
              </div>
              <div className={styles.breakdownItem}>
                <span>Railway hosting</span>
                <span>~$5</span>
              </div>
            </div>

            <div className={styles.betaBadge}>
              Beta access is free while I'm building this.
            </div>

            <button className={styles.pricingCTA}>
              Get early access →
            </button>
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
          <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
          <span>·</span>
          <a href="https://x.com" target="_blank" rel="noopener noreferrer">X</a>
          <span>·</span>
          <span>Made with NestJS + Claude + pgvector</span>
        </div>
      </footer>
    </div>
  )
}
