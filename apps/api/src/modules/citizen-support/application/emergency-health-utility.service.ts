import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TrustLabel } from '@jonoshheba/shared';
import { uuidv7 } from '../../../common/uuidv7';
import { CatalogueService } from '../../catalogue/application/catalogue.service';
import type { AccessTokenClaims } from '../../identity/domain/identity.types';
import { PolicyService } from '../../identity/domain/policy.service';
import { buildStaticEmergencyHotlines } from '../domain/emergency-fallback';
import { assessHealthRedFlags } from '../domain/health-red-flags';
import type {
  HotlineEditProposal,
  HotlineItem,
  UtilitySubscriptionRecord,
  VerifiedUtilityProvider,
} from '../domain/support.types';

const VERIFIED_UTILITY_PROVIDERS: readonly VerifiedUtilityProvider[] = [
  {
    code: 'desco',
    utilityType: 'electricity',
    nameBn: 'ডেসকো (ঢাকা ইলেকট্রিক সাপ্লাই কোম্পানি)',
    nameEn: 'DESCO (Dhaka Electric Supply Company)',
    officialPaymentUrl: 'https://prepaid.desco.org.bd',
    hotline: '16120',
    trustLabel: TrustLabel.OFFICIAL_SOURCE,
    attribution: {
      trustLabel: TrustLabel.OFFICIAL_SOURCE,
      sourceUrl: 'https://desco.gov.bd',
      agency: 'DESCO',
      lastVerifiedAt: '2026-11-19T00:00:00.000Z',
    },
  },
  {
    code: 'dpdc',
    utilityType: 'electricity',
    nameBn: 'ডিপিডিসি (ঢাকা পাওয়ার ডিস্ট্রিবিউশন কোম্পানি)',
    nameEn: 'DPDC (Dhaka Power Distribution Company)',
    officialPaymentUrl: 'https://dpdc.org.bd',
    hotline: '16116',
    trustLabel: TrustLabel.OFFICIAL_SOURCE,
    attribution: {
      trustLabel: TrustLabel.OFFICIAL_SOURCE,
      sourceUrl: 'https://dpdc.org.bd',
      agency: 'DPDC',
      lastVerifiedAt: '2026-11-19T00:00:00.000Z',
    },
  },
  {
    code: 'breb',
    utilityType: 'electricity',
    nameBn: 'বাংলাদেশ পল্লী বিদ্যুতায়ন বোর্ড (পল্লী বিদ্যুৎ)',
    nameEn: 'Bangladesh Rural Electrification Board (BREB)',
    officialPaymentUrl: 'https://reb.gov.bd',
    hotline: '16899',
    trustLabel: TrustLabel.OFFICIAL_SOURCE,
    attribution: {
      trustLabel: TrustLabel.OFFICIAL_SOURCE,
      sourceUrl: 'https://reb.gov.bd',
      agency: 'BREB',
      lastVerifiedAt: '2026-11-19T00:00:00.000Z',
    },
  },
  {
    code: 'bpdb',
    utilityType: 'electricity',
    nameBn: 'বাংলাদেশ বিদ্যুৎ উন্নয়ন বোর্ড (BPDB)',
    nameEn: 'Bangladesh Power Development Board (BPDB)',
    officialPaymentUrl: 'https://bpdb.gov.bd',
    hotline: '16200',
    trustLabel: TrustLabel.OFFICIAL_SOURCE,
    attribution: {
      trustLabel: TrustLabel.OFFICIAL_SOURCE,
      sourceUrl: 'https://bpdb.gov.bd',
      agency: 'BPDB',
      lastVerifiedAt: '2026-11-15T00:00:00.000Z',
    },
  },
  {
    code: 'nesco',
    utilityType: 'electricity',
    nameBn: 'নেসকো (নর্দান ইলেকট্রিসিটি সাপ্লাই কোম্পানি)',
    nameEn: 'NESCO (Northern Electricity Supply Company)',
    officialPaymentUrl: 'https://nesco.gov.bd',
    hotline: '16603',
    trustLabel: TrustLabel.OFFICIAL_SOURCE,
    attribution: {
      trustLabel: TrustLabel.OFFICIAL_SOURCE,
      sourceUrl: 'https://nesco.gov.bd',
      agency: 'NESCO',
      lastVerifiedAt: '2026-11-15T00:00:00.000Z',
    },
  },
  {
    code: 'wzpdcl',
    utilityType: 'electricity',
    nameBn: 'ওয়েজোপাডিকো (ওয়েস্ট জোন পাওয়ার ডিস্ট্রিবিউশন)',
    nameEn: 'WZPDCL (West Zone Power Distribution Company)',
    officialPaymentUrl: 'https://wzpdcl.gov.bd',
    hotline: '16117',
    trustLabel: TrustLabel.OFFICIAL_SOURCE,
    attribution: {
      trustLabel: TrustLabel.OFFICIAL_SOURCE,
      sourceUrl: 'https://wzpdcl.gov.bd',
      agency: 'WZPDCL',
      lastVerifiedAt: '2026-11-15T00:00:00.000Z',
    },
  },
  {
    code: 'dwasa',
    utilityType: 'water',
    nameBn: 'ঢাকা ওয়াসা (পানি সরবরাহ ও পয়ঃনিষ্কাশন)',
    nameEn: 'Dhaka WASA',
    officialPaymentUrl: 'https://dwasa.org.bd',
    hotline: '16162',
    trustLabel: TrustLabel.OFFICIAL_SOURCE,
    attribution: {
      trustLabel: TrustLabel.OFFICIAL_SOURCE,
      sourceUrl: 'https://dwasa.org.bd',
      agency: 'Dhaka WASA',
      lastVerifiedAt: '2026-11-15T00:00:00.000Z',
    },
  },
  {
    code: 'cwasa',
    utilityType: 'water',
    nameBn: 'চট্টগ্রাম ওয়াসা',
    nameEn: 'Chattogram WASA',
    officialPaymentUrl: 'https://ctg-wasa.org.bd',
    hotline: '16162',
    trustLabel: TrustLabel.OFFICIAL_SOURCE,
    attribution: {
      trustLabel: TrustLabel.OFFICIAL_SOURCE,
      sourceUrl: 'https://ctg-wasa.org.bd',
      agency: 'Chattogram WASA',
      lastVerifiedAt: '2026-11-15T00:00:00.000Z',
    },
  },
  {
    code: 'kwasa',
    utilityType: 'water',
    nameBn: 'খুলনা ওয়াসা',
    nameEn: 'Khulna WASA',
    officialPaymentUrl: 'https://kwasa.org.bd',
    hotline: '333',
    trustLabel: TrustLabel.OFFICIAL_SOURCE,
    attribution: {
      trustLabel: TrustLabel.OFFICIAL_SOURCE,
      sourceUrl: 'https://kwasa.org.bd',
      agency: 'Khulna WASA',
      lastVerifiedAt: '2026-11-15T00:00:00.000Z',
    },
  },
  {
    code: 'rwasa',
    utilityType: 'water',
    nameBn: 'রাজশাহী ওয়াসা',
    nameEn: 'Rajshahi WASA',
    officialPaymentUrl: 'https://rajshahiwasa.org.bd',
    hotline: '333',
    trustLabel: TrustLabel.OFFICIAL_SOURCE,
    attribution: {
      trustLabel: TrustLabel.OFFICIAL_SOURCE,
      sourceUrl: 'https://rajshahiwasa.org.bd',
      agency: 'Rajshahi WASA',
      lastVerifiedAt: '2026-11-15T00:00:00.000Z',
    },
  },
  {
    code: 'titas',
    utilityType: 'gas',
    nameBn: 'তিতাস গ্যাস ট্রান্সমিশন অ্যান্ড ডিস্ট্রিবিউশন',
    nameEn: 'Titas Gas Transmission & Distribution',
    officialPaymentUrl: 'https://www.titasgas.org.bd',
    hotline: '16496',
    trustLabel: TrustLabel.OFFICIAL_SOURCE,
    attribution: {
      trustLabel: TrustLabel.OFFICIAL_SOURCE,
      sourceUrl: 'https://www.titasgas.org.bd',
      agency: 'Titas Gas',
      lastVerifiedAt: '2026-11-15T00:00:00.000Z',
    },
  },
  {
    code: 'bakhrabad',
    utilityType: 'gas',
    nameBn: 'বাখরাবাদ গ্যাস ডিস্ট্রিবিউশন কোম্পানি (BGDCL)',
    nameEn: 'Bakhrabad Gas Distribution Company (BGDCL)',
    officialPaymentUrl: 'https://bgdcl.org.bd',
    hotline: '333',
    trustLabel: TrustLabel.OFFICIAL_SOURCE,
    attribution: {
      trustLabel: TrustLabel.OFFICIAL_SOURCE,
      sourceUrl: 'https://bgdcl.org.bd',
      agency: 'BGDCL',
      lastVerifiedAt: '2026-11-15T00:00:00.000Z',
    },
  },
  {
    code: 'jalalabad',
    utilityType: 'gas',
    nameBn: 'জালালাবাদ গ্যাস ট্রান্সমিশন অ্যান্ড ডিস্ট্রিবিউশন (JGTDSL)',
    nameEn: 'Jalalabad Gas T&D System (JGTDSL)',
    officialPaymentUrl: 'https://jalalabadgas.org.bd',
    hotline: '333',
    trustLabel: TrustLabel.OFFICIAL_SOURCE,
    attribution: {
      trustLabel: TrustLabel.OFFICIAL_SOURCE,
      sourceUrl: 'https://jalalabadgas.org.bd',
      agency: 'JGTDSL',
      lastVerifiedAt: '2026-11-15T00:00:00.000Z',
    },
  },
  {
    code: 'karnaphuli',
    utilityType: 'gas',
    nameBn: 'কর্ণফুলী গ্যাস ডিস্ট্রিবিউশন কোম্পানি (KGDCL)',
    nameEn: 'Karnaphuli Gas Distribution Company (KGDCL)',
    officialPaymentUrl: 'https://kgdcl.gov.bd',
    hotline: '333',
    trustLabel: TrustLabel.OFFICIAL_SOURCE,
    attribution: {
      trustLabel: TrustLabel.OFFICIAL_SOURCE,
      sourceUrl: 'https://kgdcl.gov.bd',
      agency: 'KGDCL',
      lastVerifiedAt: '2026-11-15T00:00:00.000Z',
    },
  },
];

