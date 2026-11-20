import { ForbiddenException } from '@nestjs/common';
import { TrustLabel } from '@jonoshheba/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { HybridRrfSearchAdapter } from './adapters/hybrid-rrf-search.adapter';
import { SeededCatalogueRepository } from './adapters/seeded-catalogue.repository';
import { CatalogueService } from './application/catalogue.service';
import { normalizeBanglaText } from './domain/bangla-nlp';
import { computeEtag, projectFields } from './domain/http-helpers';

/** Prompt 04 Definition of Done: 20 Bangla, English & Banglish test queries asserting Top-3 recall */
const TOP_3_SEARCH_FIXTURE: ReadonlyArray<{
  label: string;
  query: string;
  locale: 'bn' | 'en';
  expectedAnySlugOrCode: string[];
}> = [
  { label: '01. Bangla birth reg', query: 'জন্ম নিবন্ধন', locale: 'bn', expectedAnySlugOrCode: ['birth-registration-new'] },
  { label: '02. Banglish birth reg', query: 'jonmo nibondhon', locale: 'bn', expectedAnySlugOrCode: ['birth-registration-new'] },
  { label: '03. English birth cert', query: 'birth certificate', locale: 'en', expectedAnySlugOrCode: ['birth-registration-new'] },
  { label: '04. Bangla NID correction', query: 'জাতীয় পরিচয়পত্র সংশোধন', locale: 'bn', expectedAnySlugOrCode: ['nid-correction'] },
  { label: '05. English NID correction', query: 'nid correction', locale: 'en', expectedAnySlugOrCode: ['nid-correction'] },
  { label: '06. Bangla e-Passport', query: 'নতুন ই-পাসপোর্ট', locale: 'bn', expectedAnySlugOrCode: ['epassport-new'] },
  { label: '07. English e-Passport', query: 'epassport', locale: 'en', expectedAnySlugOrCode: ['epassport-new'] },
  { label: '08. Bangla land mutation', query: 'জমির নামজারি', locale: 'bn', expectedAnySlugOrCode: ['land-e-mutation'] },
  { label: '09. Banglish land mutation', query: 'namjari', locale: 'bn', expectedAnySlugOrCode: ['land-e-mutation'] },
  { label: '10. Bangla land tax', query: 'খাজনা', locale: 'bn', expectedAnySlugOrCode: ['land-development-tax'] },
  { label: '11. Bangla khatian/porcha', query: 'পর্চা খতিয়ান', locale: 'bn', expectedAnySlugOrCode: ['land-porcha-khatian'] },
  { label: '12. Bangla old age allowance', query: 'বয়স্ক ভাতা', locale: 'bn', expectedAnySlugOrCode: ['dss-old-age-allowance', 'old-age-allowance'] },
  { label: '13. Banglish old age allowance', query: 'boyosko bhata', locale: 'bn', expectedAnySlugOrCode: ['dss-old-age-allowance', 'old-age-allowance'] },
  { label: '14. Bangla driving license', query: 'ড্রাইভিং লাইসেন্স', locale: 'bn', expectedAnySlugOrCode: ['brta-learner-license', 'brta-smart-driving-license'] },
  { label: '15. English police clearance', query: 'police clearance', locale: 'en', expectedAnySlugOrCode: ['police-clearance-certificate'] },
  { label: '16. Bangla online GD', query: 'অনলাইন জিডি', locale: 'bn', expectedAnySlugOrCode: ['online-gd-police'] },
  { label: '17. English e-TIN', query: 'tin certificate', locale: 'en', expectedAnySlugOrCode: ['nbr-etin-registration'] },
  { label: '18. Bangla trade license', query: 'ট্রেড লাইসেন্স', locale: 'bn', expectedAnySlugOrCode: ['trade-license-new'] },
  { label: '19. Bangla child vaccination', query: 'শিশুর টিকা', locale: 'bn', expectedAnySlugOrCode: ['epi-child-vaccination'] },
  { label: '20. Bangla transport intent', query: 'ঢাকা চট্টগ্রাম ট্রেন', locale: 'bn', expectedAnySlugOrCode: ['RAIL-DA', 'RAIL-CTG', 'railway-eticket-guide', 'train-da-ctg'] },
];

