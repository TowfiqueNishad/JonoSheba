'use client';

import { useLocale } from '../../lib/i18n';

export default function ContactPage() {
  const { locale, dict } = useLocale();
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8 text-sm text-slate-800">
      <h1 className="text-2xl font-extrabold text-slate-900">{dict.nav.contact}</h1>
      <p>
        {locale === 'bn'
          ? 'তথ্যে কোনো ভুল বা পুরনো লিংক দেখলে প্রতিটি সেবার পাতায় "তথ্যে ভুল জানান" বাটনে ক্লিক করুন অথবা আমাদের সম্পাদকীয় দলে জানান।'
          : 'If you spot outdated information or a broken official link, click "Report an error" on any service page or contact our editorial team.'}
      </p>
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-950">
        {locale === 'bn'
          ? 'জরুরি পুলিশ, ফায়ার বা অ্যাম্বুলেন্সের জন্য আমাদের ইমেইল না করে এখনই ৯৯৯-এ কল করুন।'
          : 'For urgent Police, Fire, or Ambulance help, do not email us — dial 999 immediately.'}
      </div>
    </div>
  );
}
