'use client';

import { useEffect, useState } from 'react';
import { ErrorRetryCard, SkeletonGrid } from '../../components/UiStates';
import { FilmPlateBanner } from '../../components/NostosPrimitive';
import { apiGet, apiPost } from '../../lib/api';
import { useLocale } from '../../lib/i18n';

interface HealthGuidanceRes {
  isEmergencyRedFlag: boolean;
  messageBn?: string;
  messageEn?: string;
  guidance?: string;
  hotlines?: Array<{ number: string; label?: string }>;
}

interface FacilityItem {
  id: string;
  name: string;
  nameBn?: string;
  nameEn?: string;
  facilityType: string;
  address?: string;
  phone?: string;
}

export default function HealthPage() {
  const { locale, dict } = useLocale();
  const [query, setQuery] = useState('');
  const [guidance, setGuidance] = useState<HealthGuidanceRes | null>(null);
  const [checking, setChecking] = useState(false);

  const [facilities, setFacilities] = useState<FacilityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiGet<{ items: FacilityItem[] }>('/api/v1/facilities?type=hospital', { locale })
      .then((res) => setFacilities(res.items ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : dict.states.errorHint))
      .finally(() => setLoading(false));
  }, [locale, dict.states.errorHint]);

  async function checkGuidance(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setChecking(true);
    try {
      const res = await apiPost<HealthGuidanceRes>(
        '/api/v1/health/guidance',
        { query: query.trim() },
        { locale },
      );
      setGuidance(res);
    } catch {
      setGuidance(null);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div>
      <FilmPlateBanner
        overline="PUBLIC HEALTH · HOSPITALS & 16263 SHASTHYO BATAYON"
        title={dict.health.title}
        subtitle={dict.health.subtitle}
        breadcrumb={[{ label: dict.nav.home, href: '/' }, { label: dict.nav.health }]}
        actions={
          <div className="flex flex-wrap gap-3">
            <a
              href="tel:999"
              className="nostos-emergency-999 inline-flex min-h-[44px] items-center rounded-full bg-[#B3261E] px-4 text-xs font-extrabold text-white"
            >
              {dict.emergency.call999}
            </a>
            <a
              href="tel:16263"
              className="nostos-btn-gold"
            >
              {dict.emergency.call16263}
            </a>
          </div>
        }
      />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">

      {/* Rule-Based Red-Flag Check */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-extrabold text-slate-900">{dict.health.redFlagTitle}</h2>
        <form onSubmit={(e) => void checkGuidance(e)} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="health-guidance-input" className="sr-only">
            {dict.health.redFlagTitle}
          </label>
          <input
            id="health-guidance-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={dict.health.redFlagPlaceholder}
            className="min-h-[44px] flex-1 rounded-xl border border-slate-300 px-4 text-sm"
          />
          <button
            type="submit"
            disabled={checking || !query.trim()}
            className="min-h-[44px] rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white disabled:opacity-50"
          >
            {checking ? dict.states.loading : dict.health.checkGuidance}
          </button>
        </form>

        {guidance && (
          <div
            aria-live="polite"
            className={`mt-4 rounded-xl border p-4 text-sm ${
              guidance.isEmergencyRedFlag
                ? 'border-red-600 bg-red-50 text-red-950'
                : 'border-emerald-200 bg-emerald-50 text-emerald-950'
            }`}
          >
            <p className="font-bold">
              {locale === 'bn'
                ? guidance.messageBn ?? guidance.guidance
                : guidance.messageEn ?? guidance.guidance}
            </p>
            {guidance.isEmergencyRedFlag && (
              <a
                href="tel:999"
                className="nostos-emergency-999 mt-3 inline-flex min-h-[44px] items-center rounded-full bg-[#B3261E] px-4 text-xs font-extrabold text-white"
              >
                {dict.emergency.call999}
              </a>
            )}
          </div>
        )}
      </section>

      {/* EPI Vaccination Info */}
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm">
        <h2 className="text-base font-extrabold text-emerald-950">{dict.health.vaccinationTitle}</h2>
        <p className="mt-1 text-emerald-900">
          {locale === 'bn'
            ? 'বাংলাদেশ সরকারের ইপিআই (EPI) কর্মসূচির অধীনে সকল উপজেলা স্বাস্থ্য কমপ্লেক্স, ইউনিয়ন উপ-স্বাস্থ্যকেন্দ্র ও সিটি কর্পোরেশন টিকাদান কেন্দ্রে শিশুদের বিনামূল্যে টিকা প্রদান করা হয়।'
            : 'Under Bangladesh’s Expanded Programme on Immunization (EPI), free routine childhood and maternal vaccines are available at all Upazila Health Complexes, Union sub-centres, and City Corporation EPI clinics.'}
        </p>
      </section>

      {/* Public Hospital Directory */}
      <section className="space-y-3">
        <h2 className="text-lg font-extrabold text-slate-900">{dict.health.facilitiesTitle}</h2>
        {error && <ErrorRetryCard message={error} />}
        {loading ? (
          <SkeletonGrid count={4} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {facilities.map((f) => (
              <article key={f.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="font-bold text-slate-900">
                  {locale === 'bn' ? f.nameBn ?? f.name : f.nameEn ?? f.name}
                </h3>
                {f.address && <p className="mt-1 text-xs text-slate-700">{f.address}</p>}
                {f.phone && (
                  <a href={`tel:${f.phone}`} className="nostos-link mt-2 inline-block text-xs font-bold text-[var(--gold)]">
                    {f.phone}
                  </a>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      </div>
    </div>
  );
}
