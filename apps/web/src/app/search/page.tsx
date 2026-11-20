'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDigits } from '@jonoshheba/shared';
import { FilmPlateBanner } from '../../components/NostosPrimitive';
import { SearchCombobox } from '../../components/SearchCombobox';
import { ErrorRetryCard, SkeletonGrid, TrustChip } from '../../components/UiStates';
import { apiGet } from '../../lib/api';
import { useLocale } from '../../lib/i18n';

interface SearchHit {
  id: string;
  type: string;
  slugOrCode: string;
  title: string;
  titleBn: string;
  titleEn: string;
  summary: string;
  url: string;
  trustLabel: string;
  attribution?: {
    sourceUrl?: string;
    agency?: string;
    lastVerifiedAt?: string;
  };
}

export default function SearchPage() {
  const { locale, dict, localePath } = useLocale();
  const [query, setQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [didYouMean, setDidYouMean] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q')?.trim() ?? '';
    setQuery(q);
  }, []);

  async function runSearch(qToSearch: string, typeFilter: string) {
    if (!qToSearch.trim()) {
      setHits([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ q: qToSearch.trim(), limit: '25' });
      if (typeFilter) qs.set('types', typeFilter);
      const res = await apiGet<{
        hits: SearchHit[];
        didYouMean: string | null;
      }>(`/api/v1/search?${qs.toString()}`, { locale });
      setHits(res.hits ?? []);
      setDidYouMean(res.didYouMean ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.states.errorHint);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (query.trim()) {
      void runSearch(query, selectedType);
    }
  }, [query, selectedType, locale]);

  const typeFilters = [
    { value: '', labelBn: 'সব ধরন', labelEn: 'All types' },
    { value: 'service', labelBn: 'সরকারি সেবা', labelEn: 'Services' },
    { value: 'life_event', labelBn: 'জীবনের ধাপ', labelEn: 'Life events' },
    { value: 'station', labelBn: 'ট্রেন ও স্টেশন', labelEn: 'Trains & Stations' },
    { value: 'bus_route', labelBn: 'বাস রুট', labelEn: 'Bus routes' },
    { value: 'hotline', labelBn: 'হটলাইন', labelEn: 'Hotlines' },
    { value: 'ministry', labelBn: 'মন্ত্রণালয় ও দপ্তর', labelEn: 'Ministries & Offices' },
    { value: 'institution', labelBn: 'শিক্ষা প্রতিষ্ঠান (EIIN/UGC)', labelEn: 'Institutions (EIIN/UGC)' },
    { value: 'notice', labelBn: 'নোটিশ', labelEn: 'Notices' },
  ];

  const popularFallback = [
    { slug: 'epassport-new', titleBn: 'নতুন ই-পাসপোর্ট আবেদন', titleEn: 'New e-Passport Application' },
    { slug: 'birth-registration-new', titleBn: 'নতুন জন্ম নিবন্ধন আবেদন', titleEn: 'New Birth Registration' },
    { slug: 'land-development-tax', titleBn: 'অনলাইন ভূমি উন্নয়ন কর (খাজনা)', titleEn: 'Online Land Development Tax (Khajna)' },
    { slug: 'nbr-etin-registration', titleBn: 'অনলাইন ই-টিন (e-TIN) নিবন্ধন', titleEn: 'Online e-TIN Registration' },
  ];

  return (
    <div>
      <FilmPlateBanner
        overline="UNIVERSAL SEARCH · SERVICES · TRAINS · MINISTRIES · EIIN"
        title={locale === 'bn' ? 'সর্বজনীন অনুসন্ধান ফলাফল' : 'Universal Search Results'}
        breadcrumb={[{ label: dict.nav.home, href: '/' }, { label: dict.nav.search }]}
      />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div>
          <SearchCombobox
            variant="page"
            initialQuery={query}
            onSelectQuery={(q) => setQuery(q)}
          />
        </div>

      {/* Type filter chips */}
      <div className="flex flex-wrap gap-2">
        {typeFilters.map((tf) => (
          <button
            key={tf.value}
            type="button"
            onClick={() => setSelectedType(tf.value)}
            className={`min-h-[38px] rounded-full px-3.5 text-xs font-bold transition ${
              selectedType === tf.value
                ? 'bg-emerald-700 text-white'
                : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
            }`}
          >
            {locale === 'bn' ? tf.labelBn : tf.labelEn}
          </button>
        ))}
      </div>

      {didYouMean && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <span>{locale === 'bn' ? 'এটা খুঁজছেন? ' : 'Did you mean: '}</span>
          <button
            type="button"
            onClick={() => setQuery(didYouMean)}
            className="font-extrabold underline"
          >
            {didYouMean}
          </button>
        </div>
      )}

      {error && <ErrorRetryCard message={error} onRetry={() => void runSearch(query, selectedType)} />}

      {loading ? (
        <SkeletonGrid count={6} />
      ) : query.trim() && hits.length === 0 ? (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-extrabold text-slate-900">
            {locale === 'bn'
              ? `'${query}'-এর জন্য কোনো সরাসরি ফলাফল পাওয়া যায়নি`
              : `No direct results found for '${query}'`}
          </h2>
          <p className="text-sm text-slate-600">
            {locale === 'bn'
              ? 'আপনার অনুসন্ধানটি আমাদের কনটেন্ট গ্যাপ তালিকায় যুক্ত হয়েছে। আপনি জনো এআই-কে সরাসরি প্রশ্ন করতে পারেন অথবা নিচের জনপ্রিয় সেবাসমূহ দেখতে পারেন:'
              : 'Your query has been logged as a content gap for editorial review. You can ask Jono AI directly or browse popular services below:'}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={localePath(`/jono?q=${encodeURIComponent(query)}`)}
              className="inline-flex min-h-[44px] items-center rounded-xl bg-emerald-700 px-5 text-sm font-extrabold text-white hover:bg-emerald-800"
            >
              {locale === 'bn' ? `জনো-কে জিজ্ঞাসা করুন: '${query}'` : `Ask Jono AI: '${query}'`} →
            </Link>
          </div>
          <div className="grid gap-3 pt-2 sm:grid-cols-2">
            {popularFallback.map((p) => (
              <Link
                key={p.slug}
                href={localePath(`/services/${p.slug}`)}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-bold text-emerald-900 hover:border-emerald-400"
              >
                {locale === 'bn' ? p.titleBn : p.titleEn} →
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <section aria-live="polite" className="space-y-3">
          {query.trim() && (
            <p className="text-xs font-bold text-slate-600">
              {locale === 'bn'
                ? `${formatDigits(hits.length, 'bn')}টি যাচাইকৃত ফলাফল পাওয়া গেছে`
                : `${hits.length} verified result(s) found`}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {hits.map((hit) => (
              <article
                key={`${hit.type}-${hit.id}`}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                      {hit.type}
                    </span>
                    <TrustChip
                      label={hit.trustLabel}
                      lastVerifiedAt={hit.attribution?.lastVerifiedAt}
                      locale={locale}
                    />
                  </div>
                  <h2 className="mt-2 text-base font-extrabold text-slate-900">
                    <Link
                      href={hit.url.startsWith('tel:') ? hit.url : localePath(hit.url)}
                      className="hover:text-emerald-800 hover:underline"
                    >
                      {locale === 'bn' ? hit.titleBn || hit.title : hit.titleEn || hit.title}
                    </Link>
                  </h2>
                  <p className="mt-1 text-xs text-slate-600">{hit.summary}</p>
                </div>
                {hit.attribution?.sourceUrl && (
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                    <span>{hit.attribution.agency}</span>
                    <a
                      href={hit.attribution.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-emerald-800 hover:underline"
                    >
                      {dict.trust.source} →
                    </a>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
      </div>
    </div>
  );
}
