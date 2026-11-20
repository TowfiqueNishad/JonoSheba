'use client';

import { useLocale } from '../../lib/i18n';

export default function OfflinePage() {
  const { locale, dict } = useLocale();
  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-12 text-center">
      <h1 className="text-2xl font-extrabold text-slate-900">
        {locale === 'bn' ? 'আপনি অফলাইনে আছেন' : 'You are currently offline'}
      </h1>
      <p className="text-sm text-slate-700">{dict.states.offlineNotice}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <a
          href="tel:999"
          className="nostos-emergency-999 inline-flex min-h-[48px] items-center rounded-full bg-[#B3261E] px-6 text-sm font-extrabold text-white"
        >
          {dict.emergency.call999}
        </a>
        <a
          href="tel:333"
          className="nostos-btn-gold min-h-[48px] px-6"
        >
          {dict.emergency.call333}
        </a>
        <a
          href="/lite"
          className="inline-flex min-h-[48px] items-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-900"
        >
          {dict.nav.lite}
        </a>
      </div>
    </div>
  );
}
