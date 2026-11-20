import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import { SeededOpportunitiesRepository } from './adapters/seeded-opportunities.repository';
import { OpportunitiesService } from './application/opportunities.service';

/**
 * 10 Realistic Bangladesh Citizen Personas for the Prompt 07 Golden Matrix (20 programs × 10 personas = 200 checks)
 */
const PERSONAS: ReadonlyArray<{
  name: string;
  answers: Record<string, unknown>;
  mustBeLikely: string[];
  mustBeNotEligible: string[];
}> = [
  {
    name: '01. Senior low-income grandfather (68, male, rural)',
    answers: {
      gender: 'male',
      age: 68,
      annual_income_bdt: 6000,
      household_monthly_income_bdt: 7000,
      household_annual_income_bdt: 84000,
      receives_govt_pension: false,
      marital_status: 'married',
      has_disability: false,
      has_suborna_card: false,
      is_pregnant: false,
      existing_children_count: 3,
      is_rural: true,
      disaster_affected: false,
      is_day_laborer: false,
      is_gazetted_freedom_fighter_family: false,
      occupation_band: 'other',
      cultivable_land_acres: 0.2,
      has_valid_work_visa: false,
      has_critical_illness_diagnosis: false,
      student_level: 'none',
      attends_govt_school: false,
      attendance_percent: 0,
      gpa: 0,
      stem_or_agri_major: false,
    },
    mustBeLikely: ['old-age-allowance', 'tcb-family-card'],
    mustBeNotEligible: ['widow-deserted-women-allowance', 'mother-child-benefit-programme', 'primary-education-stipend'],
  },
  {
    name: '02. Rural widowed mother (48, female)',
    answers: {
      gender: 'female',
      age: 48,
      annual_income_bdt: 12000,
      household_monthly_income_bdt: 6500,
      household_annual_income_bdt: 78000,
      receives_govt_pension: false,
      marital_status: 'widowed',
      has_disability: false,
      has_suborna_card: false,
      is_pregnant: false,
      existing_children_count: 2,
      is_rural: true,
      disaster_affected: true,
      is_day_laborer: false,
      is_gazetted_freedom_fighter_family: false,
      occupation_band: 'worker',
      cultivable_land_acres: 0,
      has_valid_work_visa: false,
      has_critical_illness_diagnosis: false,
      student_level: 'none',
      attends_govt_school: false,
      attendance_percent: 0,
      gpa: 0,
      stem_or_agri_major: false,
    },
    mustBeLikely: ['widow-deserted-women-allowance', 'vwb-vulnerable-women-benefit', 'vgf-emergency-food-support', 'tcb-family-card'],
    mustBeNotEligible: ['old-age-allowance', 'youth-development-training-loan'],
  },
  {
    name: '03. Pregnant mother expecting first baby (24, female, rural)',
    answers: {
      gender: 'female',
      age: 24,
      annual_income_bdt: 0,
      household_monthly_income_bdt: 11000,
      household_annual_income_bdt: 132000,
      receives_govt_pension: false,
      marital_status: 'married',
      has_disability: false,
      has_suborna_card: false,
      is_pregnant: true,
      existing_children_count: 0,
      is_rural: true,
      disaster_affected: false,
      is_day_laborer: false,
      is_gazetted_freedom_fighter_family: false,
      occupation_band: 'other',
      cultivable_land_acres: 0,
      has_valid_work_visa: false,
      has_critical_illness_diagnosis: false,
      student_level: 'none',
      attends_govt_school: false,
      attendance_percent: 0,
      gpa: 0,
      stem_or_agri_major: false,
    },
    mustBeLikely: ['mother-child-benefit-programme', 'vwb-vulnerable-women-benefit', 'youth-development-training-loan', 'tcb-family-card'],
    mustBeNotEligible: ['old-age-allowance', 'widow-deserted-women-allowance', 'disability-allowance-dss'],
  },
  {
    name: '04. Polytechnic student with Suborna disability card (20, male)',
    answers: {
      gender: 'male',
      age: 20,
      annual_income_bdt: 0,
      household_monthly_income_bdt: 12000,
      household_annual_income_bdt: 144000,
      receives_govt_pension: false,
      marital_status: 'single',
      has_disability: true,
      has_suborna_card: true,
      is_pregnant: false,
      existing_children_count: 0,
      is_rural: false,
      disaster_affected: false,
      is_day_laborer: false,
      is_gazetted_freedom_fighter_family: false,
      occupation_band: 'student',
      cultivable_land_acres: 0,
      has_valid_work_visa: false,
      has_critical_illness_diagnosis: false,
      student_level: 'technical',
      attends_govt_school: false,
      attendance_percent: 85,
      gpa: 4.2,
      stem_or_agri_major: false,
    },
    mustBeLikely: ['disability-allowance-dss', 'technical-education-stipend', 'youth-development-training-loan'],
    mustBeNotEligible: ['primary-education-stipend', 'nst-fellowship-postgraduate'],
  },
  {
    name: '05. Marginal rice farmer (40, male, 1.5 acres)',
    answers: {
      gender: 'male',
      age: 40,
      annual_income_bdt: 90000,
      household_monthly_income_bdt: 14000,
      household_annual_income_bdt: 168000,
      receives_govt_pension: false,
      marital_status: 'married',
      has_disability: false,
      has_suborna_card: false,
      is_pregnant: false,
      existing_children_count: 2,
      is_rural: true,
      disaster_affected: false,
      is_day_laborer: false,
      is_gazetted_freedom_fighter_family: false,
      occupation_band: 'farmer',
      cultivable_land_acres: 1.5,
      has_valid_work_visa: false,
      has_critical_illness_diagnosis: false,
      student_level: 'none',
      attends_govt_school: false,
      attendance_percent: 0,
      gpa: 0,
      stem_or_agri_major: false,
    },
    mustBeLikely: ['agri-seed-fertilizer-incentive', 'tcb-family-card'],
    mustBeNotEligible: ['old-age-allowance', 'youth-development-training-loan', 'probashi-kallyan-migration-loan'],
  },
  {
    name: '06. High-performing HSC graduate entering university (19, female, GPA 5.0)',
    answers: {
      gender: 'female',
      age: 19,
      annual_income_bdt: 0,
      household_monthly_income_bdt: 9000,
      household_annual_income_bdt: 95000,
      receives_govt_pension: false,
      marital_status: 'single',
      has_disability: false,
      has_suborna_card: false,
      is_pregnant: false,
      existing_children_count: 0,
      is_rural: false,
      disaster_affected: false,
      is_day_laborer: false,
      is_gazetted_freedom_fighter_family: false,
      occupation_band: 'student',
      cultivable_land_acres: 0,
      has_valid_work_visa: false,
      has_critical_illness_diagnosis: false,
      student_level: 'undergraduate',
      attends_govt_school: false,
      attendance_percent: 92,
      gpa: 5.0,
      stem_or_agri_major: true,
    },
    mustBeLikely: ['pmeat-undergraduate-stipend', 'pmeat-admission-assistance', 'board-merit-scholarship-ssc-hsc', 'youth-development-training-loan'],
    mustBeNotEligible: ['nst-fellowship-postgraduate', 'primary-education-stipend'],
  },
  {
    name: '07. Overseas worker with verified work visa (29, male)',
    answers: {
      gender: 'male',
      age: 29,
      annual_income_bdt: 120000,
      household_monthly_income_bdt: 22000,
      household_annual_income_bdt: 264000,
      receives_govt_pension: false,
      marital_status: 'married',
      has_disability: false,
      has_suborna_card: false,
      is_pregnant: false,
      existing_children_count: 1,
      is_rural: true,
      disaster_affected: false,
      is_day_laborer: false,
      is_gazetted_freedom_fighter_family: false,
      occupation_band: 'worker',
      cultivable_land_acres: 0,
      has_valid_work_visa: true,
      has_critical_illness_diagnosis: false,
      student_level: 'none',
      attends_govt_school: false,
      attendance_percent: 0,
      gpa: 0,
      stem_or_agri_major: false,
    },
    mustBeLikely: ['probashi-kallyan-migration-loan', 'youth-development-training-loan'],
    mustBeNotEligible: ['tcb-family-card', 'old-age-allowance', 'cancer-kidney-medical-grant-dss'],
  },
  {
    name: '08. MS Agriculture researcher (25, female)',
    answers: {
      gender: 'female',
      age: 25,
      annual_income_bdt: 0,
      household_monthly_income_bdt: 35000,
      household_annual_income_bdt: 420000,
      receives_govt_pension: false,
      marital_status: 'single',
      has_disability: false,
      has_suborna_card: false,
      is_pregnant: false,
      existing_children_count: 0,
      is_rural: false,
      disaster_affected: false,
      is_day_laborer: false,
      is_gazetted_freedom_fighter_family: false,
      occupation_band: 'student',
      cultivable_land_acres: 0,
      has_valid_work_visa: false,
      has_critical_illness_diagnosis: false,
      student_level: 'postgraduate',
      attends_govt_school: false,
      attendance_percent: 95,
      gpa: 4.8,
      stem_or_agri_major: true,
    },
    mustBeLikely: ['nst-fellowship-postgraduate', 'youth-development-training-loan'],
    mustBeNotEligible: ['pmeat-undergraduate-stipend', 'tcb-family-card'],
  },
  {
    name: '09. Government primary school pupil with disability (9, male)',
    answers: {
      gender: 'male',
      age: 9,
      annual_income_bdt: 0,
      household_monthly_income_bdt: 10000,
      household_annual_income_bdt: 120000,
      receives_govt_pension: false,
      marital_status: 'single',
      has_disability: true,
      has_suborna_card: true,
      is_pregnant: false,
      existing_children_count: 0,
      is_rural: true,
      disaster_affected: false,
      is_day_laborer: false,
      is_gazetted_freedom_fighter_family: false,
      occupation_band: 'student',
      cultivable_land_acres: 0,
      has_valid_work_visa: false,
      has_critical_illness_diagnosis: false,
      student_level: 'primary',
      attends_govt_school: true,
      attendance_percent: 90,
      gpa: 0,
      stem_or_agri_major: false,
    },
    mustBeLikely: ['primary-education-stipend', 'disability-education-stipend-dss', 'disability-allowance-dss'],
    mustBeNotEligible: ['youth-development-training-loan', 'old-age-allowance'],
  },
  {
    name: '10. Retired govt pensioner with high income (70, male, Freedom Fighter family)',
    answers: {
      gender: 'male',
      age: 70,
      annual_income_bdt: 400000,
      household_monthly_income_bdt: 50000,
      household_annual_income_bdt: 600000,
      receives_govt_pension: true,
      marital_status: 'married',
      has_disability: false,
      has_suborna_card: false,
      is_pregnant: false,
      existing_children_count: 2,
      is_rural: false,
      disaster_affected: false,
      is_day_laborer: false,
      is_gazetted_freedom_fighter_family: true,
      occupation_band: 'other',
      cultivable_land_acres: 5,
      has_valid_work_visa: false,
      has_critical_illness_diagnosis: false,
      student_level: 'none',
      attends_govt_school: false,
      attendance_percent: 0,
      gpa: 0,
      stem_or_agri_major: false,
    },
    mustBeLikely: ['freedom-fighter-honorarium'],
    mustBeNotEligible: ['old-age-allowance', 'tcb-family-card', 'agri-seed-fertilizer-incentive'],
  },
];

