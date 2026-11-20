'use client';

import { useMemo, useState } from 'react';
import { apiPost } from '../../lib/api';
import { FilmPlateBanner } from '../../components/NostosPrimitive';
import { useAuth } from '../../lib/auth';
import { useLocale } from '../../lib/i18n';

const AUTHORITY_RULES = [
  {
    re: /(?:বিদ্যুৎ|পল্লী বিদ্যুৎ|ডেসকো|ডিপিডিসি|electricity|power|meter)/i,
    officeBn: 'বিদ্যুৎ বিভাগ / সংশ্লিষ্ট বিদ্যুৎ বিতরণ সংস্থা (DESCO/DPDC/BREB/BPDB)',
    officeEn: 'Power Division / Electricity Distributor (DESCO/DPDC/BREB/BPDB)',
    url: 'https://www.grs.gov.bd',
  },
  {
    re: /(?:ভূমি|জমি|নামজারি|খতিয়ান|land|mutation)/i,
    officeBn: 'উপজেলা ভূমি অফিস (এসিল্যান্ড) ও ভূমি মন্ত্রণালয় (হটলাইন ১৬১২২)',
    officeEn: 'Upazila Land Office (AC Land) & Ministry of Land (Hotline 16122)',
    url: 'https://land.gov.bd',
  },
  {
    re: /(?:ট্রেন|রেল|টিকিট|train|rail|station)/i,
    officeBn: 'বাংলাদেশ রেলওয়ে অভিযোগ সেল (হটলাইন ১৩১)',
    officeEn: 'Bangladesh Railway Grievance Cell (Hotline 131)',
    url: 'https://www.grs.gov.bd',
  },
  {
    re: /(?:ঘুষ|দুর্নীতি|bribe|corruption)/i,
    officeBn: 'দুর্নীতি দমন কমিশন (দুদক — হটলাইন ১০৬)',
    officeEn: 'Anti-Corruption Commission (ACC — Hotline 106)',
    url: 'https://acc.org.bd',
  },
];

export default function ComplaintsPage() {
  const { locale, dict } = useLocale();
  const { user, openSignIn } = useAuth();
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [draftText, setDraftText] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const suggestion = useMemo(() => {
    const hit = AUTHORITY_RULES.find((r) => r.re.test(description));
    return (
      hit ?? {
        officeBn: 'মন্ত্রিপরিষদ বিভাগ — কেন্দ্রীয় অভিযোগ প্রতিকার ব্যবস্থা (GRS)',
        officeEn: 'Cabinet Division — Central Grievance Redress System (GRS)',
        url: 'https://www.grs.gov.bd',
      }
    );
  }, [description]);

  async function generateDraft(e: React.FormEvent) {
    e.preventDefault();
    if (description.trim().length < 10) return;

    const preview =
      locale === 'bn'
        ? `বরাবর,\n${suggestion.officeBn}\n\nবিষয়: নাগরিক সেবা সংক্রান্ত অভিযোগ\nএলাকা: ${location || 'উল্লেখিত নয়'}\n\nমহোদয়,\n${description.trim()}\n\nবিনীত,\nসচেতন নাগরিক`
        : `To,\n${suggestion.officeEn}\n\nSubject: Public Service Grievance\nLocation: ${location || 'Not specified'}\n\nDear Sir/Madam,\n${description.trim()}\n\nSincerely,\nCitizen`;
    setDraftText(preview);

    if (user) {
      try {
        await apiPost(
          '/api/v1/cases/draft',
          { description: description.trim(), location: location.trim() || undefined },
          { locale },
        );
        setSavedMsg(
          locale === 'bn' ? 'খসড়াটি আপনার অ্যাকাউন্টে সংরক্ষিত হয়েছে।' : 'Draft saved to your account.',
        );
      } catch {
        // Keep local preview
      }
    }
  }

  return (
    <div>
      <FilmPlateBanner
        overline="II — THE HARBOURS · GRIEVANCE REDRESS · GRS"
        title={dict.complaints.title}
        subtitle={dict.complaints.subtitle}
        breadcrumb={[{ label: dict.nav.home, href: '/' }, { label: dict.nav.complaints }]}
      />
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">

      <form
        onSubmit={(e) => void generateDraft(e)}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div>
          <label htmlFor="complaint-desc" className="block text-sm font-bold text-slate-800">
            {dict.complaints.descriptionLabel}
          </label>
          <textarea
            id="complaint-desc"
            rows={4}
            required
            minLength={10}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={dict.complaints.descriptionPlaceholder}
            className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
          />
        </div>

        <div>
          <label htmlFor="complaint-location" className="block text-xs font-bold text-slate-700">
            {locale === 'bn' ? 'জেলা / উপজেলা / অফিসের নাম (ঐচ্ছিক)' : 'District / Upazila / Office (optional)'}
          </label>
          <input
            id="complaint-location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-sm"
          />
        </div>

        {/* Suggested Office */}
        {description.trim().length > 4 && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-950">
            <span className="font-extrabold">{dict.complaints.suggestedOffice}: </span>
            <span>{locale === 'bn' ? suggestion.officeBn : suggestion.officeEn}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={description.trim().length < 10}
            className="min-h-[44px] rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {dict.complaints.draftButton}
          </button>
          {!user && (
            <button
              type="button"
              onClick={() => openSignIn()}
              className="min-h-[44px] rounded-xl border border-slate-300 px-4 text-xs font-bold text-slate-800 hover:bg-slate-100"
            >
              {locale === 'bn' ? 'খসড়া সংরক্ষণ করতে সাইন ইন করুন' : 'Sign in to save drafts'}
            </button>
          )}
        </div>
      </form>

      {draftText && (
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-extrabold text-slate-900">
            {locale === 'bn' ? 'আপনার অভিযোগের খসড়া (যাচাই করে কপি করুন)' : 'Your Complaint Draft (Review & Copy)'}
          </h2>
          {savedMsg && <p className="text-xs font-semibold text-emerald-800">{savedMsg}</p>}
          <label htmlFor="complaint-final-text" className="sr-only">
            Final complaint draft
          </label>
          <textarea
            id="complaint-final-text"
            rows={7}
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3 font-mono text-xs"
          />
          <div className="flex flex-wrap gap-3">
            <a
              href={suggestion.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center rounded-xl bg-emerald-700 px-5 text-sm font-extrabold text-white hover:bg-emerald-800"
            >
              {dict.complaints.handoffButton} →
            </a>
          </div>
        </section>
      )}
      </div>
    </div>
  );
}
