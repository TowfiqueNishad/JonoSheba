'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDigits } from '@jonoshheba/shared';
import { FilmPlateBanner } from '../../components/NostosPrimitive';
import { ErrorRetryCard, SkeletonGrid, TrustChip } from '../../components/UiStates';
import { apiGet } from '../../lib/api';
import { useLocale } from '../../lib/i18n';

interface Institution {
  id: string;
  nameBn: string;
  nameEn: string;
  type: string;
  level: string;
  management: string;
  eiin: string | null;
  ugcId: string | null;
  districtEn: string;
  upazilaEn: string | null;
  addressBn: string;
  addressEn: string;
  website: string | null;
  establishedYear: number | null;
  lastVerifiedAt: string | null;
  verificationStatus: 'verified' | 'verification_pending';
}

interface EducationBoard {
  code: string;
  nameBn: string;
  nameEn: string;
  website: string;
  resultsUrl: string;
  xiAdmissionUrl: string;
  certificateCorrectionUrl: string;
  lastVerifiedAt: string;
}

export default function EducationHubPage() {
  const { locale, dict, localePath } = useLocale();
  const [tab, setTab] = useState<'institutions' | 'universities' | 'boards'>('institutions');
  const [query, setQuery] = useState('');
  const [eiinFilter, setEiinFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [managementFilter] = useState('');
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [boards, setBoards] = useState<EducationBoard[]>([]);
  const [pendingNotice, setPendingNotice] = useState('');
  const [universityRule, setUniversityRule] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const eiinParam = params.get('eiin')?.trim() ?? '';
    const qParam = params.get('q')?.trim() ?? '';
    const tabParam = params.get('tab');
    if (eiinParam) setEiinFilter(eiinParam);
    if (qParam) setQuery(qParam);
    if (tabParam === 'universities' || tabParam === 'boards') setTab(tabParam);
  }, []);

  async function loadEducationData() {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (query.trim()) qs.set('q', query.trim());
      if (eiinFilter.trim() && /^\d{4,6}$/.test(eiinFilter.trim())) {
        qs.set('eiin', eiinFilter.trim());
      }
      if (typeFilter) qs.set('type', typeFilter);
      if (managementFilter) qs.set('management', managementFilter);

      const [instRes, boardRes] = await Promise.all([
        apiGet<{
          items: Institution[];
          pendingImportNoticeBn: string;
          pendingImportNoticeEn: string;
          universityEiinRuleBn: string;
          universityEiinRuleEn: string;
        }>(`/api/v1/education/institutions?${qs.toString()}`, { locale }),
        apiGet<{ items: EducationBoard[] }>('/api/v1/education/boards', { locale }),
      ]);

      setInstitutions(instRes.items ?? []);
      setPendingNotice(
        locale === 'bn' ? instRes.pendingImportNoticeBn : instRes.pendingImportNoticeEn,
      );
      setUniversityRule(
        locale === 'bn' ? instRes.universityEiinRuleBn : instRes.universityEiinRuleEn,
      );
      setBoards(boardRes.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.states.errorHint);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEducationData();
  }, [query, eiinFilter, typeFilter, managementFilter, locale]);

  return (
    <div>
      <FilmPlateBanner
        overline="II — THE HARBOURS · BANBEIS · UGC · BOARDS"
        title={
          locale === 'bn'
            ? 'শিক্ষা হাব — শিক্ষা প্রতিষ্ঠান (EIIN), ইউজিসি বিশ্ববিদ্যালয় ও শিক্ষা বোর্ড'
            : 'Education Hub — Institutions (EIIN), UGC Universities & Boards'
        }
        subtitle={
          locale === 'bn'
            ? 'ব্যানবেইস EIIN, ইউজিসি বিশ্ববিদ্যালয় তালিকা, বোর্ড পরীক্ষার ফলাফল, একাদশ ভর্তি ও শিক্ষাবৃত্তি'
            : 'BANBEIS EIIN lookup, UGC university listings, board exam results, XI admission, and scholarships'
        }
        breadcrumb={[{ label: dict.nav.home, href: '/' }, { label: locale === 'bn' ? 'শিক্ষা' : 'Education' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <a
              href="http://www.educationboardresults.gov.bd"
              target="_blank"
              rel="noopener noreferrer"
              className="nostos-btn-gold"
            >
              {locale === 'bn' ? 'বোর্ড রেজাল্ট পোর্টাল →' : 'Board Results Portal →'}
            </a>
            <Link
              href={localePath('/scholarships')}
              className="inline-flex min-h-[44px] items-center border border-[var(--hair)] px-4 text-xs font-bold text-[var(--text)] hover:border-[var(--gold-line)]"
            >
              {dict.nav.scholarships} →
            </Link>
          </div>
        }
      />

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        {/* Honest BANBEIS / UGC Verification Banner */}
        <div className="space-y-1.5 border-l-2 border-[var(--gold)] bg-[var(--surface)] p-4 text-xs text-[var(--text)]">
          {pendingNotice && <p className="font-bold">{pendingNotice}</p>}
          {universityRule && <p className="text-[var(--text-muted)]">{universityRule}</p>}
        </div>

        {/* NOSTOS Gliding Underline Tabs */}
        <div className="flex flex-wrap gap-6 border-b border-[var(--hair)] pb-2">
          {[
            {
              key: 'institutions' as const,
              labelBn: 'শিক্ষা প্রতিষ্ঠান ও বিশ্ববিদ্যালয় অনুসন্ধান',
              labelEn: 'Institutions & Universities Lookup',
            },
            {
              key: 'universities' as const,
              labelBn: 'ইউজিসি বিশ্ববিদ্যালয় তালিকা (UGC)',
              labelEn: 'UGC Universities (No EIIN)',
            },
            {
              key: 'boards' as const,
              labelBn: 'শিক্ষা বোর্ড, ফলাফল ও ভর্তি পোর্টাল',
              labelEn: 'Education Boards, Results & Admission',
            },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`relative min-h-[44px] px-1 text-xs font-semibold transition-colors ${
                tab === t.key
                  ? 'text-[var(--gold)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <span>{locale === 'bn' ? t.labelBn : t.labelEn}</span>
              <span
                aria-hidden="true"
                className={`absolute bottom-0 left-0 right-0 h-[1.5px] bg-[var(--gold)] transition-transform duration-[700ms] ease-[cubic-bezier(.16,1,.3,1)] ${
                  tab === t.key ? 'scale-x-100' : 'scale-x-0'
                }`}
              />
            </button>
          ))}
        </div>

      {tab !== 'boards' && (
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label htmlFor="edu-name-input" className="sr-only">
              {locale === 'bn' ? 'প্রতিষ্ঠানের নাম বা কোড' : 'Institution name or code'}
            </label>
            <input
              id="edu-name-input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                locale === 'bn'
                  ? 'প্রতিষ্ঠানের নাম বা সংক্ষিপ্ত নাম লিখুন (যেমন: ঢাকা বিশ্ববিদ্যালয়, বুয়েট)...'
                  : 'Search institution name or alias (e.g., Dhaka University, BUET)...'
              }
              className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-4 text-sm"
            />
          </div>
          <div>
            <label htmlFor="edu-eiin-input" className="sr-only">
              EIIN
            </label>
            <input
              id="edu-eiin-input"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={eiinFilter}
              onChange={(e) => setEiinFilter(e.target.value.replace(/\D/g, ''))}
              placeholder={locale === 'bn' ? '৬ সংখ্যার EIIN (স্কুল/কলেজ)' : '6-digit EIIN (School/College)'}
              className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="edu-type-select" className="sr-only">
              {locale === 'bn' ? 'প্রতিষ্ঠানের ধরন' : 'Institution type'}
            </label>
            <select
              id="edu-type-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="">{locale === 'bn' ? 'সকল ধরন' : 'All Types'}</option>
              <option value="university">{locale === 'bn' ? 'বিশ্ববিদ্যালয় (UGC)' : 'University (UGC)'}</option>
              <option value="college">{locale === 'bn' ? 'কলেজ (BANBEIS/NU)' : 'College (BANBEIS/NU)'}</option>
              <option value="school">{locale === 'bn' ? 'স্কুল (BANBEIS)' : 'School (BANBEIS)'}</option>
              <option value="madrasa">{locale === 'bn' ? 'মাদ্রাসা' : 'Madrasa'}</option>
              <option value="technical">{locale === 'bn' ? 'কারিগরি (BTEB)' : 'Technical (BTEB)'}</option>
            </select>
          </div>
        </div>
      )}

      {error && <ErrorRetryCard message={error} onRetry={() => void loadEducationData()} />}

      {tab === 'boards' ? (
        <section className="grid gap-4 sm:grid-cols-2">
          {boards.map((b) => (
            <article key={b.code} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-900">
                  {b.code}
                </span>
                <TrustChip label="OFFICIAL_SOURCE" lastVerifiedAt={b.lastVerifiedAt} locale={locale} />
              </div>
              <h2 className="mt-2 text-base font-extrabold text-slate-900">
                {locale === 'bn' ? b.nameBn : b.nameEn}
              </h2>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
                <a
                  href={b.resultsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[38px] items-center rounded-xl bg-emerald-700 px-3.5 text-white hover:bg-emerald-800"
                >
                  {locale === 'bn' ? 'ফলাফল যাচাই →' : 'Exam Results →'}
                </a>
                <a
                  href={b.xiAdmissionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[38px] items-center rounded-xl border border-slate-300 bg-white px-3.5 text-slate-900 hover:bg-slate-100"
                >
                  {locale === 'bn' ? 'একাদশ ভর্তি →' : 'XI Class Admission →'}
                </a>
                <a
                  href={b.certificateCorrectionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[38px] items-center rounded-xl border border-slate-300 bg-white px-3.5 text-slate-900 hover:bg-slate-100"
                >
                  {locale === 'bn' ? 'সনদ সংশোধন →' : 'Certificate Correction →'}
                </a>
              </div>
            </article>
          ))}
        </section>
      ) : loading ? (
        <SkeletonGrid count={4} />
      ) : institutions.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-800 shadow-sm">
          <p className="font-extrabold">
            {locale === 'bn'
              ? `শিক্ষা প্রতিষ্ঠানের তালিকা যাচাই চলছে${eiinFilter ? ` (EIIN: ${eiinFilter})` : ''}`
              : `Institution listing verification pending${eiinFilter ? ` (EIIN: ${eiinFilter})` : ''}`}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {locale === 'bn'
              ? 'ব্যানবেইস (BANBEIS) ও ইউজিসি (UGC)-র অফিসিয়াল ফাইল আমদানি হলে এখানে পূর্ণাঙ্গ তালিকা দেখা যাবে। আমরা কখনোই অনুমান করে কোনো EIIN বা প্রতিষ্ঠানের তথ্য তৈরি করি না।'
              : 'Full BANBEIS and UGC records will appear here once the official dataset files are imported. Jonoshheba AI never fabricates EIINs or institution details.'}
          </p>
        </div>
      ) : (
        <section aria-live="polite" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {institutions.map((inst) => (
            <article
              key={inst.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-900">
                    {inst.eiin
                      ? `EIIN: ${inst.eiin}`
                      : inst.ugcId
                        ? `${inst.ugcId} (UGC)`
                        : locale === 'bn'
                          ? 'যাচাই চলছে'
                          : 'Pending'}
                  </span>
                  <TrustChip
                    label="OFFICIAL_SOURCE"
                    lastVerifiedAt={inst.lastVerifiedAt}
                    pending={inst.verificationStatus === 'verification_pending'}
                    locale={locale}
                  />
                </div>
                <h2 className="mt-2.5 text-base font-extrabold text-slate-900">
                  <Link
                    href={localePath(`/education/${inst.id}`)}
                    className="hover:text-emerald-800 hover:underline"
                  >
                    {locale === 'bn' ? inst.nameBn : inst.nameEn}
                  </Link>
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  {locale === 'bn' ? inst.addressBn : inst.addressEn}
                </p>
                {inst.type === 'university' && (
                  <p className="mt-2 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                    {locale === 'bn'
                      ? 'ইউজিসি তালিকাভুক্ত বিশ্ববিদ্যালয় (কোনো BANBEIS EIIN নেই)'
                      : 'UGC-listed university (no BANBEIS school EIIN)'}
                  </p>
                )}
                {inst.establishedYear && (
                  <p className="mt-1.5 text-xs text-slate-500">
                    {locale === 'bn'
                      ? `প্রতিষ্ঠাকাল: ${formatDigits(inst.establishedYear, 'bn')}`
                      : `Established: ${inst.establishedYear}`}
                  </p>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                <Link
                  href={localePath(`/education/${inst.id}`)}
                  className="font-extrabold text-emerald-800 hover:underline"
                >
                  {locale === 'bn' ? 'বিস্তারিত দেখুন →' : 'View Details →'}
                </Link>
                {inst.website && (
                  <a
                    href={inst.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-slate-700 underline"
                  >
                    {locale === 'bn' ? 'ওয়েবসাইট' : 'Website'}
                  </a>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
      </div>
    </div>
  );
}
