'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ErrorRetryCard, SkeletonGrid, TrustChip } from '../../../components/UiStates';
import { apiGet, apiPost } from '../../../lib/api';
import { useLocale } from '../../../lib/i18n';

interface LeadershipEntry {
  designationBn: string;
  designationEn: string;
  incumbentNameBn: string;
  incumbentNameEn: string;
  officePhone: string;
  officialEmail: string | null;
  asOf: string;
  sourceUrl: string;
  verificationStatus: 'verified' | 'verification_pending';
}

interface ContactEntry {
  roleBn: string;
  roleEn: string;
  phone: string;
  telUri: string;
  portalUrl?: string;
  hours: string;
  sourceUrl: string;
}

interface OrgDetail {
  id: string;
  type: string;
  groupBn: string;
  groupEn: string;
  nameBn: string;
  nameEn: string;
  website: string;
  citizenCharterUrl: string;
  phone: string;
  addressBn: string;
  addressEn: string;
  officeHoursBn: string;
  officeHoursEn: string;
  lat: number;
  lng: number;
  lastVerifiedAt: string;
  leadership: LeadershipEntry[];
  contacts: ContactEntry[];
  children: Array<{ id: string; nameBn: string; nameEn: string; phone: string }>;
  linkedServices: Array<{ slug: string; titleBn: string; titleEn: string; feeTextBn: string; feeTextEn: string }>;
}

