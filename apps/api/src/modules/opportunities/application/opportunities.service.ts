import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TrustLabel } from '@jonoshheba/shared';
import { uuidv7 } from '../../../common/uuidv7';
import {
  type CalendarDeadlineItem,
  generateDeadlinesIcs,
} from '../domain/ics-generator';
import {
  evaluateProgramRule,
  selectBestNextQuestion,
} from '../domain/json-logic-evaluator';
import type {
  JobCircularRecord,
  ProgramEvaluationResult,
  SavedChecklistRecord,
} from '../domain/opportunities.types';
import {
  OPPORTUNITIES_REPOSITORY_PORT,
  type OpportunitiesRepositoryPort,
} from '../ports/opportunities.repository.port';

const DISCLAIMER_BN =
  'সম্ভাব্য মিল — এটি নিশ্চিত ভাতা বা অনুমোদন নয়। আবেদন করতে অফিশিয়াল সরকারি চ্যানেলে যান।';
const DISCLAIMER_EN =
  'Possible match — not a guaranteed entitlement. Apply via the official channel.';

@Injectable()
export class OpportunitiesService {
  constructor(
    @Inject(OPPORTUNITIES_REPOSITORY_PORT)
    private readonly repo: OpportunitiesRepositoryPort,
  ) {}

  listPrograms(filters?: { category?: string; region?: string; deadlineBefore?: Date; openNow?: boolean }) {
    return this.repo.listPrograms(filters);
  }

  async getProgram(slug: string) {
    const p = await this.repo.findProgramBySlug(slug);
    if (!p) throw new NotFoundException(`Program '${slug}' not found`);
    return p;
  }

  listScholarships(filters?: { level?: string; region?: string; deadlineBefore?: Date; openNow?: boolean }) {
    return this.repo.listScholarships(filters);
  }

  async getScholarship(slug: string) {
    const s = await this.repo.findScholarshipBySlug(slug);
    if (!s) throw new NotFoundException(`Scholarship '${slug}' not found`);
    return s;
  }

  listJobs(filters?: { grade?: string; region?: string; deadlineBefore?: Date; openNow?: boolean }) {
    return this.repo.listJobs(filters);
  }

  async getJob(slug: string) {
    const j = await this.repo.findJobBySlug(slug);
    if (!j || j.status === 'draft') throw new NotFoundException(`Job circular '${slug}' not found`);
    return j;
  }

  /**
   * Deterministic Eligibility Evaluation (Rule R7):
   * Evaluates candidate programs & scholarships strictly via versioned JSON-Logic rules
   * active at evaluationDate, returning bilingual reasons + official source citations.
   */
  async evaluateEligibility(params: {
    need?: 'benefits' | 'scholarships' | 'all';
    slugs?: string[];
    answers: Record<string, unknown>;
    evaluationDate?: Date;
  }): Promise<{
    evaluationDate: string;
    disclaimerBn: string;
    disclaimerEn: string;
    results: ProgramEvaluationResult[];
  }> {
    const evalDate = params.evaluationDate ?? new Date();
    const need = params.need ?? 'all';

    const targets: Array<{
      targetType: 'program' | 'scholarship';
      slug: string;
      titleBn: string;
      titleEn: string;
      applicationUrl: string;
      trustLabel: TrustLabel;
    }> = [];

    if (need === 'all' || need === 'benefits') {
      const programs = await this.repo.listPrograms();
      for (const p of programs) {
        targets.push({
          targetType: 'program',
          slug: p.slug,
          titleBn: p.titleBn,
          titleEn: p.titleEn,
          applicationUrl: p.applicationUrl,
          trustLabel: p.trustLabel,
        });
      }
    }
    if (need === 'all' || need === 'scholarships') {
      const scholarships = await this.repo.listScholarships();
      for (const s of scholarships) {
        targets.push({
          targetType: 'scholarship',
          slug: s.slug,
          titleBn: s.titleBn,
          titleEn: s.titleEn,
          applicationUrl: s.applicationUrl,
          trustLabel: s.trustLabel,
        });
      }
    }

    const filtered = params.slugs?.length
      ? targets.filter((t) => params.slugs!.includes(t.slug))
      : targets;

    const results: ProgramEvaluationResult[] = [];
    for (const target of filtered) {
      const rule = await this.repo.findRuleAtDate(target.targetType, target.slug, evalDate);
      if (!rule) continue;

      const evaluated = evaluateProgramRule({
        ruleJsonLogic: rule.ruleJsonLogic,
        criteriaExplanations: rule.criteriaExplanations,
        sourceUrl: rule.sourceUrl,
        agency: rule.agency,
        answers: params.answers,
      });

      results.push({
        targetType: target.targetType,
        slug: target.slug,
        titleBn: target.titleBn,
        titleEn: target.titleEn,
        status: evaluated.outcome,
        ruleVersion: rule.version,
        applicationUrl: target.applicationUrl,
        trustLabel: target.trustLabel,
        reasons: evaluated.reasons,
        missingQuestions: evaluated.missingQuestions,
        disclaimerBn: DISCLAIMER_BN,
        disclaimerEn: DISCLAIMER_EN,
      });
    }

    // Order: LIKELY_ELIGIBLE first, then POSSIBLY_ELIGIBLE, then NOT_ELIGIBLE
    const rank = { LIKELY_ELIGIBLE: 0, POSSIBLY_ELIGIBLE: 1, NOT_ELIGIBLE: 2 };
    results.sort((a, b) => rank[a.status] - rank[b.status]);

    return {
      evaluationDate: evalDate.toISOString(),
      disclaimerBn: DISCLAIMER_BN,
      disclaimerEn: DISCLAIMER_EN,
      results,
    };
  }

