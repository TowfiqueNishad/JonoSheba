'use client';

import { useEffect, useState } from 'react';
import { formatDhakaDate } from '@jonoshheba/shared';
import { FilmPlateBanner } from '../../components/NostosPrimitive';
import { EmptyStateCard, ErrorRetryCard, SkeletonGrid, TrustChip } from '../../components/UiStates';
import { apiGet } from '../../lib/api';
import { useLocale } from '../../lib/i18n';

interface ScholarshipItem {
  slug: string;
  titleBn: string;
  titleEn: string;
  summaryBn?: string;
  summaryEn?: string;
  organizationEn?: string;
  deadlineAt?: string | null;
  officialUrl: string;
  trustLabel: string;
  lastVerifiedAt?: string | null;
}

export default function ScholarshipsPage() {
  const { locale, dict } = useLocale();
  const [items, setItems] = useState<ScholarshipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ items: ScholarshipItem[] }>('/api/v1/scholarships', { locale })
      .then((res) => setItems(res.items ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : dict.states.errorHint))
      .finally(() => setLoading(false));
  }, [locale, dict.states.errorHint]);

  return (
    <div>
      <FilmPlateBanner
        overline="II — THE HARBOURS · STIPENDS & GRANTS"
        title={dict.nav.scholarships}
        subtitle={
          locale === 'bn'
            ? 'যাচাইকৃত সরকারি উপবৃত্তি ও শিক্ষাবৃত্তির তথ্য ও অফিসিয়াল আবেদন লিংক।'
            : 'Verified government stipends and scholarships with official application portals.'
        }
        breadcrumb={[{ label: dict.nav.home, href: '/' }, { label: dict.nav.scholarships }]}
      />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      {error && <ErrorRetryCard message={error} />}
      {loading ? (
        <SkeletonGrid count={4} />
      ) : items.length === 0 ? (
        <EmptyStateCard />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <article key={item.slug} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <TrustChip label={item.trustLabel} lastVerifiedAt={item.lastVerifiedAt} locale={locale} />
              <h2 className="mt-2 text-base font-extrabold text-slate-900">
                {locale === 'bn' ? item.titleBn : item.titleEn}
              </h2>
              {item.organizationEn && <p className="mt-1 text-xs text-slate-700">{item.organizationEn}</p>}
              <p className="mt-1 text-xs font-semibold text-amber-900">
                {locale === 'bn' ? 'শেষ তারিখ:' : 'Deadline:'}{' '}
                {item.deadlineAt
                  ? formatDhakaDate(item.deadlineAt, locale)
                  : locale === 'bn'
                    ? 'ঘোষণা অনুযায়ী'
                    : 'As announced'}
              </p>
              <a
                href={item.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex min-h-[40px] items-center rounded-xl bg-emerald-700 px-4 text-xs font-bold text-white"
              >
                {dict.services.officialPortal} →
              </a>
            </article>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
