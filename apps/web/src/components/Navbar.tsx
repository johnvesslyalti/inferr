'use client';

import { usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ProfileMenu } from './ProfileMenu';
import styles from './Navbar.module.css';

const NAV_ITEMS = [
  { href: '/feed', label: 'Feed' },
  { href: '/chat', label: 'Chat' },
  { href: '/market', label: 'Tech Market', isNew: true },
];

interface NavbarProps {
  onEditInterests?: () => void;
}

export function Navbar({ onEditInterests }: NavbarProps) {
  const pathname = usePathname();

  return (
    <nav className={`${styles.nav} glassNav`}>
      <div className={styles.navInner}>
        {/* Brand logo & name */}
        <Link href="/feed" className={styles.logo}>
          <Image
            src="/logo.png"
            alt="Logo"
            width={24}
            height={24}
            className={styles.logoImg}
            style={{ borderRadius: '4px' }}
          />
          <span className={styles.logoText}>
            inferr<span className={styles.logoDot}>.</span>
          </span>
        </Link>

        {/* Center links */}
        <div className={styles.navLinks}>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navLink} ${isActive ? styles.active : ''}`}
              >
                {item.label}
                {item.isNew && <span className={styles.newBadge}>new</span>}
                {isActive && <span className={styles.activeGlow} />}
              </Link>
            );
          })}
        </div>

        {/* Right actions */}
        <div className={styles.navRight}>
          <ProfileMenu onEditInterests={onEditInterests} />
        </div>
      </div>
    </nav>
  );
}
