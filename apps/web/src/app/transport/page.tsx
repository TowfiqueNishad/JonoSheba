'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  formatBdt,
  formatDhakaTime,
  formatDigits,
  formatDuration,
  getSeatClassLabel,
} from '@jonoshheba/shared';
import { EmptyStateCard, ErrorRetryCard, SkeletonGrid } from '../../components/UiStates';
import { FilmPlateBanner } from '../../components/NostosPrimitive';
import { apiGet, apiPost } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useLocale } from '../../lib/i18n';

interface Station {
  code: string;
  nameBn: string;
  nameEn: string;
  division: string;
  districtEn: string;
  aliases: string[];
  status: string;
  eTicketingEnabled: boolean;
}

interface TrainResult {
  number: string;
  nameBn: string;
  nameEn: string;
  departure: string;
  arrival: string;
  dayOffset?: number;
  overnightArrival?: boolean;
  durationMin: number;
  distanceKm: number;
  runsOnDate: boolean;
  offDays: string[];
  classes: Array<{
    seatClass: string;
    labelBn?: string;
    labelEn?: string;
    estimatedOfficialFareBdt: number;
  }>;
  timetableTrust?: { version: string; sourceUrl: string; lastVerifiedAt: string };
  officialBookingUrl: string;
}

interface MetroStation {
  code: string;
  nameBn: string;
  nameEn: string;
  status: string;
}

interface TollAsset {
  code: string;
  nameBn: string;
  nameEn: string;
  ratesBdt: Record<string, number>;
}

interface BusTerminal {
  code: string;
  nameBn: string;
  nameEn: string;
  districtEn: string;
}

