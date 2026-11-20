'use client';

import { useLocale } from '../../lib/i18n';

export default function PrivacyPage() {
  const { locale, dict } = useLocale();
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8 text-sm text-slate-800">
      <h1 className="text-2xl font-extrabold text-slate-900">{dict.nav.privacy}</h1>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          {locale === 'bn'
            ? 'তথ্য ব্রাউজ করার জন্য কখনোই এনআইডি, জন্ম নিবন্ধন নম্বর, আয় বা ব্যক্তিগত কাগজপত্রের প্রয়োজন হয় না।'
            : 'Browsing services, timetables, and hotlines never requires NID, birth registration numbers, income, or documents.'}
        </li>
        <li>
          {locale === 'bn'
            ? 'আমরা কোনো তৃতীয় পক্ষের পাসওয়ার্ড, ব্যাংক কার্ড নম্বর, মোবাইল ব্যাংকিং পিন বা ওটিপি সংরক্ষণ করি না।'
            : 'We never store third-party passwords, payment card numbers, mobile-banking PINs, or OTPs.'}
        </li>
        <li>
          {locale === 'bn'
            ? 'আপনার কথোপকথন, সংরক্ষিত তালিকা ও চেকলিস্ট সম্পূর্ণ ব্যক্তিগত; অতিথি চ্যাট সেশন ৩০ দিন পর স্বয়ংক্রিয়ভাবে মুছে যায় এবং আপনি যেকোনো সময় নিজেই মুছে ফেলতে পারেন।'
            : 'Your chat sessions, saved items, and checklists are strictly isolated to your account; guest chat sessions expire after 30 days and can be deleted anytime.'}
        </li>
      </ul>
    </div>
  );
}
