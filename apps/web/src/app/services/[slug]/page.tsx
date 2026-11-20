'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { formatDigits, getChannelLabel } from '@jonoshheba/shared';
import { ErrorRetryCard, SafeMarkdown, SkeletonGrid, TrustChip } from '../../../components/UiStates';
import { ChapterHeading, FilmPlateBanner } from '../../../components/NostosPrimitive';
import { apiGet, apiPost } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { useLocale } from '../../../lib/i18n';

function localizeProcessingTime(raw: string, locale: 'bn' | 'en'): string {
  if (locale === 'en') return raw;
  const withBnDigits = formatDigits(raw, 'bn');
  return withBnDigits
    .replace(/working days/gi, 'কর্মদিবস')
    .replace(/days/gi, 'দিন')
    .replace(/Instant online check/gi, 'তাৎক্ষণিক অনলাইন যাচাই')
    .replace(/Instant receipt after verification/gi, 'যাচাই শেষে তাৎক্ষণিক রসিদ')
    .replace(/Instant acknowledgment/gi, 'তাৎক্ষণিক প্রাপ্তি স্বীকারপত্র')
    .replace(/Instant lookup/gi, 'তাৎক্ষণিক অনুসন্ধান')
    .replace(/Instant on official portal/gi, 'অফিসিয়াল পোর্টালে তাৎক্ষণিক')
    .replace(/Instant receipt/gi, 'তাৎক্ষণিক রসিদ')
    .replace(/\bInstant\b/gi, 'তাৎক্ষণিক')
    .replace(/24\/7 helpline/gi, '২৪/৭ হেল্পলাইন')
    .replace(/Same day/gi, 'একই দিনে')
    .replace(/Walk-in/gi, 'সরাসরি উপস্থিত হয়ে');
}

interface ServiceDetail {
  slug: string;
  title: string;
  titleBn: string;
  titleEn: string;
  what: { summary: string; descriptionMd: string };
  whoProvides?: { name: string; officialUrl: string; contactPhone?: string | null } | null;
  whoCanApply: string;
  documents: Array<{ name: string; nameBn: string; nameEn: string; isMandatory: boolean }>;
  howAndWhere: {
    officialUrl: string;
    deliveryChannels: string[];
    handoffNotice: string;
    steps: Array<{ stepOrder: number; title: string; instruction: string; channel: string }>;
  };
  feeInfo: string;
  processingTime: string;
  trustLabel: string;
  lastVerifiedAt?: string | null;
  sources: Array<{ id: string; url: string; agency: string; trustLabel: string; lastVerifiedAt?: string | null }>;
  faqs: Array<{ id: string; question: string; answer: string }>;
  relatedServices: Array<{ slug: string; title: string }>;
}