  /**
   * Adaptive Information-Gain Wizard:
   * Stateless (client keeps answers by default per Rule R9). Returns the single best next question
   * that maximally splits remaining POSSIBLY_ELIGIBLE candidates, or final results when done.
   */
  async nextWizardStep(params: {
    need?: 'benefits' | 'scholarships' | 'all';
    answers: Record<string, unknown>;
    evaluationDate?: Date;
  }) {
    const evalDate = params.evaluationDate ?? new Date();
    const evaluation = await this.evaluateEligibility({
      need: params.need,
      answers: params.answers,
      evaluationDate: evalDate,
    });

    const possiblyEligible = evaluation.results.filter((r) => r.status === 'POSSIBLY_ELIGIBLE');
    const remainingRules = [];
    for (const r of possiblyEligible) {
      const rule = await this.repo.findRuleAtDate(r.targetType, r.slug, evalDate);
      if (rule) {
        remainingRules.push({
          ruleJsonLogic: rule.ruleJsonLogic,
          criteriaExplanations: rule.criteriaExplanations,
        });
      }
    }

    const nextQuestion = selectBestNextQuestion(remainingRules, params.answers);
    const likelyCount = evaluation.results.filter((r) => r.status === 'LIKELY_ELIGIBLE').length;

    if (!nextQuestion) {
      return {
        done: true,
        nextQuestion: null,
        summary: {
          likelyEligibleCount: likelyCount,
          possiblyEligibleCount: possiblyEligible.length,
          totalEvaluated: evaluation.results.length,
        },
        disclaimerBn: DISCLAIMER_BN,
        disclaimerEn: DISCLAIMER_EN,
        results: evaluation.results,
      };
    }

    return {
      done: false,
      nextQuestion,
      summary: {
        likelyEligibleCount: likelyCount,
        possiblyEligibleCount: possiblyEligible.length,
        totalEvaluated: evaluation.results.length,
      },
      disclaimerBn: DISCLAIMER_BN,
      disclaimerEn: DISCLAIMER_EN,
    };
  }

  // --- Checklists & Deadline Radar (+ RFC 5545 .ics export) ---

  listChecklists(userId: string) {
    return this.repo.listChecklists(userId);
  }

  async saveChecklist(
    userId: string,
    dto: {
      targetType: 'program' | 'scholarship' | 'job' | 'service';
      targetSlug: string;
      titleBn: string;
      titleEn: string;
      deadlineAt?: Date | null;
      applicationUrl: string;
      documents: string[];
    },
  ): Promise<SavedChecklistRecord> {
    const checklist: SavedChecklistRecord = {
      id: uuidv7(),
      userId,
      targetType: dto.targetType,
      targetSlug: dto.targetSlug,
      titleBn: dto.titleBn,
      titleEn: dto.titleEn,
      deadlineAt: dto.deadlineAt ?? null,
      applicationUrl: dto.applicationUrl,
      items: dto.documents.map((d) => ({ label: d, checked: false })),
      createdAt: new Date(),
    };
    return this.repo.saveChecklist(checklist);
  }

  async deleteChecklist(userId: string, id: string): Promise<{ deleted: true }> {
    const existing = await this.repo.findChecklistById(id);
    if (!existing) throw new NotFoundException('Checklist not found');
    if (existing.userId !== userId) {
      throw new ForbiddenException('Cannot delete another citizen’s checklist');
    }
    await this.repo.deleteChecklist(id);
    return { deleted: true };
  }

