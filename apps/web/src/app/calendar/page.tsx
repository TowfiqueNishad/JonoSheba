'use client';

import { useEffect, useState } from 'react';
import { formatDhakaDate } from '@jonoshheba/shared';
import { FilmPlateBanner } from '../../components/NostosPrimitive';
import { ErrorRetryCard, SkeletonGrid } from '../../components/UiStates';
import { apiGet } from '../../lib/api';
import { useLocale } from '../../lib/i18n';

interface CalendarEvent {
  id: string;
  type: string;
  titleBn: string;
  titleEn: string;
  date: string;
  provisional: boolean;
  agency: string;
  officialUrl: string;
}

export default function CalendarPage() {
  const { locale, dict } = useLocale();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ items: CalendarEvent[] }>('/api/v1/calendar', { locale })
      .then((res) => setEvents(res.items ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : dict.states.errorHint))
      .finally(() => setLoading(false));
  }, [locale, dict.states.errorHint]);

  return (
    <div>
      <FilmPlateBanner
        overline="NATIONAL CALENDAR · HOLIDAYS & DEADLINES"
        title={dict.nav.calendar}
        subtitle={
          locale === 'bn'
            ? 'সরকারি ছুটি, আয়কর ই-রিটার্ন সময়সীমা এবং ঈদ অগ্রিম টিকিট ক্যালেন্ডার (Asia/Dhaka)।'
            : 'Bangladesh public holidays, income tax deadlines, and Eid advance ticket windows (Asia/Dhaka).'
        }
        breadcrumb={[{ label: dict.nav.home, href: '/' }, { label: dict.nav.calendar }]}
        actions={
          <a
            href="/api/v1/calendar.ics"
            className="nostos-btn-gold"
          >
            {dict.benefits.downloadCalendar}
          </a>
        }
      />
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">

      {error && <ErrorRetryCard message={error} />}
      {loading ? (
        <SkeletonGrid count={4} />
      ) : (
        <div className="space-y-3">
          {events.map((ev) => (
            <article key={ev.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <p className="text-xs font-bold text-emerald-800">
                  {formatDhakaDate(ev.date, locale)}
                  {ev.provisional ? (locale === 'bn' ? ' · সম্ভাব্য' : ' · Provisional') : ''}
                </p>
                <h2 className="mt-1 text-base font-extrabold text-slate-900">
                  {locale === 'bn' ? ev.titleBn : ev.titleEn}
                </h2>
                <p className="text-xs text-slate-700">{ev.agency}</p>
              </div>
              <a
                href={ev.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-emerald-800 underline"
              >
                {dict.trust.source} →
              </a>
            </article>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
