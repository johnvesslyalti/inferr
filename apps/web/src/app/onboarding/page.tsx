'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useAuthFetch, API_BASE, SessionExpiredError } from '@/src/lib/auth-context';
import { getCanonicalTags } from '@/src/lib/interests';
import styles from './onboarding.module.css';

const CATEGORIES = [
  {
    name: 'Artificial Intelligence',
    icon: '🧠',
    tags: ['AI / ML'],
  },
  {
    name: 'Application Development',
    icon: '💻',
    tags: ['Web Development', 'Mobile Development', 'Open Source'],
  },
  {
    name: 'Infrastructure & Databases',
    icon: '☁️',
    tags: ['DevOps', 'Security', 'Databases'],
  },
  {
    name: 'Systems & Emerging Tech',
    icon: '📐',
    tags: ['System Design', 'Hardware', 'Blockchain'],
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { token, ready, refetchProfile } = useAuth();
  const authFetch = useAuthFetch();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !token) return;
    authFetch(`${API_BASE}/users/interests`)
      .then((r) => r.json())
      .then((data) => {
        if (data.tags?.length) {
          setSelected(new Set(getCanonicalTags(data.tags)));
        }
      })
      .catch((err) => { if (err instanceof SessionExpiredError) router.push('/'); });
  }, [token, ready, router, authFetch]);

  const toggle = (tag: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch(`${API_BASE}/users/interests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: Array.from(selected) }),
      });
      if (!res.ok) throw new Error('Failed to save interests');
      await refetchProfile();
      router.push('/feed');
    } catch (err) {
      if (err instanceof SessionExpiredError) { router.push('/'); return; }
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSaving(false);
    }
  };

  return (
    <main className={`${styles.page} pageGlow`}>
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.step}>Step 01 / Personalization</span>
          <h1 className={styles.title}>What is your tech stack?</h1>
          <p className={styles.subtitle}>
            Select the topics you care about. We will rank your daily feed based on their relevance to these technologies.
          </p>
        </div>

        {/* Categorized interest tags selector */}
        <div className={styles.categories}>
          {CATEGORIES.map((cat) => (
            <div key={cat.name} className={styles.categoryBlock}>
              <h3 className={styles.categoryTitle}>
                <span className={styles.categoryIcon}>{cat.icon}</span>
                {cat.name}
              </h3>
              <div className={styles.tags}>
                {cat.tags.map((tag) => {
                  const isSelected = selected.has(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggle(tag)}
                      className={`${styles.chip} ${isSelected ? styles.chipSelected : ''}`}
                    >
                      {isSelected && (
                        <span className={styles.checkIcon}>✓</span>
                      )}
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.footer}>
          <span className={styles.count}>
            <strong>{selected.size}</strong> topics selected
          </span>
          <button
            onClick={save}
            disabled={selected.size === 0 || saving}
            className={styles.cta}
          >
            {saving ? 'Creating feed…' : 'Build my feed →'}
          </button>
        </div>
      </div>
    </main>
  );
}