function StationCombobox({
  id,
  label,
  stations,
  value,
  onChange,
  placeholder,
  locale,
}: {
  id: string;
  label: string;
  stations: Station[];
  value: string;
  onChange: (code: string) => void;
  placeholder: string;
  locale: 'bn' | 'en';
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const selected = stations.find((s) => s.code === value);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter(
      (s) =>
        s.code.toLowerCase().includes(q) ||
        s.nameEn.toLowerCase().includes(q) ||
        s.nameBn.includes(search.trim()) ||
        s.districtEn.toLowerCase().includes(q) ||
        s.aliases.some((a) => a.toLowerCase().includes(q)),
    );
  }, [stations, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, Station[]>();
    for (const st of filtered) {
      const group = st.division || st.districtEn || 'Other';
      const arr = map.get(group) ?? [];
      arr.push(st);
      map.set(group, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="relative">
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </label>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        value={
          open
            ? search
            : selected
              ? `${locale === 'bn' ? selected.nameBn : selected.nameEn} (${selected.code})`
              : value
        }
        onFocus={() => {
          setSearch('');
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        placeholder={placeholder}
        className="mt-1 min-h-[44px] w-full rounded-xl border border-[var(--hair)] bg-[var(--field)] px-3 text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none"
      />
      {open && (
        <div
          id={`${id}-listbox`}
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-[var(--hair)] bg-[var(--surface)] p-1.5 shadow-2xl backdrop-blur-md"
        >
          {grouped.length === 0 ? (
            <p className="p-2 text-xs text-[var(--text-muted)]">
              {locale === 'bn' ? 'কোনো স্টেশন মেলেনি' : 'No matching stations'}
            </p>
          ) : (
            grouped.map(([div, list]) => (
              <div key={div} className="mb-1">
                <p className="px-2 py-1 text-[11px] font-mono font-bold tracking-wider uppercase text-[var(--text-muted)]">{div}</p>
                {list.map((st) => {
                  const isSelected = st.code === value;
                  return (
                    <button
                      key={st.code}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseDown={() => {
                        onChange(st.code);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg border-b border-[var(--hair-soft)] px-3 py-2 text-left text-sm transition-colors ${
                        isSelected
                          ? 'bg-[var(--gold)] text-[#050709] font-bold shadow-sm'
                          : 'text-[var(--text)] hover:bg-[var(--surface-2)] hover:text-[var(--gold)]'
                      }`}
                    >
                      <span className={isSelected ? 'text-[#050709] font-bold' : 'text-[var(--text)]'}>
                        {locale === 'bn' ? st.nameBn : st.nameEn}
                      </span>
                      <span className={`font-mono text-xs ${isSelected ? 'text-[#050709]/80 font-bold' : 'text-[var(--text-muted)]'}`}>
                        {st.code}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function TransportPage() {
  const { locale, dict, localePath } = useLocale();
  const { user, openSignIn } = useAuth();
  const [tab, setTab] = useState<'rail' | 'metro' | 'bus' | 'water' | 'planner'>('rail');

  const [stations, setStations] = useState<Station[]>([]);
  const [fromCode, setFromCode] = useState('DA');
  const [toCode, setToCode] = useState('CTG');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sortBy, setSortBy] = useState<'departure' | 'duration' | 'fare'>('departure');
  const [classFilter, setClassFilter] = useState<string>('');
  const [trains, setTrains] = useState<TrainResult[]>([]);
  const [timetableVersion, setTimetableVersion] = useState<string>('');
  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingTrains, setLoadingTrains] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [watchBanner, setWatchBanner] = useState<string | null>(null);

  // Metro & Tolls
  const [metroStations, setMetroStations] = useState<MetroStation[]>([]);
  const [metroFrom, setMetroFrom] = useState('UTN');
  const [metroTo, setMetroTo] = useState('MTJ');
  const [metroFare, setMetroFare] = useState<{ singleJourneyFareBdt: number; mrtOrRapidPassFareBdt: number } | null>(null);
  const [tolls, setTolls] = useState<TollAsset[]>([]);

  // Bus
  const [busFrom, setBusFrom] = useState('Dhaka');
  const [busTo, setBusTo] = useState('Chattogram');
  const [busEstimate, setBusEstimate] = useState<{ distanceKm: number; officialFareEstimateBdt: number } | null>(null);
  const [busTerminals, setBusTerminals] = useState<BusTerminal[]>([]);

  // Water & Air & Planner
  const [waterRoutes, setWaterRoutes] = useState<Array<{ id: string; nameBn: string; nameEn: string; typicalDurationHours?: number; weatherWarningUrl?: string }>>([]);
  const [airRoutes, setAirRoutes] = useState<Array<{ id: string; routeBn: string; routeEn: string; flightDurationMin: number; officialAirlineUrls: string[] }>>([]);
  const [planFrom, setPlanFrom] = useState('Dhaka');
  const [planTo, setPlanTo] = useState('Chattogram');
  const [itineraries, setItineraries] = useState<Array<{ mode: string; labelBn: string; durationMin: number; estimatedFareBdt: number; officialChannelUrl: string }>>([]);

  useEffect(() => {
    async function init() {
      setLoadingInit(true);
      setError(null);
      const [stR, msR, tR, btR, wR, aR] = await Promise.allSettled([
        apiGet<{ items: Station[]; timetableVersion?: { version: string } }>('/api/v1/rail/stations', { locale }),
        apiGet<{ items: MetroStation[] }>('/api/v1/metro/stations', { locale }),
        apiGet<{ items: TollAsset[] }>('/api/v1/tolls', { locale }),
        apiGet<{ items: BusTerminal[] }>('/api/v1/bus/terminals', { locale }),
        apiGet<{ items?: Array<{ id: string; nameBn: string; nameEn: string; typicalDurationHours?: number; weatherWarningUrl?: string }>; routes?: Array<{ id: string; nameBn: string; nameEn: string; typicalDurationHours?: number; weatherWarningUrl?: string }> }>('/api/v1/water/routes', { locale }),
        apiGet<{ items?: Array<{ id: string; routeBn: string; routeEn: string; flightDurationMin: number; officialAirlineUrls: string[] }>; routes?: Array<{ id: string; routeBn: string; routeEn: string; flightDurationMin: number; officialAirlineUrls: string[] }> }>('/api/v1/air/routes', { locale }),
      ]);
      if (stR.status === 'fulfilled') {
        setStations(stR.value.items ?? []);
        setTimetableVersion(stR.value.timetableVersion?.version ?? '');
      } else {
        setError(dict.states.errorHint);
      }
      if (msR.status === 'fulfilled') setMetroStations(msR.value.items ?? []);
      if (tR.status === 'fulfilled') setTolls(tR.value.items ?? []);
      if (btR.status === 'fulfilled') setBusTerminals(btR.value.items ?? []);
      if (wR.status === 'fulfilled') setWaterRoutes(wR.value.routes ?? wR.value.items ?? []);
      if (aR.status === 'fulfilled') setAirRoutes(aR.value.routes ?? aR.value.items ?? []);
      setLoadingInit(false);
    }
    void init();
  }, [locale, dict.states.errorHint]);

  useEffect(() => {
    if (!fromCode || !toCode) return;
    setLoadingTrains(true);
    apiGet<{ trains: TrainResult[]; timetableVersion?: { version: string } }>(
      `/api/v1/rail/trains?from=${encodeURIComponent(fromCode)}&to=${encodeURIComponent(toCode)}&date=${encodeURIComponent(date)}`,
      { locale },
    )
      .then((res) => {
        setTrains(res.trains ?? []);
        if (res.timetableVersion?.version) setTimetableVersion(res.timetableVersion.version);
      })
      .catch(() => setTrains([]))
      .finally(() => setLoadingTrains(false));
  }, [fromCode, toCode, date, locale]);

  useEffect(() => {
    apiGet<{ singleJourneyFareBdt: number; mrtOrRapidPassFareBdt: number }>(
      `/api/v1/metro/fare?from=${encodeURIComponent(metroFrom)}&to=${encodeURIComponent(metroTo)}`,
      { locale },
    )
      .then(setMetroFare)
      .catch(() => setMetroFare(null));
  }, [metroFrom, metroTo, locale]);

  useEffect(() => {
    if (!busFrom.trim() || !busTo.trim()) return;
    apiGet<{ distanceKm: number; officialFareEstimateBdt: number }>(
      `/api/v1/bus/fare-estimate?from=${encodeURIComponent(busFrom)}&to=${encodeURIComponent(busTo)}`,
      { locale },
    )
      .then(setBusEstimate)
      .catch(() => setBusEstimate(null));
  }, [busFrom, busTo, locale]);

  async function createTicketWatch(train: TrainResult) {
    const runWatch = async () => {
      try {
        await apiPost(
          '/api/v1/ticket-watches',
          {
            mode: 'train',
            originCode: fromCode,
            destinationCode: toCode,
            journeyDate: date,
            passengers: 1,
            preferences: { trainName: train.nameEn },
          },
          { locale },
        );
        setWatchBanner(dict.transport.watchCreated);
      } catch (err) {
        setWatchBanner(err instanceof Error ? err.message : dict.states.errorHint);
      }
    };

    if (!user) {
      openSignIn(() => void runWatch());
      return;
    }
    await runWatch();
  }

  async function runPlanner(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await apiGet<{
        itineraries: Array<{ mode: string; labelBn: string; durationMin: number; estimatedFareBdt: number; officialChannelUrl: string }>;
      }>(`/api/v1/journeys/plan?from=${encodeURIComponent(planFrom)}&to=${encodeURIComponent(planTo)}`, { locale });
      setItineraries(res.itineraries ?? []);
    } catch {
      setItineraries([]);
    }
  }

  return (
    <div>
      <FilmPlateBanner
        overline="II — THE HARBOURS · RAIL · METRO · BUS · RIVER"
        title={dict.transport.title}
        subtitle={dict.transport.subtitle}
        breadcrumb={[{ label: dict.nav.home, href: '/' }, { label: dict.nav.transport }]}
        actions={
          <span className="nostos-overline border border-[var(--gold-line)] px-3 py-1.5 text-[10px] text-[var(--gold)]">
            {dict.transport.liveSeatsNotice}
          </span>
        }
      />

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        {/* Fraud Warning Banner (clean citizen copy — no internal rule codes) */}
        <div className="border-l-2 border-[var(--gold)] bg-[var(--surface)] p-4 text-xs text-[var(--text)]">
          {dict.transport.fraudWarning}
        </div>

        {watchBanner && (
          <div
            role="status"
            aria-live="polite"
            className="border border-[var(--gold-line)] bg-[var(--surface)] p-3 text-sm text-[var(--gold)]"
          >
            {watchBanner}
          </div>
        )}

        {/* NOSTOS Text Tabs with Gliding Gold Underline */}
        <div role="tablist" className="flex flex-wrap gap-6 border-b border-[var(--hair)] pb-2">
          {[
            { id: 'rail' as const, label: dict.transport.tabRail },
            { id: 'metro' as const, label: dict.transport.tabMetro },
            { id: 'bus' as const, label: dict.transport.tabBus },
            { id: 'water' as const, label: dict.transport.tabWaterAir },
            { id: 'planner' as const, label: dict.transport.tabPlanner },
          ].map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`relative min-h-[44px] px-1 text-sm font-semibold transition-colors ${
                tab === t.id
                  ? 'text-[var(--gold)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <span>{t.label}</span>
              <span
                aria-hidden="true"
                className={`absolute bottom-0 left-0 right-0 h-[1.5px] bg-[var(--gold)] transition-transform duration-[700ms] ease-[cubic-bezier(.16,1,.3,1)] ${
                  tab === t.id ? 'scale-x-100' : 'scale-x-0'
                }`}
              />
            </button>
          ))}
        </div>

      {error && <ErrorRetryCard message={error} />}

      {/* RAIL TAB */}
      {tab === 'rail' && (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-2xl border border-[var(--hair)] bg-[var(--surface)] p-4 shadow-sm sm:grid-cols-[1fr_auto_1fr_1fr]">
            <StationCombobox
              id="rail-from"
              label={dict.transport.fromStation}
              stations={stations}
              value={fromCode}
              onChange={setFromCode}
              placeholder={dict.transport.searchStationPlaceholder}
              locale={locale}
            />
            <div className="flex items-end">
              <button
                type="button"
                aria-label={dict.transport.swapStations}
                onClick={() => {
                  setFromCode(toCode);
                  setToCode(fromCode);
                }}
                className="min-h-[44px] min-w-[44px] rounded-xl border border-[var(--hair)] bg-[var(--surface-2)] font-bold text-[var(--gold)] hover:border-[var(--gold)]"
              >
                ⇄
              </button>
            </div>
            <StationCombobox
              id="rail-to"
              label={dict.transport.toStation}
              stations={stations}
              value={toCode}
              onChange={setToCode}
              placeholder={dict.transport.searchStationPlaceholder}
              locale={locale}
            />
            <div>
              <label htmlFor="rail-date" className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {dict.transport.journeyDate}
              </label>
              <input
                id="rail-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-[var(--hair)] bg-[var(--field)] px-3 text-sm text-[var(--text)] focus:border-[var(--gold)] focus:outline-none"
              />
            </div>
          </div>

          {/* Sort & Class Filter */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {locale === 'bn' ? 'সাজান:' : 'Sort by:'}
              </span>
              {[
                { id: 'departure' as const, bn: 'ছাড়ার সময়', en: 'Departure' },
                { id: 'duration' as const, bn: 'যাত্রার সময়', en: 'Duration' },
                { id: 'fare' as const, bn: 'ভাড়া', en: 'Fare' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSortBy(s.id)}
                  className={`min-h-[34px] rounded-lg px-2.5 font-bold transition-colors ${
                    sortBy === s.id
                      ? 'bg-[var(--gold)] text-[#050709]'
                      : 'border border-[var(--hair)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {locale === 'bn' ? s.bn : s.en}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {locale === 'bn' ? 'আসন শ্রেণি:' : 'Seat class:'}
              </span>
              {['', 'S_CHAIR', 'SNIGDHA', 'AC_S', 'AC_B'].map((cls) => (
                <button
                  key={cls || 'all'}
                  type="button"
                  onClick={() => setClassFilter(cls)}
                  className={`min-h-[34px] rounded-lg px-2.5 font-bold transition-colors ${
                    classFilter === cls
                      ? 'bg-[var(--gold)] text-[#050709]'
                      : 'border border-[var(--hair)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {cls ? getSeatClassLabel(cls, locale) : locale === 'bn' ? 'সব' : 'All'}
                </button>
              ))}
            </div>
          </div>

          <div aria-live="polite" className="space-y-3">
            {loadingInit || loadingTrains ? (
              <SkeletonGrid count={3} />
            ) : trains.length === 0 ? (
              <EmptyStateCard title={dict.transport.noTrainsTitle} hint={dict.transport.noTrainsHint} />
            ) : (
              trains
                .filter((tr) =>
                  !classFilter ? true : tr.classes.some((c) => c.seatClass === classFilter),
                )
                .sort((a, b) => {
                  if (sortBy === 'duration') return a.durationMin - b.durationMin;
                  if (sortBy === 'fare') {
                    const fa = a.classes[0]?.estimatedOfficialFareBdt ?? 0;
                    const fb = b.classes[0]?.estimatedOfficialFareBdt ?? 0;
                    return fa - fb;
                  }
                  return (a.departure || '').localeCompare(b.departure || '');
                })
                .map((tr) => (
                <article
                  key={tr.number}
                  className={`rounded-2xl border p-4 shadow-sm transition ${
                    tr.runsOnDate
                      ? 'border-[var(--hair)] bg-[var(--surface)]'
                      : 'border-[var(--hair)] bg-[var(--surface-2)] opacity-70'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-bold text-[var(--hero-text)]">
                        <Link
                          href={localePath(`/transport/trains/${tr.number}`)}
                          className="hover:text-[var(--gold)] hover:underline"
                        >
                          {locale === 'bn' ? tr.nameBn : tr.nameEn}{' '}
                          <span className="text-sm font-semibold text-[var(--text-muted)]">
                            ({formatDigits(tr.number, locale)})
                          </span>
                        </Link>
                      </h2>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[var(--text)]">
                        <span className="text-xl font-semibold text-[var(--text)]">
                          {formatDhakaTime(tr.departure, locale)}
                        </span>
                        <span aria-hidden="true" className="inline-block h-[1px] w-10 bg-[var(--gold-line)]" />
                        <span className="nostos-editorial-italic text-base text-[var(--text-muted)]">
                          {formatDuration(tr.durationMin, locale)}
                        </span>
                        <span aria-hidden="true" className="inline-block h-[1px] w-10 bg-[var(--gold-line)]" />
                        <span className="text-xl font-semibold text-[var(--text)]">
                          {formatDhakaTime(tr.arrival, locale)}
                        </span>
                        {(tr.overnightArrival ||
                          (tr.dayOffset ?? 0) > 0 ||
                          (tr.arrival && tr.departure && tr.arrival < tr.departure)) && (
                          <span className="border border-dashed border-[var(--gold)] px-2 py-0.5 text-xs font-semibold text-[var(--gold)]">
                            {locale === 'bn' ? '+১ দিন' : '+1 day'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Split Trust vs Seat Availability Badges */}
                    <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
                      <span className="rounded-full border border-[var(--gold-line)] bg-[var(--surface-2)] px-2.5 py-1 text-[var(--gold)]">
                        {dict.transport.officialTimetable}
                        {timetableVersion ? ` · ${timetableVersion}` : ''}
                      </span>
                      <span className="rounded-full border border-[var(--hair)] bg-[var(--surface-2)] px-2.5 py-1 text-[var(--text-muted)]">
                        {dict.transport.seatInfoUnknown}
                      </span>
                    </div>
                  </div>

                  {!tr.runsOnDate && (
                    <p className="mt-2 rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-1.5 text-xs font-bold text-red-400">
                      {dict.transport.offDayWarning}
                    </p>
                  )}

                  {/* Localized Seat Classes & Estimated Official Fares */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tr.classes.map((cls) => (
                      <div
                        key={cls.seatClass}
                        className="rounded-lg border border-[var(--hair)] bg-[var(--surface-2)] px-3 py-1.5 text-xs"
                      >
                        <span className="font-bold text-[var(--text)]">
                          {getSeatClassLabel(cls.seatClass, locale)}
                        </span>
                        <span className="ml-2 font-semibold text-[var(--gold)]">
                          {formatBdt(cls.estimatedOfficialFareBdt, locale)}
                        </span>
                        <span className="ml-1 text-[11px] text-[var(--text-muted)]">
                          ({dict.transport.estimatedFare})
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <a
                      href={tr.officialBookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] items-center rounded-xl bg-[var(--gold)] px-4 text-xs font-extrabold text-[#050709] hover:opacity-90"
                    >
                      {dict.transport.continueOfficial} →
                    </a>
                    <button
                      type="button"
                      onClick={() => void createTicketWatch(tr)}
                      className="inline-flex min-h-[44px] items-center rounded-xl border border-[var(--gold-line)] px-4 text-xs font-bold text-[var(--gold)] hover:bg-[var(--surface-2)]"
                    >
                      {dict.transport.watchTrain}
                    </button>
                    <Link
                      href={localePath(`/transport/trains/${tr.number}`)}
                      className="inline-flex min-h-[44px] items-center rounded-xl border border-[var(--hair)] bg-[var(--surface-2)] px-4 text-xs font-bold text-[var(--text)] hover:border-[var(--gold-line)]"
                    >
                      {locale === 'bn' ? 'সকল বিরতি ও মানচিত্র →' : 'All Stops & Map →'}
                    </Link>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      )}

      {/* METRO & TOLLS TAB */}
      {tab === 'metro' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-[var(--hair)] bg-[var(--surface)] p-5 shadow-sm">
            <h2 className="text-lg font-bold text-[var(--hero-text)]">{dict.transport.metroFareTitle}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="metro-from" className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  {dict.transport.fromStation}
                </label>
                <select
                  id="metro-from"
                  value={metroFrom}
                  onChange={(e) => setMetroFrom(e.target.value)}
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-[var(--hair)] bg-[var(--field)] px-3 text-sm text-[var(--text)]"
                >
                  {metroStations.map((s) => (
                    <option key={s.code} value={s.code} className="bg-[var(--surface)] text-[var(--text)]">
                      {locale === 'bn' ? s.nameBn : s.nameEn}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="metro-to" className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  {dict.transport.toStation}
                </label>
                <select
                  id="metro-to"
                  value={metroTo}
                  onChange={(e) => setMetroTo(e.target.value)}
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-[var(--hair)] bg-[var(--field)] px-3 text-sm text-[var(--text)]"
                >
                  {metroStations.map((s) => (
                    <option key={s.code} value={s.code} className="bg-[var(--surface)] text-[var(--text)]">
                      {locale === 'bn' ? s.nameBn : s.nameEn}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {metroFare && (
              <div className="mt-4 rounded-xl border border-[var(--hair)] bg-[var(--surface-2)] p-4 text-sm text-[var(--text)]">
                <p className="font-extrabold text-[var(--gold)]">
                  {dict.transport.singleJourney}: {formatBdt(metroFare.singleJourneyFareBdt, locale)}
                </p>
                <p className="mt-1 font-semibold text-[var(--text)]">
                  {dict.transport.rapidPass}: {formatBdt(metroFare.mrtOrRapidPassFareBdt, locale)}
                </p>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-[var(--hair)] bg-[var(--surface)] p-5 shadow-sm">
            <h2 className="text-lg font-bold text-[var(--hero-text)]">{dict.transport.tollsTitle}</h2>
            <div className="mt-3 space-y-3">
              {tolls.map((t) => (
                <div key={t.code} className="rounded-xl border border-[var(--hair)] bg-[var(--surface-2)] p-3">
                  <p className="font-bold text-[var(--hero-text)]">{locale === 'bn' ? t.nameBn : t.nameEn}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    {Object.entries(t.ratesBdt).map(([k, v]) => (
                      <span key={k} className="rounded border border-[var(--hair)] bg-[var(--surface)] px-2 py-0.5 text-[var(--text-muted)]">
                        {k.replace(/_/g, ' ')}: <strong className="text-[var(--gold)]">{formatBdt(v, locale)}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* BUS TAB */}
      {tab === 'bus' && (
        <div className="space-y-4">
          <section className="rounded-2xl border border-[var(--hair)] bg-[var(--surface)] p-5 shadow-sm">
            <h2 className="text-lg font-bold text-[var(--hero-text)]">{dict.transport.busFareTitle}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="bus-from" className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  {dict.transport.fromStation}
                </label>
                <input
                  id="bus-from"
                  type="text"
                  value={busFrom}
                  onChange={(e) => setBusFrom(e.target.value)}
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-[var(--hair)] bg-[var(--field)] px-3 text-sm text-[var(--text)]"
                />
              </div>
              <div>
                <label htmlFor="bus-to" className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  {dict.transport.toStation}
                </label>
                <input
                  id="bus-to"
                  type="text"
                  value={busTo}
                  onChange={(e) => setBusTo(e.target.value)}
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-[var(--hair)] bg-[var(--field)] px-3 text-sm text-[var(--text)]"
                />
              </div>
            </div>
            {busEstimate && (
              <p className="mt-3 rounded-xl border border-[var(--hair)] bg-[var(--surface-2)] p-3 text-sm font-bold text-[var(--gold)]">
                {formatDigits(busEstimate.distanceKm, locale)} km · {dict.transport.estimatedFare}:{' '}
                {formatBdt(busEstimate.officialFareEstimateBdt, locale)}
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-[var(--hair)] bg-[var(--surface)] p-5 shadow-sm">
            <h2 className="text-base font-bold text-[var(--hero-text)]">
              {dict.transport.busTerminalsTitle} ({formatDigits(busTerminals.length, locale)})
            </h2>
            <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              {busTerminals.slice(0, 60).map((bt) => (
                <div key={bt.code} className="rounded-lg border border-[var(--hair)] bg-[var(--surface-2)] p-2.5 text-xs">
                  <p className="font-bold text-[var(--text)]">{locale === 'bn' ? bt.nameBn : bt.nameEn}</p>
                  <p className="text-[var(--text-muted)]">{bt.districtEn}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* WATER & AIR TAB */}
      {tab === 'water' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-[var(--hair)] bg-[var(--surface)] p-5 shadow-sm">
            <h2 className="text-lg font-bold text-[var(--hero-text)]">{dict.transport.waterTitle}</h2>
            <div className="mt-3 space-y-2.5">
              {waterRoutes.map((w) => (
                <div key={w.id} className="rounded-xl border border-[var(--hair)] bg-[var(--surface-2)] p-3 text-sm">
                  <p className="font-bold text-[var(--text)]">{locale === 'bn' ? w.nameBn : w.nameEn}</p>
                  {w.weatherWarningUrl && (
                    <a
                      href={w.weatherWarningUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-xs font-semibold text-[var(--gold)] underline"
                    >
                      {locale === 'bn' ? 'আবহাওয়া ও নদীবন্দর সতর্কতা দেখুন →' : 'Check BMD river port warning →'}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-[var(--hair)] bg-[var(--surface)] p-5 shadow-sm">
            <h2 className="text-lg font-bold text-[var(--hero-text)]">{dict.transport.airTitle}</h2>
            <div className="mt-3 space-y-2.5">
              {airRoutes.map((a) => (
                <div key={a.id} className="rounded-xl border border-[var(--hair)] bg-[var(--surface-2)] p-3 text-sm">
                  <p className="font-bold text-[var(--text)]">{locale === 'bn' ? a.routeBn : a.routeEn}</p>
                  <p className="text-xs text-[var(--text-muted)]">{formatDuration(a.flightDurationMin, locale)}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {a.officialAirlineUrls.map((u) => (
                      <a
                        key={u}
                        href={u}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-[var(--gold)] px-2.5 py-1 text-xs font-bold text-[#050709] hover:opacity-90"
                      >
                        {u.replace(/^https?:\/\//, '')}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* JOURNEY PLANNER TAB */}
      {tab === 'planner' && (
        <section className="space-y-4 rounded-2xl border border-[var(--hair)] bg-[var(--surface)] p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[var(--hero-text)]">{dict.transport.plannerTitle}</h2>
          <form onSubmit={(e) => void runPlanner(e)} className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="plan-from" className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {dict.transport.fromStation}
              </label>
              <input
                id="plan-from"
                type="text"
                value={planFrom}
                onChange={(e) => setPlanFrom(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-[var(--hair)] bg-[var(--field)] px-3 text-sm text-[var(--text)]"
              />
            </div>
            <div>
              <label htmlFor="plan-to" className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {dict.transport.toStation}
              </label>
              <input
                id="plan-to"
                type="text"
                value={planTo}
                onChange={(e) => setPlanTo(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-[var(--hair)] bg-[var(--field)] px-3 text-sm text-[var(--text)]"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="min-h-[44px] w-full rounded-xl bg-[var(--gold)] px-4 text-sm font-bold text-[#050709] hover:opacity-90"
              >
                {dict.transport.planButton}
              </button>
            </div>
          </form>
          {itineraries.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {itineraries.map((it, idx) => (
                <div key={idx} className="rounded-xl border border-[var(--hair)] bg-[var(--surface-2)] p-4 text-sm">
                  <p className="font-bold text-[var(--hero-text)]">{it.labelBn}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {formatDuration(it.durationMin, locale)} · <strong className="text-[var(--gold)]">{formatBdt(it.estimatedFareBdt, locale)}</strong>
                  </p>
                  <a
                    href={it.officialChannelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs font-bold text-[var(--gold)] underline"
                  >
                    {dict.transport.continueOfficial} →
                  </a>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      </div>
    </div>
  );
}
