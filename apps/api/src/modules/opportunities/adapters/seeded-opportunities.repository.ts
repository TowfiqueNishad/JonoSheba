import { Injectable } from '@nestjs/common';
import { TrustLabel } from '@jonoshheba/shared';
import { uuidv7 } from '../../../common/uuidv7';
import { OPPORTUNITIES_WITH_RULES_SEED } from '../../../seed-data/opportunities';
import type {
  EligibilityRuleRecord,
  JobCircularRecord,
  OpportunityTargetType,
  ProgramRecord,
  SavedChecklistRecord,
  ScholarshipRecord,
} from '../domain/opportunities.types';
import type { OpportunitiesRepositoryPort } from '../ports/opportunities.repository.port';

@Injectable()
export class SeededOpportunitiesRepository implements OpportunitiesRepositoryPort {
  private readonly programs = new Map<string, ProgramRecord>();
  private readonly scholarships = new Map<string, ScholarshipRecord>();
  private readonly jobs = new Map<string, JobCircularRecord>();
  private readonly rules: EligibilityRuleRecord[] = [];
  private readonly checklists = new Map<string, SavedChecklistRecord>();

  constructor() {
    this.bootstrapSeedData();
  }

  private bootstrapSeedData(): void {
    const verifiedSnapshotAt = new Date('2026-11-10T00:00:00Z');
    const effectiveFrom = new Date('2026-01-01T00:00:00Z');

    for (const item of OPPORTUNITIES_WITH_RULES_SEED) {
      const attribution = {
        trustLabel: TrustLabel.OFFICIAL_SOURCE,
        sourceUrl: item.applicationUrl,
        agency: item.agencyOrProvider,
        lastVerifiedAt: verifiedSnapshotAt.toISOString(),
      };

      if (item.kind === 'program') {
        this.programs.set(item.slug, {
          id: uuidv7(),
          slug: item.slug,
          titleBn: item.titleBn,
          titleEn: item.titleEn,
          summaryBn: item.summaryBn,
          summaryEn: item.summaryEn,
          agency: item.agencyOrProvider,
          category: item.categoryOrLevel,
          benefitAmountInfo: item.benefitAmountInfo ?? null,
          // Section 6.3: No synthetic placeholder deadline (null -> "ঘোষণা অনুযায়ী / As announced")
          deadlineAt: null,
          requiredDocuments: [...item.requiredDocuments],
          applicationUrl: item.applicationUrl,
          regionScope: { national: true },
          trustLabel: TrustLabel.OFFICIAL_SOURCE,
          attribution,
          status: 'published',
        });
      } else {
        this.scholarships.set(item.slug, {
          id: uuidv7(),
          slug: item.slug,
          titleBn: item.titleBn,
          titleEn: item.titleEn,
          summaryBn: item.summaryBn,
          summaryEn: item.summaryEn,
          provider: item.agencyOrProvider,
          educationLevel: item.categoryOrLevel,
          // Section 6.3: No synthetic placeholder deadline (null -> "ঘোষণা অনুযায়ী / As announced")
          deadlineAt: null,
          requiredDocuments: [...item.requiredDocuments],
          applicationUrl: item.applicationUrl,
          regionScope: { national: true },
          trustLabel: TrustLabel.OFFICIAL_SOURCE,
          attribution,
          status: 'published',
        });
      }

      this.rules.push({
        id: uuidv7(),
        targetType: item.kind,
        targetSlug: item.slug,
        version: 1,
        ruleJsonLogic: item.ruleJsonLogic,
        criteriaExplanations: [...item.criteriaExplanations],
        sourceUrl: item.applicationUrl,
        agency: item.agencyOrProvider,
        reviewerId: 'seed-reviewer',
        effectiveFrom,
        effectiveTo: null,
        isActive: true,
      });
    }

    // Seed sample public job circulars
    const sampleJobs: Array<Omit<JobCircularRecord, 'id' | 'attribution'>> = [
      {
        slug: 'bpsc-47th-bcs-circular',
        titleBn: '৪৭তম বিসিএস (সাধারণ ও কারিগরি ক্যাডার) নিয়োগ বিজ্ঞপ্তি',
        titleEn: '47th BCS (General & Technical Cadre) Recruitment Circular',
        organizationBn: 'বাংলাদেশ সরকারি কর্ম কমিশন (বিপিএসসি)',
        organizationEn: 'Bangladesh Public Service Commission (BPSC)',
        grade: 'Grade-9',
        vacancies: 3487,
        ageLimitInfo: '21–32 years (verify latest gazette on bpsc.gov.bd)',
        qualificationsBn: 'স্বীকৃত বিশ্ববিদ্যালয় হতে স্নাতক / স্নাতকোত্তর ডিগ্রি।',
        qualificationsEn: 'Bachelor’s or Master’s degree from a recognized university.',
        feeInfo: 'বিপিএসসি নির্ধারিত টেলিটক ফি (অফিশিয়াল বিজ্ঞপ্তি দেখুন)',
        deadlineAt: null,
        requiredDocuments: ['স্নাতক সনদ', 'এনআইডি', 'পাসপোর্ট সাইজ ছবি ও স্বাক্ষর'],
        applicationUrl: 'https://bpsc.teletalk.com.bd',
        regionScope: { national: true },
        trustLabel: TrustLabel.OFFICIAL_SOURCE,
        status: 'published',
      },
      {
        slug: 'bb-assistant-director-general',
        titleBn: 'বাংলাদেশ ব্যাংক — সহকারী পরিচালক (জেনারেল)',
        titleEn: 'Bangladesh Bank — Assistant Director (General)',
        organizationBn: 'বাংলাদেশ ব্যাংক',
        organizationEn: 'Bangladesh Bank',
        grade: 'Grade-9',
        vacancies: 150,
        ageLimitInfo: 'Max 32 years per latest circular',
        qualificationsBn: 'যেকোনো বিষয়ে ৪ বছর মেয়াদী স্নাতক (সম্মান) বা স্নাতকোত্তর।',
        qualificationsEn: '4-year Honours or Master’s degree in any discipline.',
        feeInfo: 'অফিশিয়াল ই-রিক্রুটমেন্ট বিজ্ঞপ্তি অনুযায়ী',
        deadlineAt: null,
        requiredDocuments: ['একাডেমিক সনদসমূহ', 'এনআইডি', 'রঙিন ছবি'],
        applicationUrl: 'https://erecruitment.bb.org.bd',
        regionScope: { national: true },
        trustLabel: TrustLabel.OFFICIAL_SOURCE,
        status: 'published',
      },
      {
        slug: 'dpe-primary-assistant-teacher',
        titleBn: 'সরকারি প্রাথমিক বিদ্যালয় সহকারী শিক্ষক নিয়োগ',
        titleEn: 'Government Primary School Assistant Teacher Recruitment',
        organizationBn: 'প্রাথমিক শিক্ষা অধিদপ্তর (ডিপিই)',
        organizationEn: 'Directorate of Primary Education (DPE)',
        grade: 'Grade-13',
        vacancies: 5000,
        ageLimitInfo: '21–32 years',
        qualificationsBn: 'ন্যূনতম দ্বিতীয় শ্রেণির স্নাতক বা সমমান ডিগ্রি।',
        qualificationsEn: 'Minimum 2nd class Bachelor’s degree or equivalent.',
        feeInfo: 'টেলিটক আবেদন ফি (বিজ্ঞপ্তিতে যাচাই করুন)',
        deadlineAt: null,
        requiredDocuments: ['স্নাতক সনদ', 'নাগরিকত্ব সনদ', 'এনআইডি'],
        applicationUrl: 'https://dpe.teletalk.com.bd',
        regionScope: { national: true },
        trustLabel: TrustLabel.OFFICIAL_SOURCE,
        status: 'published',
      },
    ];

    for (const j of sampleJobs) {
      this.jobs.set(j.slug, {
        ...j,
        id: uuidv7(),
        attribution: {
          trustLabel: j.trustLabel,
          sourceUrl: j.applicationUrl,
          agency: j.organizationEn,
          lastVerifiedAt: verifiedSnapshotAt.toISOString(),
        },
      });
    }
  }

