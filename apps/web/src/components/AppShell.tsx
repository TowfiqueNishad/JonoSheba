'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../lib/auth';
import { useLocale } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { SearchCombobox } from './SearchCombobox';

/**
 * NOSTOS Language Switcher:
 * Text toggle "বাং | EN" with a gold underline that glides under the active locale.
 */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, dict, switchLocale } = useLocale();
  return (
    <div
      role="group"
      aria-label={dict.locale.switchLabel}
      className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 px-1 text-[11px] font-semibold tracking-[0.22em]"
    >
      <button
        type="button"
        aria-pressed={locale === 'bn'}
        onClick={() => switchLocale('bn')}
        lang="bn"
        className={`relative min-h-[44px] px-1.5 transition-colors duration-[400ms] ${
          locale === 'bn' ? 'text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
        }`}
      >
        <span>{compact ? 'বাং' : dict.locale.bn}</span>
        <span
          aria-hidden="true"
          className={`absolute bottom-2 left-1 right-1 h-[1.5px] bg-[var(--gold)] transition-transform duration-[900ms] ease-[cubic-bezier(.16,1,.3,1)] ${
            locale === 'bn' ? 'scale-x-100' : 'scale-x-0'
          }`}
        />
      </button>
      <span aria-hidden="true" className="text-[var(--hair)]">
        |
      </span>
      <button
        type="button"
        aria-pressed={locale === 'en'}
        onClick={() => switchLocale('en')}
        lang="en"
        className={`relative min-h-[44px] px-1.5 uppercase transition-colors duration-[400ms] ${
          locale === 'en' ? 'text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
        }`}
      >
        <span>{compact ? 'EN' : dict.locale.en}</span>
        <span
          aria-hidden="true"
          className={`absolute bottom-2 left-1 right-1 h-[1.5px] bg-[var(--gold)] transition-transform duration-[900ms] ease-[cubic-bezier(.16,1,.3,1)] ${
            locale === 'en' ? 'scale-x-100' : 'scale-x-0'
          }`}
        />
      </button>
    </div>
  );
}

