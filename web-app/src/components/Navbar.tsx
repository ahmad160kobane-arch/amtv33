'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';

function IconHome({ active }: { active: boolean }) {
  return active ? (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
    </svg>
  ) : (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12L5 10M5 10L12 3L19 10M5 10V20C5 20.5523 5.44772 21 6 21H9M19 10L21 12M19 10V20C19 20.5523 18.5523 21 18 21H15M9 21C9 21 9 15 12 15C15 15 15 21 15 21M9 21H15" />
    </svg>
  );
}

function IconSports({ active }: { active: boolean }) {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      {active ? (
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 13v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
      ) : (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
          <path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32" />
        </>
      )}
    </svg>
  );
}

function IconKids({ active }: { active: boolean }) {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      {active ? (
        <path d="M12 2a5 5 0 015 5c0 1.45-.62 2.76-1.6 3.7C16.94 11.63 18 13.19 18 15v1a1 1 0 01-1 1h-2v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3H7a1 1 0 01-1-1v-1c0-1.81 1.06-3.37 2.6-4.3A4.978 4.978 0 017 7a5 5 0 015-5zm0 2a3 3 0 100 6 3 3 0 000-6z" />
      ) : (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M6 20v-2a6 6 0 0112 0v2" />
          <path d="M12 12v8" strokeDasharray="2 2" />
        </>
      )}
    </svg>
  );
}

function IconEntertainment({ active }: { active: boolean }) {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      {active ? (
        <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4zM10 15V9l5 3-5 3z" />
      ) : (
        <>
          <rect x="2" y="7" width="20" height="15" rx="2" />
          <path d="M17 2L12 7L7 2" />
          <polygon points="10,11 10,17 16,14" />
        </>
      )}
    </svg>
  );
}

function IconLive({ active }: { active: boolean }) {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      {active ? (
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
      ) : (
        <>
          <circle cx="12" cy="12" r="10" />
          <polygon points="10,8 16,12 10,16" />
        </>
      )}
    </svg>
  );
}

function IconMyList({ active }: { active: boolean }) {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" fill={active ? 'currentColor' : 'none'} />
    </svg>
  );
}

function IconAccount({ active }: { active: boolean }) {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {active ? (
        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
      ) : (
        <>
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </>
      )}
    </svg>
  );
}

const NAV_ICONS: Record<string, React.FC<{ active: boolean }>> = {
  '/': IconHome,
  '/live': IconLive,
  '/entertainment': IconEntertainment,
  '/mylist': IconMyList,
  '/account': IconAccount,
};

const NAV_ITEMS = [
  { href: '/', label: 'الرئيسية' },
  { href: '/live', label: 'مباشر' },
  { href: '/entertainment', label: 'ترفيه' },
  { href: '/mylist', label: 'قائمتي' },
  { href: '/account', label: 'حسابي' },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  return (
    <>
      {/* Desktop / top navbar */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-light-header/98 dark:bg-dark-header/98 backdrop-blur shadow-lg shadow-black/10'
          : 'bg-light-header/80 dark:bg-dark-header/80 backdrop-blur-sm'
      }`}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-brand-primary text-2xl font-black tracking-wide">MA</span>
            <span className="text-xs text-light-muted dark:text-dark-muted mt-1">streaming</span>
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? 'bg-brand-primary/15 text-brand-primary'
                      : 'text-light-muted dark:text-dark-muted hover:text-light-text dark:hover:text-dark-text hover:bg-light-input dark:hover:bg-dark-input'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/allcontent')}
              className="p-2 rounded-lg text-light-muted dark:text-dark-muted hover:bg-light-input dark:hover:bg-dark-input transition"
              title="البحث"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            <button
              onClick={toggle}
              className="p-2 rounded-lg text-light-muted dark:text-dark-muted hover:bg-light-input dark:hover:bg-dark-input transition"
              title="تغيير المظهر"
            >
              {theme === 'dark' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            <Link
              href="/account"
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary text-sm font-medium transition"
            >
              {user ? (user.display_name || user.username).split(' ')[0] : 'دخول'}
            </Link>

            {/* Search shortcut on mobile */}
            <button
              onClick={() => router.push('/allcontent')}
              className="md:hidden p-2 rounded-lg text-light-muted dark:text-dark-muted hover:bg-light-input dark:hover:bg-dark-input transition"
              title="البحث"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
        </div>

      </header>

      {/* Bottom nav for mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-light-card/95 dark:bg-dark-card/95 backdrop-blur border-t border-light-border dark:border-dark-border flex">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors ${
                active ? 'text-brand-primary' : 'text-light-muted dark:text-dark-muted'
              }`}
            >
              <span className={`transition-transform ${active ? 'scale-110' : ''}`}>
                {React.createElement(NAV_ICONS[item.href], { active })}
              </span>
              <span className="text-[10px] font-semibold">{item.label}</span>
              {active && <span className="absolute bottom-0 w-8 h-0.5 bg-brand-primary rounded-t-full" />}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
