'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/src/lib/auth-context';
import styles from './ProfileMenu.module.css';

const NAV_ITEMS = [
  { href: '/feed',       label: 'Feed' },
  { href: '/chat',       label: 'Chat' },
  { href: '/market',     label: 'Tech Market', isNew: true },
];

interface ProfileMenuProps {
  // When provided, "Edit Interests" opens this handler (e.g. an in-place dialog)
  // instead of navigating to the /onboarding page.
  onEditInterests?: () => void;
}

export function ProfileMenu({ onEditInterests }: ProfileMenuProps = {}) {
  const { user, token, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '';

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    router.push('/');
  };

  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-label="Open profile menu"
        disabled={!token}
      >
        {!user ? (
          <span className={styles.skeleton} />
        ) : user.avatar ? (
          <Image
            src={user.avatar}
            alt={user.name}
            width={30}
            height={30}
            className={styles.avatar}
          />
        ) : (
          <span className={styles.initials}>{initials}</span>
        )}
      </button>

      {open && (
        <div className={styles.dropdown}>
          {/* User info header */}
          <div className={styles.userInfo}>
            {user?.avatar ? (
              <Image src={user.avatar} alt={user.name} width={36} height={36} className={styles.dropAvatar} />
            ) : (
              <span className={styles.dropInitials}>{initials}</span>
            )}
            <div>
              <p className={styles.userName}>{user?.name ?? '—'}</p>
              <p className={styles.userEmail}>{user?.email ?? '—'}</p>
            </div>
          </div>

          <div className={styles.divider} />

          {/* Nav links */}
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`${styles.item} ${pathname === item.href ? styles.itemActive : ''}`}
              onClick={() => setOpen(false)}
            >
              {item.label}
              {item.isNew && <span className={styles.newBadge}>new</span>}
            </a>
          ))}

          {/* Edit Interests: open the in-place dialog when a handler is given,
              otherwise fall back to the onboarding page. */}
          {onEditInterests ? (
            <button
              className={`${styles.item} ${styles.itemButton}`}
              onClick={() => { setOpen(false); onEditInterests(); }}
            >
              Edit Interests
            </button>
          ) : (
            <a
              href="/onboarding"
              className={`${styles.item} ${pathname === '/onboarding' ? styles.itemActive : ''}`}
              onClick={() => setOpen(false)}
            >
              Edit Interests
            </a>
          )}

          <div className={styles.divider} />

          <button className={styles.signOut} onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
