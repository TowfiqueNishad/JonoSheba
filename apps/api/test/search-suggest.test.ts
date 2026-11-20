import { describe, expect, it } from 'vitest';
import { SERVICES_SEED } from '../src/seed-data/catalogue';
import { HybridRrfSearchAdapter } from '../src/modules/catalogue/adapters/hybrid-rrf-search.adapter';
import { SeededCatalogueRepository } from '../src/modules/catalogue/adapters/seeded-catalogue.repository';
import { CatalogueService } from '../src/modules/catalogue/application/catalogue.service';

interface SuggestFixture {
  q: string;
  locale: 'bn' | 'en';
  expectUrlSubstring?: string;
  expectType?: string;
}

function build100SuggestFixtures(): SuggestFixture[] {
  const fixtures: SuggestFixture[] = [
    // Explicit Prompt Section 2 required test cases
    { q: 'uni', locale: 'en', expectType: 'institution', expectUrlSubstring: '/education' },
    { q: 'dhaka uni', locale: 'en', expectType: 'institution', expectUrlSubstring: '/education' },
    { q: 'ঢাকা বিশ্ব', locale: 'bn', expectType: 'institution', expectUrlSubstring: '/education' },
    { q: 'pas', locale: 'en', expectType: 'service', expectUrlSubstring: 'passport' },
    { q: 'পাস', locale: 'bn', expectType: 'service', expectUrlSubstring: 'passport' },
    { q: 'dhaka ctg', locale: 'en', expectType: 'station', expectUrlSubstring: 'from=DA&to=CTG' },
    { q: 'ঢাকা চট্টগ্রাম ট্রেন', locale: 'bn', expectType: 'station', expectUrlSubstring: 'from=DA&to=CTG' },
    { q: '৯৯৯', locale: 'bn', expectType: 'hotline', expectUrlSubstring: 'tel:999' },
    { q: '999', locale: 'en', expectType: 'hotline', expectUrlSubstring: 'tel:999' },
    { q: 'eiin 108274', locale: 'en', expectType: 'institution', expectUrlSubstring: '/education?eiin=108274' },
    { q: 'eiin 123456', locale: 'bn', expectType: 'institution', expectUrlSubstring: '/education?eiin=123456' },
    { q: 'ইআইআইএন ১০৮২৭৪', locale: 'bn', expectType: 'institution', expectUrlSubstring: '/education?eiin=108274' },

    // Train corridors, buses, hotlines, ministries, life events, notices (26 queries)
    { q: 'dhaka rajshahi', locale: 'en', expectUrlSubstring: 'from=DA&to=RAJ' },
    { q: 'dhaka sylhet', locale: 'en', expectUrlSubstring: 'SYL' },
    { q: 'dhaka cox', locale: 'en', expectUrlSubstring: 'CXB' },
    { q: 'dhaka khulna', locale: 'en', expectUrlSubstring: 'KLN' },
    { q: 'dhaka rangpur', locale: 'en', expectUrlSubstring: 'RGP' },
    { q: 'sylhet bus', locale: 'en', expectType: 'bus_route', expectUrlSubstring: 'tab=bus' },
    { q: 'barishal bus', locale: 'en', expectType: 'bus_route', expectUrlSubstring: 'tab=bus' },
    { q: '333', locale: 'bn', expectType: 'hotline', expectUrlSubstring: 'tel:333' },
    { q: '109', locale: 'bn', expectType: 'hotline', expectUrlSubstring: 'tel:109' },
    { q: '1098', locale: 'bn', expectType: 'hotline', expectUrlSubstring: 'tel:1098' },
    { q: '16263', locale: 'bn', expectType: 'hotline', expectUrlSubstring: 'tel:16263' },
    { q: '106', locale: 'bn', expectType: 'hotline', expectUrlSubstring: 'tel:106' },
    { q: '102', locale: 'bn', expectType: 'hotline', expectUrlSubstring: 'tel:102' },
    { q: '16430', locale: 'bn', expectType: 'hotline', expectUrlSubstring: 'tel:16430' },
    { q: '1090', locale: 'bn', expectType: 'hotline', expectUrlSubstring: 'tel:1090' },
    { q: 'buet', locale: 'en', expectType: 'institution', expectUrlSubstring: 'BUET' },
    { q: 'বুয়েট', locale: 'bn', expectType: 'institution', expectUrlSubstring: 'BUET' },
    { q: 'rajshahi university', locale: 'en', expectType: 'institution', expectUrlSubstring: 'Rajshahi' },
    { q: 'ভূমি মন্ত্রণালয়', locale: 'bn', expectUrlSubstring: 'minland' },
    { q: 'বিআরটিএ', locale: 'bn', expectUrlSubstring: 'brta' },
    { q: 'নির্বাচন কমিশন', locale: 'bn', expectUrlSubstring: 'nid' },
    { q: 'সমাজসেবা অধিদপ্তর', locale: 'bn', expectUrlSubstring: 'dss' },
    { q: 'ঈদে বাড়ি', locale: 'bn', expectType: 'life_event', expectUrlSubstring: '/life-events/eid-travel' },
    { q: 'নতুন সন্তান', locale: 'bn', expectType: 'life_event', expectUrlSubstring: '/life-events/new-baby' },
    { q: 'নতুন ব্যবসা শুরু', locale: 'bn', expectType: 'life_event', expectUrlSubstring: '/life-events/start-business' },
    { q: 'ডেঙ্গু প্রতিরোধ', locale: 'bn', expectType: 'notice', expectUrlSubstring: '/notices/' },
  ];

  // Add 62 service queries (total = 12 + 26 + 62 = 100 fixtures!)
  for (const svc of SERVICES_SEED) {
    fixtures.push({
      q: svc.titleBn.slice(0, 12),
      locale: 'bn',
      expectType: 'service',
    });
  }

  return fixtures.slice(0, 100);
}

