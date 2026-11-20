'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDhakaTime, formatDigits, getSeatClassLabel } from '@jonoshheba/shared';
import { ErrorRetryCard, SkeletonGrid, TrustChip } from '../../../../components/UiStates';
import { apiGet } from '../../../../lib/api';
import { useLocale } from '../../../../lib/i18n';

interface TrainStop {
  stationCode: string;
  sequence: number;
  arrival: string | null;
  departure: string | null;
  dayOffset: number;
  km: number;
}

interface TrainDetailResponse {
  train: {
    number: string;
    nameBn: string;
    nameEn: string;
    type: string;
    zone: string;
    offDays: string[];
    classes: string[];
    lastVerifiedAt: string;
    stops: TrainStop[];
  };
  timetableVersion: {
    version: string;
    effectiveFrom: string;
    sourceUrl: string;
  };
  officialChannels: {
    officialWebUrl: string;
    hotline: string;
    fraudWarningBn: string;
    fraudWarningEn: string;
  };
}

export default function TrainDetailPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = use(params);
  const { locale, dict, localePath } = useLocale();
  const [data, setData] = useState<TrainDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadTrain() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<TrainDetailResponse>(
        `/api/v1/rail/trains/${encodeURIComponent(number)}`,
        { locale },
      );
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.states.errorHint);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTrain();
  }, [number, locale]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <SkeletonGrid count={3} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <ErrorRetryCard message={error ?? dict.states.errorHint} onRetry={() => void loadTrain()} />
      </div>
    );
  }

  const { train, timetableVersion, officialChannels } = data;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={localePath('/transport')}
          className="text-xs font-extrabold text-emerald-800 hover:underline"
        >
          ← {locale === 'bn' ? 'পরিবহন হাবে ফিরে যান' : 'Back to Transport Hub'}
        </Link>
        <TrustChip label="OFFICIAL_SOURCE" lastVerifiedAt={train.lastVerifiedAt} locale={locale} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-900">
              {locale === 'bn'
                ? `ট্রেন নং ${formatDigits(train.number, 'bn')}`
                : `Train #${train.number}`}
            </span>
            <h1 className="mt-2 text-2xl font-extrabold text-slate-900">
              {locale === 'bn' ? train.nameBn : train.nameEn}
            </h1>
            <p className="mt-1 text-xs text-slate-600">
              {locale === 'bn'
                ? `সাপ্তাহিক বন্ধ: ${train.offDays.length > 0 ? train.offDays.join(', ') : 'প্রতিদিন চলে'} · সময়সূচি সংস্করণ: ${timetableVersion.version}`
                : `Weekly off-day: ${train.offDays.length > 0 ? train.offDays.join(', ') : 'Runs daily'} · Timetable: ${timetableVersion.version}`}
            </p>
          </div>
          <a
            href={officialChannels.officialWebUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center rounded-xl bg-emerald-700 px-5 text-xs font-extrabold text-white hover:bg-emerald-800"
          >
            {dict.transport.continueOfficial} →
          </a>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {train.classes.map((cls) => (
            <span
              key={cls}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-800"
            >
              {getSeatClassLabel(cls, locale)}
            </span>
          ))}
          <span className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-950">
            {dict.transport.seatInfoUnknown}
          </span>
        </div>
      </section>

      {/* Complete Stop Sequence */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-extrabold text-slate-900">
          {locale === 'bn'
            ? `যাত্রাপথের বিরতি ও সময়সূচি (${formatDigits(train.stops.length, 'bn')}টি স্টেশন)`
            : `Full Stop Sequence & Schedule (${train.stops.length} stations)`}
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-extrabold text-slate-800">
                <th className="p-3">#</th>
                <th className="p-3">{locale === 'bn' ? 'স্টেশন কোড' : 'Station Code'}</th>
                <th className="p-3">{locale === 'bn' ? 'পৌঁছানোর সময়' : 'Arrival'}</th>
                <th className="p-3">{locale === 'bn' ? 'ছাড়ার সময়' : 'Departure'}</th>
                <th className="p-3">{locale === 'bn' ? 'দূরত্ব (কিমি)' : 'Distance (km)'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {train.stops.map((st) => (
                <tr key={st.sequence}>
                  <td className="p-3 font-bold text-slate-600">
                    {formatDigits(st.sequence, locale)}
                  </td>
                  <td className="p-3 font-extrabold text-emerald-900">{st.stationCode}</td>
                  <td className="p-3 text-slate-800">
                    {st.arrival ? formatDhakaTime(st.arrival, locale) : '—'}
                    {st.dayOffset > 0 && (
                      <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-950">
                        {locale === 'bn' ? `+${formatDigits(st.dayOffset, 'bn')} দিন` : `+${st.dayOffset} day`}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-slate-800">
                    {st.departure ? formatDhakaTime(st.departure, locale) : '—'}
                  </td>
                  <td className="p-3 text-slate-600">{formatDigits(st.km, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs font-semibold text-amber-950">
        {locale === 'bn' ? officialChannels.fraudWarningBn : officialChannels.fraudWarningEn}
      </div>
    </div>
  );
}
