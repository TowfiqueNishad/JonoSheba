'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { SkeletonGrid } from '../../../components/UiStates';
import { apiGet } from '../../../lib/api';
import { useLocale } from '../../../lib/i18n';

interface LifeEventDetail {
  slug: string;
  titleBn: string;
  titleEn: string;
  summary?: string;
  steps?: Array<{
    stepOrder: number;
    title: string;
    notes?: string;
    service?: { slug: string; title: string; officialUrl: string } | null;
  }>;
}

export default function LifeEventDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const { locale, dict, localePath } = useLocale();
  const [detail, setDetail] = useState<LifeEventDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    apiGet<LifeEventDetail>(`/api/v1/life-events/${encodeURIComponent(slug)}`, { locale })
      .then(setDetail)
      .catch(async () => {
        const bundles = await apiGet<{ items: Array<{ slug: string; titleBn: string; titleEn: string }> }>(
          '/api/v1/services/life-event-bundles',
          { locale },
        );
        const match = bundles.items.find((b) => b.slug === slug);
        setDetail(match ? { ...match, steps: [] } : null);
      })
      .finally(() => setLoading(false));
  }, [slug, locale]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <SkeletonGrid count={2} />
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 text-sm">
        <p className="font-bold">{dict.states.notFoundTitle}</p>
        <Link href={localePath('/life-events')} className="mt-2 inline-block text-emerald-800 underline">
          ← {dict.nav.lifeEvents}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <Link href={localePath('/life-events')} className="text-xs font-bold text-emerald-800 hover:underline">
        ← {dict.nav.lifeEvents}
      </Link>
      <h1 className="text-2xl font-extrabold text-slate-900">
        {locale === 'bn' ? detail.titleBn : detail.titleEn}
      </h1>
      {detail.summary && <p className="text-sm text-slate-700">{detail.summary}</p>}

      {detail.steps && detail.steps.length > 0 ? (
        <ol className="space-y-3">
          {detail.steps.map((st) => (
            <li key={st.stepOrder} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="font-extrabold text-slate-900">
                {st.stepOrder}. {st.title}
              </p>
              {st.notes && <p className="mt-1 text-xs text-slate-700">{st.notes}</p>}
              {st.service && (
                <div className="mt-2 flex gap-3 text-xs">
                  <Link href={localePath(`/services/${st.service.slug}`)} className="font-bold text-emerald-800 underline">
                    {dict.services.viewDetails} →
                  </Link>
                  <a href={st.service.officialUrl} target="_blank" rel="noopener noreferrer" className="text-slate-700 underline">
                    {dict.services.officialPortal}
                  </a>
                </div>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
          <p className="text-emerald-950">
            {locale === 'bn'
              ? 'এই জীবনের ধাপের সাথে সম্পর্কিত সকল সরকারি সেবা ডিরেক্টরি থেকে দেখুন বা জনো-কে জিজ্ঞাসা করুন।'
              : 'Explore related government services in the directory or ask Jono for a personalized checklist.'}
          </p>
          <div className="mt-3 flex gap-3">
            <Link href={localePath('/services')} className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white">
              {dict.nav.services}
            </Link>
            <Link href={localePath('/jono')} className="rounded-xl border border-emerald-700 px-4 py-2 text-xs font-bold text-emerald-900">
              {dict.nav.jono}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
