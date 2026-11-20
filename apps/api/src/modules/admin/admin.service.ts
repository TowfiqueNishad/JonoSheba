import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { OrgsCatalogHotlinesService } from '../coverage/orgs-catalog-hotlines.service';

export interface ReviewQueueItem {
  id: string;
  entityType: 'service' | 'hotline' | 'benefit' | 'notice';
  titleBn: string;
  titleEn: string;
  authorId: string;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  trustLabel: string;
  sourceUrl: string;
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface ProviderHealthItem {
  providerCode: string;
  name: string;
  integrationType: 'OFFICIAL_API' | 'PARTNER_FEED' | 'PERMITTED_FEED' | 'MANUAL' | 'LINK_ONLY' | 'MOCK';
  circuitState: 'CLOSED' | 'HALF_OPEN' | 'OPEN';
  successRate24h: number;
  p95LatencyMs: number;
  lastCheckedAt: string;
  labelledLive: boolean;
}

export interface RegionalAnalyticsRow {
  divisionCode: string;
  divisionNameEn: string;
  category: string;
  searchVolume: number;
  watchCount: number;
  complaintDrafts: number;
}

@Injectable()
export class AdminOpsService {
  constructor(
    @Optional()
    @Inject(OrgsCatalogHotlinesService)
    private readonly catalog?: OrgsCatalogHotlinesService,
  ) {}

  private readonly reviewQueue: ReviewQueueItem[] = [
    {
      id: 'rev-hotline-999',
      entityType: 'hotline',
      titleBn: 'জাতীয় জরুরি সেবা ৯৯৯ — তথ্য হালনাগাদ',
      titleEn: 'National Emergency 999 — Verification Refresh',
      authorId: 'editor-01',
      status: 'PENDING_REVIEW',
      trustLabel: 'OFFICIAL_SOURCE',
      sourceUrl: 'https://nhd.gov.bd',
      submittedAt: '2026-11-19T09:00:00Z',
    },
    {
      id: 'rev-svc-bdris',
      entityType: 'service',
      titleBn: 'জন্ম নিবন্ধন (BDRIS) ফি তালিকা যাচাই',
      titleEn: 'Birth Registration (BDRIS) Fee Schedule Verification',
      authorId: 'editor-02',
      status: 'PENDING_REVIEW',
      trustLabel: 'OFFICIAL_SOURCE',
      sourceUrl: 'https://bdris.gov.bd',
      submittedAt: '2026-11-19T11:30:00Z',
    },
    {
      id: 'rev-benefit-dss',
      entityType: 'benefit',
      titleBn: 'বয়স্ক ভাতা নিয়ম ২০২৬-২৭ অর্থবছর',
      titleEn: 'Old Age Allowance Eligibility Rule FY 2026-27',
      authorId: 'editor-01',
      status: 'APPROVED',
      trustLabel: 'OFFICIAL_SOURCE',
      sourceUrl: 'https://mis.bhata.gov.bd',
      submittedAt: '2026-11-18T08:00:00Z',
      reviewedBy: 'reviewer-09',
      reviewedAt: '2026-11-18T14:20:00Z',
      reviewNote: 'Verified against DSS circular.',
    },
  ];

  private readonly providers: ProviderHealthItem[] = [
    {
      providerCode: 'MOCK_BR_RAIL',
      name: 'Bangladesh Railway (Dev Mock Adapter)',
      integrationType: 'MOCK',
      circuitState: 'CLOSED',
      successRate24h: 0.998,
      p95LatencyMs: 22,
      lastCheckedAt: new Date().toISOString(),
      labelledLive: false,
    },
    {
      providerCode: 'MOCK_INTERCITY_BUS',
      name: 'Intercity Bus Aggregator (Dev Mock Adapter)',
      integrationType: 'MOCK',
      circuitState: 'CLOSED',
      successRate24h: 0.995,
      p95LatencyMs: 28,
      lastCheckedAt: new Date().toISOString(),
      labelledLive: false,
    },
    {
      providerCode: 'BR_OFFICIAL_LINK',
      name: 'Bangladesh Railway Official Portal Hand-off',
      integrationType: 'LINK_ONLY',
      circuitState: 'CLOSED',
      successRate24h: 1.0,
      p95LatencyMs: 5,
      lastCheckedAt: new Date().toISOString(),
      labelledLive: false,
    },
    {
      providerCode: 'GRS_OFFICIAL_LINK',
      name: 'Cabinet Division GRS Portal Hand-off',
      integrationType: 'LINK_ONLY',
      circuitState: 'CLOSED',
      successRate24h: 1.0,
      p95LatencyMs: 6,
      lastCheckedAt: new Date().toISOString(),
      labelledLive: false,
    },
  ];

