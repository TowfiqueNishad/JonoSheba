'use client';

import { useEffect, useState } from 'react';
import { formatDhakaDate } from '@jonoshheba/shared';
import { FilmPlateBanner } from '../../components/NostosPrimitive';
import { EmptyStateCard, ErrorRetryCard, SkeletonGrid, TrustChip } from '../../components/UiStates';
import { apiGet } from '../../lib/api';
import { useLocale } from '../../lib/i18n';

interface JobItem {
  slug: string;
  titleBn: string;
  titleEn: string;
  organizationEn?: string;
  grade?: string;
  deadlineAt?: string | null;
  officialUrl: string;
  trustLabel: string;
  lastVerifiedAt?: string | null;
}

export default function JobsPage() {
  const { locale, dict } = useLocale();
  const [items, setItems] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ items: JobItem[] }>('/api/v1/jobs', { locale })
      .then((res) => setItems(res.items ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : dict.states.errorHint))
      .finally(() => setLoading(false));
  }, [locale, dict.states.errorHint]);

  return (
    <div>
      <FilmPlateBanner
        overline="II — THE HARBOURS · PUBLIC RECRUITMENT"
        title={dict.nav.jobs}
        subtitle={
          locale === 'bn'
            ? 'সরকারি ও স্বায়ত্তশাসিত প্রতিষ্ঠানের যাচাইকৃত নিয়োগ বিজ্ঞপ্তি — সরাসরি অফিসিয়াল পোর্টালে আবেদন করুন।'
            : 'Verified public-sector recruitment circulars — apply directly on the official portal.'
        }
        breadcrumb={[{ label: dict.nav.home, href: '/' }, { label: dict.nav.jobs }]}
      />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      {error && <ErrorRetryCard message={error} />}
      {loading ? (
        <SkeletonGrid count={4} />
      ) : items.length === 0 ? (
        <EmptyStateCard />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((job) => (
            <article key={job.slug} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <TrustChip label={job.trustLabel} lastVerifiedAt={job.lastVerifiedAt} locale={locale} />
              <h2 className="mt-2 text-base font-extrabold text-slate-900">
                {locale === 'bn' ? job.titleBn : job.titleEn}
              </h2>
              {job.organizationEn && <p className="mt-1 text-xs text-slate-700">{job.organizationEn}</p>}
              <p className="mt-1 text-xs font-semibold text-amber-900">
                {locale === 'bn' ? 'আবেদনের শেষ তারিখ:' : 'Application deadline:'}{' '}
                {job.deadlineAt
                  ? formatDhakaDate(job.deadlineAt, locale)
                  : locale === 'bn'
                    ? 'ঘোষণা অনুযায়ী'
                    : 'As announced'}
              </p>
              <a
                href={job.officialUrl}
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