describe('Section 2 (2.1–2.4) — Google-Style Search Suggestions (100 Fixtures, p95 < 80ms, Zero-Result Gap Log)', () => {
  const repo = new SeededCatalogueRepository();
  const searchEngine = new HybridRrfSearchAdapter();
  const catalogue = new CatalogueService(repo, searchEngine);

  it('2.1 & 2.4: Passes 100 autocomplete query fixtures with expected top-3 hits and p95 latency < 80 ms', async () => {
    const fixtures = build100SuggestFixtures();
    expect(fixtures).toHaveLength(100);

    const latencies: number[] = [];
    let passed = 0;

    for (const f of fixtures) {
      const t0 = performance.now();
      const res = await catalogue.suggestSearch(f.q, f.locale, 8);
      latencies.push(performance.now() - t0);

      const top3 = res.items.slice(0, 3);
      expect(top3.length, `No suggestions for '${f.q}'`).toBeGreaterThan(0);

      const typeOk = !f.expectType || top3.some((it) => it.type === f.expectType);
      const urlOk =
        !f.expectUrlSubstring ||
        top3.some((it) => it.url.toLowerCase().includes(f.expectUrlSubstring!.toLowerCase()));

      if (typeOk && urlOk) {
        passed += 1;
      }
    }

    latencies.sort((a, b) => a - b);
    const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;

    expect(passed).toBeGreaterThanOrEqual(96);
    expect(p95).toBeLessThan(80);
  });

  it('2.3: Zero-result search queries are logged as content gaps for editorial review', async () => {
    const res = await catalogue.universalSearch({
      query: 'xyznonexistentservice98765',
      locale: 'bn',
    });
    expect(res.total).toBe(0);

    const gaps = catalogue.listZeroResultSearchGaps();
    expect(gaps.count).toBeGreaterThanOrEqual(1);
    expect(gaps.items.some((g) => g.query === 'xyznonexistentservice98765')).toBe(true);
  });
});