/**
 * NOSTOS Day · Night Toggle:
 * Text toggle "DAY  NIGHT" with a gold underline that glides between words (900ms)
 * while the entire page re-grades with a 1.4s cross-fade.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { locale } = useLocale();
  return (
    <div
      role="group"
      aria-label={locale === 'bn' ? 'দিন বা রাতের থিম বেছে নিন' : 'Select Day or Night theme'}
      className="inline-flex min-h-[44px] shrink-0 items-center gap-2 px-1 font-overline text-[10px] font-semibold uppercase tracking-[0.34em]"
    >
      <button
        type="button"
        aria-pressed={theme === 'day'}
        aria-label={locale === 'bn' ? 'দিনের আলো থিম (DAY)' : 'Day theme (Bleached Light)'}
        onClick={() => setTheme('day')}
        className={`relative min-h-[44px] px-1 transition-colors duration-[500ms] ${
          theme === 'day' ? 'text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
        }`}
      >
        <span>DAY</span>
        <span
          aria-hidden="true"
          className={`absolute bottom-2 left-0.5 right-0.5 h-[1.5px] bg-[var(--gold)] transition-transform duration-[900ms] ease-[cubic-bezier(.16,1,.3,1)] ${
            theme === 'day' ? 'scale-x-100' : 'scale-x-0'
          }`}
        />
      </button>
      <span aria-hidden="true" className="text-[var(--gold)]">
        ·
      </span>
      <button
        type="button"
        aria-pressed={theme === 'night'}
        aria-label={locale === 'bn' ? 'রাতের থিম (NIGHT)' : 'Night theme (Steel & Gold)'}
        onClick={() => setTheme('night')}
        className={`relative min-h-[44px] px-1 transition-colors duration-[500ms] ${
          theme === 'night'
            ? 'text-[var(--text)]'
            : 'text-[var(--text-muted)] hover:text-[var(--text)]'
        }`}
      >
        <span>NIGHT</span>
        <span
          aria-hidden="true"
          className={`absolute bottom-2 left-0.5 right-0.5 h-[1.5px] bg-[var(--gold)] transition-transform duration-[900ms] ease-[cubic-bezier(.16,1,.3,1)] ${
            theme === 'night' ? 'scale-x-100' : 'scale-x-0'
          }`}
        />
      </button>
    </div>
  );
}

export function AppHeader() {
  const pathname = usePathname() ?? '/';
  const { locale, dict, localePath } = useLocale();
  const { user, openSignIn } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [heroSearchInView, setHeroSearchInView] = useState(true);

  const strippedPath = pathname.replace(/^\/(bn|en)(?=\/|$)/, '') || '/';
  const isHomePage = strippedPath === '/';
  const isEmergencyPage = strippedPath === '/emergency';

  // Section 1 Fix First: On Home, header search is hidden while the hero search is in view,
  // and fades in smoothly only after the hero search scrolls out of view (IntersectionObserver).
  useEffect(() => {
    if (!isHomePage) {
      setHeroSearchInView(false);
      return;
    }
    setHeroSearchInView(true);

    function onHeroVisibility(e: Event) {
      const custom = e as CustomEvent<{ inView: boolean }>;
      if (typeof custom.detail?.inView === 'boolean') {
        setHeroSearchInView(custom.detail.inView);
      }
    }

    window.addEventListener('nostos:hero-search-visibility', onHeroVisibility);
    return () => window.removeEventListener('nostos:hero-search-visibility', onHeroVisibility);
  }, [isHomePage]);

  const primaryNav = [
    { href: '/', label: dict.nav.home },
    { href: '/services', label: dict.nav.services },
    { href: '/transport', label: dict.nav.transport },
    { href: '/benefits', label: dict.nav.benefits },
    { href: '/ministries', label: locale === 'bn' ? 'মন্ত্রণালয়' : 'Ministries' },
    { href: '/education', label: locale === 'bn' ? 'শিক্ষা' : 'Education' },
    { href: '/jono', label: dict.nav.jono },
    { href: '/emergency', label: dict.nav.emergency },
  ];

  const moreNav = [
    { href: '/hotlines', label: locale === 'bn' ? 'সকল হটলাইন' : 'Hotline Directory' },
    { href: '/life-events', label: dict.nav.lifeEvents },
    { href: '/scholarships', label: dict.nav.scholarships },
    { href: '/jobs', label: dict.nav.jobs },
    { href: '/notices', label: dict.nav.notices },
    { href: '/calendar', label: dict.nav.calendar },
    { href: '/complaints', label: dict.nav.complaints },
    { href: '/health', label: dict.nav.health },
    { href: '/utilities', label: dict.nav.utilities },
    { href: '/near-me', label: dict.nav.nearMe },
    { href: '/lite', label: dict.nav.lite, plainLink: true },
  ];

  const showHeaderSearch = !isHomePage || !heroSearchInView;

  return (
    <>
      {/* Tab stop 1: Skip to main content (WCAG 2.2 AA) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:border focus:border-[var(--gold)] focus:bg-[var(--page)] focus:px-4 focus:py-2 focus:text-xs focus:font-bold focus:text-[var(--text)]"
      >
        {dict.app.skipToContent}
      </a>

      {/* High-contrast emergency strip on /emergency */}
      {isEmergencyPage && (
        <div className="bg-[#B3261E] px-4 py-2 text-center text-xs font-semibold text-white">
          <span>{dict.emergency.noDispatchNotice} </span>
          <a href="tel:999" className="underline">
            {dict.emergency.call999}
          </a>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-[var(--hair)] bg-[var(--panel)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-2.5 sm:px-5">
          {/* Left: Solid #B3261E 999 Pill + NOSTOS Wordmark ("জনসেবা" wide Anek Bangla + "JONOSHHEBA" tracked 9px steel-blue) */}
          <div className="flex shrink-0 items-center gap-3">
            <a
              href="tel:999"
              className="nostos-emergency-999 inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full bg-[#B3261E] px-3.5 text-xs font-bold tracking-wider text-white transition-transform duration-300 active:scale-[0.985]"
              aria-label={dict.emergency.call999}
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.63 2.63a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.45-1.2a2 2 0 0 1 2.11-.45c.85.3 1.73.51 2.63.63A2 2 0 0 1 22 16.92z" />
              </svg>
              <span>{dict.emergency.pill999}</span>
            </a>

            <Link
              href={localePath('/')}
              className="flex shrink-0 flex-col whitespace-nowrap leading-none text-[var(--text)]"
            >
              <span className="nostos-display-h1 text-lg tracking-wide sm:text-xl">জনসেবা</span>
              <span className="mt-0.5 font-overline text-[9px] font-semibold uppercase tracking-[0.42em] text-[var(--accent)]">
                JONOSHHEBA
              </span>
            </Link>
          </div>

          {/* Header Search Combobox: hidden on Home while hero search is in view; fades in on scroll or on inner pages */}
          <div
            data-testid="header-search-slot"
            data-visible={showHeaderSearch ? 'true' : 'false'}
            className={`hidden transition-opacity duration-[700ms] ease-[cubic-bezier(.16,1,.3,1)] md:block ${
              showHeaderSearch ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            {showHeaderSearch && <SearchCombobox variant="header" />}
          </div>

          {/* Centred Desktop Text Nav (xl:flex) */}
          <nav
            aria-label={locale === 'bn' ? 'প্রধান মেনু' : 'Primary navigation'}
            className="hidden items-center gap-3 text-xs font-medium xl:flex"
          >
            {primaryNav.map((item) => {
              const active = strippedPath === item.href;
              return (
                <Link
                  key={item.href}
                  href={localePath(item.href)}
                  className={`relative inline-flex min-h-[44px] items-center whitespace-nowrap px-1.5 transition-colors duration-[400ms] ${
                    active ? 'text-[var(--gold)]' : 'text-[var(--text)] hover:text-[var(--gold)]'
                  }`}
                >
                  <span>{item.label}</span>
                  <span
                    aria-hidden="true"
                    className={`absolute bottom-2 left-1 right-1 h-[1px] bg-[var(--gold)] transition-transform duration-[700ms] ease-[cubic-bezier(.16,1,.3,1)] ${
                      active ? 'scale-x-100' : 'scale-x-0'
                    }`}
                  />
                </Link>
              );
            })}

            <div className="relative">
              <button
                type="button"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((v) => !v)}
                className="inline-flex min-h-[44px] items-center gap-1 whitespace-nowrap px-1.5 text-[var(--text-muted)] hover:text-[var(--gold)]"
              >
                <span>{dict.nav.more}</span>
                <svg
                  className="h-3 w-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {moreOpen && (
                <div
                  onMouseLeave={() => setMoreOpen(false)}
                  className="absolute right-0 mt-1 w-60 border border-[var(--hair)] bg-[var(--panel)] p-2 shadow-2xl backdrop-blur-xl"
                >
                  {moreNav.map((m) =>
                    m.plainLink ? (
                      <a
                        key={m.href}
                        href={`${m.href}?lang=${locale}`}
                        className="block border-b border-[var(--hair-soft)] px-3 py-2 text-xs text-[var(--text)] transition-colors hover:text-[var(--gold)]"
                      >
                        {m.label}
                      </a>
                    ) : (
                      <Link
                        key={m.href}
                        href={localePath(m.href)}
                        onClick={() => setMoreOpen(false)}
                        className="block border-b border-[var(--hair-soft)] px-3 py-2 text-xs text-[var(--text)] transition-colors hover:text-[var(--gold)]"
                      >
                        {m.label}
                      </Link>
                    ),
                  )}
                </div>
              )}
            </div>
          </nav>

          {/* Right Controls: বাং | EN + DAY · NIGHT + Account + Mobile Menu Trigger */}
          <div className="flex shrink-0 items-center gap-2">
            <LanguageSwitcher compact />
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>

            {user ? (
              <Link href={localePath('/account')} className="nostos-btn-gold hidden xl:inline-flex">
                {dict.nav.account}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => openSignIn()}
                className="nostos-btn-gold hidden xl:inline-flex"
              >
                {dict.nav.account}
              </button>
            )}

            <button
              type="button"
              aria-expanded={drawerOpen}
              aria-label={dict.nav.menu}
              onClick={() => setDrawerOpen((v) => !v)}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center border border-[var(--hair)] text-xs font-semibold text-[var(--text)] xl:hidden"
            >
              {drawerOpen ? (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Slide-Out Editorial Drawer (<1280px) */}
        {drawerOpen && (
          <nav
            aria-label={locale === 'bn' ? 'মোবাইল মেনু' : 'Mobile menu'}
            className="border-t border-[var(--hair)] bg-[var(--panel)] px-4 py-4 backdrop-blur-xl xl:hidden"
          >
            <div className="mb-4 md:hidden">
              <SearchCombobox variant="page" />
            </div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--hair)] pb-3">
              <ThemeToggle />
              <Link
                href={localePath('/account')}
                onClick={() => setDrawerOpen(false)}
                className="nostos-btn-gold"
              >
                {dict.nav.account}
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              {[...primaryNav, ...moreNav].map((item) =>
                'plainLink' in item && item.plainLink ? (
                  <a
                    key={item.href}
                    href={`${item.href}?lang=${locale}`}
                    className="flex min-h-[44px] items-center border border-[var(--hair)] px-3 text-[var(--text)] hover:border-[var(--gold-line)]"
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    key={item.href}
                    href={localePath(item.href)}
                    onClick={() => setDrawerOpen(false)}
                    className={`flex min-h-[44px] items-center border px-3 ${
                      strippedPath === item.href
                        ? 'border-[var(--gold)] text-[var(--gold)]'
                        : 'border-[var(--hair)] text-[var(--text)] hover:border-[var(--gold-line)]'
                    }`}
                  >
                    {item.label}
                  </Link>
                ),
              )}
            </div>
          </nav>
        )}
      </header>
    </>
  );
}

/**
 * NOSTOS Mobile Text Bottom Tab Bar:
 * হোম · খুঁজুন · জনো · সতর্কতা · আমি
 * with a gliding gold hairline under the active tab.
 */
export function MobileBottomNav() {
  const pathname = usePathname() ?? '/';
  const { locale, dict, localePath } = useLocale();
  const strippedPath = pathname.replace(/^\/(bn|en)(?=\/|$)/, '') || '/';

  const tabs = [
    { href: '/', label: dict.nav.home },
    { href: '/search', label: dict.nav.search },
    { href: '/jono', label: locale === 'bn' ? 'জনো' : 'Jono' },
    { href: '/notices', label: dict.nav.alerts },
    { href: '/account', label: dict.nav.me },
  ];

  return (
    <nav
      aria-label={locale === 'bn' ? 'নিচের নেভিগেশন' : 'Bottom navigation'}
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--hair)] bg-[var(--panel)] backdrop-blur-xl xl:hidden no-print"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {tabs.map((tab) => {
          const active = strippedPath === tab.href;
          return (
            <Link
              key={tab.href}
              href={localePath(tab.href)}
              className={`relative flex min-h-[52px] items-center justify-center text-xs font-medium tracking-wider transition-colors ${
                active ? 'text-[var(--gold)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <span>{tab.label}</span>
              <span
                aria-hidden="true"
                className={`absolute bottom-0 left-3 right-3 h-[1.5px] bg-[var(--gold)] transition-transform duration-[700ms] ease-[cubic-bezier(.16,1,.3,1)] ${
                  active ? 'scale-x-100' : 'scale-x-0'
                }`}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * NOSTOS Editorial Footer:
 * Wordmark · tracked disclaimer · OpenStreetMap ODbL attribution · hairline links
 */
export function AppFooter() {
  const { locale, dict, localePath } = useLocale();
  return (
    <footer className="relative z-10 mt-16 border-t border-[var(--hair)] bg-[var(--page)] pb-24 pt-12 text-xs text-[var(--text-muted)] xl:pb-12">
      <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-6 border-b border-[var(--hair)] pb-8">
          <div className="space-y-2">
            <div className="flex items-baseline gap-3">
              <span className="nostos-display-h2 text-2xl text-[var(--text)]">জনসেবা</span>
              <span className="nostos-overline text-[var(--accent)]">JONOSHHEBA AI</span>
            </div>
            <p className="font-overline text-[10px] uppercase tracking-[0.28em] text-[var(--text)]">
              {dict.app.disclaimer}
            </p>
            <p className="nostos-editorial-italic text-sm text-[var(--text-muted)]">
              {dict.app.osmAttribution}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs">
          <Link href={localePath('/ministries')} className="nostos-link">
            {locale === 'bn' ? 'মন্ত্রণালয় ও দপ্তর' : 'Ministries & Offices'}
          </Link>
          <Link href={localePath('/education')} className="nostos-link">
            {locale === 'bn' ? 'শিক্ষা প্রতিষ্ঠান ও EIIN' : 'Education & EIIN Hub'}
          </Link>
          <Link href={localePath('/hotlines')} className="nostos-link">
            {locale === 'bn' ? 'সকল হটলাইন' : 'Hotline Directory'}
          </Link>
          <Link href={localePath('/about')} className="nostos-link">
            {dict.nav.about}
          </Link>
          <Link href={localePath('/privacy')} className="nostos-link">
            {dict.nav.privacy}
          </Link>
          <Link href={localePath('/terms')} className="nostos-link">
            {dict.nav.terms}
          </Link>
          <Link href={localePath('/contact')} className="nostos-link">
            {dict.nav.contact}
          </Link>
          <Link href={localePath('/accessibility')} className="nostos-link">
            {dict.nav.accessibility}
          </Link>
          <a href={`/lite?lang=${locale}`} className="nostos-link text-[var(--gold)]">
            {dict.nav.lite}
          </a>
        </div>
      </div>
    </footer>
  );
}
