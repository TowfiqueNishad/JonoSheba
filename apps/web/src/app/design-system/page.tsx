'use client';

import { TrustLabel } from '@jonoshheba/shared';
import { AvailabilityBadge, NostosSectionHeading, TrustBadge } from '@jonoshheba/ui';
import { ChapterHeading, FilmPlateBanner } from '../../components/NostosPrimitive';
import { SearchCombobox } from '../../components/SearchCombobox';
import { EmptyStateCard, ErrorRetryCard, SkeletonGrid, TrustChip } from '../../components/UiStates';
import { useLocale } from '../../lib/i18n';

/**
 * NOSTOS Component Sheet & Interactive Storybook Showcase (`/design-system`)
 * Renders every NOSTOS primitive in both NIGHT ("Steel & Gold") and DAY ("Bleached Light") themes.
 */
export default function DesignSystemStorybookPage() {
  const { locale } = useLocale();
  return (
    <div>
      <FilmPlateBanner
        overline="NOSTOS · DESIGN SYSTEM & COMPONENT SHEET"
        title={locale === 'bn' ? 'নস্তোস ডিজাইন সিস্টেম ও কম্পোনেন্ট শিট' : 'NOSTOS — Cinematic Design System'}
        subtitle="Steel & Gold (Night) · Bleached Light (Day) · Anek Bangla · Montserrat · Cormorant Garamond"
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Design System' }]}
      />

      <div className="mx-auto max-w-6xl space-y-16 px-4 py-12 sm:px-6">
        <section>
          <ChapterHeading
            roman="I"
            overline="TYPOGRAPHY & BUTTONS"
            title={locale === 'bn' ? 'টাইপোগ্রাফি, বাটন ও লিংক' : 'Typography, Buttons & Links'}
          />
          <div className="flex flex-wrap items-center gap-4 border border-[var(--hair)] bg-[var(--surface)] p-6">
            <button type="button" className="nostos-btn-gold">
              OUTLINE GOLD BUTTON
            </button>
            <a
              href="tel:999"
              className="nostos-emergency-999 inline-flex min-h-[44px] items-center rounded-full bg-[#B3261E] px-5 text-xs font-bold text-white"
            >
              ৯৯৯ জরুরি · 999 EMERGENCY
            </a>
            <a href="#main-content" className="nostos-link text-sm text-[var(--text)]">
              {locale === 'bn' ? 'হাতের রেখায় আঁকা আন্ডারলাইন লিংক →' : 'Drawn Hairline Text Link →'}
            </a>
          </div>
        </section>

        <section>
          <ChapterHeading
            roman="II"
            overline="TRUST & AVAILABILITY TAGS"
            title={locale === 'bn' ? 'ট্রাস্ট ও প্রাপ্যতা ট্যাগ' : 'Trust & Availability Tags'}
          />
          <div className="flex flex-wrap items-center gap-3 border border-[var(--hair)] bg-[var(--surface)] p-6">
            <TrustChip label="OFFICIAL_SOURCE" lastVerifiedAt="2026-11-20T00:00:00Z" locale={locale} />
            <TrustChip label="OFFICIAL_SOURCE" pending locale={locale} />
            <TrustChip label="UNAVAILABLE_STALE" lastVerifiedAt="2026-01-01T00:00:00Z" locale={locale} />
            <TrustBadge label={TrustLabel.OFFICIAL_SOURCE} locale={locale} />
            <AvailabilityBadge state="UNKNOWN_STALE" locale={locale} />
          </div>
        </section>

        <section>
          <ChapterHeading
            roman="III"
            overline="SEARCH COMBOBOX & STATES"
            title={locale === 'bn' ? 'সার্চ কম্বোবক্স ও স্টেটসমূহ' : 'Search Combobox & UI States'}
          />
          <div className="space-y-6">
            <SearchCombobox variant="page" />
            <SkeletonGrid count={3} />
            <EmptyStateCard />
            <ErrorRetryCard message="Sample RFC 9457 error state preview" />
            <NostosSectionHeading
              roman="IV"
              overlineEn="SHARED PACKAGE PRIMITIVE"
              titleBnOrEn="জনসেবা শেয়ারড কম্পোনেন্ট"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