@Injectable()
export class EmergencyHealthUtilityService {
  private hotlines: HotlineItem[] = buildStaticEmergencyHotlines();
  private readonly hotlineProposals = new Map<string, HotlineEditProposal>();
  private readonly utilitySubscriptions = new Map<string, UtilitySubscriptionRecord>();
  /** Test hook simulating database outage to prove GET /emergency stays resilient (Rule R8) */
  simulateDbDown = false;

  constructor(
    private readonly catalogue: CatalogueService,
    private readonly policy: PolicyService,
  ) {}

  /**
   * Rule R8: Ultra-compact (< 5 KB) emergency hotline payload with tap-to-call tel: URIs.
   * Falls back seamlessly to static bundled hotlines even if the database is completely down.
   */
  async getEmergencyPayload() {
    let sourceMode: 'cache' | 'static_fallback' = 'cache';
    let items: HotlineItem[];

    try {
      if (this.simulateDbDown) {
        throw new Error('Simulated DB outage');
      }
      items = this.hotlines;
    } catch {
      sourceMode = 'static_fallback';
      items = buildStaticEmergencyHotlines();
    }

    return {
      sourceMode,
      noDispatchNoticeBn: 'জনসেবা জরুরি দল পাঠায় না — তাৎক্ষণিক বিপদে সরাসরি ৯৯৯-এ কল করুন।',
      noDispatchNoticeEn: 'Jonoshheba does not dispatch responders — dial 999 directly.',
      hotlines: items.map((h) => ({
        n: h.number,
        tel: h.telUri,
        bn: h.nameBn,
        en: h.nameEn,
        cat: h.category,
        src: h.sourceUrl,
        v: h.lastVerifiedAt,
        vbr: h.verifyBeforeRelease,
      })),
    };
  }