  private matchesFilters(
    item: {
      regionScope: { national?: boolean; districts?: string[] };
      deadlineAt: Date | null;
      status: string;
    },
    filters?: { region?: string; deadlineBefore?: Date; openNow?: boolean; includeDrafts?: boolean },
  ): boolean {
    if (!filters?.includeDrafts && item.status !== 'published') return false;
    const now = new Date();
    if (filters?.openNow && item.deadlineAt && item.deadlineAt <= now) return false;
    if (filters?.deadlineBefore && (!item.deadlineAt || item.deadlineAt > filters.deadlineBefore)) {
      return false;
    }
    if (filters?.region) {
      const reg = filters.region.toLowerCase();
      const hit = (item.regionScope.districts ?? []).some((d) => d.toLowerCase() === reg);
      if (!item.regionScope.national && !hit) return false;
    }
    return true;
  }

  async listPrograms(filters?: {
    category?: string;
    region?: string;
    deadlineBefore?: Date;
    openNow?: boolean;
  }): Promise<ProgramRecord[]> {
    return [...this.programs.values()].filter(
      (p) =>
        (!filters?.category || p.category === filters.category) &&
        this.matchesFilters(p, filters),
    );
  }

  async findProgramBySlug(slug: string): Promise<ProgramRecord | null> {
    return this.programs.get(slug) ?? null;
  }