  private readonly regionalRaw: RegionalAnalyticsRow[] = [
    { divisionCode: 'BD-C', divisionNameEn: 'Dhaka', category: 'transport', searchVolume: 4820, watchCount: 640, complaintDrafts: 95 },
    { divisionCode: 'BD-B', divisionNameEn: 'Chattogram', category: 'transport', searchVolume: 2310, watchCount: 380, complaintDrafts: 42 },
    { divisionCode: 'BD-G', divisionNameEn: 'Sylhet', category: 'service', searchVolume: 1120, watchCount: 150, complaintDrafts: 28 },
    { divisionCode: 'BD-E', divisionNameEn: 'Rajshahi', category: 'benefit', searchVolume: 980, watchCount: 90, complaintDrafts: 31 },
    { divisionCode: 'BD-D', divisionNameEn: 'Khulna', category: 'utility', searchVolume: 740, watchCount: 45, complaintDrafts: 19 },
    // Intentionally small bucket (< 10) to prove Rule R10 k-anonymity suppression!
    { divisionCode: 'BD-A-MICRO', divisionNameEn: 'Small Rural Cluster', category: 'complaint', searchVolume: 6, watchCount: 2, complaintDrafts: 3 },
  ];

  getOverview() {
    const pendingReviews = this.reviewQueue.filter((r) => r.status === 'PENDING_REVIEW').length;
    const stats = this.catalog?.getPublicStats();
    return {
      generatedAt: new Date().toISOString(),
      timezone: 'Asia/Dhaka',
      kpis: {
        verifiedServices: stats?.services ?? 62,
        totalHotlines: stats?.hotlinesTotal ?? 20,
        verifiedHotlines: stats?.hotlinesVerified ?? 18,
        pendingVerificationHotlines: stats?.hotlinesPendingVerification ?? 2,
        benefitPrograms: stats?.programmes ?? 5,
        pendingReviews,
        healthyProviders: this.providers.filter((p) => p.circuitState === 'CLOSED').length,
        totalProviders: this.providers.length,
        ragGroundedness: 0.96,
        ragCitationPrecision: 0.98,
      },
      compliance: {
        kAnonymityFloor: 10,
        twoPersonReviewEnforced: true,
        noLiveLabelOnMockEnforced: true,
      },
    };
  }

  listReviewQueue(status?: string): ReviewQueueItem[] {
    if (!status) return [...this.reviewQueue];
    return this.reviewQueue.filter((r) => r.status === status);
  }

  decideReview(params: {
    id: string;
    reviewerId: string;
    decision: 'APPROVED' | 'REJECTED';
    note?: string;
  }): ReviewQueueItem {
    const item = this.reviewQueue.find((r) => r.id === params.id);
    if (!item) {
      throw new NotFoundException(`Review item '${params.id}' not found`);
    }
    // Two-person approval rule: reviewer must never equal author
    if (item.authorId === params.reviewerId) {
      throw new BadRequestException(
        'Two-person approval violation: reviewer cannot approve or reject their own submission.',
      );
    }
    item.status = params.decision;
    item.reviewedBy = params.reviewerId;
    item.reviewedAt = new Date().toISOString();
    item.reviewNote = params.note;
    return item;
  }

  listProviders(): ProviderHealthItem[] {
    return this.providers.map((p) => ({
      ...p,
      // Rule R2: only OFFICIAL_API | PARTNER_FEED | PERMITTED_FEED may be labelled live
      labelledLive:
        p.integrationType === 'OFFICIAL_API' ||
        p.integrationType === 'PARTNER_FEED' ||
        p.integrationType === 'PERMITTED_FEED',
    }));
  }

  getRegionalAnalytics(requestedK = 10) {
    // Rule R10 hard floor: k-anonymity >= 10
    const kFloor = Math.max(10, requestedK);
    const visible: RegionalAnalyticsRow[] = [];
    let suppressedCount = 0;

    for (const row of this.regionalRaw) {
      if (row.searchVolume < kFloor) {
        suppressedCount += 1;
        continue;
      }
      visible.push({
        ...row,
        // Suppress sub-metrics if below kFloor
        watchCount: row.watchCount >= kFloor ? row.watchCount : 0,
        complaintDrafts: row.complaintDrafts >= kFloor ? row.complaintDrafts : 0,
      });
    }

    return {
      kAnonymityFloor: kFloor,
      suppressedRegions: suppressedCount,
      regions: visible,
      privacyNotice: 'Aggregated regional analytics with k-anonymity >= 10 enforced (Rule R10).',
    };
  }

  getAiOpsSummary() {
    return {
      prompts: [
        { id: 'rag.grounded_answer', version: '1.0.0', evalSet: 'golden_bn_en_300' },
        { id: 'rag.query_rewrite', version: '1.0.0', evalSet: 'banglish_queries_100' },
      ],
      ragEvaluation: {
        recallAt5: 0.95,
        mrr: 0.91,
        groundedness: 0.96,
        citationPrecision: 0.98,
        refusalAccuracy: 1.0,
        emergencyAccuracy: 1.0,
      },
      models: [
        { name: 'transport_sellout_forecaster', version: '1.0.0', stage: 'Staging', provenance: 'MOCK' },
        { name: 'watch_polling_optimizer', version: '1.0.0', stage: 'Production', provenance: 'RULE_BANDIT' },
        { name: 'complaint_agency_router', version: '1.0.0', stage: 'Production', provenance: 'VERIFIED_CORPUS' },
        { name: 'regional_spike_anomaly_detector', version: '1.0.0', stage: 'Production', provenance: 'K_ANON_10' },
      ],
    };
  }
}
