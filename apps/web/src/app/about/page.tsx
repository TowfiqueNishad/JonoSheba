'use client';

import { useLocale } from '../../lib/i18n';

export default function AboutPage() {
  const { locale, dict } = useLocale();
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8 text-sm text-slate-800">
      <h1 className="text-2xl font-extrabold text-slate-900">{dict.nav.about}</h1>
      <p className="font-semibold text-emerald-900">{dict.app.disclaimer}</p>
      <p>
        {locale === 'bn'
          ? 'জনসেবা AI হলো বাংলাদেশের নাগরিকদের জন্য একটি স্বাধীন সেবা-অনুসন্ধান, নির্দেশনা ও সতর্কতা প্ল্যাটফর্ম। আমরা কোনো সরকারি দপ্তর নই এবং কোনো আবেদন, টিকিট বুকিং বা অভিযোগ নাগরিকের হয়ে জমা দিই না — আমরা যাচাইকৃত সরকারি উৎসের তথ্য সহজ বাংলা ও ইংরেজিতে উপস্থাপন করি এবং সরাসরি অফিসিয়াল চ্যানেলে পথ দেখাই।'
          : 'Jonoshheba AI is an independent citizen-service discovery, guidance, and alert platform for Bangladesh. We are not a government agency and never book tickets, submit applications, or file grievances on your behalf — we present verified official information in plain Bangla and English and hand off directly to verified official channels.'}
      </p>
      <p className="text-xs text-slate-600">{dict.app.osmAttribution}</p>
    </div>
  );
}
