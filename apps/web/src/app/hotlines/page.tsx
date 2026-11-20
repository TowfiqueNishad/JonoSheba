'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatDigits } from '@jonoshheba/shared';
import { FilmPlateBanner } from '../../components/NostosPrimitive';
import { EmptyStateCard, ErrorRetryCard, SkeletonGrid, TrustChip } from '../../components/UiStates';
import { apiGet } from '../../lib/api';
import { useLocale } from '../../lib/i18n';

interface HotlineRecord {
  number: string;
  telUri: string;
  category: string;
  nameBn: string;
  nameEn: string;
  agency: string;
  hours: string;
  tollFree: boolean;
  sourceUrl: string;
  lastVerifiedAt: string;
  verificationStatus: 'verified' | 'needs_verification';
}

export default function HotlinesDirectoryPage() {
  const { locale, dict } = useLocale();
  const [items, setItems] = useState<HotlineRecord[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [orgFilter, setOrgFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadHotlines() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<{ items: HotlineRecord[] }>('/api/v1/hotlines', { locale });
      setItems(res.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.states.errorHint);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHotlines();
  }, [locale]);

  const categories = useMemo(() => {
    return [...new Set(items.map((i) => i.category))];
  }, [items]);

  const agencies = useMemo(() => {
    return [...new Set(items.map((i) => i.agency))];
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((h) => {
      if (categoryFilter && h.category !== categoryFilter) return false;
      if (orgFilter && h.agency !== orgFilter) return false;
      if (!q) return true;
      return (
        h.number.includes(q) ||
        h.nameBn.includes(search.trim()) ||
        h.nameEn.toLowerCase().includes(q) ||
        h.agency.toLowerCase().includes(q)
      );
    });
  }, [items, categoryFilter, orgFilter, search]);

  return (
    <div>
      <FilmPlateBanner
        overline="NATIONAL HELPLINES · DIRECT TAP-TO-CALL"
        title={
          locale === 'bn'
            ? 'জাতীয় ও সরকারি হটলাইন ডিরেক্টরি'
            : 'National & Government Hotline Directory'
        }
        subtitle={dict.emergency.noDispatchNotice}
        breadcrumb={[{ label: dict.nav.home, href: '/' }, { label: locale === 'bn' ? 'হটলাইন' : 'Hotlines' }]}
        actions={
          <a
            href="tel:999"
            className="nostos-emergency-999 inline-flex min-h-[48px] items-center rounded-full bg-[#B3261E] px-5 text-sm font-extrabold text-white"
          >
            {dict.emergency.call999}
          </a>
        }
      />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">

      {/* Filters by Topic (category), Organisation (agency), and Search */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="hotline-search" className="sr-only">
            {locale === 'bn' ? 'হটলাইন খুঁজুন' : 'Search hotlines'}
          </label>
          <input
            id="hotline-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              locale === 'bn'
                ? 'নম্বর বা সেবার নাম লিখুন (যেমন: ৯৯৯, ৩৩৩, ১৬১২২)...'
                : 'Search number or topic (e.g., 999, 333, 16122)...'
            }
            className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-4 text-sm"
          />
        </div>
        <div>
          <label htmlFor="hotline-category-select" className="sr-only">
            {locale === 'bn' ? 'বিষয় অনুযায়ী ফিল্টার' : 'Filter by topic'}
          </label>
          <select
            id="hotline-category-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="">{locale === 'bn' ? 'সকল বিষয় (Topic)' : 'All Topics'}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="hotline-org-select" className="sr-only">
            {locale === 'bn' ? 'সংস্থা অনুযায়ী ফিল্টার' : 'Filter by organisation'}
          </label>
          <select
            id="hotline-org-select"
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="">{locale === 'bn' ? 'সকল দপ্তর / সংস্থা' : 'All Organisations'}</option>
            {agencies.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <ErrorRetryCard message={error} onRetry={() => void loadHotlines()} />}

      {loading ? (
        <SkeletonGrid count={6} />
      ) : filtered.length === 0 ? (
        <EmptyStateCard />
      ) : (
        <section aria-live="polite" className="space-y-3">
          <p className="text-xs font-bold text-slate-600">
            {locale === 'bn'
              ? `${formatDigits(filtered.length, 'bn')}টি হটলাইন দেখানো হচ্ছে`
              : `Showing ${filtered.length} hotlines`}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((h) => (
              <article
                key={h.number}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xl font-extrabold text-red-700">{h.number}</span>
                    <TrustChip
                      label="OFFICIAL_SOURCE"
                      lastVerifiedAt={h.lastVerifiedAt}
                      pending={h.verificationStatus === 'needs_verification'}
                      locale={locale}
                    />
                  </div>
                  <h2 className="mt-2 text-sm font-bold text-slate-900">
                    {locale === 'bn' ? h.nameBn : h.nameEn}
                  </h2>
                  <p className="mt-1 text-xs text-slate-600">
                    {h.agency} · {h.hours}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                  <a
                    href={h.telUri}
                    className="inline-flex min-h-[40px] items-center rounded-lg bg-emerald-700 px-3 text-xs font-extrabold text-white hover:bg-emerald-800"
                  >
                    {dict.emergency.tapToCall}
                  </a>
                  <a
                    href={h.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-slate-700 underline"
                  >
                    {dict.trust.source}
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      </div>
    </div>
  );
}
