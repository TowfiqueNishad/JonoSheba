import type { TrustAttribution, TrustLabel } from '@jonoshheba/shared';

export type ContentStatus = 'draft' | 'in_review' | 'published' | 'archived';
export type NoticeKind = 'circular' | 'deadline' | 'outage' | 'disaster' | 'health' | 'exam';
export type FacilityType =
  | 'hospital'
  | 'clinic'
  | 'diagnostic'
  | 'shelter'
  | 'police'
  | 'fire'
  | 'utility_office';

export interface CategoryRecord {
  id: string;
  parentId: string | null;
  slug: string;
  nameBn: string;
  nameEn: string;
  icon: string;
  sortOrder: number;
  children?: CategoryRecord[];
}

export interface AgencyRecord {
  id: string;
  slug: string;
  nameBn: string;
  nameEn: string;
  officialUrl: string;
  contactPhone: string | null;
}

export interface SourceRecord {
  id: string;
  url: string;
  agency: string;
  sourceType: string;
  contentHash: string | null;
  fetchedAt: Date | null;
  verifiedAt: Date | null;
  validFrom: Date | null;
  validTo: Date | null;
  reviewerId: string | null;
  trustLabel: TrustLabel;
}

export interface ServiceVersionRecord {
  id: string;
  serviceId: string;
  version: number;
  changeSummary: string;
  authorId: string | null;
  reviewerId: string | null;
  publishedAt: Date;
  snapshot: {
    titleBn: string;
    titleEn: string;
    summaryBn: string;
    summaryEn: string;
    feeInfo: { bn: string; en: string };
    processingTime: string;
    officialUrl: string;
  };
}

export interface ServiceRecord {
  id: string;
  slug: string;
  titleBn: string;
  titleEn: string;
  summaryBn: string;
  summaryEn: string;
  descriptionMdBn: string;
  descriptionMdEn: string;
  whoCanApplyBn: string;
  whoCanApplyEn: string;
  agencyId: string;
  agencySlug: string;
  categoryId: string;
  categorySlug: string;
  sourceId: string;
  deliveryChannels: string[];
  officialUrl: string;
  feeInfo: { bn: string; en: string };
  processingTime: string;
  status: ContentStatus;
  trustLabel: TrustLabel;
  version: number;
  authorId: string | null;
  verifiedBy: string | null;
  lastVerifiedAt: Date | null;
  aliases: string[];
  requirements: Array<{ documentNameBn: string; documentNameEn: string; isMandatory: boolean }>;
  steps: Array<{
    stepOrder: number;
    titleBn: string;
    titleEn: string;
    instructionBn: string;
    instructionEn: string;
    channel: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface LifeEventRecord {
  id: string;
  slug: string;
  titleBn: string;
  titleEn: string;
  summaryBn: string;
  summaryEn: string;
  icon: string;
  sortOrder: number;
  steps: Array<{
    stepOrder: number;
    titleBn: string;
    titleEn: string;
    serviceSlug: string | null;
    notesBn: string;
    notesEn: string;
  }>;
}

export interface NoticeRecord {
  id: string;
  titleBn: string;
  titleEn: string;
  bodyBn: string;
  bodyEn: string;
  agency: string;
  kind: NoticeKind;
  publishedAt: Date;
  expiresAt: Date | null;
  regionScope: { national?: boolean; districts?: string[] };
  sourceId: string;
  trustLabel: TrustLabel;
  attribution: TrustAttribution;
}

export interface FacilityRecord {
  id: string;
  facilityType: FacilityType;
  nameBn: string;
  nameEn: string;
  districtEn: string;
  addressBn: string;
  addressEn: string;
  lat: number;
  lng: number;
  hours: string;
  contact: string;
  trustLabel: TrustLabel;
  attribution: TrustAttribution;
}

export interface UtilityOutageRecord {
  id: string;
  utilityType: 'electricity' | 'water' | 'gas';
  providerName: string;
  districtEn: string;
  areaDescriptionBn: string;
  areaDescriptionEn: string;
  startsAt: Date;
  expectedEndAt: Date | null;
  status: 'active' | 'resolved';
  trustLabel: TrustLabel;
  attribution: TrustAttribution;
}

export interface FaqRecord {
  id: string;
  serviceSlug: string | null;
  questionBn: string;
  questionEn: string;
  answerBn: string;
  answerEn: string;
  trustLabel: TrustLabel;
  attribution: TrustAttribution;
}

export interface ContentReportRecord {
  id: string;
  reporterId: string | null;
  resourceType: string;
  resourceId: string;
  reason: string;
  details: string;
  status: 'open' | 'in_review' | 'resolved' | 'dismissed';
  createdAt: Date;
}

export interface ReviewTaskRecord {
  id: string;
  reason: 'source_expired' | 'source_changed' | 'content_report' | 'submission';
  resourceType: string;
  resourceId: string;
  details: string;
  status: 'open' | 'resolved';
  createdAt: Date;
}

export interface SavedItemRecord {
  id: string;
  userId: string;
  resourceType: string;
  resourceId: string;
  notes: string | null;
  createdAt: Date;
}

export interface ReminderRecord {
  id: string;
  userId: string;
  resourceType: string;
  resourceId: string | null;
  titleBn: string;
  titleEn: string;
  remindAt: Date;
  status: 'scheduled' | 'sent' | 'cancelled';
  createdAt: Date;
}

export type SearchItemType =
  | 'service'
  | 'life_event'
  | 'notice'
  | 'program'
  | 'scholarship'
  | 'job'
  | 'facility'
  | 'hotline'
  | 'faq'
  | 'station'
  | 'bus_route'
  | 'ministry'
  | 'institution';

export interface SearchDocument {
  id: string;
  type: SearchItemType;
  slugOrCode: string;
  titleBn: string;
  titleEn: string;
  summaryBn: string;
  summaryEn: string;
  keywords: string[];
  url: string;
  trustLabel: TrustLabel;
  attribution: TrustAttribution;
  extra?: Record<string, unknown>;
}

export interface UniversalSearchHit {
  id: string;
  type: SearchItemType;
  slugOrCode: string;
  title: string;
  titleBn: string;
  titleEn: string;
  summary: string;
  url: string;
  score: number;
  trustLabel: TrustLabel;
  attribution: TrustAttribution;
  extra?: Record<string, unknown>;
}

export interface IntentHint {
  module:
    | 'transport'
    | 'service'
    | 'benefit'
    | 'scholarship'
    | 'job'
    | 'complaint'
    | 'emergency'
    | 'health'
    | 'utility'
    | 'general';
  confidence: number;
  actionCard?: {
    type: 'transport_search' | 'emergency_call' | 'eligibility_wizard';
    payload: Record<string, unknown>;
  };
}

export interface UniversalSearchResponse {
  query: string;
  normalizedQuery: string;
  expandedTerms: string[];
  didYouMean: string | null;
  intentHint: IntentHint;
  total: number;
  latencyMs: number;
  hits: UniversalSearchHit[];
}
