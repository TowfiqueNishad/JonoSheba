'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { formatDigits } from '@jonoshheba/shared';
import { ChapterHeading, toRoman } from '../components/NostosPrimitive';
import { SearchCombobox } from '../components/SearchCombobox';
import { ErrorRetryCard, SkeletonGrid, TrustChip } from '../components/UiStates';
import { apiGet } from '../lib/api';
import { useLocale } from '../lib/i18n';

interface PublicStats {
  divisions: number;
  districts: number;
  upazilas: number;
  railStations: number;
  mrtOperationalStations: number;
  serviceCategories: number;
  services: number;
  lifeEventBundles: number;
  hotlinesTotal: number;
  hotlinesVerified: number;
  programmes: number;
  busTerminals: number;
  waterTerminals: number;
  airports: number;
}

interface LifeEventBundle {
  slug: string;
  titleBn: string;
  titleEn: string;
  categories: string[];
}

interface NoticeItem {
  id: string;
  title?: string;
  titleBn?: string;
  titleEn?: string;
  summary?: string;
  kind: string;
  trustLabel: string;
  lastVerifiedAt?: string | null;
  officialUrl?: string;
}

interface SearchHit {
  id: string;
  type: string;
  slugOrCode: string;
  title: string;
  summary?: string;
  trustLabel?: string;
}

