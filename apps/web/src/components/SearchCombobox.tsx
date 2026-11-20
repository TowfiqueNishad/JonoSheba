'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDigits } from '@jonoshheba/shared';
import { apiGet } from '../lib/api';
import { useLocale } from '../lib/i18n';

export interface SuggestItem {
  text: string;
  textAlt: string;
  type: string;
  group:
    | 'Services'
    | 'Life events'
    | 'Trains/Stations'
    | 'Bus routes'
    | 'Hotlines'
    | 'Ministries/Offices'
    | 'Institutions/EIIN'
    | 'Notices';
  slugOrCode: string;
  url: string;
  icon: string;
  matchRanges: Array<[number, number]>;
}

const RECENT_STORAGE_KEY = 'jonoshheba_recent_searches';

const GROUP_LABELS_BN: Record<SuggestItem['group'], string> = {
  Services: 'সরকারি সেবা',
  'Life events': 'জীবনের ধাপ',
  'Trains/Stations': 'ট্রেন ও স্টেশন',
  'Bus routes': 'বাস রুট',
  Hotlines: 'হটলাইন',
  'Ministries/Offices': 'মন্ত্রণালয় ও দপ্তর',
  'Institutions/EIIN': 'শিক্ষা প্রতিষ্ঠান ও EIIN',
  Notices: 'নোটিশ',
};

function CategorySvgIcon({ icon }: { icon: string }) {
  switch (icon) {
    case 'train':
      return (
        <svg className="h-4 w-4 shrink-0 text-[var(--gold)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="4" y="3" width="16" height="15" rx="1" />
          <path d="M4 11h16M8 15h.01M16 15h.01M7 18l-2 3M17 18l2 3" />
        </svg>
      );
    case 'bus':
      return (
        <svg className="h-4 w-4 shrink-0 text-[var(--gold)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="3" y="4" width="18" height="14" rx="1" />
          <path d="M3 11h18M7 15h.01M17 15h.01M6 18v2M18 18v2" />
        </svg>
      );
    case 'phone':
      return (
        <svg className="h-4 w-4 shrink-0 text-[#E57368]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.63 2.63a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.45-1.2a2 2 0 0 1 2.11-.45c.85.3 1.73.51 2.63.63A2 2 0 0 1 22 16.92z" />
        </svg>
      );
    case 'graduation-cap':
      return (
        <svg className="h-4 w-4 shrink-0 text-[var(--gold)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c3 3 9 3 12 0v-5" />
        </svg>
      );
    case 'building':
      return (
        <svg className="h-4 w-4 shrink-0 text-[var(--gold)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="4" y="2" width="16" height="20" rx="1" />
          <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
        </svg>
      );
    default:
      return (
        <svg className="h-4 w-4 shrink-0 text-[var(--accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
        </svg>
      );
  }
}

function renderHighlighted(text: string, ranges: Array<[number, number]>) {
  if (!ranges || ranges.length === 0) return <span>{text}</span>;
  const [start, end] = ranges[0]!;
  if (start < 0 || end <= start || end > text.length) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, start)}
      <mark className="bg-transparent font-bold text-[var(--gold)] underline decoration-[var(--gold-line)]">
        {text.slice(start, end)}
      </mark>
      {text.slice(end)}
    </span>
  );
}

function shouldTriggerAutocomplete(q: string): boolean {
  const trimmed = q.trim();
  if (!trimmed) return false;
  if (/[\u0980-\u09FF]/.test(trimmed)) return trimmed.length >= 1;
  return trimmed.length >= 2;
}

/**
 * NOSTOS Search Field + Glass Suggestions Panel (ARIA 1.2 Combobox):
 * - On focus, hairline border warms to gold with soft halo
 * - Glass panel (`--panel` + backdrop blur), rows reveal with 40ms stagger
 * - Type labels in tracked small caps, English gloss in Cormorant italic
 */