export default function ServiceDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const { locale, dict, localePath } = useLocale();
  const { user, openSignIn } = useAuth();
  const [detail, setDetail] = useState<ServiceDetail | null>(null);
  const [versions, setVersions] = useState<Array<{ version: number; changeSummary: string; createdAt: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportSent, setReportSent] = useState(false);
  const [districts, setDistricts] = useState<Array<{ id: string; nameBn: string; nameEn: string; lat: number; lng: number }>>([]);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [localOffice, setLocalOffice] = useState<{
    nameBn: string;
    nameEn: string;
    website: string;
    phone?: string;
    resolvedArea?: { district?: string };
  } | null>(null);

  useEffect(() => {
    apiGet<{ items: Array<{ id: string; nameBn: string; nameEn: string; lat: number; lng: number }> }>(
      '/api/v1/geo/districts',
      { locale },
    )
      .then((res) => setDistricts(res.items ?? []))
      .catch(() => undefined);
  }, [locale]);

  useEffect(() => {
    const d = districts.find((x) => x.id === selectedDistrict);
    if (!d || !slug) {
      setLocalOffice(null);
      return;
    }
    apiGet<{
      resolvedArea?: { district?: string };
      responsibleOffice?: { nameBn: string; nameEn: string; website: string; phone?: string };
    }>(`/api/v1/offices/resolve?service=${encodeURIComponent(slug)}&lat=${d.lat}&lng=${d.lng}`, {
      locale,
    })
      .then((res) =>
        setLocalOffice(
          res.responsibleOffice
            ? { ...res.responsibleOffice, resolvedArea: res.resolvedArea }
            : null,
        ),
      )
      .catch(() => setLocalOffice(null));
  }, [selectedDistrict, districts, slug, locale]);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    Promise.allSettled([
      apiGet<ServiceDetail>(`/api/v1/services/${encodeURIComponent(slug)}`, { locale }),
      apiGet<{ items: Array<{ version: number; changeSummary: string; createdAt: string }> }>(
        `/api/v1/services/${encodeURIComponent(slug)}/versions`,
        { locale },
      ),
    ]).then(([dR, vR]) => {
      if (dR.status === 'fulfilled') {
        setDetail(dR.value);
      } else {
        setError(dict.states.notFoundTitle);
      }
      if (vR.status === 'fulfilled') setVersions(vR.value.items ?? []);
      setLoading(false);
    });
  }, [slug, locale, dict.states.notFoundTitle]);

  async function saveChecklist() {
    if (!detail) return;
    const run = async () => {
      await apiPost(
        '/api/v1/me/checklists',
        {
          targetType: 'service',
          targetSlug: detail.slug,
          titleBn: detail.titleBn,
          titleEn: detail.titleEn,
          applicationUrl: detail.howAndWhere.officialUrl,
          documents: detail.documents.map((d) => (locale === 'bn' ? d.nameBn : d.nameEn)),
        },
        { locale },
      );
      setSavedNotice(locale === 'bn' ? 'চেকলিস্ট অ্যাকাউন্টে সংরক্ষিত হয়েছে।' : 'Checklist saved to your account.');
    };
    if (!user) {
      openSignIn(() => void run());
      return;
    }
    await run();
  }

  async function submitErrorReport(e: React.FormEvent) {
    e.preventDefault();
    if (!detail || reportText.trim().length < 5) return;
    await apiPost(
      '/api/v1/content-reports',
      {
        resourceType: 'service',
        resourceId: detail.slug,
        reason: 'other',
        details: reportText.trim(),
      },
      { locale },
    );
    setReportSent(true);
    setReportText('');
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <SkeletonGrid count={3} />
      </div>
    );
  }
  if (error || !detail) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <ErrorRetryCard message={error ?? dict.states.notFoundTitle} />
      </div>
    );
  }

  // JSON-LD GovernmentService + FAQPage + BreadcrumbList (Finding LOW-1 / F08)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'GovernmentService',
    name: locale === 'bn' ? detail.titleBn : detail.titleEn,
    serviceType: detail.what.summary,
    url: detail.howAndWhere.officialUrl,
    provider: detail.whoProvides
      ? { '@type': 'GovernmentOrganization', name: detail.whoProvides.name }
      : undefined,
  };

  return (
    <div>
      <script
        type="application/ld+json"
        // Safe structured JSON-LD from typed fields
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <FilmPlateBanner
        overline="PUBLIC SERVICE GUIDE · VERIFIED DIRECTORY"
        title={locale === 'bn' ? detail.titleBn : detail.titleEn}
        subtitle={detail.what.summary}
        breadcrumb={[
          { label: dict.nav.home, href: '/' },
          { label: dict.nav.services, href: '/services' },
          { label: locale === 'bn' ? detail.titleBn : detail.titleEn },
        ]}
        actions={
          <TrustChip label={detail.trustLabel} lastVerifiedAt={detail.lastVerifiedAt} locale={locale} />
        }
      />

      <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
        <header className="space-y-3 border border-[var(--hair)] bg-[var(--surface)] p-5">
          <div className="flex flex-wrap gap-2">
            <a
              href={detail.howAndWhere.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="nostos-btn-gold"
            >
              {dict.services.officialPortal} →
            </a>
            <button
              type="button"
              onClick={() => void saveChecklist()}
              className="inline-flex min-h-[44px] items-center border border-[var(--gold-line)] px-4 text-xs font-bold text-[var(--gold)] no-print"
            >
              {dict.services.saveChecklist}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-[44px] items-center border border-[var(--hair)] px-4 text-xs font-bold text-[var(--text)] no-print"
            >
              {dict.services.printChecklist}
            </button>
            <Link
              href={localePath(`/jono?q=${encodeURIComponent(locale === 'bn' ? detail.titleBn : detail.titleEn)}`)}
              className="inline-flex min-h-[44px] items-center border border-[var(--hair)] px-4 text-xs font-bold text-[var(--text)] no-print"
            >
              {dict.services.askJono}
            </Link>
          </div>
          {savedNotice && <p className="text-xs font-bold text-[var(--gold)]">{savedNotice}</p>}
        </header>

        {/* 5-Question Citizen Layout as Numbered Roman Chapters */}
        <section className="border border-[var(--hair)] bg-[var(--surface)] p-6">
          <ChapterHeading roman="I" overline="OVERVIEW" title={dict.services.qWhat} />
          <div className="mt-2 text-sm text-[var(--text)]">
            <SafeMarkdown text={detail.what.descriptionMd || detail.what.summary} />
          </div>
        </section>

        {detail.whoProvides && (
          <section className="border border-[var(--hair)] bg-[var(--surface)] p-6 text-sm">
            <ChapterHeading roman="II" overline="AUTHORITY" title={dict.services.qWhoProvides} />
            <p className="mt-2 font-bold text-[var(--text)]">{detail.whoProvides.name}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              <a href={detail.whoProvides.officialUrl} target="_blank" rel="noopener noreferrer" className="nostos-link text-[var(--gold)]">
                {detail.whoProvides.officialUrl}
              </a>
              {detail.whoProvides.contactPhone && (
                <>
                  {' '}· <a href={`tel:${detail.whoProvides.contactPhone}`} className="font-bold text-[#E57368] underline">{detail.whoProvides.contactPhone}</a>
                </>
              )}
            </p>
          </section>
        )}

        <section className="border border-[var(--hair)] bg-[var(--surface)] p-6 text-sm">
          <ChapterHeading roman="III" overline="ELIGIBILITY" title={dict.services.qWhoCanApply} />
          <p className="mt-2 text-[var(--text)]">{detail.whoCanApply}</p>
        </section>

        <section className="border border-[var(--hair)] bg-[var(--surface)] p-6 text-sm">
          <ChapterHeading roman="IV" overline="CHECKLIST" title={dict.services.qDocuments} />
        <ul className="mt-2 space-y-2">
          {detail.documents.map((doc, idx) => (
            <li key={idx} className="flex items-start gap-2.5">
              <svg
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="18" height="18" rx="1" />
                <path d="M8 12.5l3 3 5-6" />
              </svg>
              <span>
                {locale === 'bn' ? doc.nameBn : doc.nameEn}{' '}
                {doc.isMandatory && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-950">
                    {locale === 'bn' ? 'আবশ্যিক' : 'Required'}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="border border-[var(--hair)] bg-[var(--surface)] p-6 text-sm">
        <ChapterHeading roman="V" overline="PROCEDURE & CHANNELS" title={dict.services.qHowWhere} />
        <p className="mt-1 text-xs font-semibold text-emerald-900">{detail.howAndWhere.handoffNotice}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {detail.howAndWhere.deliveryChannels.map((ch) => (
            <span key={ch} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800">
              {getChannelLabel(ch, locale)}
            </span>
          ))}
        </div>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          {detail.howAndWhere.steps.map((st) => (
            <li key={st.stepOrder}>
              <p className="font-bold text-slate-900">{st.title}</p>
              <p className="text-xs text-slate-700">{st.instruction}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm">
        <h2 className="text-base font-extrabold text-slate-900">{dict.services.feesAndTime}</h2>
        <p className="mt-2 font-semibold text-slate-900">{detail.feeInfo}</p>
        <p className="mt-1 text-xs text-slate-700">
          {locale === 'bn' ? 'সম্ভাব্য সময়:' : 'Processing time:'}{' '}
          {localizeProcessingTime(detail.processingTime, locale)}
        </p>
      </section>

      {/* Section 7.4: "আমার এলাকায় কোথায় যাব?" via offices/resolve */}
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-emerald-950">
              {locale === 'bn' ? 'আমার এলাকায় কোথায় যাব?' : 'Where do I go in my area?'}
            </h2>
            <p className="mt-0.5 text-xs text-emerald-900">
              {locale === 'bn'
                ? 'আপনার জেলা বেছে নিন — দায়িত্বপ্রাপ্ত স্থানীয় দপ্তর ও অনলাইন লিংক দেখুন'
                : 'Select your district to see the responsible office and official online channel'}
            </p>
          </div>
          <select
            aria-label={locale === 'bn' ? 'জেলা নির্বাচন করুন' : 'Select district'}
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
        {localOffice && (
          <div className="mt-3 rounded-xl bg-white p-3.5 text-xs text-slate-900 shadow-sm">
            <p className="font-extrabold">
              {locale === 'bn' ? localOffice.nameBn : localOffice.nameEn}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-3">
              <a
                href={localOffice.website}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-emerald-800 underline"
              >
                {localOffice.website} →
              </a>
              {localOffice.phone && (
                <a href={`tel:${localOffice.phone}`} className="font-bold text-red-700 underline">
                  {localOffice.phone}
                </a>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Sources + FAQs + Versions + Report Error */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm">
        <h2 className="text-base font-extrabold text-slate-900">{dict.services.sources}</h2>
        <ul className="mt-2 space-y-1.5 text-xs">
          {detail.sources.map((s) => (
            <li key={s.id}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-bold text-emerald-800 underline">
                {s.agency} ({s.url})
              </a>
            </li>
          ))}
        </ul>

        {detail.faqs.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <h3 className="font-extrabold text-slate-900">{dict.services.faqs}</h3>
            <dl className="mt-2 space-y-2">
              {detail.faqs.map((f) => (
                <div key={f.id}>
                  <dt className="font-bold text-slate-900">{f.question}</dt>
                  <dd className="text-xs text-slate-700">{f.answer}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {versions.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-700">
            <h3 className="font-extrabold text-slate-900">{dict.services.versions}</h3>
            <ul className="mt-1 list-disc pl-5">
              {versions.map((v) => (
                <li key={v.version}>
                  v{v.version} — {v.changeSummary}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 border-t border-slate-100 pt-4 no-print">
          <button
            type="button"
            onClick={() => setReportOpen((v) => !v)}
            className="text-xs font-bold text-red-700 underline"
          >
            {dict.services.reportError}
          </button>
          {reportSent && (
            <p className="mt-2 text-xs font-bold text-emerald-800">
              {locale === 'bn' ? 'ধন্যবাদ! আপনার রিপোর্ট পর্যালোচনার জন্য পাঠানো হয়েছে।' : 'Thank you! Your report has been queued for review.'}
            </p>
          )}
          {reportOpen && (
            <form onSubmit={(e) => void submitErrorReport(e)} className="mt-2 flex gap-2">
              <label htmlFor="report-error-input" className="sr-only">
                {dict.services.reportError}
              </label>
              <input
                id="report-error-input"
                type="text"
                required
                minLength={5}
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder={locale === 'bn' ? 'কী ভুল বা পুরনো তথ্য দেখেছেন লিখুন...' : 'Describe what is outdated or incorrect...'}
                className="min-h-[44px] flex-1 rounded-xl border border-slate-300 px-3 text-xs"
              />
              <button type="submit" className="min-h-[44px] rounded-xl bg-red-700 px-4 text-xs font-bold text-white">
                {dict.jono.send}
              </button>
            </form>
          )}
        </div>
      </section>
      </div>
    </div>
  );
}