export default function MinistryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { locale, dict, localePath } = useLocale();
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportDetails, setReportDetails] = useState('');
  const [reportSent, setReportSent] = useState(false);

  async function loadOrg() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<OrgDetail>(`/api/v1/orgs/${encodeURIComponent(id)}`, { locale });
      setOrg(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.states.errorHint);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOrg();
  }, [id, locale]);

  async function submitIssueReport(e: React.FormEvent) {
    e.preventDefault();
    if (!org || reportDetails.trim().length < 5) return;
    await apiPost(
      '/api/v1/content-reports',
      {
        resourceType: 'organisation',
        resourceId: org.id,
        reason: 'wrong_hotline',
        details: reportDetails.trim(),
      },
      { locale },
    ).catch(() => undefined);
    setReportSent(true);
    setReportDetails('');
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <SkeletonGrid count={4} />
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <ErrorRetryCard message={error ?? dict.states.errorHint} onRetry={() => void loadOrg()} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      {/* Header Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900">
            {locale === 'bn' ? org.groupBn : org.groupEn}
          </span>
          <TrustChip label="OFFICIAL_SOURCE" lastVerifiedAt={org.lastVerifiedAt} locale={locale} />
        </div>

        <h1 className="mt-3 text-2xl font-extrabold text-slate-900">
          {locale === 'bn' ? org.nameBn : org.nameEn}
        </h1>
        <p className="mt-1 text-xs text-slate-600">
          {locale === 'bn' ? org.addressBn : org.addressEn} ·{' '}
          {locale === 'bn' ? org.officeHoursBn : org.officeHoursEn}
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={`tel:${org.phone}`}
            className="inline-flex min-h-[44px] items-center rounded-xl bg-emerald-700 px-4 text-xs font-extrabold text-white hover:bg-emerald-800"
          >
            {locale === 'bn' ? `অফিস ফোন / হটলাইন: ${org.phone}` : `Call Office / Helpline: ${org.phone}`}
          </a>
          <a
            href={org.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-300 bg-white px-4 text-xs font-bold text-slate-900 hover:bg-slate-100"
          >
            {locale === 'bn' ? 'অফিসিয়াল ওয়েবসাইট →' : 'Official Website →'}
          </a>
          <a
            href={org.citizenCharterUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-300 bg-white px-4 text-xs font-bold text-slate-900 hover:bg-slate-100"
          >
            {locale === 'bn' ? 'সিটিজেন চার্টার →' : 'Citizen Charter →'}
          </a>
          <button
            type="button"
            onClick={() => setReportOpen((v) => !v)}
            className="inline-flex min-h-[44px] items-center rounded-xl border border-amber-300 bg-amber-50 px-4 text-xs font-bold text-amber-950 hover:bg-amber-100"
          >
            {locale === 'bn' ? 'ভুল জানান' : 'Report incorrect info'}
          </button>
        </div>

        {reportOpen && (
          <form onSubmit={(e) => void submitIssueReport(e)} className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label htmlFor="org-report-input" className="block text-xs font-bold text-slate-800">
              {locale === 'bn'
                ? 'কোন তথ্যটি হালনাগাদ করা প্রয়োজন? (সংশোধনের জন্য রিভিউ কিউতে যাবে)'
                : 'What information needs updating? (Queued for editorial review)'}
            </label>
            <textarea
              id="org-report-input"
              rows={2}
              required
              minLength={5}
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs"
            />
            <button
              type="submit"
              className="min-h-[38px] rounded-xl bg-emerald-700 px-4 text-xs font-bold text-white"
            >
              {locale === 'bn' ? 'রিপোর্ট পাঠান' : 'Submit report'}
            </button>
            {reportSent && (
              <p className="text-xs font-bold text-emerald-800">
                {locale === 'bn' ? 'ধন্যবাদ! আপনার রিপোর্টটি রিভিউ কিউতে যুক্ত হয়েছে।' : 'Thank you! Your report has been queued for review.'}
              </p>
            )}
          </form>
        )}
      </section>

      {/* Leadership ("প্রধানগণ") Table with Office Phones & as_of Date */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-extrabold text-slate-900">
          {locale === 'bn'
            ? 'প্রধানগণ (দপ্তর প্রধান, সচিব ও দায়িত্বপ্রাপ্ত কর্মকর্তা)'
            : 'Leadership (Head of Office, Secretary & Key Officers)'}
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          {locale === 'bn'
            ? 'শুধুমাত্র সরকারি ওয়েবসাইটে প্রকাশিত দাপ্তরিক পদবি ও অফিস ফোন নম্বর প্রদর্শিত হয় (কোনো ব্যক্তিগত মোবাইল নম্বর সংগ্রহ করা হয় না)।'
            : 'Only official designation details and office phone numbers published on government portals are shown (never personal mobile numbers).'}
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-extrabold text-slate-800">
                <th className="p-3">{locale === 'bn' ? 'পদবি' : 'Designation'}</th>
                <th className="p-3">{locale === 'bn' ? 'দায়িত্বপ্রাপ্ত কর্মকর্তা' : 'Incumbent'}</th>
                <th className="p-3">{locale === 'bn' ? 'অফিস ফোন' : 'Office Phone'}</th>
                <th className="p-3">{locale === 'bn' ? 'সর্বশেষ যাচাই' : 'As Of'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {org.leadership.map((l, idx) => (
                <tr key={idx}>
                  <td className="p-3 font-bold text-slate-900">
                    {locale === 'bn' ? l.designationBn : l.designationEn}
                  </td>
                  <td className="p-3 text-slate-700">
                    <span className="rounded bg-amber-100 px-2 py-0.5 font-semibold text-amber-950">
                      {locale === 'bn' ? l.incumbentNameBn : l.incumbentNameEn}
                    </span>
                  </td>
                  <td className="p-3">
                    <a
                      href={`tel:${l.officePhone}`}
                      className="inline-flex min-h-[36px] items-center rounded-lg bg-emerald-50 px-3 font-extrabold text-emerald-900 hover:bg-emerald-100"
                    >
                      {l.officePhone}
                    </a>
                  </td>
                  <td className="p-3 text-slate-500">{l.asOf.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* GRS, RTI & Office Contacts */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-extrabold text-slate-900">
          {locale === 'bn'
            ? 'অভিযোগ প্রতিকার (GRS), তথ্য অধিকার (RTI) ও যোগাযোগ'
            : 'GRS Focal Point, RTI Officer & Official Contacts'}
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {org.contacts.map((c, idx) => (
            <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
              <p className="font-extrabold text-slate-900">
                {locale === 'bn' ? c.roleBn : c.roleEn}
              </p>
              <p className="mt-1 text-slate-600">{c.hours}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <a
                  href={c.telUri}
                  className="inline-flex min-h-[36px] items-center rounded-lg bg-emerald-700 px-3 font-bold text-white"
                >
                  {c.phone}
                </a>
                {c.portalUrl && (
                  <a
                    href={c.portalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[36px] items-center rounded-lg border border-slate-300 bg-white px-3 font-bold text-slate-800"
                  >
                    {locale === 'bn' ? 'পোর্টাল →' : 'Portal →'}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Child Agencies (if any) */}
      {org.children && org.children.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-extrabold text-slate-900">
            {locale === 'bn' ? 'অধীনস্থ অধিদপ্তর ও সংস্থাসমূহ' : 'Departments & Agencies Under This Ministry'}
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {org.children.map((ch) => (
              <Link
                key={ch.id}
                href={localePath(`/ministries/${ch.id}`)}
                className="rounded-xl border border-slate-200 p-3.5 text-sm font-bold text-emerald-900 hover:border-emerald-400"
              >
                {locale === 'bn' ? ch.nameBn : ch.nameEn} ({ch.phone}) →
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Services Offered */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-extrabold text-slate-900">
          {locale === 'bn' ? 'এই দপ্তরের নাগরিক সেবাসমূহ' : 'Citizen Services Provided by This Office'}
        </h2>
        {org.linkedServices && org.linkedServices.length > 0 ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {org.linkedServices.map((s) => (
              <Link
                key={s.slug}
                href={localePath(`/services/${s.slug}`)}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm hover:border-emerald-400"
              >
                <p className="font-extrabold text-emerald-900">
                  {locale === 'bn' ? s.titleBn : s.titleEn} →
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {locale === 'bn' ? s.feeTextBn : s.feeTextEn}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-600">
            {locale === 'bn'
              ? 'সকল সরকারি সেবা দেখতে সেবা ডিরেক্টরিতে যান।'
              : 'Browse the full Services Directory for all citizen services.'}
          </p>
        )}
      </section>

      {/* OpenStreetMap Location with ODbL Attribution */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 text-xs text-slate-700 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            {locale === 'bn' ? 'মানচিত্রে অবস্থান:' : 'Map Location:'} ({org.lat}, {org.lng}) · © OpenStreetMap contributors (ODbL)
          </span>
          <a
            href={`https://www.openstreetmap.org/?mlat=${org.lat}&mlon=${org.lng}#map=16/${org.lat}/${org.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-extrabold text-emerald-800 underline"
          >
            {locale === 'bn' ? 'ওপেনস্ট্রিটম্যাপে দেখুন →' : 'View on OpenStreetMap →'}
          </a>
        </div>
      </section>
    </div>
  );
}
