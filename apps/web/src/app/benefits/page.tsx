'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatBdt, formatDhakaDate } from '@jonoshheba/shared';
import { FilmPlateBanner } from '../../components/NostosPrimitive';
import { ErrorRetryCard, SkeletonGrid, TrustChip } from '../../components/UiStates';
import { apiGet, apiPost } from '../../lib/api';
import { useLocale } from '../../lib/i18n';

interface ProgrammeItem {
  slug: string;
  nameBn: string;
  nameEn: string;
  agency: string;
  monthlyAmountBdt: number;
  effectiveFrom: string;
  sourceUrl: string;
  lastVerifiedAt: string;
  paymentChannel: string;
}

interface WizardStep {
  done: boolean;
  nextQuestion?: {
    field: string;
    labelBn: string;
    labelEn: string;
    type: string;
    options?: string[];
  };
  results?: Array<{
    slug: string;
    titleBn: string;
    titleEn: string;
    status: string;
    officialUrl: string;
  }>;
}

export default function BenefitsPage() {
  const { locale, dict, localePath } = useLocale();
  const [programmes, setProgrammes] = useState<ProgrammeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Interactive Multi-Step Eligibility Wizard + Family Card 2026
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [householdMembers, setHouseholdMembers] = useState(4);
  const [age, setAge] = useState(66);
  const [gender, setGender] = useState<'male' | 'female'>('female');
  const [govtEmployee, setGovtEmployee] = useState(false);
  const [ownsCar, setOwnsCar] = useState(false);
  const [taxPayer, setTaxPayer] = useState(false);
  const [evalResult, setEvalResult] = useState<{
    familyCard?: { status: string; reasonsBn: string[]; reasonsEn: string[]; officialPortalUrl: string };
    oldAge?: { status: string; reasonsBn: string[]; reasonsEn: string[]; officialPortalUrl: string };
    wizard?: WizardStep;
  } | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  async function loadProgrammes() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<{ items: ProgrammeItem[] }>('/api/v1/programmes', { locale });
      setProgrammes(res.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.states.errorHint);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProgrammes();
  }, [locale]);

  async function runCheck(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) {
      setConsentError(true);
      return;
    }
    setConsentError(false);
    setEvaluating(true);
    try {
      const [fc, oa, wiz] = await Promise.all([
        apiPost<{ status: string; reasonsBn: string[]; reasonsEn: string[]; officialPortalUrl: string }>(
          '/api/v1/programmes/family-card-2026/eligibility',
          {
            answers: {
              householdMembers,
              government_pension_or_permanent_govt_employee: govtEmployee,
              owns_registered_private_car_or_commercial_vehicle: ownsCar,
              income_tax_payer_above_threshold: taxPayer,
            },
          },
          { locale },
        ),
        apiPost<{ status: string; reasonsBn: string[]; reasonsEn: string[]; officialPortalUrl: string }>(
          '/api/v1/programmes/old-age-allowance/eligibility',
          { answers: { age, gender } },
          { locale },
        ),
        apiPost<WizardStep>(
          '/api/v1/eligibility/wizard/next',
          { need: 'benefits', answers: { age, gender, household_members: householdMembers } },
          { locale },
        ),
      ]);
      setEvalResult({ familyCard: fc, oldAge: oa, wizard: wiz });
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.states.errorHint);
    } finally {
      setEvaluating(false);
    }
  }

  return (
    <div>
      <FilmPlateBanner
        overline="II — THE HARBOURS · ALLOWANCES & FAMILY CARD 2026"
        title={dict.benefits.title}
        subtitle={dict.benefits.subtitle}
        breadcrumb={[{ label: dict.nav.home, href: '/' }, { label: dict.nav.benefits }]}
        actions={
          <a
            href="/api/v1/calendar.ics"
            className="nostos-btn-gold"
          >
            {dict.benefits.downloadCalendar}
          </a>
        }
      />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">

      {/* Deterministic Eligibility Checker */}
      <form
        onSubmit={(e) => void runCheck(e)}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h2 className="text-lg font-extrabold text-slate-900">{dict.benefits.wizardTitle}</h2>

        <div
          className={`rounded-xl border p-3.5 text-sm ${
            consentError
              ? 'border-red-500 bg-red-50 text-red-950'
              : 'border-sky-200 bg-sky-50 text-slate-900'
          }`}
        >
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
                if (e.target.checked) setConsentError(false);
              }}
              className="mt-1 h-5 w-5"
            />
            <span className="font-semibold">{dict.benefits.consentLabel}</span>
          </label>
          {consentError && (
            <p role="alert" className="mt-2 text-xs font-bold text-red-700">
              {dict.benefits.consentRequiredError}
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="ben-members" className="block text-xs font-bold text-slate-700">
              {locale === 'bn' ? 'পরিবারের সদস্য সংখ্যা' : 'Household members'}
            </label>
            <input
              id="ben-members"
              type="number"
              min={1}
              max={20}
              value={householdMembers}
              onChange={(e) => setHouseholdMembers(Number(e.target.value))}
              className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="ben-age" className="block text-xs font-bold text-slate-700">
              {locale === 'bn' ? 'বয়স' : 'Age'}
            </label>
            <input
              id="ben-age"
              type="number"
              min={1}
              max={120}
              value={age}
              onChange={(e) => setAge(Number(e.target.value))}
              className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="ben-gender" className="block text-xs font-bold text-slate-700">
              {locale === 'bn' ? 'লিঙ্গ' : 'Gender'}
            </label>
            <select
              id="ben-gender"
              value={gender}
              onChange={(e) => setGender(e.target.value as 'male' | 'female')}
              className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="female">{locale === 'bn' ? 'নারী' : 'Female'}</option>
              <option value="male">{locale === 'bn' ? 'পুরুষ' : 'Male'}</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-slate-800">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={govtEmployee} onChange={(e) => setGovtEmployee(e.target.checked)} className="h-4 w-4" />
            <span>{locale === 'bn' ? 'সরকারি চাকরি বা পেনশনভোগী' : 'Government employee or pensioner'}</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={ownsCar} onChange={(e) => setOwnsCar(e.target.checked)} className="h-4 w-4" />
            <span>{locale === 'bn' ? 'নিবন্ধিত ব্যক্তিগত গাড়ি আছে' : 'Owns registered private car'}</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={taxPayer} onChange={(e) => setTaxPayer(e.target.checked)} className="h-4 w-4" />
            <span>{locale === 'bn' ? 'সীমার উপরে আয়করদাতা' : 'Income tax payer above threshold'}</span>
          </label>
        </div>

        <button
          type="submit"
          disabled={evaluating}
          className="min-h-[44px] rounded-xl bg-emerald-700 px-6 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {evaluating ? dict.states.loading : dict.benefits.checkButton}
        </button>

        {evalResult && (
          <div aria-live="polite" className="grid gap-3 pt-2 sm:grid-cols-2">
            {evalResult.familyCard && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
                <p className="font-extrabold text-emerald-950">
                  {locale === 'bn' ? 'ফ্যামিলি কার্ড ২০২৬' : 'Family Card 2026'} —{' '}
                  {evalResult.familyCard.status === 'POSSIBLE_MATCH'
                    ? locale === 'bn'
                      ? 'সম্ভাব্য মিল'
                      : 'Possible Match'
                    : locale === 'bn'
                      ? 'যোগ্য নয়'
                      : 'Not Eligible'}
                </p>
                <p className="mt-1 text-xs text-slate-800">
                  {(locale === 'bn' ? evalResult.familyCard.reasonsBn : evalResult.familyCard.reasonsEn).join(' ')}
                </p>
                <a
                  href={evalResult.familyCard.officialPortalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs font-bold text-emerald-800 underline"
                >
                  {dict.services.officialPortal} →
                </a>
              </div>
            )}
            {evalResult.oldAge && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <p className="font-extrabold text-slate-900">
                  {locale === 'bn' ? 'বয়স্ক ভাতা' : 'Old Age Allowance'} —{' '}
                  {evalResult.oldAge.status === 'POSSIBLE_MATCH'
                    ? locale === 'bn'
                      ? 'সম্ভাব্য মিল'
                      : 'Possible Match'
                    : locale === 'bn'
                      ? 'যোগ্য নয়'
                      : 'Not Eligible'}
                </p>
                <p className="mt-1 text-xs text-slate-800">
                  {(locale === 'bn' ? evalResult.oldAge.reasonsBn : evalResult.oldAge.reasonsEn).join(' ')}
                </p>
                <a
                  href={evalResult.oldAge.officialPortalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs font-bold text-emerald-800 underline"
                >
                  {dict.services.officialPortal} →
                </a>
              </div>
            )}
          </div>
        )}
      </form>

      {error && <ErrorRetryCard message={error} onRetry={() => void loadProgrammes()} />}

      {/* Programmes List */}
      <section className="space-y-3">
        <h2 className="text-lg font-extrabold text-slate-900">
          {locale === 'bn' ? 'সামাজিক নিরাপত্তা কর্মসূচি' : 'Social Protection Programmes'}
        </h2>
        {loading ? (
          <SkeletonGrid count={4} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {programmes.map((p) => (
              <article key={p.slug} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <TrustChip label="OFFICIAL_SOURCE" lastVerifiedAt={p.lastVerifiedAt} locale={locale} />
                  <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-extrabold text-emerald-950">
                    {dict.benefits.monthlyAmount} {formatBdt(p.monthlyAmountBdt, locale)}
                  </span>
                </div>
                <h3 className="mt-2 text-base font-extrabold text-slate-900">
                  <Link href={localePath(`/programmes/${p.slug}`)} className="hover:text-emerald-800 hover:underline">
                    {locale === 'bn' ? p.nameBn : p.nameEn}
                  </Link>
                </h3>
                <p className="mt-1 text-xs text-slate-700">{p.agency}</p>
                <p className="mt-1 text-xs text-slate-600">
                  {dict.benefits.effectiveFrom}: {formatDhakaDate(p.effectiveFrom, locale)}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <Link
                    href={localePath(`/programmes/${p.slug}`)}
                    className="text-xs font-extrabold text-emerald-800 hover:underline"
                  >
                    {dict.services.viewDetails} →
                  </Link>
                  <a
                    href={p.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-slate-700 underline"
                  >
                    {dict.services.officialPortal} →
                  </a>
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
