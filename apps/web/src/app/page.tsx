'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import styles from './page.module.css'

const GITHUB_URL = 'https://github.com/johnvesslyalti/ai-developer-feed'
const X_URL = 'https://x.com/zavxai'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

const features = [
  {
    title: 'Daily digest',
    desc: 'HN + Dev.to scraped every 24h. Top posts surface automatically — no manual browsing.',
  },
  {
    title: '3-line AI summaries',
    desc: 'gpt-4o-mini distills each article to three lines. No fluff, just the point.',
  },
  {
    title: 'Interest-ranked feed',
    desc: 'Set your stack once. Embeddings rank articles by relevance to you, not by recency.',
  },
  {
    title: 'Semantic chat',
    desc: 'Ask questions across your feed. "What\'s new in vector databases this week?" actually works.',
  },
]

const steps = [
  { n: '01', title: 'Sign in with Google', desc: 'One click. No password, no setup.' },
  { n: '02', title: 'Set your interests', desc: 'Tell us your stack. NestJS, Rust, LLMs — whatever you actually work with.' },
  { n: '03', title: 'Feed builds itself', desc: 'Articles scraped, summarised, and ranked for you every 24h.' },
  { n: '04', title: 'Ask it anything', desc: 'Use semantic chat to query your feed like a database.' },
]

export default function Home() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)

    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('visible')),
      { threshold: 0.1, rootMargin: '0px 0px -80px 0px' },
    )
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el))

    window.addEventListener('scroll', handleScroll)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      observer.disconnect()
    }
  }, [])

  return (
    <div className={styles.container}>

      {/* Navbar */}
      <nav className={`${styles.navbar} ${scrolled ? styles.scrolled : ''}`}>
        <div className={styles.navContent}>
          <div className={styles.logo}>
            <Image src="/logo.png" alt="Logo" width={26} height={26} style={{ borderRadius: '4px' }} />
            <span className={styles.logoText}>ai.devfeed</span>
          </div>
          <div className={styles.navRight}>
            <a href={`${API_URL}/auth/google`} className={styles.signInBtn}>
              Sign in with Google →
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={`${styles.eyebrow} reveal`}>free · built in public</div>

          <h1 className={`${styles.headline} reveal`}>
            Your AI that reads the internet.<br />You just read what matters.
          </h1>

          <p className={`${styles.subheadline} reveal`}>
            AI Developer Feed scrapes Hacker News and Dev.to every day, summarises each article in 3 lines,
            and surfaces only what&apos;s relevant to your stack — automatically.
          </p>

          <div className={`${styles.heroActions} reveal`}>
            <a href={`${API_URL}/auth/google`} className={styles.primaryBtn}>
              Sign in with Google →
            </a>
          </div>

          <p className={`${styles.heroNote} reveal`}>Free during early access. No credit card.</p>
        </div>
      </section>

      {/* Demo card */}
      <section className={styles.demoSection}>
        <div className={styles.sectionInner}>
          <p className={`${styles.sectionLabel} reveal`}>What your feed looks like</p>
          <div className={`${styles.terminalCard} reveal`}>
            <div className={styles.terminalHeader}>
              <div className={styles.terminalDots}>
                <div></div><div></div><div></div>
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
                <p>PostgreSQL&apos;s pgvector extension enables semantic search through embeddings.</p>
                <p>Combine with an LLM for retrieval-augmented generation in production.</p>
                <p>Real-world example: 50K docs, &lt;1s queries, $0.02 cost per summary.</p>
              </div>
              <div className={styles.terminalFooter}>
                <span className={styles.tags}>NestJS · RAG · PostgreSQL</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className={styles.featuresSection}>
        <div className={styles.sectionInner}>
          <h2 className={`${styles.sectionHeading} reveal`}>Everything you need, nothing you don&apos;t</h2>
          <div className={`${styles.featuresGrid} reveal`}>
            {features.map((f) => (
              <div key={f.title} className={styles.featureCard}>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className={styles.howSection}>
        <div className={styles.sectionInner}>
          <h2 className={`${styles.sectionHeading} reveal`}>Up and running in 30 seconds</h2>
          <div className={`${styles.stepsRow} reveal`}>
            {steps.map((s) => (
              <div key={s.n} className={styles.stepCard}>
                <span className={styles.stepNumber}>{s.n}</span>
                <h3 className={styles.stepTitle}>{s.title}</h3>
                <p className={styles.stepDesc}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open stack */}
      <section className={styles.stackSection}>
        <div className={styles.sectionInner}>
          <p className={`${styles.stackLine} reveal`}>
            NestJS · TypeScript · PostgreSQL · pgvector · Redis · gpt-4o-mini · Railway
          </p>
          <p className={`${styles.stackSub} reveal`}>
            One repo. Open source. $7/month to run.{' '}
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              View on GitHub →
            </a>
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className={styles.finalCTA}>
        <div className={styles.sectionInner}>
          <h2 className={`${styles.finalHeadline} reveal`}>
            Stop losing 45 minutes to Hacker News every morning.
          </h2>
          <p className={`${styles.finalSub} reveal`}>
            Free. Takes 30 seconds to set up.
          </p>
          <div className="reveal">
            <a href={`${API_URL}/auth/google`} className={styles.primaryBtn}>
              Sign in with Google →
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <span>Built by <a href={X_URL} target="_blank" rel="noopener noreferrer">@zavxai</a></span>
          <span className={styles.footerDot}>·</span>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
          <span className={styles.footerDot}>·</span>
          <a href={X_URL} target="_blank" rel="noopener noreferrer">X</a>
        </div>
      </footer>

    </div>
  )
}
