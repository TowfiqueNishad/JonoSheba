'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDigits } from '@jonoshheba/shared';
import { FilmPlateBanner } from '../../components/NostosPrimitive';
import { EmptyStateCard, ErrorRetryCard, SkeletonGrid, TrustChip } from '../../components/UiStates';
import { apiGet } from '../../lib/api';
import { useLocale } from '../../lib/i18n';

interface MinistryGroupMeta {
  code: string;
  nameBn: string;
  nameEn: string;
}

interface OrgItem {
  id: string;
  type: string;
  group: string;
  groupBn: string;
  groupEn: string;
  nameBn: string;
  nameEn: string;
  website: string;
  phone: string;
  citizenCharterUrl: string;
  districtEn: string;
  servicesOffered: string[];
  lastVerifiedAt: string;
  leadership: Array<{
    designationBn: string;
    designationEn: string;
    incumbentNameBn: string;
    incumbentNameEn: string;
    officePhone: string;
    verificationStatus: string;
  }>;
}

const BANGLA_INDEX_LETTERS = ['সব', 'অ', 'আ', 'ই', 'উ', 'ক', 'খ', 'গ', 'চ', 'জ', 'ট', 'ড', 'ত', 'দ', 'ন', 'প', 'ফ', 'ব', 'ভ', 'ম', 'য', 'র', 'ল', 'শ', 'স', 'হ'];
const LATIN_INDEX_LETTERS = ['ALL', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'R', 'S', 'T', 'U', 'W'];

