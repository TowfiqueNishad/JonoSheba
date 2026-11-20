'use client';

import { useEffect, useState } from 'react';
import { interpolate } from '@jonoshheba/shared';
import { ErrorRetryCard, SkeletonGrid, TrustChip } from '../../components/UiStates';
import { apiGet } from '../../lib/api';
import { useLocale } from '../../lib/i18n';

interface HotlineItem {
  number: string;
  telUri: string;
  category: string;
  nameBn: string;
  nameEn: string;
  agency: string;
  hours: string;
  tollFree: boolean;
  sourceUrl: string;
  lastVerifiedAt: string;
  verificationStatus?: 'verified' | 'needs_verification';
}

/**
 * SAFETY RULE: Emergency page has NO film plate and NO grain overlay.
 * Minimal, ultra-fast, high-contrast layout with solid #B3261E 999 button first.
 */
export default function EmergencyPage() {
  const { locale, dict } = useLocale();
  const [hotlines, setHotlines] = useState<HotlineItem[]>([]);
  const [verifiedCount, setVerifiedCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [situation, setSituation] = useState('');
  const [decision, setDecision] = useState<{
    reasonBn: string;
    reasonEn: string;
    recommendedHotlines: HotlineItem[];
  } | null>(null);

  async function loadHotlines() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<{
        count: number;
        verifiedCount: number;
        items: HotlineItem[];
      }>('/api/v1/hotlines', { locale });
      setHotlines(res.items ?? []);
      setVerifiedCount(res.verifiedCount ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.states.errorHint);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHotlines();
  }, [locale]);

  async function decide(e: React.FormEvent) {
    e.preventDefault();
    if (!situation.trim()) return;
    try {
      const res = await apiGet<{
        reasonBn: string;
        reasonEn: string;
        recommendedHotlines: HotlineItem[];
      }>(`/api/v1/hotlines/decide?situation=${encodeURIComponent(situation.trim())}`, { locale });
      setDecision(res);
    } catch {
      setDecision(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      {/* Immediate Tap-to-Call Emergency Cards (Solid #B3261E) */}
      <section className="border-2 border-[#B3261E] bg-[var(--surface)] p-6">
        <p className="nostos-overline text-[#E57368]">IMMEDIATE EMERGENCY RESPONSE · 24/7</p>
        <h1 className="nostos-display-h2 mt-2 text-2xl text-[var(--text)]">
          {dict.emergency.pageTitle}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{dict.emergency.noDispatchNotice}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href="tel:999"
            className="nostos-emergency-999 inline-flex min-h-[48px] items-center rounded-full bg-[#B3261E] px-6 text-sm font-bold text-white"
          >
            {dict.emergency.call999}
          </a>
          <a
            href="tel:16263"
            className="nostos-btn-gold min-h-[48px] px-5"
          >
            {dict.emergency.call16263}
          </a>
          <a
            href="tel:333"
            className="inline-flex min-h-[48px] items-center border border-[var(--hair)] px-5 text-sm font-semibold text-[var(--text)] hover:border-[var(--gold-line)]"
          >
            {dict.emergency.call333}
          </a>
        </div>
      </section>

      {/* Deterministic Situation Helper */}
      <section className="border border-[var(--hair)] bg-[var(--surface)] p-6">
        <h2 className="text-lg font-semibold text-[var(--text)]">{dict.emergency.helperTitle}</h2>
        <form onSubmit={(e) => void decide(e)} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="hotline-situation-input" className="sr-only">
            {dict.emergency.helperTitle}
          </label>
          <input
            id="hotline-situation-input"
            type="text"
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder={dict.emergency.helperPlaceholder}
            className="min-h-[44px] flex-1 border border-[var(--hair)] bg-[var(--field)] px-4 text-sm text-[var(--text)]"
          />
          <button
            type="submit"
            disabled={!situation.trim()}
            className="nostos-btn-gold min-h-[44px] px-5 disabled:opacity-50"
          >
            {dict.emergency.helperButton}
          </button>
        </form>

        {decision && (
          <div
            aria-live="polite"
            className="mt-4 border-l-2 border-[var(--gold)] bg-[var(--surface-2)] p-4"
          >
            <p className="text-sm font-semibold text-[var(--text)]">
              {locale === 'bn' ? decision.reasonBn : decision.reasonEn}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {decision.recommendedHotlines.map((h) => (
                <a
                  key={h.number}
                  href={h.telUri}
                  className="nostos-emergency-999 inline-flex min-h-[44px] items-center rounded-full bg-[#B3261E] px-4 text-xs font-bold text-white"
                >
                  {h.number} — {locale === 'bn' ? h.nameBn : h.nameEn}
                </a>
              ))}
            </div>
          </div>
        )}
      </section>

      {error && <ErrorRetryCard message={error} onRetry={() => void loadHotlines()} />}

      {/* Complete Hotline Directory */}
      <section className="space-y-4">
        {!loading && verifiedCount !== null && (
          <h2 className="text-lg font-semibold text-[var(--text)]">
            {interpolate(
              dict.emergency.hotlinesSummary,
              { total: hotlines.length, verified: verifiedCount },
              locale,
            )}
          </h2>
        )}
        {loading ? (
          <SkeletonGrid count={6} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {hotlines.map((h) => (
              <article
                key={h.number}
                className="flex flex-col justify-between border border-[var(--hair)] bg-[var(--surface)] p-5"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-2xl font-bold text-[var(--gold)]">{h.number}</span>
                    <TrustChip
                      label="OFFICIAL_SOURCE"
                      lastVerifiedAt={h.lastVerifiedAt}
                      pending={h.verificationStatus === 'needs_verification'}
                      locale={locale}
                    />
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-[var(--text)]">
                    {locale === 'bn' ? h.nameBn : h.nameEn}
                  </h3>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {h.agency} · {h.hours}
                  </p>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-[var(--hair)] pt-3">
                  <a href={h.telUri} className="nostos-btn-gold min-h-[40px] px-3">
                    {dict.emergency.tapToCall}
                  </a>
                  <a
                    href={h.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nostos-link text-xs text-[var(--text-muted)]"
                  >
                    {dict.trust.source}
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
