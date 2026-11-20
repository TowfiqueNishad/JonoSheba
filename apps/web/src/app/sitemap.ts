import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://jonoshheba.app';

const STATIC_PATHS = [
  '',
  '/services',
  '/transport',
  '/benefits',
  '/life-events',
  '/scholarships',
  '/jobs',
  '/notices',
  '/calendar',
  '/complaints',
  '/jono',
  '/emergency',
  '/health',
  '/utilities',
  '/near-me',
  '/about',
  '/privacy',
  '/terms',
  '/contact',
  '/accessibility',
];

const FEATURED_SERVICES = [
  'birth-registration',
  'e-passport-new',
  'nid-new-registration',
  'land-e-mutation',
  'driving-licence',
  'income-tax-ereturn',
];

const FEATURED_PROGRAMMES = [
  'family-card-2026',
  'old-age-allowance',
  'widow-deserted-women-allowance',
  'disability-allowance-shubarna',
  'mother-and-child-benefit',
  'freedom-fighter-honorarium',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of ['bn', 'en'] as const) {
    for (const p of STATIC_PATHS) {
      entries.push({
        url: `${BASE_URL}/${locale}${p}`,
        lastModified: now,
        changeFrequency: 'daily',
        priority: p === '' ? 1.0 : 0.8,
        alternates: {
          languages: {
            bn: `${BASE_URL}/bn${p}`,
            en: `${BASE_URL}/en${p}`,
          },
        },
      });
    }
    for (const slug of FEATURED_SERVICES) {
      entries.push({
        url: `${BASE_URL}/${locale}/services/${slug}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.7,
      });
    }
    for (const slug of FEATURED_PROGRAMMES) {
      entries.push({
        url: `${BASE_URL}/${locale}/programmes/${slug}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.7,
      });
    }
  }
  entries.push({ url: `${BASE_URL}/lite`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 });
  return entries;
}
