'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SkeletonGrid } from '../../components/UiStates';
import { FilmPlateBanner, toRoman } from '../../components/NostosPrimitive';
import { apiGet } from '../../lib/api';
import { useLocale } from '../../lib/i18n';

interface LifeEventBundle {
  slug: string;
  titleBn: string;
  titleEn: string;
  categories: string[];
}

const CATEGORY_NAMES: Record<string, { bn: string; en: string }> = {
  civil_registration: { bn: 'নাগরিক নিবন্ধন', en: 'Civil Registration' },
  identity: { bn: 'পরিচয়পত্র', en: 'Identity' },
  education: { bn: 'শিক্ষা', en: 'Education' },
  transport: { bn: 'যাতায়াত ও পরিবহন', en: 'Transport' },
  land: { bn: 'ভূমি ও রাজস্ব', en: 'Land & Revenue' },
  health: { bn: 'স্বাস্থ্যসেবা', en: 'Healthcare' },
  social_safety: { bn: 'সামাজিক নিরাপত্তা', en: 'Social Safety' },
  business: { bn: 'ব্যবসা ও বাণিজ্য', en: 'Business' },
  legal: { bn: 'আইন ও বিচার', en: 'Legal' },
  utility: { bn: 'নাগরিক ইউটিলিটি', en: 'Utilities' },
  general: { bn: 'সাধারণ সেবা', en: 'General' },
};

function formatCategories(cats: string[], loc: 'bn' | 'en'): string {
  return cats
    .map((c) => CATEGORY_NAMES[c]?.[loc] ?? c.replace(/_/g, ' '))
    .join(' · ');
}

export default function LifeEventsPage() {
  const { locale, dict, localePath } = useLocale();
  const [items, setItems] = useState<LifeEventBundle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ items: LifeEventBundle[] }>('/api/v1/services/life-event-bundles', { locale })
      .then((res) => setItems(res.items ?? []))
      .finally(() => setLoading(false));
  }, [locale]);

  return (
    <div>
      <FilmPlateBanner
        overline="I — CHAPTERS OF LIFE · CITIZEN MILESTONES"
        title={dict.nav.lifeEvents}
        subtitle={dict.home.lifeEventsTitle}
        breadcrumb={[{ label: dict.nav.home, href: '/' }, { label: dict.nav.lifeEvents }]}
      />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        {loading ? (
          <SkeletonGrid count={6} />
        ) : (
          <div className="grid gap-x-12 border-t border-[var(--hair)] md:grid-cols-2">
            {items.map((ev, idx) => (
              <Link
                key={ev.slug}
                href={localePath(`/life-events/${ev.slug}`)}
                className="nostos-editorial-row flex min-h-[68px] items-center justify-between gap-4 py-4"
              >
                <div className="flex items-baseline gap-4">
                  <span className="nostos-editorial-italic w-8 shrink-0 text-sm text-[var(--gold)]">
                    {toRoman(idx + 1)}
                  </span>
                  <div>
                    <h2 className="font-semibold text-[var(--text)]">
                      {locale === 'bn' ? ev.titleBn : ev.titleEn}
                    </h2>
                    <p className="nostos-editorial-italic mt-0.5 text-xs text-[var(--text-muted)]">
                      {formatCategories(ev.categories, locale)}
                    </p>
                  </div>
                </div>
                <span aria-hidden="true" className="nostos-row-arrow text-sm text-[var(--text-muted)]">
                  →
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