  async getDeadlineRadar(userId: string, locale: 'bn' | 'en') {
    const checklists = await this.repo.listChecklists(userId);
    const items = checklists
      .filter((c) => c.deadlineAt !== null)
      .sort((a, b) => a.deadlineAt!.getTime() - b.deadlineAt!.getTime())
      .map((c) => ({
        id: c.id,
        targetType: c.targetType,
        targetSlug: c.targetSlug,
        title: locale === 'en' ? c.titleEn : c.titleBn,
        titleBn: c.titleBn,
        titleEn: c.titleEn,
        deadlineAt: c.deadlineAt!.toISOString(),
        daysRemaining: Math.ceil((c.deadlineAt!.getTime() - Date.now()) / 86_400_000),
        applicationUrl: c.applicationUrl,
      }));
    return { items };
  }

  async exportDeadlinesIcs(userId: string, locale: 'bn' | 'en'): Promise<string> {
    const checklists = await this.repo.listChecklists(userId);
    const calItems: CalendarDeadlineItem[] = checklists
      .filter((c) => c.deadlineAt !== null)
      .map((c) => ({
        id: c.id,
        title: locale === 'en' ? c.titleEn : c.titleBn,
        description: `Apply via official channel: ${c.applicationUrl}`,
        deadlineAt: c.deadlineAt!,
        url: c.applicationUrl,
      }));
    return generateDeadlinesIcs(calItems);
  }

  /**
   * Human-in-the-loop Job Circular Extractor:
   * Parses raw circular text (or AI OCR output) into a DRAFT job circular requiring editor approval.
   */
  async parseJobCircularDraft(input: {
    rawText: string;
    sourceUrl: string;
    organizationEn: string;
    organizationBn?: string;
  }): Promise<JobCircularRecord> {
    const text = input.rawText;
    const postMatch = text.match(/(?:Post|Position|পদের নাম)\s*[:-]\s*([^\n\r]+)/i);
    const gradeMatch = text.match(/(?:Grade|গ্রেড)\s*[:-]?\s*([A-Za-z0-9–-]+)/i);
    const vacMatch = text.match(/(?:Vacancies|Posts|পদসংখ্যা)\s*[:-]?\s*(\d+)/i);
    const ageMatch = text.match(/(?:Age Limit|বয়সসীমা)\s*[:-]\s*([^\n\r]+)/i);
    const feeMatch = text.match(/(?:Fee|আবেদন ফি)\s*[:-]\s*([^\n\r]+)/i);
    const deadlineMatch = text.match(/(?:Deadline|Last Date|শেষ তারিখ)\s*[:-]\s*(\d{4}-\d{2}-\d{2})/i);
    const urlMatch = text.match(/https?:\/\/[^\s)]+/i);

    const titleEn = postMatch?.[1]?.trim() ?? 'Extracted Government Job Circular (Review Required)';
    const slug = `${titleEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48)}-${Date.now().toString(36)}`;

    const draft: JobCircularRecord = {
      id: uuidv7(),
      slug,
      titleBn: `${titleEn} (সম্পাদকীয় যাচাই প্রয়োজন)`,
      titleEn,
      organizationBn: input.organizationBn ?? input.organizationEn,
      organizationEn: input.organizationEn,
      grade: gradeMatch?.[1]?.trim() ?? null,
      vacancies: vacMatch?.[1] ? Number(vacMatch[1]) : null,
      ageLimitInfo: ageMatch?.[1]?.trim() ?? null,
      qualificationsBn: 'মূল বিজ্ঞপ্তি থেকে সম্পাদকীয় যাচাই প্রয়োজন।',
      qualificationsEn: 'Extracted from circular — editor verification required before publish.',
      feeInfo: feeMatch?.[1]?.trim() ?? null,
      deadlineAt: deadlineMatch?.[1] ? new Date(`${deadlineMatch[1]}T17:59:59Z`) : null,
      requiredDocuments: ['জাতীয় পরিচয়পত্র (NID)', 'শিক্ষাগত যোগ্যতার সনদ'],
      applicationUrl: urlMatch?.[0] ?? input.sourceUrl,
      regionScope: { national: true },
      trustLabel: TrustLabel.VERIFIED_BY_JONOSHHEBA,
      attribution: {
        trustLabel: TrustLabel.VERIFIED_BY_JONOSHHEBA,
        sourceUrl: input.sourceUrl,
        agency: input.organizationEn,
        lastVerifiedAt: null,
      },
      // Human-in-the-loop: NEVER auto-published!
      status: 'draft',
    };

    return this.repo.saveJob(draft);
  }
}
