'use client';

import { useEffect, useState } from 'react';
import { ErrorRetryCard, SkeletonGrid } from '../../components/UiStates';
import { FilmPlateBanner } from '../../components/NostosPrimitive';
import { apiGet } from '../../lib/api';
import { useLocale } from '../../lib/i18n';

interface PlaceItem {
  id: string;
  type: string;
  nameBn: string;
  nameEn: string;
  districtEn: string;
  lat: number;
  lng: number;
  accessible: boolean;
  open24x7: boolean;
  attribution: string;
}

export default function NearMePage() {
  const { locale, dict } = useLocale();
  const [places, setPlaces] = useState<PlaceItem[]>([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [district, setDistrict] = useState('Dhaka');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (typeFilter) qs.set('type', typeFilter);
    apiGet<{ items: PlaceItem[] }>(`/api/v1/places?${qs.toString()}`, { locale })
      .then((res) => setPlaces(res.items ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : dict.states.errorHint))
      .finally(() => setLoading(false));
  }, [typeFilter, locale, dict.states.errorHint]);

  return (
    <div>
      <FilmPlateBanner
        overline="II — THE HARBOURS · HOSPITALS · SHELTERS · UDC"
        title={dict.nav.nearMe}
        subtitle={
          locale === 'bn'
            ? 'সরকারি হাসপাতাল, আশ্রয়কেন্দ্র, ইউনিয়ন ডিজিটাল সেন্টার ও জেলা অফিস খুঁজুন।'
            : 'Locate public hospitals, cyclone shelters, Union Digital Centres, and local offices.'
        }
        breadcrumb={[{ label: dict.nav.home, href: '/' }, { label: dict.nav.nearMe }]}
        actions={
          <a
            href={`/api/v1/offline-packs/${encodeURIComponent(district)}`}
            className="nostos-btn-gold"
          >
            {locale === 'bn' ? `${district} অফলাইন প্যাক (GeoJSON)` : `${district} Offline Pack (GeoJSON)`}
          </a>
        }
      />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">

      {/* Filters */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <div>
            <label htmlFor="nearme-type" className="block text-xs font-bold text-slate-700">
              {locale === 'bn' ? 'সেবাকেন্দ্রের ধরন' : 'Facility type'}
            </label>
            <select
              id="nearme-type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="mt-1 min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="">{locale === 'bn' ? 'সব ধরন' : 'All types'}</option>
              <option value="hospital">{locale === 'bn' ? 'হাসপাতাল' : 'Hospital'}</option>
              <option value="cyclone_shelter">{locale === 'bn' ? 'ঘূর্ণিঝড় আশ্রয়কেন্দ্র' : 'Cyclone Shelter'}</option>
              <option value="udc">{locale === 'bn' ? 'ইউনিয়ন ডিজিটাল সেন্টার' : 'Union Digital Centre'}</option>
            </select>
          </div>
          <div>
            <label htmlFor="nearme-district" className="block text-xs font-bold text-slate-700">
              {locale === 'bn' ? 'অফলাইন প্যাক জেলা' : 'Offline pack district'}
            </label>
            <input
              id="nearme-district"
              type="text"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="mt-1 min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
            />
          </div>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900">
          {locale === 'bn'
            ? `মোট সেবাকেন্দ্র: ${places.length}টি`
            : `Total facilities loaded: ${places.length}`}
        </span>
      </div>

      {error && <ErrorRetryCard message={error} />}

      {loading ? (
        <SkeletonGrid count={4} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {places.map((p) => (
            <article key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-base font-extrabold text-slate-900">
                {locale === 'bn' ? p.nameBn : p.nameEn}
              </h2>
              <p className="mt-1 text-xs text-slate-700">
                {p.districtEn} · {p.open24x7 ? (locale === 'bn' ? '২৪ ঘণ্টা খোলা' : 'Open 24/7') : ''}
                {p.accessible ? (locale === 'bn' ? ' · হুইলচেয়ার প্রবেশযোগ্য' : ' · Wheelchair accessible') : ''}
              </p>
              <p className="mt-1 text-[11px] text-slate-600">{p.attribution}</p>
              <a
                href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=15/${p.lat}/${p.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex min-h-[40px] items-center rounded-xl bg-emerald-700 px-3.5 text-xs font-bold text-white"
              >
                {locale === 'bn' ? 'OpenStreetMap-এ দেখুন' : 'Open on OpenStreetMap'} →
              </a>
            </article>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-600">{dict.app.osmAttribution}</p>
      </div>
    </div>
  );
}