describe('Phase 04: Catalogue, Life Events, Lifecycle & Universal Bangla/English/Banglish Search', () => {
  let repo: SeededCatalogueRepository;
  let searchAdapter: HybridRrfSearchAdapter;
  let service: CatalogueService;

  beforeEach(() => {
    repo = new SeededCatalogueRepository();
    searchAdapter = new HybridRrfSearchAdapter();
    service = new CatalogueService(repo, searchAdapter);
  });

  it('normalizes Bangla Unicode, ZWJ, khanda-ta, and Bangla digits consistently', () => {
    expect(normalizeBanglaText('৯৯৯\u200C জরুরি!')).toBe('999 জরুরি');
    expect(normalizeBanglaText('উৎস')).toBe(normalizeBanglaText('উত্স'));
  });

  it('hits expected Top-3 across all 20 Bangla, English & Banglish test queries with p95 < 300ms', async () => {
    const latencies: number[] = [];

    for (const tc of TOP_3_SEARCH_FIXTURE) {
      const res = await service.universalSearch({ query: tc.query, locale: tc.locale, limit: 10 });
      latencies.push(res.latencyMs);

      const top3Slugs = res.hits.slice(0, 3).map((h) => h.slugOrCode);
      const matched = tc.expectedAnySlugOrCode.some((expected) => top3Slugs.includes(expected));
      expect(
        matched,
        `[${tc.label}] query="${tc.query}" expected one of [${tc.expectedAnySlugOrCode.join(', ')}] in top-3, got [${top3Slugs.join(', ')}]`,
      ).toBe(true);

      // Rule R5: Every search hit must carry a valid TrustLabel
      for (const hit of res.hits) {
        expect(Object.values(TrustLabel)).toContain(hit.trustLabel);
        expect(hit.attribution.agency).toBeTruthy();
      }
    }

    latencies.sort((a, b) => a - b);
    const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
    expect(p95).toBeLessThan(300);
  });

  it('emits transport search card for "ঢাকা চট্টগ্রাম ট্রেন" and emergency 999 card for immediate danger', async () => {
    const trainRes = await service.universalSearch({ query: 'ঢাকা চট্টগ্রাম ট্রেন', locale: 'bn' });
    expect(trainRes.intentHint.module).toBe('transport');
    expect(trainRes.intentHint.actionCard?.type).toBe('transport_search');
    expect(trainRes.intentHint.actionCard?.payload).toMatchObject({
      mode: 'train',
      origin: 'Dhaka',
      destination: 'Chattogram',
    });

    const emergencyRes = await service.universalSearch({ query: '৯৯৯ জরুরি অ্যাম্বুলেন্স', locale: 'bn' });
    expect(emergencyRes.intentHint.module).toBe('emergency');
    expect(emergencyRes.intentHint.actionCard?.payload).toMatchObject({
      number: '999',
      telUri: 'tel:999',
    });
    expect(emergencyRes.hits.slice(0, 3).some((h) => h.slugOrCode === '999')).toBe(true);
  });

  it('provides low-latency autocomplete (<80ms p95) and typo tolerance', async () => {
    const queries = ['জন্ম', 'jonmo', 'passp', 'namja', 'বয়স্ক', 'driv', 'tin', 'trade', 'dhak', '999'];
    const latencies: number[] = [];
    for (const q of queries) {
      const res = await service.suggestSearch(q, 'bn');
      latencies.push(res.latencyMs);
      expect(res.suggestions.length).toBeGreaterThan(0);
    }
    latencies.sort((a, b) => a - b);
    const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
    expect(p95).toBeLessThan(80);

    // Typo tolerance: "jonmo nibondon" (missing h) still resolves birth-registration-new!
    const typoRes = await service.universalSearch({ query: 'jonmo nibondon', locale: 'bn' });
    expect(typoRes.hits.slice(0, 3).some((h) => h.slugOrCode === 'birth-registration-new')).toBe(true);
  });

  it('returns 5-question service detail, life events, nearby geo facilities, ETag & sparse fields', async () => {
    const detail = await service.getServiceDetail('birth-registration-new', 'bn');
    expect(detail.what.summary).toBeTruthy();
    expect(detail.whoProvides?.slug).toBe('bdris');
    expect(detail.documents.length).toBeGreaterThan(0);
    expect(detail.howAndWhere.steps.length).toBeGreaterThan(0);
    expect(detail.sources[0]?.trustLabel).toBe(TrustLabel.OFFICIAL_SOURCE);

    const newBaby = await service.getLifeEventDetail('new-baby', 'bn');
    expect(newBaby.steps).toHaveLength(3);
    expect(newBaby.steps[0]?.service?.slug).toBe('birth-registration-new');

    // Geo radius filter near central Dhaka returns Dhaka facilities first and excludes Chattogram
    const nearDhaka = await service.listFacilities({
      nearLat: 23.73,
      nearLng: 90.4,
      radiusKm: 10,
      locale: 'en',
    });
    expect(nearDhaka.length).toBeGreaterThanOrEqual(2);
    expect(nearDhaka.every((f) => f.districtEn === 'Dhaka')).toBe(true);
    expect((nearDhaka[0]?.distanceKm ?? 99) <= (nearDhaka[1]?.distanceKm ?? 99)).toBe(true);

    // Sparse ?fields= projection & deterministic ETag
    const projected = projectFields({ slug: 'a', title: 'b', extra: 'c' }, 'slug,title');
    expect(projected).toEqual({ slug: 'a', title: 'b' });
    expect(computeEtag(projected)).toBe(computeEtag({ slug: 'a', title: 'b' }));
  });

  it('enforces editorial lifecycle (draft -> in_review -> published, reviewer !== author), version history, expired sources -> UNAVAILABLE_STALE & hash drift', async () => {
    const draft = await service.createDraftService('editor-1', {
      slug: 'new-e-service-test',
      titleBn: 'পরীক্ষামূলক সরকারি সেবা',
      titleEn: 'Test Public E-Service',
      summaryBn: 'নতুন ডিজিটাল সেবার নির্দেশিকা',
      summaryEn: 'Guide for a newly added public digital service',
      agencySlug: 'mygov',
      categorySlug: 'identity-civil',
      officialUrl: 'https://www.mygov.bd/test-service',
      feeInfo: { bn: 'বিনামূল্যে', en: 'Free' },
      processingTime: '3 days',
      sourceUrl: 'https://www.mygov.bd/test-service',
      sourceAgency: 'myGov',
    });
    expect(draft.status).toBe('draft');

    await service.submitServiceForReview(draft.slug, 'editor-1');

    // Author CANNOT self-publish!
    await expect(service.publishService(draft.slug, 'editor-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    // Distinct reviewer publishes -> creates version 1
    const published = await service.publishService(draft.slug, 'reviewer-2', 'Initial verification');
    expect(published.status).toBe('published');
    expect(published.version).toBe(1);
    const versions = await service.getServiceVersions(draft.slug);
    expect(versions).toHaveLength(1);
    expect(versions[0]?.reviewerId).toBe('reviewer-2');

    // Expire source validTo -> nightly sweep flags service UNAVAILABLE_STALE & creates review task
    const source = (await repo.findSourceById(published.sourceId))!;
    source.validTo = new Date(Date.now() - 86_400_000);
    await repo.saveSource(source);

    const sweep = await service.flagExpiredSources();
    expect(sweep.staleServicesFlagged).toContain(draft.slug);
    const afterSweep = await repo.findServiceBySlug(draft.slug);
    expect(afterSweep?.trustLabel).toBe(TrustLabel.UNAVAILABLE_STALE);

    // Source hash drift check opens a review task
    await service.recordSourceHashCheck(source.id, 'hash-v1');
    const drift = await service.recordSourceHashCheck(source.id, 'hash-v2-changed');
    expect(drift.changed).toBe(true);
    expect(drift.reviewTask?.reason).toBe('source_changed');

    // Citizen content report opens a review task
    const reported = await service.submitContentReport('citizen-1', {
      resourceType: 'service',
      resourceId: published.id,
      reason: 'outdated_fee',
      details: 'Official fee updated on agency portal',
    });
    expect(reported.reviewTask.reason).toBe('content_report');
  });

  it('enforces owner isolation (IDOR protection) on citizen saved items and reminders', async () => {
    const savedA = await service.saveItem('citizen-A', {
      resourceType: 'service',
      resourceId: 'birth-registration-new',
    });
    await expect(service.deleteSavedItem('citizen-B', savedA.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    const remA = await service.createReminder('citizen-A', {
      resourceType: 'service',
      titleBn: 'পাসপোর্ট অ্যাপয়েন্টমেন্ট',
      titleEn: 'Passport appointment',
      remindAt: new Date(Date.now() + 86_400_000),
    });
    await expect(
      service.updateReminder('citizen-B', remA.id, { status: 'cancelled' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.deleteReminder('citizen-B', remA.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
