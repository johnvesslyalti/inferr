'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/src/lib/auth-context';
import styles from './chat.module.css';

interface Source {
  title: string;
  url: string;
  source: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
}

const SOURCE_LABEL: Record<string, string> = { hn: 'HN', devto: 'Dev.to' };

export default function ChatPage() {
  const router = useRouter();
  const { token, ready, signOut: authSignOut } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ready && !token) { router.push('/'); }
  }, [router, token, ready]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const message = input.trim();
    if (!message || loading || !token) return;

    setMessages((prev) => [...prev, { role: 'user', content: message }]);
    setInput('');
    setLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const api = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/+$/, '');
      const res = await fetch(`${api}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.answer, sources: data.sources },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: err instanceof Error ? err.message : 'Something went wrong.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const onInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  const signOut = async () => {
    await authSignOut();
    router.push('/');
  };

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.logo}>
          <Image src="/logo.png" alt="Logo" width={22} height={22} style={{ borderRadius: '4px' }} />
          <span className={styles.logoText}>inferr</span>
        </div>
        <div className={styles.navRight}>
          <a href="/feed" className={styles.navLink}>feed</a>
          <a href="/onboarding" className={styles.navLink}>interests</a>
          <button onClick={signOut} className={styles.signOut}>sign out</button>
        </div>
      </nav>

      <div className={styles.body}>
        <div className={styles.history}>
          {messages.length === 0 && (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>Ask anything about your feed</p>
              <p className={styles.emptyHint}>{`e.g. "What's new in Rust this week?" or "Summarise the top Go articles"`}</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`${styles.row} ${msg.role === 'user' ? styles.rowUser : styles.rowAssistant}`}>
              <div className={`${styles.bubble} ${msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant}`}>
                <p className={styles.bubbleText}>{msg.content}</p>

                {msg.sources && msg.sources.length > 0 && (
                  <div className={styles.sources}>
                    <span className={styles.sourcesLabel}>sources</span>
                    {msg.sources.map((s, j) => (
                      <a key={j} href={s.url} target="_blank" rel="noopener noreferrer" className={styles.sourceLink}>
                        <span className={`${styles.sourceBadge} ${styles[`badge_${s.source}`]}`}>
                          {SOURCE_LABEL[s.source] ?? s.source}
                        </span>
                        {s.title}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className={`${styles.row} ${styles.rowAssistant}`}>
              <div className={`${styles.bubble} ${styles.bubbleAssistant}`}>
                <span className={styles.dots}>
                  <span /><span /><span />
                </span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className={styles.inputBar}>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            rows={1}
            placeholder="Ask a question… (Enter to send, Shift+Enter for newline)"
            value={input}
            onChange={onInput}
            onKeyDown={onKeyDown}
            disabled={loading}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className={styles.sendBtn}
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}
