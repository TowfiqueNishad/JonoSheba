'use client';

import Link from 'next/link';
import { FilmPlateBanner } from '../components/NostosPrimitive';
import { useLocale } from '../lib/i18n';

export default function NotFound() {
  const { locale, dict, localePath } = useLocale();
  return (
    <div>
      <FilmPlateBanner
        overline="404 · LOST AT SEA"
        title="পথ হারিয়েছেন? ফিরে চলুন শুরুতে · LOST AT SEA"
        subtitle={dict.states.notFoundDesc}
        breadcrumb={[{ label: dict.nav.home, href: '/' }, { label: '404' }]}
      />
      <div className="mx-auto max-w-xl space-y-6 px-4 py-16 text-center">
        <p className="nostos-editorial-italic text-xl text-[var(--text-muted)]">
          {locale === 'bn'
            ? 'যে পাতাটি খুঁজছেন তা এই বন্দরে নেই। শুরুতে ফিরে যান অথবা জরুরি প্রয়োজনে ৯৯৯-এ কল করুন।'
            : 'The harbour you seek could not be found. Return to the origin or dial 999 for immediate emergency assistance.'}
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link href={localePath('/')} className="nostos-btn-gold">
            {dict.states.backHome}
          </Link>
          <Link
            href={localePath('/services')}
            className="inline-flex min-h-[44px] items-center border border-[var(--hair)] px-5 font-overline text-[11px] uppercase tracking-[0.24em] text-[var(--text)] hover:border-[var(--gold-line)]"
          >
            {dict.nav.services}
          </Link>
          <a
            href="tel:999"
            className="nostos-emergency-999 inline-flex min-h-[44px] items-center rounded-full bg-[#B3261E] px-5 text-xs font-bold text-white"
          >
            {dict.emergency.pill999}
          </a>
        </div>
      </div>
    </div>
  );
}
