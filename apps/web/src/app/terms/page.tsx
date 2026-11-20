'use client';

import { useLocale } from '../../lib/i18n';

export default function TermsPage() {
  const { locale, dict } = useLocale();
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8 text-sm text-slate-800">
      <h1 className="text-2xl font-extrabold text-slate-900">{dict.nav.terms}</h1>
      <p className="font-semibold text-emerald-900">{dict.app.disclaimer}</p>
      <p>
        {locale === 'bn'
          ? 'এই প্ল্যাটফর্মের সকল ফি, সময়সূচি, ভাতা ও যোগ্যতার তথ্য কেবল সহায়তামূলক নির্দেশনা। চূড়ান্ত আবেদন, টিকিট ক্রয়, অর্থ পরিশোধ ও ভাতা অনুমোদন কেবল সংশ্লিষ্ট সরকারি বা অফিসিয়াল চ্যানেলের মাধ্যমেই সম্পন্ন হয়। জরুরি বিপদে সরাসরি ৯৯৯ নম্বরে কল করুন।'
          : 'All fees, timetables, allowances, and eligibility checks on this platform are informational guidance only. Final applications, ticket purchases, payments, and entitlement decisions occur exclusively on the official agency channel. In emergencies, dial 999 directly.'}
      </p>
    </div>
  );
}
