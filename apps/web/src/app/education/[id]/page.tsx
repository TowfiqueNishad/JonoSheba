'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDigits } from '@jonoshheba/shared';
import { ErrorRetryCard, SkeletonGrid, TrustChip } from '../../../components/UiStates';
import { apiGet, apiPost } from '../../../lib/api';
import { useLocale } from '../../../lib/i18n';

interface InstitutionDetail {
  id: string;
  nameBn: string;
  nameEn: string;
  type: string;
  level: string;
  management: string;
  eiin: string | null;
  ugcId: string | null;
  nuCollegeCode: string | null;
  btebCode: string | null;
  boardCode: string | null;
  eiinExplanationBn: string;
  eiinExplanationEn: string;
  districtEn: string;
  upazilaEn: string | null;
  addressBn: string;
  addressEn: string;
  website: string | null;
  admissionPortalUrl: string | null;
  establishedYear: number | null;
  lat: number | null;
  lng: number | null;
  sourceUrl: string;
  lastVerifiedAt: string | null;
  verificationStatus: 'verified' | 'verification_pending';
  officialPortals: {
    resultsUrl: string;
    xiAdmissionUrl: string;
    scholarshipsUrl: string;
    certificateCorrectionUrl: string;
  };
}

export default function EducationInstitutionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { locale, dict, localePath } = useLocale();
  const [inst, setInst] = useState<InstitutionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  async function loadDetail() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<InstitutionDetail>(
        `/api/v1/education/institutions/${encodeURIComponent(id)}`,
        { locale },
      );
      setInst(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.states.errorHint);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDetail();
  }, [id, locale]);

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  async function reportIssue() {
    if (!inst) return;
    await apiPost(
      '/api/v1/content-reports',
      {
        resourceType: 'education_institution',
        resourceId: inst.id,
        reason: 'other',
        details: 'Citizen requested verification/update of institution record.',
      },
      { locale },
    ).catch(() => undefined);
    setReportSent(true);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <SkeletonGrid count={3} />
      </div>
    );
  }

  if (error || !inst) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <ErrorRetryCard message={error ?? dict.states.errorHint} onRetry={() => void loadDetail()} />
      </div>
    );
  }

  const primaryCode = inst.eiin ?? inst.ugcId ?? inst.nuCollegeCode ?? inst.btebCode ?? inst.id;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={localePath('/education')}
          className="text-xs font-extrabold text-emerald-800 hover:underline"
        >
          ← {locale === 'bn' ? 'শিক্ষা হাবে ফিরে যান' : 'Back to Education Hub'}
        </Link>
        <TrustChip
          label="OFFICIAL_SOURCE"
          lastVerifiedAt={inst.lastVerifiedAt}
          pending={inst.verificationStatus === 'verification_pending'}
          locale={locale}
        />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-emerald-50 px-3 py-1 font-mono text-xs font-extrabold text-emerald-950">
              {inst.eiin ? `EIIN: ${inst.eiin}` : `Code: ${primaryCode}`}
            </span>
            <button
              type="button"
              onClick={() => void copyCode(primaryCode)}
              className="min-h-[34px] rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 hover:bg-slate-100"
            >
              {copied
                ? locale === 'bn'
                  ? 'কপি হয়েছে'
                  : 'Copied'
                : locale === 'bn'
                  ? 'কোড কপি করুন'
                  : 'Copy code'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => void reportIssue()}
            className="min-h-[36px] rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-bold text-amber-950 hover:bg-amber-100"
          >
            {reportSent
              ? locale === 'bn'
                ? 'রিপোর্ট গৃহীত হয়েছে'
                : 'Report queued'
              : locale === 'bn'
                ? 'ভুল জানান'
                : 'Report issue'}
          </button>
        </div>

        <h1 className="mt-3 text-2xl font-extrabold text-slate-900">
          {locale === 'bn' ? inst.nameBn : inst.nameEn}
        </h1>
        <p className="mt-1 text-xs text-slate-600">
          {locale === 'bn' ? inst.addressBn : inst.addressEn}
          {inst.establishedYear
            ? ` · ${locale === 'bn' ? `প্রতিষ্ঠিত: ${formatDigits(inst.establishedYear, 'bn')}` : `Est. ${inst.establishedYear}`}`
            : ''}
        </p>

        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-800">
          {locale === 'bn' ? inst.eiinExplanationBn : inst.eiinExplanationEn}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          {inst.website && (
            <a
              href={inst.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[42px] items-center rounded-xl bg-emerald-700 px-4 text-xs font-extrabold text-white hover:bg-emerald-800"
            >
              {locale === 'bn' ? 'অফিসিয়াল ওয়েবসাইট →' : 'Official Website →'}
            </a>
          )}
          {inst.admissionPortalUrl && (
            <a
              href={inst.admissionPortalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[42px] items-center rounded-xl border border-slate-300 bg-white px-4 text-xs font-bold text-slate-900 hover:bg-slate-100"
            >
              {locale === 'bn' ? 'ভর্তি পোর্টাল →' : 'Admission Portal →'}
            </a>
          )}
          <a
            href={inst.officialPortals.resultsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[42px] items-center rounded-xl border border-slate-300 bg-white px-4 text-xs font-bold text-slate-900 hover:bg-slate-100"
          >
            {locale === 'bn' ? 'বোর্ড পরীক্ষার ফলাফল →' : 'Board Exam Results →'}
          </a>
          <Link
            href={localePath(inst.officialPortals.scholarshipsUrl)}
            className="inline-flex min-h-[42px] items-center rounded-xl border border-slate-300 bg-white px-4 text-xs font-bold text-slate-900 hover:bg-slate-100"
          >
            {locale === 'bn' ? 'উপবৃত্তি ও শিক্ষাবৃত্তি →' : 'Stipends & Scholarships →'}
          </Link>
        </div>
      </section>

      {inst.lat !== null && inst.lng !== null && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 text-xs text-slate-700 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {locale === 'bn' ? 'মানচিত্রে অবস্থান:' : 'Map Coordinates:'} ({inst.lat}, {inst.lng}) · © OpenStreetMap contributors (ODbL)
            </span>
            <a
              href={`https://www.openstreetmap.org/?mlat=${inst.lat}&mlon=${inst.lng}#map=16/${inst.lat}/${inst.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-extrabold text-emerald-800 underline"
            >
              {locale === 'bn' ? 'ওপেনস্ট্রিটম্যাপে দেখুন →' : 'View on OpenStreetMap →'}
            </a>
          </div>
        </section>
      )}
    </div>
  );
}
