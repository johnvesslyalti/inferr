'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth, useAuthFetch, API_BASE, SessionExpiredError } from '@/src/lib/auth-context';
import styles from './InterestsDialog.module.css';

const CATEGORIES = [
  {
    name: 'Languages',
    icon: '💻',
    tags: ['TypeScript', 'JavaScript', 'Python', 'Go', 'Rust'],
  },
  {
    name: 'Frameworks & Runtimes',
    icon: '⚡',
    tags: ['React', 'Next.js', 'Node.js', 'NestJS'],
  },
  {
    name: 'Databases & Storage',
    icon: '🗄️',
    tags: ['PostgreSQL', 'Redis'],
  },
  {
    name: 'AI / ML & Intelligent Systems',
    icon: '🧠',
    tags: ['AI / ML', 'LLMs', 'RAG'],
  },
  {
    name: 'DevOps & Cloud Infrastructure',
    icon: '☁️',
    tags: ['Docker', 'Kubernetes', 'AWS', 'DevOps'],
  },
  {
    name: 'Architecture & Security',
    icon: '📐',
    tags: ['System Design', 'Security'],
  },
];

interface Props {
  onClose: () => void;
  onSaved?: () => void;
}

export function InterestsDialog({ onClose, onSaved }: Props) {
  const { token } = useAuth();
  const authFetch = useAuthFetch();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Load existing interests
  useEffect(() => {
    if (!token) return;
    authFetch(`${API_BASE}/users/interests`)
      .then((r) => r.json())
      .then((data) => { if (data.tags?.length) setSelected(new Set(data.tags)); })
      .catch((err) => { if (err instanceof SessionExpiredError) onClose(); });
  }, [token, onClose, authFetch]);

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Close on backdrop click
  const onBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

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
      onSaved?.();
      onClose();
    } catch (err) {
      if (err instanceof SessionExpiredError) { onClose(); return; }
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSaving(false);
    }
  };

  return (
    <div className={styles.backdrop} onClick={onBackdrop}>
      <div className={styles.dialog} ref={dialogRef} role="dialog" aria-modal="true" aria-label="Edit interests">
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Edit interests</h2>
            <p className={styles.subtitle}>Your feed is ranked by relevance to these topics.</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.categoriesContainer}>
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
          <div className={styles.actions}>
            <button onClick={onClose} className={styles.cancelBtn}>Cancel</button>
            <button
              onClick={save}
              disabled={selected.size === 0 || saving}
              className={styles.saveBtn}
            >
              {saving ? 'Saving…' : 'Save interests'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