  async getNearbyEmergencyFacilities(lat: number, lng: number, radiusKm = 25, locale: 'bn' | 'en' = 'bn') {
    const all = await this.catalogue.listFacilities({ nearLat: lat, nearLng: lng, radiusKm, locale });
    return {
      items: all.filter((f) => ['hospital', 'police', 'fire', 'shelter'].includes(f.facilityType)),
    };
  }

  async getEmergencyAlerts(district: string | undefined, locale: 'bn' | 'en' = 'bn') {
    const items = await this.catalogue.listNotices({
      kind: 'disaster',
      region: district,
      activeOnly: true,
      locale,
    });
    return { items };
  }

  /** Two-person review workflow for hotline edits (Prompt 08 & Rule R8) */
  proposeHotlineEdit(
    authorId: string,
    hotlineNumber: string,
    dto: { proposedNameBn: string; proposedNameEn: string; sourceUrl: string },
  ): HotlineEditProposal {
    const existing = this.hotlines.find((h) => h.number === hotlineNumber);
    if (!existing) throw new NotFoundException(`Hotline '${hotlineNumber}' not found`);

    const proposal: HotlineEditProposal = {
      id: uuidv7(),
      hotlineNumber,
      proposedNameBn: dto.proposedNameBn,
      proposedNameEn: dto.proposedNameEn,
      sourceUrl: dto.sourceUrl,
      authorId,
      reviewerId: null,
      status: 'pending_review',
      createdAt: new Date(),
      resolvedAt: null,
    };
    this.hotlineProposals.set(proposal.id, proposal);
    return proposal;
  }