export function SearchCombobox({
  variant = 'hero',
  initialQuery = '',
  placeholder,
  onSelectQuery,
}: {
  variant?: 'hero' | 'header' | 'page';
  initialQuery?: string;
  placeholder?: string;
  onSelectQuery?: (q: string) => void;
}) {
  const { locale, dict, localePath } = useLocale();
  const router = useRouter();
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const inputId = `${baseId}-input`;

  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [items, setItems] = useState<SuggestItem[]>([]);
  const [didYouMean, setDidYouMean] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const trending =
    locale === 'bn'
      ? ['ই-পাসপোর্ট আবেদন', 'ঢাকা চট্টগ্রাম ট্রেন', 'জমির খাজনা', 'ঢাকা বিশ্ববিদ্যালয়', '৯৯৯ জরুরি সেবা']
      : ['e-Passport application', 'Dhaka Chattogram train', 'Land tax (Khajna)', 'Dhaka University', '999 Emergency'];

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
      if (raw) setRecent(JSON.parse(raw) as string[]);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    if (!shouldTriggerAutocomplete(query)) {
      setItems([]);
      setDidYouMean(null);
      setActiveIndex(-1);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await apiGet<{
          items?: SuggestItem[];
          suggestions?: SuggestItem[];
          didYouMean?: string | null;
        }>(`/api/v1/search/suggest?q=${encodeURIComponent(query.trim())}&limit=8`, { locale });
        const list = res.items ?? res.suggestions ?? [];
        setItems(list.slice(0, 8));
        setDidYouMean(res.didYouMean ?? null);
        setActiveIndex(-1);
      } catch {
        setItems([]);
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [query, locale]);

  function saveRecentSearch(q: string) {
    const clean = q.trim();
    if (!clean) return;
    const next = [clean, ...recent.filter((r) => r !== clean)].slice(0, 5);
    setRecent(next);
    try {
      window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  function clearRecentSearches() {
    setRecent([]);
    try {
      window.localStorage.removeItem(RECENT_STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  function navigateToSuggestion(item: SuggestItem) {
    saveRecentSearch(item.text);
    setOpen(false);
    if (item.url.startsWith('tel:')) {
      window.location.href = item.url;
      return;
    }
    router.push(localePath(item.url));
  }

  function submitFullSearch(qOverride?: string) {
    const q = (qOverride ?? query).trim();
    if (!q) return;
    saveRecentSearch(q);
    setOpen(false);
    if (onSelectQuery) {
      onSelectQuery(q);
      return;
    }
    router.push(localePath(`/search?q=${encodeURIComponent(q)}`));
  }

  function askJonoWithQuery() {
    const q = query.trim();
    if (!q) return;
    saveRecentSearch(q);
    setOpen(false);
    router.push(localePath(`/jono?q=${encodeURIComponent(q)}`));
  }

  const hasAskJonoRow = query.trim().length > 0;
  const totalOptions = items.length + (hasAskJonoRow ? 1 : 0);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((prev) => (totalOptions > 0 ? (prev + 1) % totalOptions : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((prev) => (totalOptions > 0 ? (prev - 1 + totalOptions) % totalOptions : -1));
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    } else if (e.key === 'Enter') {
      if (open && activeIndex >= 0) {
        e.preventDefault();
        if (activeIndex < items.length) {
          navigateToSuggestion(items[activeIndex]!);
        } else if (hasAskJonoRow) {
          askJonoWithQuery();
        }
      }
    }
  }

  const isHeader = variant === 'header';

  return (
    <div ref={containerRef} className={`relative ${isHeader ? 'w-48 lg:w-64' : 'w-full'}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitFullSearch();
        }}
        className={isHeader ? 'flex items-center' : 'flex flex-col gap-2 sm:flex-row'}
      >
        <label htmlFor={inputId} className="sr-only">
          {dict.home.searchLabel}
        </label>
        <input
          id={inputId}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && activeIndex >= 0 ? `${baseId}-opt-${activeIndex}` : undefined
          }
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? dict.home.searchPlaceholder}
          className={
            isHeader
              ? 'min-h-[40px] w-full border border-[var(--hair)] bg-[var(--field)] px-3 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)]'
              : 'min-h-[46px] flex-1 border border-[var(--hair)] bg-[var(--field)] px-4 text-sm text-[var(--hero-text)] placeholder:text-[var(--hero-muted)] backdrop-blur-md transition-all duration-[600ms] focus:border-[var(--gold)] sm:min-h-[52px]'
          }
        />
        {!isHeader && (
          <button
            type="submit"
            disabled={!query.trim()}
            className="nostos-btn-gold min-h-[46px] px-6 disabled:opacity-50 sm:min-h-[52px] sm:px-7"
          >
            {dict.home.searchButton}
          </button>
        )}
      </form>

      {/* Screen-reader live result announcement */}
      <div aria-live="polite" className="sr-only">
        {open && shouldTriggerAutocomplete(query)
          ? locale === 'bn'
            ? `${formatDigits(items.length, 'bn')}টি প্রস্তাবনা পাওয়া গেছে`
            : `${items.length} suggestions available`
          : ''}
      </div>

      {/* Glass Autocomplete Panel */}
      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={locale === 'bn' ? 'অনুসন্ধান প্রস্তাবনা' : 'Search suggestions'}
          className="fixed inset-x-2 top-20 z-50 max-h-[75vh] overflow-y-auto border border-[var(--hair)] bg-[var(--panel)] p-2 text-[var(--text)] shadow-2xl backdrop-blur-2xl sm:absolute sm:inset-x-0 sm:top-full sm:mt-1.5"
        >
          {didYouMean && (
            <button
              type="button"
              onClick={() => {
                setQuery(didYouMean);
                submitFullSearch(didYouMean);
              }}
              className="mb-1 flex w-full items-center gap-2 border-b border-[var(--hair)] px-3 py-2 text-left text-xs text-[var(--gold)]"
            >
              <span>{locale === 'bn' ? 'এটা খুঁজছেন?' : 'Did you mean:'}</span>
              <span className="underline">{didYouMean}</span>
            </button>
          )}

          {!shouldTriggerAutocomplete(query) && (
            <div className="space-y-4 p-3">
              {recent.length > 0 && (
                <div>
                  <div className="flex items-center justify-between">
                    <span className="nostos-overline text-[var(--accent)]">
                      {locale === 'bn' ? 'সাম্প্রতিক অনুসন্ধান' : 'RECENT SEARCHES'}
                    </span>
                    <button
                      type="button"
                      onClick={clearRecentSearches}
                      className="text-xs text-[var(--gold)] hover:underline"
                    >
                      {locale === 'bn' ? 'মুছুন' : 'Clear'}
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {recent.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          setQuery(r);
                          submitFullSearch(r);
                        }}
                        className="border border-[var(--hair)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--text)] hover:border-[var(--gold-line)]"
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="nostos-overline text-[var(--accent)]">
                  {locale === 'bn' ? 'জনপ্রিয় অনুসন্ধান' : 'TRENDING SEARCHES'}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {trending.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setQuery(t);
                        submitFullSearch(t);
                      }}
                      className="border border-[var(--hair)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--text)] hover:border-[var(--gold-line)]"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Grouped Autocomplete Items with 40ms stagger & Cormorant italic English gloss */}
          {items.map((item, idx) => {
            const active = idx === activeIndex;
            const groupLabel =
              locale === 'bn' ? GROUP_LABELS_BN[item.group] ?? item.group : item.group;
            return (
              <div
                key={`${item.type}-${item.slugOrCode}-${idx}`}
                id={`${baseId}-opt-${idx}`}
                role="option"
                aria-selected={active}
                style={{ animationDelay: `${idx * 40}ms` }}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => navigateToSuggestion(item)}
                className={`nostos-editorial-row flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-left ${
                  active ? 'bg-[var(--surface-2)] text-[var(--gold)]' : ''
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <CategorySvgIcon icon={item.icon} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--text)]">
                      {renderHighlighted(item.text, item.matchRanges)}
                    </p>
                    {item.textAlt && (
                      <p className="nostos-editorial-italic truncate text-xs text-[var(--text-muted)]">
                        {item.textAlt}
                      </p>
                    )}
                  </div>
                </div>
                <span className="nostos-overline shrink-0 border border-[var(--hair)] px-2 py-0.5 text-[9px] text-[var(--accent)]">
                  {groupLabel}
                </span>
              </div>
            );
          })}

          {hasAskJonoRow && (
            <div
              id={`${baseId}-opt-${items.length}`}
              role="option"
              aria-selected={activeIndex === items.length}
              onMouseEnter={() => setActiveIndex(items.length)}
              onClick={askJonoWithQuery}
              className={`mt-1 flex cursor-pointer items-center justify-between border-t border-[var(--gold-line)] px-3 py-3 text-xs font-semibold ${
                activeIndex === items.length
                  ? 'bg-[var(--gold)] text-[#050709]'
                  : 'text-[var(--gold)] hover:bg-[var(--surface-2)]'
              }`}
            >
              <span>
                {locale === 'bn'
                  ? `জনো-কে জিজ্ঞাসা করুন: '${query.trim()}'`
                  : `Ask Jono Oracle: '${query.trim()}'`}
              </span>
              <span>→</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