  async listScholarships(filters?: {
    level?: string;
    region?: string;
    deadlineBefore?: Date;
    openNow?: boolean;
  }): Promise<ScholarshipRecord[]> {
    return [...this.scholarships.values()].filter(
      (s) =>
        (!filters?.level || s.educationLevel === filters.level) &&
        this.matchesFilters(s, filters),
    );
  }

  async findScholarshipBySlug(slug: string): Promise<ScholarshipRecord | null> {
    return this.scholarships.get(slug) ?? null;
  }

  async listJobs(filters?: {
    grade?: string;
    region?: string;
    deadlineBefore?: Date;
    openNow?: boolean;
    includeDrafts?: boolean;
  }): Promise<JobCircularRecord[]> {
    return [...this.jobs.values()].filter(
      (j) =>
        (!filters?.grade || j.grade?.toLowerCase() === filters.grade.toLowerCase()) &&
        this.matchesFilters(j, filters),
    );
  }

  async findJobBySlug(slug: string): Promise<JobCircularRecord | null> {
    return this.jobs.get(slug) ?? null;
  }

  async saveJob(job: JobCircularRecord): Promise<JobCircularRecord> {
    this.jobs.set(job.slug, job);
    return job;
  }

  async saveRule(rule: EligibilityRuleRecord): Promise<EligibilityRuleRecord> {
    this.rules.push(rule);
    return rule;
  }

  async findRuleAtDate(
    targetType: OpportunityTargetType,
    targetSlug: string,
    atDate: Date,
  ): Promise<EligibilityRuleRecord | null> {
    const candidates = this.rules
      .filter(
        (r) =>
          r.targetType === targetType &&
          r.targetSlug === targetSlug &&
          r.isActive &&
          r.effectiveFrom.getTime() <= atDate.getTime() &&
          (r.effectiveTo === null || atDate.getTime() < r.effectiveTo.getTime()),
      )
      .sort((a, b) => b.version - a.version);
    return candidates[0] ?? null;
  }

  async listChecklists(userId: string): Promise<SavedChecklistRecord[]> {
    return [...this.checklists.values()].filter((c) => c.userId === userId);
  }

  async findChecklistById(id: string): Promise<SavedChecklistRecord | null> {
    return this.checklists.get(id) ?? null;
  }

  async saveChecklist(checklist: SavedChecklistRecord): Promise<SavedChecklistRecord> {
    this.checklists.set(checklist.id, checklist);
    return checklist;
  }

  async deleteChecklist(id: string): Promise<void> {
    this.checklists.delete(id);
  }
}
