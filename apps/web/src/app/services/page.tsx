'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDigits } from '@jonoshheba/shared';
import { SearchCombobox } from '../../components/SearchCombobox';
import { FilmPlateBanner } from '../../components/NostosPrimitive';
import { EmptyStateCard, ErrorRetryCard, SkeletonGrid, TrustChip } from '../../components/UiStates';
import { apiGet } from '../../lib/api';
import { useLocale } from '../../lib/i18n';

interface TaxonomyCategory {
  code: string;
  nameBn: string;
  nameEn: string;
  officialPortal: string;
  hotline: string;
}

interface ServiceItem {
  slug: string;
  title: string;
  titleBn: string;
  titleEn: string;
  summary: string;
  categorySlug: string;
  officialUrl: string;
  processingTime: string;
  trustLabel: string;
  lastVerifiedAt?: string | null;
  sources?: Array<{ id: string; agency: string; url: string; lastVerifiedAt?: string | null }>;
}

interface District {
  id: string;
  nameBn: string;
  nameEn: string;
  lat: number;
  lng: number;
}

export default function ServicesPage() {
  const { locale, dict, localePath } = useLocale();
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [search, setSearch] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [officeInfo, setOfficeInfo] = useState<{ nameBn: string; nameEn: string; website: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setError(null);
    const [taxR, svcR, distR] = await Promise.allSettled([
      apiGet<{ categories: TaxonomyCategory[] }>('/api/v1/services/taxonomy', { locale }),
      apiGet<{ items: ServiceItem[] }>('/api/v1/services?limit=100', { locale }),
      apiGet<{ items: District[] }>('/api/v1/geo/districts', { locale }),
    ]);

    if (taxR.status === 'fulfilled') setCategories(taxR.value.categories ?? []);
    if (svcR.status === 'fulfilled') setServices(svcR.value.items ?? []);
    if (distR.status === 'fulfilled') setDistricts(distR.value.items ?? []);
    if (taxR.status === 'rejected' && svcR.status === 'rejected') {
      setError(dict.states.errorHint);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadAll();
  }, [locale]);

  useEffect(() => {
    const d = districts.find((x) => x.id === selectedDistrict);
    if (!d) {
      setOfficeInfo(null);
      return;
    }
    apiGet<{ responsibleOffice?: { nameBn: string; nameEn: string; website: string } }>(
      `/api/v1/offices/resolve?service=birth-registration&lat=${d.lat}&lng=${d.lng}`,
      { locale },
    )
      .then((res) => setOfficeInfo(res.responsibleOffice ?? null))
      .catch(() => setOfficeInfo(null));
  }, [selectedDistrict, districts, locale]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((s) => {
      if (selectedCategory && !s.categorySlug.includes(selectedCategory.replace(/^\d+-/, '').split('-')[0] ?? '')) {
        // Also match direct slug
        if (s.categorySlug !== selectedCategory) return false;
      }
      if (!q) return true;
      return (
        s.titleEn.toLowerCase().includes(q) ||
        s.titleBn.includes(search.trim()) ||
        s.slug.toLowerCase().includes(q)
      );
    });
  }, [services, selectedCategory, search]);

  return (
    <div>
      <FilmPlateBanner
        overline="II — THE HARBOURS · CITIZEN DIRECTORY"
        title={dict.services.title}
        subtitle={dict.services.subtitle}
        breadcrumb={[{ label: dict.nav.home, href: '/' }, { label: dict.nav.services }]}
      />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">

      {/* District Office Resolver */}
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <label htmlFor="district-office-select" className="block text-sm font-extrabold text-emerald-950">
              {dict.services.myDistrictOffice}
            </label>
          </div>
          <select
            id="district-office-select"
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            className="min-h-[44px] rounded-xl border border-emerald-300 bg-white px-3 text-sm text-slate-900"
          >
            <option value="">{dict.services.selectDistrict}</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {locale === 'bn' ? d.nameBn : d.nameEn}
              </option>
            ))}
          </select>
        </div>
        {officeInfo && (
          <p className="mt-2 rounded-lg bg-white p-3 text-sm text-slate-900">
            <strong>{locale === 'bn' ? officeInfo.nameBn : officeInfo.nameEn}</strong> ·{' '}
            <a
              href={officeInfo.website}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-emerald-800 underline"
            >
              {officeInfo.website}
            </a>
          </p>
        )}
      </section>

      {/* Search Combobox & Category Filter */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <SearchCombobox
            variant="page"
            initialQuery={search}
            placeholder={dict.services.searchPlaceholder}
            onSelectQuery={(q) => setSearch(q)}
          />
        </div>
        <div>
          <label htmlFor="service-category-select" className="sr-only">
            {dict.services.allCategories}
          </label>
          <select
            id="service-category-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="">{dict.services.allCategories}</option>
            {categories.map((c) => (
              <option key={c.code} value={c.code}>
                {locale === 'bn' ? c.nameBn : c.nameEn}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <ErrorRetryCard message={error} onRetry={() => void loadAll()} />}

      {/* Services List */}
      <div aria-live="polite" className="space-y-3">
        {!loading && (
          <p className="text-xs font-bold text-slate-600">
            {locale === 'bn'
              ? `${formatDigits(filtered.length, 'bn')}টি সেবা দেখানো হচ্ছে`
              : `Showing ${filtered.length} services`}
          </p>
        )}

        {loading ? (
          <SkeletonGrid count={6} />
        ) : filtered.length === 0 ? (
          <EmptyStateCard />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((svc) => (
              <article
                key={svc.slug}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div>
                  <TrustChip
                    label={svc.trustLabel}
                    lastVerifiedAt={svc.lastVerifiedAt}
                    locale={locale}
                  />
                  <h2 className="mt-2 text-base font-extrabold text-slate-900">
                    <Link href={localePath(`/services/${svc.slug}`)} className="hover:text-emerald-800 hover:underline">
                      {locale === 'bn' ? svc.titleBn : svc.titleEn}
                    </Link>
                  </h2>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-700">{svc.summary}</p>
                  {svc.sources?.[0] && (
                    <p className="mt-2 text-[11px] text-slate-600">
                      {dict.trust.source}:{' '}
                      <a
                        href={svc.sources[0].url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-emerald-800 underline"
                      >
                        {svc.sources[0].agency}
                      </a>
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <Link
                    href={localePath(`/services/${svc.slug}`)}
                    className="text-xs font-extrabold text-emerald-800 hover:underline"
                  >
                    {dict.services.viewDetails} →
                  </Link>
                  <a
                    href={svc.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-slate-700 underline"
                  >
                    {dict.services.officialPortal}
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
