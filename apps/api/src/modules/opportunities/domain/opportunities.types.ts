import type { TrustAttribution, TrustLabel } from '@jonoshheba/shared';

export type OpportunityTargetType = 'program' | 'scholarship' | 'job';
export type EligibilityOutcome = 'LIKELY_ELIGIBLE' | 'POSSIBLY_ELIGIBLE' | 'NOT_ELIGIBLE';
export type CriterionStatus = 'met' | 'unmet' | 'unknown';

export interface CriterionExplanationMeta {
  field: string;
  labelBn: string;
  labelEn: string;
  purposeBn: string;
  purposeEn: string;
}

export interface EligibilityRuleRecord {
  id: string;
  targetType: OpportunityTargetType;
  targetSlug: string;
  version: number;
  ruleJsonLogic: Record<string, unknown>;
  criteriaExplanations: CriterionExplanationMeta[];
  sourceUrl: string;
  agency: string;
  reviewerId: string | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  isActive: boolean;
}

export interface ProgramRecord {
  id: string;
  slug: string;
  titleBn: string;
  titleEn: string;
  summaryBn: string;
  summaryEn: string;
  agency: string;
  category: string;
  benefitAmountInfo: string | null;
  deadlineAt: Date | null;
  requiredDocuments: string[];
  applicationUrl: string;
  regionScope: { national?: boolean; districts?: string[] };
  trustLabel: TrustLabel;
  attribution: TrustAttribution;
  status: 'draft' | 'in_review' | 'published' | 'expired' | 'archived';
}

export interface ScholarshipRecord {
  id: string;
  slug: string;
  titleBn: string;
  titleEn: string;
  summaryBn: string;
  summaryEn: string;
  provider: string;
  educationLevel: string;
  deadlineAt: Date | null;
  requiredDocuments: string[];
  applicationUrl: string;
  regionScope: { national?: boolean; districts?: string[] };
  trustLabel: TrustLabel;
  attribution: TrustAttribution;
  status: 'draft' | 'in_review' | 'published' | 'expired' | 'archived';
}

export interface JobCircularRecord {
  id: string;
  slug: string;
  titleBn: string;
  titleEn: string;
  organizationBn: string;
  organizationEn: string;
  grade: string | null;
  vacancies: number | null;
  ageLimitInfo: string | null;
  qualificationsBn: string;
  qualificationsEn: string;
  feeInfo: string | null;
  deadlineAt: Date | null;
  requiredDocuments: string[];
  applicationUrl: string;
  regionScope: { national?: boolean; districts?: string[] };
  trustLabel: TrustLabel;
  attribution: TrustAttribution;
  status: 'draft' | 'in_review' | 'published' | 'expired' | 'archived';
}

export interface CriterionReason {
  field: string;
  status: CriterionStatus;
  labelBn: string;
  labelEn: string;
  sourceUrl: string;
  agency: string;
}

export interface WizardQuestion {
  field: string;
  questionBn: string;
  questionEn: string;
  purposeBn: string;
  purposeEn: string;
  inputType: 'boolean' | 'number' | 'select';
  options?: Array<{ value: string; labelBn: string; labelEn: string }>;
}

export interface ProgramEvaluationResult {
  targetType: OpportunityTargetType;
  slug: string;
  titleBn: string;
  titleEn: string;
  status: EligibilityOutcome;
  ruleVersion: number;
  applicationUrl: string;
  trustLabel: TrustLabel;
  reasons: CriterionReason[];
  missingQuestions: WizardQuestion[];
  disclaimerBn: string;
  disclaimerEn: string;
}

export interface SavedChecklistRecord {
  id: string;
  userId: string;
  targetType: 'program' | 'scholarship' | 'job' | 'service';
  targetSlug: string;
  titleBn: string;
  titleEn: string;
  deadlineAt: Date | null;
  applicationUrl: string;
  items: Array<{ label: string; checked: boolean }>;
  createdAt: Date;
}