  approveHotlineEdit(
    proposalId: string,
    reviewer: Pick<AccessTokenClaims, 'sub' | 'roles' | 'orgScopes' | 'mfaVerified'>,
  ): { proposal: HotlineEditProposal; hotline: HotlineItem } {
    const proposal = this.hotlineProposals.get(proposalId);
    if (!proposal) throw new NotFoundException('Hotline edit proposal not found');

    // Enforces reviewer !== author AND MFA AND hotline:approve permission
    this.policy.assertTwoPersonApproval({
      action: 'hotline:approve',
      authorId: proposal.authorId,
      reviewer,
    });

    const hotline = this.hotlines.find((h) => h.number === proposal.hotlineNumber);
    if (!hotline) throw new NotFoundException('Hotline not found');

    hotline.nameBn = proposal.proposedNameBn;
    hotline.nameEn = proposal.proposedNameEn;
    hotline.sourceUrl = proposal.sourceUrl;
    hotline.lastVerifiedAt = new Date().toISOString();
    hotline.verifyBeforeRelease = false;

    proposal.reviewerId = reviewer.sub;
    proposal.status = 'approved';
    proposal.resolvedAt = new Date();

    return { proposal, hotline };
  }

  // --- Health Guidance (Rule R7 & R8: Zero Diagnosis, Red-Flag -> 999 FIRST) ---

  async getHealthGuidance(params: {
    query: string;
    lat?: number;
    lng?: number;
    locale: 'bn' | 'en';
  }) {
    const assessment = assessHealthRedFlags(params.query);
    const [hospitals, healthNotices] = await Promise.all([
      this.catalogue.listFacilities({
        type: 'hospital',
        nearLat: params.lat,
        nearLng: params.lng,
        locale: params.locale,
      }),
      this.catalogue.listNotices({ kind: 'health', activeOnly: true, locale: params.locale }),
    ]);

    return {
      urgentRedFlag: assessment.isRedFlag,
      matchedSignals: assessment.matchedSignals,
      call999: assessment.isRedFlag ? { number: '999', telUri: 'tel:999' } : null,
      healthHelpline: { number: '16263', telUri: 'tel:16263', name: 'Shastho Batayon (DGHS)' },
      guidanceBn: assessment.immediateActionBn,
      guidanceEn: assessment.immediateActionEn,
      noDiagnosisNoticeBn: assessment.noDiagnosisNoticeBn,
      noDiagnosisNoticeEn: assessment.noDiagnosisNoticeEn,
      nearbyHospitals: hospitals.slice(0, 5),
      publicHealthNotices: healthNotices,
    };
  }

  // --- Utilities: Verified Payment Links & Outage Subscriptions ---

  listVerifiedUtilityProviders() {
    return {
      disclaimerBn:
        'জনসেবা কখনো কার্ড নম্বর বা মোবাইল ব্যাংকিং পিন সংরক্ষণ করে না — বিল পরিশোধের জন্য অফিশিয়াল লিংকে যান।',
      disclaimerEn:
        'Jonoshheba never stores card numbers or mobile-banking PINs — continue to the official utility link to pay.',
      items: VERIFIED_UTILITY_PROVIDERS,
    };
  }

  subscribeUtilityOutages(
    userId: string,
    dto: { districtEn: string; utilityType: 'electricity' | 'water' | 'gas'; providerName?: string },
  ): UtilitySubscriptionRecord {
    const sub: UtilitySubscriptionRecord = {
      id: uuidv7(),
      userId,
      districtEn: dto.districtEn.trim(),
      utilityType: dto.utilityType,
      providerName: dto.providerName?.trim() || null,
      createdAt: new Date(),
    };
    this.utilitySubscriptions.set(sub.id, sub);
    return sub;
  }

  listUtilitySubscriptions(userId: string): UtilitySubscriptionRecord[] {
    return [...this.utilitySubscriptions.values()].filter((s) => s.userId === userId);
  }

  deleteUtilitySubscription(userId: string, id: string): { deleted: true } {
    const existing = this.utilitySubscriptions.get(id);
    if (!existing) throw new NotFoundException('Utility subscription not found');
    if (existing.userId !== userId) {
      throw new ForbiddenException('Cannot remove another citizen’s utility subscription');
    }
    this.utilitySubscriptions.delete(id);
    return { deleted: true };
  }
}