export default function MinistriesDirectoryPage() {
  const { locale, dict, localePath } = useLocale();
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [groups, setGroups] = useState<MinistryGroupMeta[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [search, setSearch] = useState('');
  const [selectedLetter, setSelectedLetter] = useState<string>('');
  const [noticeText, setNoticeText] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDirectory() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<{
        count: number;
        groups: MinistryGroupMeta[];
        verificationNoticeBn: string;
        verificationNoticeEn: string;
        items: OrgItem[];
      }>('/api/v1/orgs', { locale });
      setOrgs(res.items ?? []);
      setGroups(res.groups ?? []);
      setNoticeText(locale === 'bn' ? res.verificationNoticeBn : res.verificationNoticeEn);
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.states.errorHint);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDirectory();
  }, [locale]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orgs.filter((o) => {
      if (selectedGroup && o.group !== selectedGroup) return false;
      if (selectedLetter && selectedLetter !== 'সব' && selectedLetter !== 'ALL') {
        const title = locale === 'bn' ? o.nameBn : o.nameEn.toUpperCase();
        if (!title.startsWith(selectedLetter)) return false;
      }
      if (!q) return true;
      return (
        o.nameBn.includes(search.trim()) ||
        o.nameEn.toLowerCase().includes(q) ||
        o.phone.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q)
      );
    });
  }, [orgs, selectedGroup, selectedLetter, search, locale]);

  const indexLetters = locale === 'bn' ? BANGLA_INDEX_LETTERS : LATIN_INDEX_LETTERS;

  return (
    <div>
      <FilmPlateBanner
        overline="II — THE HARBOURS · MINISTRIES & LEADERSHIP"
        title={
          locale === 'bn'
            ? 'মন্ত্রণালয়, বিভাগ ও সরকারি দপ্তর ডিরেক্টরি'
            : 'Ministries, Divisions & Government Directory'
        }
        subtitle={
          locale === 'bn'
            ? 'অফিসিয়াল ওয়েবসাইট, প্রধানগণ (দপ্তর প্রধান ও সচিব), অফিস ফোন, হটলাইন, সিটিজেন চার্টার এবং অভিযোগ ফোকাল পয়েন্ট'
            : 'Official websites, leadership office phones, hotlines, citizen charters, and GRS/RTI focal points'
        }
        breadcrumb={[{ label: dict.nav.home, href: '/' }, { label: locale === 'bn' ? 'মন্ত্রণালয়' : 'Ministries' }]}
        actions={
          <Link
            href={localePath('/hotlines')}
            className="nostos-btn-gold"
          >
            {locale === 'bn' ? 'জাতীয় হটলাইন ডিরেক্টরি →' : 'National Hotline Directory →'}
          </Link>
        }
      />

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        {/* Honest Verification Status Banner */}
        {noticeText && (
          <div className="border-l-2 border-[var(--gold)] bg-[var(--surface)] p-4 text-xs text-[var(--text)]">
            {noticeText}
          </div>
        )}

      {/* Search & Group Filter */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label htmlFor="ministry-search-input" className="sr-only">
            {locale === 'bn' ? 'মন্ত্রণালয় বা দপ্তর খুঁজুন' : 'Search ministry or office'}
          </label>
          <input
            id="ministry-search-input"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              locale === 'bn'
                ? 'মন্ত্রণালয়, অধিদপ্তর বা ফোন নম্বর দিয়ে খুঁজুন (যেমন: ভূমি, পাসপোর্ট, বিআরটিএ)...'
                : 'Search ministry, directorate, or phone (e.g., Land, Passport, BRTA)...'
            }
            className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-4 text-sm"
          />
        </div>
        <div>
          <label htmlFor="ministry-group-select" className="sr-only">
            {locale === 'bn' ? 'মন্ত্রণালয় খাত নির্বাচন' : 'Select ministry group'}
          </label>
          <select
            id="ministry-group-select"
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="">
              {locale === 'bn' ? 'সকল খাত (১০টি গ্রুপ)' : 'All Sectors (10 Groups)'}
            </option>
            {groups.map((g) => (
              <option key={g.code} value={g.code}>
                {locale === 'bn' ? g.nameBn : g.nameEn}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* অ–হ / A–Z Alphabetical Index */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Alphabetical index">
        {indexLetters.map((letter) => {
          const active =
            selectedLetter === letter ||
            (!selectedLetter && (letter === 'সব' || letter === 'ALL'));
          return (
            <button
              key={letter}
              type="button"
              onClick={() =>
                setSelectedLetter(letter === 'সব' || letter === 'ALL' ? '' : letter)
              }
              className={`min-h-[36px] min-w-[36px] rounded-lg px-2 text-xs font-extrabold transition ${
                active
                  ? 'bg-emerald-700 text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              {letter}
            </button>
          );
        })}
      </div>

      {error && <ErrorRetryCard message={error} onRetry={() => void loadDirectory()} />}

      {loading ? (
        <SkeletonGrid count={6} />
      ) : filtered.length === 0 ? (
        <EmptyStateCard />
      ) : (
        <section aria-live="polite" className="space-y-4">
          <p className="text-xs font-bold text-slate-600">
            {locale === 'bn'
              ? `${formatDigits(filtered.length, 'bn')}টি মন্ত্রণালয় ও সরকারি দপ্তর দেখানো হচ্ছে`
              : `Showing ${filtered.length} ministries & government offices`}
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((org) => (
              <article
                key={org.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-900">
                      {locale === 'bn' ? org.groupBn : org.groupEn}
                    </span>
                    <TrustChip
                      label="OFFICIAL_SOURCE"
                      lastVerifiedAt={org.lastVerifiedAt}
                      locale={locale}
                    />
                  </div>

                  <h2 className="mt-2.5 text-base font-extrabold text-slate-900">
                    <Link
                      href={localePath(`/ministries/${org.id}`)}
                      className="hover:text-emerald-800 hover:underline"
                    >
                      {locale === 'bn' ? org.nameBn : org.nameEn}
                    </Link>
                  </h2>

                  <div className="mt-3 space-y-1.5 text-xs text-slate-700">
                    <p>
                      <span className="font-bold">
                        {locale === 'bn' ? 'অফিস ফোন / হটলাইন:' : 'Office Phone / Helpline:'}
                      </span>{' '}
                      <a href={`tel:${org.phone}`} className="font-extrabold text-emerald-800 underline">
                        {org.phone}
                      </a>
                    </p>
                    <p>
                      <span className="font-bold">
                        {locale === 'bn' ? 'প্রধানগণ (সচিব / প্রধান):' : 'Leadership:'}
                      </span>{' '}
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900">
                        {locale === 'bn' ? 'যাচাই চলছে' : 'Verification pending'}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                  <Link
                    href={localePath(`/ministries/${org.id}`)}
                    className="font-extrabold text-emerald-800 hover:underline"
                  >
                    {locale === 'bn' ? 'প্রধানগণ ও বিস্তারিত →' : 'Leadership & Details →'}
                  </Link>
                  <a
                    href={org.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-slate-700 underline"
                  >
                    {locale === 'bn' ? 'ওয়েবসাইট' : 'Website'}
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      </div>
    </div>
  );
}
