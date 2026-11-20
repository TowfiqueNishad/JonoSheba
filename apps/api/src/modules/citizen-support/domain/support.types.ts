import type { CaseStatus, TrustAttribution, TrustLabel } from '@jonoshheba/shared';

export interface ComplaintGuideRecord {
  slug: string;
  category: string;
  authorityBn: string;
  authorityEn: string;
  officialChannelUrl: string;
  supportsAnonymity: boolean;
  anonymityNotesBn: string;
  anonymityNotesEn: string;
  evidenceChecklist: string[];
}

export interface CitizenCaseRecord {
  id: string;
  userId: string;
  caseType: 'support' | 'external_complaint';
  category: string;
  categoryConfidence: number;
  title: string;
  location: string | null;
  summaryBn: string;
  summaryEn: string;
  structuredSummary: {
    what: string;
    when: string | null;
    where: string | null;
    service: string | null;
    reference: string | null;
  };
  suggestedAuthorityBn: string;
  suggestedAuthorityEn: string;
  officialChannelUrl: string;
  supportsAnonymity: boolean;
  anonymityNotesBn: string;
  anonymityNotesEn: string;
  missingEvidenceChecklist: string[];
  possibleDuplicateCount: number; // Aggregate count ONLY — never leaks another citizen's text (R10)
  aiDraft: string;
  userFinalText: string | null;
  userReviewedAt: Date | null;
  externalChannel: string | null;
  externalReference: string | null;
  status: CaseStatus;
  userReportedUpdates: Array<{ note: string; recordedAt: string }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupportTicketRecord {
  id: string;
  userId: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  agentResponse: string | null;
  respondedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface HotlineItem {
  number: string;
  telUri: string;
  nameBn: string;
  nameEn: string;
  category: string;
  agency: string;
  sourceUrl: string;
  trustLabel: TrustLabel;
  lastVerifiedAt: string | null;
  verifyBeforeRelease: boolean;
}

export interface HotlineEditProposal {
  id: string;
  hotlineNumber: string;
  proposedNameBn: string;
  proposedNameEn: string;
  sourceUrl: string;
  authorId: string;
  reviewerId: string | null;
  status: 'pending_review' | 'approved' | 'rejected';
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface UtilitySubscriptionRecord {
  id: string;
  userId: string;
  districtEn: string;
  utilityType: 'electricity' | 'water' | 'gas';
  providerName: string | null;
  createdAt: Date;
}

export interface VerifiedUtilityProvider {
  code: string;
  utilityType: 'electricity' | 'water' | 'gas';
  nameBn: string;
  nameEn: string;
  officialPaymentUrl: string;
  hotline: string;
  trustLabel: TrustLabel;
  attribution: TrustAttribution;
}
