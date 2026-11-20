'use client';

import { useEffect, useState } from 'react';
import { ErrorRetryCard, SkeletonGrid, TrustChip } from '../../components/UiStates';
import { FilmPlateBanner } from '../../components/NostosPrimitive';
import { apiGet, apiPost } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useLocale } from '../../lib/i18n';

interface UtilityProvider {
  code: string;
  utilityType: 'electricity' | 'water' | 'gas';
  nameBn: string;
  nameEn: string;
  officialPaymentUrl: string;
  hotline: string;
  trustLabel: string;
  attribution?: { lastVerifiedAt?: string; sourceUrl?: string };
}

interface OutageNotice {
  id: string;
  title?: string;
  titleBn?: string;
  titleEn?: string;
  districtEn?: string;
  provider?: string;
  status?: string;
}

export default function UtilitiesPage() {
  const { locale, dict } = useLocale();
  const { user, openSignIn } = useAuth();
  const [providers, setProviders] = useState<UtilityProvider[]>([]);
  const [outages, setOutages] = useState<OutageNotice[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'electricity' | 'gas' | 'water'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subMsg, setSubMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      const [pR, oR] = await Promise.allSettled([
        apiGet<{ items?: UtilityProvider[]; providers?: UtilityProvider[] }>('/api/v1/utilities/providers', { locale }),
        apiGet<{ items: OutageNotice[] }>('/api/v1/utilities/outages', { locale }),
      ]);
      if (pR.status === 'fulfilled') {
        setProviders(pR.value.items ?? pR.value.providers ?? []);
      } else {
        setError(dict.states.errorHint);
      }
      if (oR.status === 'fulfilled') setOutages(oR.value.items ?? []);
      setLoading(false);
    }
    void load();
  }, [locale, dict.states.errorHint]);

  async function subscribeOutage(utilityType: 'electricity' | 'water' | 'gas', providerName: string) {
    const run = async () => {
      try {
        await apiPost(
          '/api/v1/utilities/outage-subscriptions',
          { districtEn: 'Dhaka', utilityType, providerName },
          { locale },
        );
        setSubMsg(
          locale === 'bn'
            ? `${providerName}-এর বিভ্রাট সতর্কতা চালু হয়েছে।`
            : `Subscribed to outage notices for ${providerName}.`,
        );
      } catch (err) {
        setSubMsg(err instanceof Error ? err.message : dict.states.errorHint);
      }
    };
    if (!user) {
      openSignIn(() => void run());
      return;
    }
    await run();
  }

  const visibleProviders =
    filterType === 'all' ? providers : providers.filter((p) => p.utilityType === filterType);

  return (
    <div>
      <FilmPlateBanner
        overline="PUBLIC UTILITIES · POWER · GAS · WATER"
        title={dict.utilities.title}
        subtitle={dict.utilities.subtitle}
        breadcrumb={[{ label: dict.nav.home, href: '/' }, { label: dict.nav.utilities }]}
      />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">

      {subMsg && (
        <div role="status" aria-live="polite" className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm font-semibold text-emerald-950">
          {subMsg}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['all', locale === 'bn' ? 'সব সংস্থা' : 'All Providers'],
            ['electricity', locale === 'bn' ? 'বিদ্যুৎ (৬ সংস্থা)' : 'Electricity (6)'],
            ['gas', locale === 'bn' ? 'গ্যাস' : 'Gas'],
            ['water', locale === 'bn' ? 'পানি (ওয়াসা)' : 'Water (WASA)'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilterType(key)}
            className={`min-h-[44px] rounded-xl px-4 text-xs font-bold ${
              filterType === key
                ? 'bg-emerald-700 text-white'
                : 'border border-slate-300 bg-white text-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <ErrorRetryCard message={error} />}

      {/* Providers */}
      <section className="space-y-3">
        <h2 className="text-lg font-extrabold text-slate-900">{dict.utilities.providersTitle}</h2>
        {loading ? (
          <SkeletonGrid count={6} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleProviders.map((p) => (
              <article key={p.code} className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div>
                  <TrustChip label={p.trustLabel} lastVerifiedAt={p.attribution?.lastVerifiedAt} locale={locale} />
                  <h3 className="mt-2 text-sm font-extrabold text-slate-900">
                    {locale === 'bn' ? p.nameBn : p.nameEn}
                  </h3>
                  <p className="mt-1 text-xs text-slate-700">
                    {locale === 'bn' ? 'হটলাইন:' : 'Hotline:'}{' '}
                    <a href={`tel:${p.hotline}`} className="font-bold text-red-700 underline">
                      {p.hotline}
                    </a>
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  <a
                    href={p.officialPaymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[40px] items-center rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white"
                  >
                    {dict.services.officialPortal} →
                  </a>
                  <button
                    type="button"
                    onClick={() => void subscribeOutage(p.utilityType, p.code.toUpperCase())}
                    className="inline-flex min-h-[40px] items-center rounded-lg border border-slate-300 px-3 text-xs font-bold text-slate-800 hover:bg-slate-100"
                  >
                    {locale === 'bn' ? 'সতর্কতা' : 'Alerts'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Active Outages */}
      <section className="space-y-3">
        <h2 className="text-lg font-extrabold text-slate-900">{dict.utilities.outagesTitle}</h2>
        {outages.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            {dict.states.empty}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {outages.map((o) => (
              <div key={o.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
                <p className="font-bold text-amber-950">
                  {locale === 'bn' ? o.titleBn ?? o.title : o.titleEn ?? o.title}
                </p>
                {o.districtEn && <p className="mt-1 text-xs text-amber-900">{o.districtEn}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
      </div>
    </div>
  );
}