describe('Phase 07: Benefits, Scholarships, Jobs & Deterministic JSON-Logic Rules Engine', () => {
  let repo: SeededOpportunitiesRepository;
  let service: OpportunitiesService;

  beforeEach(() => {
    repo = new SeededOpportunitiesRepository();
    service = new OpportunitiesService(repo);
  });

  it('passes golden evaluation matrix across ALL 20 seeded programs/scholarships × 10 personas with bilingual reasons on every criterion', async () => {
    for (const persona of PERSONAS) {
      const res = await service.evaluateEligibility({
        need: 'all',
        answers: persona.answers,
        evaluationDate: new Date('2026-11-20T00:00:00Z'),
      });

      expect(res.results).toHaveLength(20);
      expect(res.disclaimerEn).toContain('Possible match — not a guaranteed entitlement');

      const bySlug = new Map(res.results.map((r) => [r.slug, r]));
      for (const expectedSlug of persona.mustBeLikely) {
        expect(bySlug.get(expectedSlug)?.status, `${persona.name} -> ${expectedSlug}`).toBe(
          'LIKELY_ELIGIBLE',
        );
      }
      for (const expectedNot of persona.mustBeNotEligible) {
        expect(bySlug.get(expectedNot)?.status, `${persona.name} -> ${expectedNot}`).toBe(
          'NOT_ELIGIBLE',
        );
      }

      // Every single evaluated program MUST explain every criterion in bn & en + sourceUrl
      for (const item of res.results) {
        expect(item.reasons.length).toBeGreaterThan(0);
        for (const reason of item.reasons) {
          expect(reason.labelBn.length).toBeGreaterThan(2);
          expect(reason.labelEn.length).toBeGreaterThan(2);
          expect(reason.sourceUrl).toMatch(/^https?:\/\//);
        }
      }
    }
  });

  it('selects the exact rule version active at the requested evaluationDate', async () => {
    // Add v2 of old-age-allowance effective 2027-01-01 raising income cap to 25,000 BDT
    const v1 = (await repo.findRuleAtDate('program', 'old-age-allowance', new Date('2026-11-20T00:00:00Z')))!;
    v1.effectiveTo = new Date('2027-01-01T00:00:00Z');
    await repo.saveRule({
      ...v1,
      id: 'rule-v2-old-age',
      version: 2,
      effectiveFrom: new Date('2027-01-01T00:00:00Z'),
      effectiveTo: null,
      ruleJsonLogic: {
        and: [
          { '>=': [{ var: 'age' }, 65] },
          { '<=': [{ var: 'annual_income_bdt' }, 25000] },
          { '==': [{ var: 'receives_govt_pension' }, false] },
        ],
      },
    });

    const applicant = { gender: 'male', age: 67, annual_income_bdt: 18000, receives_govt_pension: false };

    const eval2026 = await service.evaluateEligibility({
      slugs: ['old-age-allowance'],
      answers: applicant,
      evaluationDate: new Date('2026-11-20T00:00:00Z'),
    });
    expect(eval2026.results[0]?.ruleVersion).toBe(1);
    expect(eval2026.results[0]?.status).toBe('NOT_ELIGIBLE');

    const eval2027 = await service.evaluateEligibility({
      slugs: ['old-age-allowance'],
      answers: applicant,
      evaluationDate: new Date('2027-02-01T00:00:00Z'),
    });
    expect(eval2027.results[0]?.ruleVersion).toBe(2);
    expect(eval2027.results[0]?.status).toBe('LIKELY_ELIGIBLE');
  });

  it('runs adaptive information-gain wizard with bilingual purpose explanations and converges cleanly', async () => {
    const step1 = await service.nextWizardStep({ need: 'scholarships', answers: {} });
    expect(step1.done).toBe(false);
    expect(step1.nextQuestion?.purposeBn).toBeTruthy();
    expect(step1.nextQuestion?.purposeEn).toBeTruthy();

    // Answering student_level=primary immediately rules out secondary/undergrad/postgrad/technical
    const step2 = await service.nextWizardStep({
      need: 'scholarships',
      answers: { student_level: 'primary', attends_govt_school: true, has_disability: false },
    });
    expect(step2.done).toBe(true);
    expect(step2.summary.likelyEligibleCount).toBe(1);
    expect(step2.results?.[0]?.slug).toBe('primary-education-stipend');
  });

  it('supports Deadline Radar, RFC 5545 .ics export, human-in-the-loop job circular parser & IDOR checklist protection', async () => {
    const checklist = await service.saveChecklist('citizen-1', {
      targetType: 'scholarship',
      targetSlug: 'pmeat-undergraduate-stipend',
      titleBn: 'স্নাতক সরকারি উপবৃত্তি',
      titleEn: 'Undergraduate Government Stipend',
      deadlineAt: new Date('2026-12-30T17:59:59Z'),
      applicationUrl: 'https://estipend.pmeat.gov.bd',
      documents: ['NID', 'Admission Receipt'],
    });

    const radar = await service.getDeadlineRadar('citizen-1', 'en');
    expect(radar.items).toHaveLength(1);
    expect(radar.items[0]?.targetSlug).toBe('pmeat-undergraduate-stipend');

    const ics = await service.exportDeadlinesIcs('citizen-1', 'en');
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('SUMMARY:Undergraduate Government Stipend');
    expect(ics).toContain('END:VCALENDAR');

    // IDOR: another user cannot delete citizen-1's checklist
    await expect(service.deleteChecklist('citizen-2', checklist.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    // Human-in-the-loop job circular parser creates a DRAFT (not published!)
    const draftJob = await service.parseJobCircularDraft({
      rawText:
        'Post: Assistant Engineer (CSE)\nGrade: Grade-9\nVacancies: 25\nAge Limit: 21-32 years\nFee: 223 BDT\nDeadline: 2026-12-28\nApply: https://bpsc.teletalk.com.bd',
      sourceUrl: 'https://bpsc.gov.bd/circular-123',
      organizationEn: 'Bangladesh Public Service Commission',
    });
    expect(draftJob.status).toBe('draft');
    expect(draftJob.grade).toBe('Grade-9');
    expect(draftJob.vacancies).toBe(25);
    expect(draftJob.applicationUrl).toBe('https://bpsc.teletalk.com.bd');
  });
});
