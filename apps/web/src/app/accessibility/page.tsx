'use client';

import { useLocale } from '../../lib/i18n';

export default function AccessibilityPage() {
  const { locale, dict } = useLocale();
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8 text-sm text-slate-800">
      <h1 className="text-2xl font-extrabold text-slate-900">{dict.nav.accessibility}</h1>
      <p>
        {locale === 'bn'
          ? 'জনসেবা AI WCAG 2.2 AA মানদণ্ড অনুসরণ করে তৈরি: কিবোর্ড নেভিগেশন, স্কিপ লিংক, স্ক্রিন-রিডার লেবেল, উচ্চ কনট্রাস্ট, ৪৪ পিক্সেল স্পর্শ লক্ষ্য এবং ২০০% ফন্ট জুম সমর্থন করে। কম গতির ইন্টারনেটের জন্য ২জি লাইট মোড (/lite) উপলব্ধ।'
          : 'Jonoshheba AI is built to WCAG 2.2 AA standards with keyboard navigation, skip-to-content links, screen-reader labels, high contrast, 44 px touch targets, reduced-motion support, and 200% zoom compatibility. A zero-JavaScript 2G Lite mode (/lite) is available for low-bandwidth devices.'}
      </p>
    </div>
  );
}
