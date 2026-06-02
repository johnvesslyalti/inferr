'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, API_BASE } from '@/src/lib/auth-context';
import { apiFetch } from '@/src/lib/server-status';
import { INTEREST_TAGS } from '@/src/lib/interests';
import styles from './onboarding.module.css';

const TAGS = INTEREST_TAGS;

export default function OnboardingPage() {
  const router = useRouter();
  const { token, ready } = useAuth();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !token) return;
    apiFetch(`${API_BASE}/users/interests`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.tags?.length) setSelected(new Set(data.tags));
      })
      .catch(() => {});
  }, [token, ready]);

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
      const res = await apiFetch(`${API_BASE}/users/interests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ tags: Array.from(selected) }),
      });
      if (!res.ok) throw new Error('Failed to save interests');
      router.push('/feed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSaving(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.step}>01 / setup</span>
          <h1 className={styles.title}>What&apos;s your tech stack?</h1>
          <p className={styles.subtitle}>
            Pick topics that matter to you — your feed will be ranked by relevance.
          </p>
        </div>

        <div className={styles.tags}>
          {TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => toggle(tag)}
              className={`${styles.chip} ${selected.has(tag) ? styles.chipSelected : ''}`}
            >
              {tag}
            </button>
          ))}
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.footer}>
          <span className={styles.count}>
            {selected.size} selected
          </span>
          <button
            onClick={save}
            disabled={selected.size === 0 || saving}
            className={styles.cta}
          >
            {saving ? 'Saving…' : 'Build my feed →'}
          </button>
        </div>
      </div>
    </main>
  );
}
