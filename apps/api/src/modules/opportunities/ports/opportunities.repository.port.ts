import type {
  EligibilityRuleRecord,
  JobCircularRecord,
  OpportunityTargetType,
  ProgramRecord,
  SavedChecklistRecord,
  ScholarshipRecord,
} from '../domain/opportunities.types';

export interface OpportunitiesRepositoryPort {
  listPrograms(filters?: {
    category?: string;
    region?: string;
    deadlineBefore?: Date;
    openNow?: boolean;
  }): Promise<ProgramRecord[]>;
  findProgramBySlug(slug: string): Promise<ProgramRecord | null>;

  listScholarships(filters?: {
    level?: string;
    region?: string;
    deadlineBefore?: Date;
    openNow?: boolean;
  }): Promise<ScholarshipRecord[]>;
  findScholarshipBySlug(slug: string): Promise<ScholarshipRecord | null>;

  listJobs(filters?: {
    grade?: string;
    region?: string;
    deadlineBefore?: Date;
    openNow?: boolean;
    includeDrafts?: boolean;
  }): Promise<JobCircularRecord[]>;
  findJobBySlug(slug: string): Promise<JobCircularRecord | null>;
  saveJob(job: JobCircularRecord): Promise<JobCircularRecord>;

  // Versioned deterministic eligibility rules
  saveRule(rule: EligibilityRuleRecord): Promise<EligibilityRuleRecord>;
  findRuleAtDate(
    targetType: OpportunityTargetType,
    targetSlug: string,
    atDate: Date,
  ): Promise<EligibilityRuleRecord | null>;

  // Citizen saved checklists (owner-scoped)
  listChecklists(userId: string): Promise<SavedChecklistRecord[]>;
  findChecklistById(id: string): Promise<SavedChecklistRecord | null>;
  saveChecklist(checklist: SavedChecklistRecord): Promise<SavedChecklistRecord>;
  deleteChecklist(id: string): Promise<void>;
}

export const OPPORTUNITIES_REPOSITORY_PORT = Symbol('OPPORTUNITIES_REPOSITORY_PORT');
