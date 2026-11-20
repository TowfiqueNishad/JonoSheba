'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { formatBdt, formatDhakaDate } from '@jonoshheba/shared';
import { ErrorRetryCard, SkeletonGrid, TrustChip } from '../../../components/UiStates';
import { apiGet } from '../../../lib/api';
import { useLocale } from '../../../lib/i18n';

interface ProgrammeDetail {
  slug: string;
  nameBn: string;
  nameEn: string;
  agency: string;
  monthlyAmountBdt: number;
  effectiveFrom: string;
  sourceUrl: string;
  lastVerifiedAt: string;
  paymentChannel: string;
  negativeListCategories: string[];
}

export default function ProgrammeDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const { locale, dict, localePath } = useLocale();
  const [prog, setProg] = useState<ProgrammeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    apiGet<ProgrammeDetail>(`/api/v1/programmes/${encodeURIComponent(slug)}`, { locale })
      .then(setProg)
      .catch((err) => setError(err instanceof Error ? err.message : dict.states.notFoundTitle))
      .finally(() => setLoading(false));
  }, [slug, locale, dict.states.notFoundTitle]);

  if (loading) return <div className="mx-auto max-w-4xl px-4 py-8"><SkeletonGrid count={2} /></div>;
  if (error || !prog) return <div className="mx-auto max-w-4xl px-4 py-8"><ErrorRetryCard message={error ?? undefined} /></div>;

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <Link href={localePath('/benefits')} className="text-xs font-bold text-emerald-800 hover:underline">
        ← {dict.nav.benefits}
      </Link>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <TrustChip label="OFFICIAL_SOURCE" lastVerifiedAt={prog.lastVerifiedAt} locale={locale} />
        <h1 className="mt-2 text-2xl font-extrabold text-slate-900">
          {locale === 'bn' ? prog.nameBn : prog.nameEn}
        </h1>
        <p className="mt-1 text-sm text-slate-700">{prog.agency}</p>
        <p className="mt-3 text-lg font-extrabold text-emerald-800">
          {dict.benefits.monthlyAmount}: {formatBdt(prog.monthlyAmountBdt, locale)}
        </p>
        <p className="mt-1 text-xs text-slate-600">
          {dict.benefits.effectiveFrom}: {formatDhakaDate(prog.effectiveFrom, locale)} · {prog.paymentChannel}
        </p>
        {prog.negativeListCategories.length > 0 && (
          <div className="mt-4">
            <h2 className="text-sm font-extrabold text-slate-900">
              {locale === 'bn' ? 'অযোগ্যতার শর্তাবলি (নেগেটিভ লিস্ট)' : 'Exclusion Criteria (Negative List)'}
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-700">
              {prog.negativeListCategories.map((c) => (
                <li key={c}>{c.replace(/_/g, ' ')}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href={prog.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center rounded-xl bg-emerald-700 px-5 text-xs font-extrabold text-white"
          >
            {dict.services.officialPortal} →
          </a>
          <Link
            href={localePath('/benefits')}
            className="inline-flex min-h-[44px] items-center rounded-xl border border-emerald-700 px-4 text-xs font-bold text-emerald-900"
          >
            {dict.benefits.checkButton}
          </Link>
        </div>
      </div>
    </div>
  );
}
