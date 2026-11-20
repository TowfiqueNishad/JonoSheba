'use client';

import Link from 'next/link';
import { useLocale } from '../lib/i18n';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { dict, localePath } = useLocale();
  return (
    <div className="mx-auto max-w-xl space-y-5 px-4 py-16 text-center">
      <p className="nostos-overline text-[#E57368]">500 · SYSTEM INTERRUPTION</p>
      <h1 className="nostos-display-h2 text-2xl text-[var(--text)]">
        {dict.states.serverErrorTitle}
      </h1>
      <p className="nostos-editorial-italic text-lg text-[var(--text-muted)]">
        {dict.states.errorHint}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="nostos-btn-gold">
          {dict.states.retry}
        </button>
        <Link
          href={localePath('/')}
          className="inline-flex min-h-[44px] items-center border border-[var(--hair)] px-5 text-xs font-semibold text-[var(--text)]"
        >
          {dict.states.backHome}
        </Link>
        <a
          href="tel:999"
          className="nostos-emergency-999 inline-flex min-h-[44px] items-center rounded-full bg-[#B3261E] px-5 text-xs font-bold text-white"
        >
          {dict.emergency.pill999}
        </a>
      </div>
    </div>
  );
}