export default function HomePage() {
  const { locale, dict, localePath } = useLocale();
  const [searchResults, setSearchResults] = useState<SearchHit[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [stats, setStats] = useState<PublicStats | null>(null);
  const [lifeEvents, setLifeEvents] = useState<LifeEventBundle[]>([]);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [areaText, setAreaText] = useState<string | null>(null);
  const [areaBusy, setAreaBusy] = useState(false);
  const heroSearchRef = useRef<HTMLDivElement | null>(null);

  // Section 1 Fix First: Observe hero search visibility so the header search only fades in
  // when the hero search scrolls out of view (single search bar in initial viewport).
  useEffect(() => {
    const el = heroSearchRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        window.dispatchEvent(
          new CustomEvent('nostos:hero-search-visibility', {
            detail: { inView: entry.isIntersecting },
          }),
        );
      },
      { threshold: 0.1 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      window.dispatchEvent(
        new CustomEvent('nostos:hero-search-visibility', { detail: { inView: false } }),
      );
    };
  }, []);

  async function loadHomeData() {
    setLoading(true);
    setLoadError(null);
    const [sRes, leRes, nRes] = await Promise.allSettled([
      apiGet<PublicStats>('/api/v1/stats', { locale }),
      apiGet<{ items: LifeEventBundle[] }>('/api/v1/services/life-event-bundles', { locale }),
      apiGet<{ items: NoticeItem[] }>('/api/v1/notices', { locale }),
    ]);

    if (sRes.status === 'fulfilled') setStats(sRes.value);
    if (leRes.status === 'fulfilled') setLifeEvents(leRes.value.items ?? []);
    if (nRes.status === 'fulfilled') setNotices((nRes.value.items ?? []).slice(0, 5));

    if (sRes.status === 'rejected' && leRes.status === 'rejected') {
      setLoadError(dict.states.errorHint);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadHomeData();
  }, [locale]);

  function detectMyArea() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setAreaText(
        locale === 'bn'
          ? 'এই ব্রাউজারে লোকেশন সমর্থিত নয়।'
          : 'Geolocation is not supported in this browser.',
      );
      return;
    }
    setAreaBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const data = await apiGet<{
            division?: { nameBn: string; nameEn: string };
            district?: { nameBn: string; nameEn: string };
            upazila?: { nameBn: string; nameEn: string };
          }>(
            `/api/v1/geo/resolve?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`,
            { locale },
          );
          const parts = [data.upazila, data.district, data.division]
            .filter(Boolean)
            .map((x) => (locale === 'bn' ? x!.nameBn : x!.nameEn));
          setAreaText(parts.join(', '));
        } catch {
          setAreaText(
            locale === 'bn'
              ? 'বাংলাদেশের বাইরের অবস্থান অথবা অবস্থান শনাক্ত করা যায়নি।'
              : 'Location is outside Bangladesh coverage or could not be resolved.',
          );
        } finally {
          setAreaBusy(false);
        }
      },
      () => {
        setAreaText(
          locale === 'bn'
            ? 'অবস্থান দেখার অনুমতি দেওয়া হয়নি।'
            : 'Location permission was declined.',
        );
        setAreaBusy(false);
      },
    );
  }

  const harbours = [
    {
      href: '/transport',
      overline: 'RAIL · METRO · BUS · RIVER',
      title: dict.nav.transport,
      plateGradient: 'linear-gradient(155deg,#0C1826 0%,#132538 55%,#1E3246 100%)',
      metric: stats
        ? locale === 'bn'
          ? `${formatDigits(stats.railStations, 'bn')} রেল স্টেশন · ${formatDigits(stats.busTerminals, 'bn')} বাস টার্মিনাল`
          : `${stats.railStations} rail stations · ${stats.busTerminals} bus terminals`
        : null,
    },
    {
      href: '/services',
      overline: 'CITIZEN DIRECTORY',
      title: dict.nav.services,
      plateGradient: 'linear-gradient(155deg,#0B141E 0%,#162432 55%,#243546 100%)',
      metric: stats
        ? locale === 'bn'
          ? `${formatDigits(stats.serviceCategories, 'bn')} খাত · ${formatDigits(stats.services, 'bn')}+ সেবা`
          : `${stats.serviceCategories} categories · ${stats.services}+ services`
        : null,
    },
    {
      href: '/ministries',
      overline: 'MINISTRIES & LEADERSHIP',
      title: locale === 'bn' ? 'মন্ত্রণালয় ও দপ্তর' : 'Ministries & Offices',
      plateGradient: 'linear-gradient(155deg,#0D151F 0%,#1A2736 60%,#293848 100%)',
      metric: locale === 'bn' ? '১০টি খাত · দপ্তর প্রধান ও সিটিজেন চার্টার' : '10 sectors · leadership & citizen charters',
    },
    {
      href: '/education',
      overline: 'BANBEIS · UGC · BOARDS',
      title: locale === 'bn' ? 'শিক্ষা ও EIIN হাব' : 'Education & EIIN',
      plateGradient: 'linear-gradient(155deg,#0A131C 0%,#172636 55%,#273B4E 100%)',
      metric: locale === 'bn' ? 'EIIN · UGC বিশ্ববিদ্যালয় · ১১টি শিক্ষা বোর্ড' : 'EIIN · UGC universities · 11 Education Boards',
    },
    {
      href: '/benefits',
      overline: 'ALLOWANCES & FAMILY CARD',
      title: dict.nav.benefits,
      plateGradient: 'linear-gradient(155deg,#101720 0%,#1D2B3A 55%,#2C3C4C 100%)',
      metric: stats
        ? locale === 'bn'
          ? `${formatDigits(stats.programmes, 'bn')}টি কর্মসূচি ও যোগ্যতা যাচাই`
          : `${stats.programmes} programmes & eligibility checker`
        : null,
    },
    {
      href: '/jono',
      overline: 'THE ORACLE ASSISTANT',
      title: dict.nav.jono,
      plateGradient: 'linear-gradient(155deg,#09121B 0%,#16263A 55%,#2A3A4A 100%)',
      metric: locale === 'bn' ? 'উৎসসহ বাংলা ও ইংরেজি নাগরিক সহায়ক' : 'Cited bilingual citizen intelligence',
    },
    {
      href: '/emergency',
      overline: 'IMMEDIATE RESPONSE · 999',
      title: dict.nav.emergency,
      plateGradient: 'linear-gradient(155deg,#1F0B0A 0%,#3B1310 60%,#5C1C17 100%)',
      metric: stats
        ? locale === 'bn'
          ? `${formatDigits(stats.hotlinesTotal, 'bn')} হটলাইন (${formatDigits(stats.hotlinesVerified, 'bn')} যাচাইকৃত)`
          : `${stats.hotlinesTotal} hotlines (${stats.hotlinesVerified} verified)`
        : null,
    },
    {
      href: '/complaints',
      overline: 'GRIEVANCE REDRESS · GRS',
      title: dict.nav.complaints,
      plateGradient: 'linear-gradient(155deg,#0C141C 0%,#172430 60%,#233442 100%)',
      metric: locale === 'bn' ? 'অভিযোগ খসড়া ও কেন্দ্রীয় GRS' : 'Structured grievance draft & GRS hand-off',
    },
    {
      href: '/near-me',
      overline: 'HOSPITALS · SHELTERS · UDC',
      title: dict.nav.nearMe,
      plateGradient: 'linear-gradient(155deg,#0A151E 0%,#152635 60%,#213748 100%)',
      metric: locale === 'bn' ? 'হাসপাতাল, আশ্রয়কেন্দ্র ও অফলাইন ম্যাপ' : 'Hospitals, cyclone shelters & offline packs',
    },
    {
      href: '/scholarships',
      overline: 'STIPENDS & GRANTS',
      title: dict.nav.scholarships,
      plateGradient: 'linear-gradient(155deg,#0E1620 0%,#1B2938 60%,#2A3A4B 100%)',
      metric: locale === 'bn' ? 'সরকারি উপবৃত্তি ও শিক্ষাবৃত্তি' : 'Verified public stipends & grants',
    },
    {
      href: '/jobs',
      overline: 'PUBLIC RECRUITMENT',
      title: dict.nav.jobs,
      plateGradient: 'linear-gradient(155deg,#0B131B 0%,#182534 60%,#263646 100%)',
      metric: locale === 'bn' ? 'সরকারি নিয়োগ বিজ্ঞপ্তি' : 'Verified public recruitment circulars',
    },
    {
      href: '/hotlines',
      overline: 'NATIONAL HELPLINES',
      title: locale === 'bn' ? 'জাতীয় হটলাইন ডিরেক্টরি' : 'Hotline Directory',
      plateGradient: 'linear-gradient(155deg,#0E151D 0%,#192634 60%,#273747 100%)',
      metric: locale === 'bn' ? 'সরাসরি কল ও পরিস্থিতি সহায়ক' : 'Direct tap-to-call & situation helper',
    },
  ];

  return (
    <div className="space-y-20 pb-12">
      {/* ═══════════════════════════════════════════════════════════════════
       * HERO — FULL-BLEED NOSTOS FILM PLATE (860px desktop)
       * ═══════════════════════════════════════════════════════════════════ */}
      <section className="nostos-film-plate relative flex min-h-[680px] flex-col justify-between overflow-hidden border-b border-[var(--hair)] lg:min-h-[860px]">
        {/* Top 14px letterbox bar */}
        <div aria-hidden="true" className="h-[14px] w-full bg-[#020304]" />

        {/* Atmospheric backdrop (sky, luminous horizon, water light-path, drifting fog, vignette — no sun/moon orb behind text) */}
        <div aria-hidden="true" className="nostos-plate-backdrop pointer-events-none absolute inset-0">
          <div className="nostos-horizon-line" />
          <div className="nostos-water-path" />
          <div className="nostos-fog-layer-1" />
          <div className="nostos-vignette" />
        </div>

        {/* Hero Centerpiece Scrim */}
        <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
          <p
            aria-label={
              locale === 'bn'
                ? 'সকল সরকারি সেবা, এক ঠিকানায় (ALL PUBLIC SERVICES · ONE DESTINATION)'
                : 'ALL PUBLIC SERVICES · ONE DESTINATION'
            }
            className="nostos-overline text-[var(--accent)]"
          >
            ALL PUBLIC SERVICES · ONE DESTINATION
          </p>

          <h1 className="nostos-display-h1 mt-5 text-[clamp(3rem,6.4vw,6rem)] text-[var(--hero-text)]">
            {locale === 'bn'
              ? 'সব সরকারি সেবা। এক ঠিকানায়।'
              : 'Every Public Service. One Harbour.'}
          </h1>

          <p className="nostos-editorial-italic mt-4 max-w-2xl text-xl text-[var(--hero-muted)] sm:text-2xl">
            {locale === 'bn'
              ? 'যাত্রা যতই দীর্ঘ হোক — পথ দেখাবে জনসেবা।'
              : 'However long the voyage home — Jonoshheba lights the way.'}
          </p>

          {/* The SINGLE Search Bar in the Home Viewport */}
          <div ref={heroSearchRef} data-testid="hero-search-slot" className="mt-10 w-full max-w-2xl text-left">
            <SearchCombobox
              variant="hero"
              onSelectQuery={(q) => {
                void apiGet<{ hits?: SearchHit[]; items?: SearchHit[] }>(
                  `/api/v1/search?q=${encodeURIComponent(q)}&limit=10`,
                  { locale },
                )
                  .then((res) => setSearchResults(res.hits ?? res.items ?? []))
                  .catch((err) =>
                    setSearchError(err instanceof Error ? err.message : dict.states.errorHint),
                  );
              }}
            />
          </div>

          {searchError && (
            <p role="alert" className="mt-3 text-xs text-[#E57368]">
              {searchError}
            </p>
          )}

          {searchResults && (
            <div
              aria-live="polite"
              className="mt-4 w-full max-w-2xl border border-[var(--hair)] bg-[var(--panel)] p-4 text-left text-xs text-[var(--text)] backdrop-blur-xl"
            >
              {searchResults.length === 0 ? (
                <p>{dict.states.empty}</p>
              ) : (
                <ul className="divide-y divide-[var(--hair)]">
                  {searchResults.map((hit) => {
                    const href =
                      hit.type === 'service'
                        ? `/services/${hit.slugOrCode}`
                        : hit.type === 'programme'
                          ? `/programmes/${hit.slugOrCode}`
                          : hit.type === 'station'
                            ? '/transport'
                            : '/services';
                    return (
                      <li key={`${hit.type}-${hit.id}`} className="py-2">
                        <Link
                          href={localePath(href)}
                          className="flex items-center justify-between gap-2 hover:text-[var(--gold)]"
                        >
                          <span className="font-semibold">{hit.title}</span>
                          <span className="nostos-overline text-[9px] text-[var(--accent)]">
                            {hit.type}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {/* Subtle Location & 2G Lite Strip */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-[var(--hero-muted)]">
            <button
              type="button"
              onClick={detectMyArea}
              disabled={areaBusy}
              className="nostos-link text-xs uppercase tracking-[0.22em] text-[var(--hero-text)]"
            >
              {areaBusy ? dict.states.loading : dict.home.detectLocation}
            </button>
            {areaText && <span className="text-[var(--gold)]">· {areaText}</span>}
            <span aria-hidden="true" className="text-[var(--hair)]">
              |
            </span>
            <a
              href={`/lite?lang=${locale}`}
              className="nostos-link text-xs uppercase tracking-[0.22em] text-[var(--gold)]"
            >
              {dict.nav.lite} →
            </a>
          </div>
        </div>

        {/* Animated Hairline SCROLL Cue */}
        <div className="relative z-10 flex flex-col items-center pb-5">
          <span className="nostos-overline text-[9px] tracking-[0.45em] text-[var(--hero-muted)]">
            SCROLL
          </span>
          <span
            aria-hidden="true"
            className="mt-2 block h-8 w-[1px] bg-gradient-to-b from-[var(--gold)] to-transparent"
          />
        </div>

        {/* Bottom 14px letterbox bar */}
        <div aria-hidden="true" className="h-[14px] w-full bg-[#020304]" />
      </section>

      <div className="mx-auto max-w-6xl space-y-24 px-4 sm:px-6">
        {loadError && <ErrorRetryCard message={loadError} onRetry={() => void loadHomeData()} />}

        {/* ═══════════════════════════════════════════════════════════════════
         * I — CHAPTERS OF LIFE (Two-Column Editorial List with Roman Numerals)
         * ═══════════════════════════════════════════════════════════════════ */}
        <section aria-labelledby="chapter-i-heading">
          <ChapterHeading
            roman="I"
            overline="CHAPTERS OF LIFE"
            title={dict.home.lifeEventsTitle}
            subtitle={
              locale === 'bn'
                ? 'নাগরিক জীবনের প্রতিটি সন্ধিক্ষণে প্রয়োজনীয় সরকারি সেবার সমন্বিত পথনির্দেশ'
                : 'Curated public-service pathways for every milestone of a citizen’s life'
            }
            action={
              <Link
                href={localePath('/life-events')}
                className="nostos-link font-overline text-[10px] uppercase tracking-[0.32em] text-[var(--gold)]"
              >
                {dict.home.viewAll} →
              </Link>
            }
          />

          {loading ? (
            <SkeletonGrid count={6} />
          ) : (
            <div className="grid gap-x-12 border-t border-[var(--hair)] md:grid-cols-2">
              {lifeEvents.slice(0, 8).map((ev, idx) => (
                <Link
                  key={ev.slug}
                  href={localePath(`/life-events/${ev.slug}`)}
                  className="nostos-editorial-row flex min-h-[68px] items-center justify-between gap-4 py-4"
                >
                  <div className="flex items-baseline gap-4">
                    <span className="nostos-editorial-italic w-8 shrink-0 text-sm text-[var(--gold)]">
                      {toRoman(idx + 1)}
                    </span>
                    <div>
                      <h3 className="text-base font-semibold text-[var(--text)]">
                        {locale === 'bn' ? ev.titleBn : ev.titleEn}
                      </h3>
                      <p className="nostos-editorial-italic mt-0.5 text-xs text-[var(--text-muted)]">
                        {locale === 'bn' ? ev.titleEn : ev.categories.slice(0, 3).join(' · ')}
                      </p>
                    </div>
                  </div>
                  <span aria-hidden="true" className="nostos-row-arrow text-sm text-[var(--text-muted)]">
                    →
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
         * II — THE HARBOURS (Tile Grid Separated by 2px Hairline Gaps)
         * ═══════════════════════════════════════════════════════════════════ */}
        <section aria-labelledby="chapter-ii-heading">
          <ChapterHeading
            roman="II"
            overline="THE HARBOURS"
            title={dict.home.modulesTitle}
            subtitle={
              locale === 'bn'
                ? 'পরিবহন, সেবা, মন্ত্রণালয়, শিক্ষা, ভাতা ও জরুরি সহায়তার ১২টি বন্দর'
                : 'Twelve civic harbours covering transport, ministries, education, benefits, and emergency response'
            }
          />

          <div className="grid gap-[2px] bg-[var(--hair)] sm:grid-cols-2 lg:grid-cols-3">
            {harbours.map((m, idx) => (
              <Link
                key={m.href}
                href={localePath(m.href)}
                className="nostos-harbour-tile group relative flex min-h-[190px] flex-col justify-between p-6"
              >
                {/* Moody Graded Plate + Bottom Scrim */}
                <div
                  aria-hidden="true"
                  style={{ background: m.plateGradient }}
                  className="nostos-harbour-plate pointer-events-none absolute inset-0 opacity-40"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--surface)] via-[var(--surface)]/75 to-transparent"
                />

                <div className="relative z-10 flex items-center justify-between">
                  <span className="nostos-overline text-[9px] text-[var(--accent)]">
                    {m.overline}
                  </span>
                  <span className="nostos-editorial-italic text-xs text-[var(--gold)]">
                    {toRoman(idx + 1)}
                  </span>
                </div>

                <div className="relative z-10 mt-8 transition-transform duration-700 ease-[cubic-bezier(.16,1,.3,1)] group-hover:-translate-y-1">
                  <h3 className="text-xl font-semibold text-[var(--text)]">{m.title}</h3>
                  {m.metric ? (
                    <p className="nostos-editorial-italic mt-1 text-sm text-[var(--text-muted)]">
                      {m.metric}
                    </p>
                  ) : (
                    <div className="nostos-skeleton-sheen mt-2 h-3 w-32" />
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
         * III — THE ORACLE (Deep Steel Band with Sample Exchange & CTA)
         * ═══════════════════════════════════════════════════════════════════ */}
        <section aria-labelledby="chapter-iii-heading">
          <ChapterHeading
            roman="III"
            overline="THE ORACLE"
            title={locale === 'bn' ? 'জনো — আপনার নাগরিক পরামর্শক' : 'Jono — The Civic Oracle'}
            subtitle={
              locale === 'bn'
                ? 'প্রতিটি তথ্য সরকারি সূত্র থেকে যাচাইকৃত; কোনো অনুমান নয়, কোনো অটো-বুকিং নয়'
                : 'Every claim grounded in verified official sources; zero fabrication, zero auto-booking'
            }
          />

          <div
            style={{ background: 'var(--band)' }}
            className="border border-[var(--hair)] p-6 sm:p-10"
          >
            <div className="grid items-center gap-8 lg:grid-cols-12">
              <div className="space-y-4 lg:col-span-7">
                {/* Sample Citizen Query */}
                <div className="border border-[var(--hair)] bg-[var(--surface)] p-4">
                  <p className="nostos-overline text-[9px] text-[var(--text-muted)]">
                    {locale === 'bn' ? 'নাগরিকের প্রশ্ন' : 'CITIZEN INQUIRY'}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text)]">
                    {locale === 'bn'
                      ? '“ই-পাসপোর্ট করতে কত টাকা লাগে এবং পুলিশ ভেরিফিকেশন কি এখনো লাগে?”'
                      : '“What is the fee for a 48-page e-Passport and is police verification still required?”'}
                  </p>
                </div>

                {/* Sample Oracle Grounded Reply with Gold Left Rule */}
                <div className="border-l-2 border-[var(--gold)] bg-[var(--surface)] p-5">
                  <p className="nostos-overline text-[9px] text-[var(--gold)]">
                    {locale === 'bn' ? 'জনো · যাচাইকৃত উত্তর' : 'JONO ORACLE · GROUNDED RESPONSE'}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--text)]">
                    {locale === 'bn'
                      ? '৪৮ পৃষ্ঠা ও ৫ বছর মেয়াদি সাধারণ ই-পাসপোর্টের সরকারি ফি ৪,০২৫ টাকা (১৫% ভ্যাটসহ)। ফেব্রুয়ারি ২০২৫-এর সরকারি প্রজ্ঞাপন অনুযায়ী পাসপোর্ট ইস্যুতে আর প্রাক-পুলিশ ভেরিফিকেশন প্রয়োজন হয় না।'
                      : 'A 48-page, 5-year regular e-Passport costs BDT 4,025 (including 15% VAT). Under the February 2025 government circular, pre-issue police verification is no longer required.'}
                  </p>
                  <p className="nostos-overline mt-3 text-[9px] text-[var(--accent)]">
                    SOURCE · DEPARTMENT OF IMMIGRATION &amp; PASSPORTS (EPASSPORT.GOV.BD)
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-start justify-center space-y-4 lg:col-span-5">
                <p className="nostos-editorial-italic text-xl text-[var(--text)]">
                  {locale === 'bn'
                    ? 'পাসপোর্ট, ট্রেনের সময়সূচি, ভাতা কিংবা মন্ত্রণালয়ের অফিস নম্বর — সরাসরি জনো-কে জিজ্ঞাসা করুন।'
                    : 'Ask about passports, train schedules, allowances, or ministry office numbers in Bangla or English.'}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href={localePath('/jono')} className="nostos-btn-gold">
                    {locale === 'bn' ? 'জনো-র সাথে কথা বলুন →' : 'CONSULT JONO →'}
                  </Link>
                  <a
                    href="tel:333"
                    className="inline-flex min-h-[44px] items-center border border-[var(--hair)] px-4 font-overline text-[10px] uppercase tracking-[0.24em] text-[var(--text)] hover:border-[var(--gold-line)]"
                  >
                    {dict.emergency.call333}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
         * IV — THE HERALD (Editorial Notice Rows: Date | Title | Status)
         * ═══════════════════════════════════════════════════════════════════ */}
        <section aria-labelledby="chapter-iv-heading">
          <ChapterHeading
            roman="IV"
            overline="THE HERALD"
            title={dict.home.activeNoticesTitle}
            subtitle={
              locale === 'bn'
                ? 'সরকারি প্রজ্ঞাপন, সময়সূচি পরিবর্তন ও জরুরি জনস্বার্থ বিজ্ঞপ্তি'
                : 'Official circulars, timetable revisions, and public-interest dispatches'
            }
            action={
              <Link
                href={localePath('/notices')}
                className="nostos-link font-overline text-[10px] uppercase tracking-[0.32em] text-[var(--gold)]"
              >
                {dict.home.viewAll} →
              </Link>
            }
          />

          {loading ? (
            <SkeletonGrid count={3} />
          ) : (
            <div className="border-t border-[var(--hair)]">
              {notices.map((n, idx) => (
                <article
                  key={n.id}
                  className="nostos-editorial-row flex flex-wrap items-center justify-between gap-4 py-4"
                >
                  <div className="flex min-w-0 flex-1 items-baseline gap-4">
                    <span className="nostos-editorial-italic w-8 shrink-0 text-sm text-[var(--gold)]">
                      {toRoman(idx + 1)}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-[var(--text)]">
                        {locale === 'bn' ? n.titleBn ?? n.title : n.titleEn ?? n.title}
                      </h3>
                      {n.summary && (
                        <p className="mt-1 text-xs text-[var(--text-muted)]">{n.summary}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <TrustChip
                      label={n.trustLabel}
                      lastVerifiedAt={n.lastVerifiedAt}
                      locale={locale}
                    />
                    {n.officialUrl && (
                      <a
                        href={n.officialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="nostos-row-arrow text-sm text-[var(--text-muted)]"
                        aria-label={dict.services.officialPortal}
                      >
                        →
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
