import type {
  CriterionExplanationMeta,
  CriterionReason,
  CriterionStatus,
  EligibilityOutcome,
  WizardQuestion,
} from './opportunities.types';

export type TriValue = true | false | 'unknown';

/** Canonical citizen-friendly question bank with bilingual purpose ("why we ask") per Rule R9 */
export const WIZARD_QUESTION_BANK: Readonly<Record<string, WizardQuestion>> = {
  gender: {
    field: 'gender',
    questionBn: 'আবেদনকারীর লিঙ্গ কী?',
    questionEn: 'What is the applicant’s gender?',
    purposeBn: 'বয়স্ক ভাতার বয়সসীমা এবং নারী-কেন্দ্রিক ভাতা (বিধবা/মা ও শিশু) যাচাইয়ের জন্য।',
    purposeEn: 'Used to check gender-specific age thresholds and maternal/widow allowances.',
    inputType: 'select',
    options: [
      { value: 'female', labelBn: 'নারী', labelEn: 'Female' },
      { value: 'male', labelBn: 'পুরুষ', labelEn: 'Male' },
      { value: 'other', labelBn: 'অন্যান্য', labelEn: 'Other' },
    ],
  },
  age: {
    field: 'age',
    questionBn: 'আবেদনকারীর বয়স কত বছর?',
    questionEn: 'What is the applicant’s age (in years)?',
    purposeBn: 'বয়স্ক ভাতা, যুব ঋণ ও মাতৃত্বকালীন ভাতার সরকারি বয়সসীমা যাচাইয়ের জন্য।',
    purposeEn: 'Used to verify official age thresholds for allowances and youth programs.',
    inputType: 'number',
  },
  annual_income_bdt: {
    field: 'annual_income_bdt',
    questionBn: 'আবেদনকারীর বার্ষিক ব্যক্তিগত আয় কত টাকা?',
    questionEn: 'What is the applicant’s annual personal income (BDT)?',
    purposeBn: 'সরকারি সামাজিক নিরাপত্তা ভাতার আয়সীমা যাচাইয়ের জন্য।',
    purposeEn: 'Used to verify official income ceilings for social safety-net allowances.',
    inputType: 'number',
  },
  household_monthly_income_bdt: {
    field: 'household_monthly_income_bdt',
    questionBn: 'পরিবারের মাসিক মোট আয় কত টাকা?',
    questionEn: 'What is the household’s monthly income (BDT)?',
    purposeBn: 'খাদ্য সহায়তা, টিসিবি কার্ড ও চিকিৎসা অনুদানের যোগ্যতা যাচাইয়ের জন্য।',
    purposeEn: 'Used to check household income criteria for food and medical grants.',
    inputType: 'number',
  },
  household_annual_income_bdt: {
    field: 'household_annual_income_bdt',
    questionBn: 'অভিভাবকের বার্ষিক আয় কত টাকা?',
    questionEn: 'What is the guardian’s annual household income (BDT)?',
    purposeBn: 'শিক্ষা উপবৃত্তি ও ভর্তি সহায়তার আয়সীমা যাচাইয়ের জন্য।',
    purposeEn: 'Used to check financial-need thresholds for government stipends.',
    inputType: 'number',
  },
  receives_govt_pension: {
    field: 'receives_govt_pension',
    questionBn: 'আবেদনকারী কি বর্তমানে সরকারি পেনশন পান?',
    questionEn: 'Does the applicant currently receive a government pension?',
    purposeBn: 'সরকারি নীতিমালা অনুযায়ী দ্বৈত ভাতা এড়ানোর জন্য।',
    purposeEn: 'Government rules exclude pension recipients from certain allowances.',
    inputType: 'boolean',
  },
  marital_status: {
    field: 'marital_status',
    questionBn: 'বৈবাহিক অবস্থা কী?',
    questionEn: 'What is the applicant’s marital status?',
    purposeBn: 'বিধবা ও স্বামী নিগৃহীতা ভাতার যোগ্যতা যাচাইয়ের জন্য।',
    purposeEn: 'Used to check Widow & Deserted Women Allowance criteria.',
    inputType: 'select',
    options: [
      { value: 'married', labelBn: 'বিবাহিত', labelEn: 'Married' },
      { value: 'single', labelBn: 'অবিবাহিত', labelEn: 'Single' },
      { value: 'widowed', labelBn: 'বিধবা', labelEn: 'Widowed' },
      { value: 'deserted', labelBn: 'স্বামী নিগৃহীতা', labelEn: 'Deserted' },
    ],
  },
  has_disability: {
    field: 'has_disability',
    questionBn: 'আবেদনকারী কি প্রতিবন্ধী ব্যক্তি?',
    questionEn: 'Is the applicant a person with a disability?',
    purposeBn: 'প্রতিবন্ধী ভাতা ও প্রতিবন্ধী শিক্ষা উপবৃত্তি খুঁজে বের করার জন্য।',
    purposeEn: 'Used to surface disability allowances and education stipends.',
    inputType: 'boolean',
  },
  has_suborna_card: {
    field: 'has_suborna_card',
    questionBn: 'সমাজসেবার সুবর্ণ নাগরিক পরিচয়পত্র আছে কি?',
    questionEn: 'Does the applicant hold a DSS Suborna Nagorik disability ID card?',
    purposeBn: 'প্রতিবন্ধী ভাতার জন্য সুবর্ণ নাগরিক নিবন্ধন প্রয়োজন।',
    purposeEn: 'DSS disability benefits require Suborna Nagorik registration.',
    inputType: 'boolean',
  },
  is_pregnant: {
    field: 'is_pregnant',
    questionBn: 'আবেদনকারী কি বর্তমানে গর্ভবতী?',
    questionEn: 'Is the applicant currently pregnant?',
    purposeBn: 'মা ও শিশু সহায়তা কর্মসূচির (MCBP) যোগ্যতা যাচাইয়ের জন্য।',
    purposeEn: 'Used to verify Mother & Child Benefit Programme criteria.',
    inputType: 'boolean',
  },
  existing_children_count: {
    field: 'existing_children_count',
    questionBn: 'বর্তমানে কতজন জীবিত সন্তান আছে?',
    questionEn: 'How many existing children does the mother have?',
    purposeBn: 'মা ও শিশু সহায়তা কর্মসূচি প্রথম বা দ্বিতীয় সন্তানের ক্ষেত্রে প্রযোজ্য।',
    purposeEn: 'MCBP applies for the first or second child per official policy.',
    inputType: 'number',
  },
  is_rural: {
    field: 'is_rural',
    questionBn: 'আবেদনকারী কি গ্রামীণ (ইউনিয়ন) এলাকায় বসবাস করেন?',
    questionEn: 'Does the applicant reside in a rural union area?',
    purposeBn: 'গ্রামীণ খাদ্য সহায়তা কর্মসূচি (VWB) যাচাইয়ের জন্য।',
    purposeEn: 'VWB targets rural union residents.',
    inputType: 'boolean',
  },
  disaster_affected: {
    field: 'disaster_affected',
    questionBn: 'পরিবার কি সম্প্রতি বন্যা বা প্রাকৃতিক দুর্যোগে ক্ষতিগ্রস্ত?',
    questionEn: 'Was the household recently affected by flood or disaster?',
    purposeBn: 'ভিজিএফ জরুরি ত্রাণ সহায়তার অগ্রাধিকার যাচাইয়ের জন্য।',
    purposeEn: 'Used to check VGF emergency relief eligibility.',
    inputType: 'boolean',
  },
  is_day_laborer: {
    field: 'is_day_laborer',
    questionBn: 'পরিবারের প্রধান উপার্জনকারী কি দিনমজুর?',
    questionEn: 'Is the primary earner a day laborer?',
    purposeBn: 'ভিজিএফ খাদ্য সহায়তার যোগ্যতা যাচাইয়ের জন্য।',
    purposeEn: 'Used to check VGF livelihood priority criteria.',
    inputType: 'boolean',
  },
  is_gazetted_freedom_fighter_family: {
    field: 'is_gazetted_freedom_fighter_family',
    questionBn: 'গেজেটভুক্ত বীর মুক্তিযোদ্ধা বা যোগ্য উত্তরাধিকারী কি?',
    questionEn: 'Are you a gazetted Freedom Fighter or eligible heir?',
    purposeBn: 'বীর মুক্তিযোদ্ধা সম্মানী ভাতা যাচাইয়ের জন্য।',
    purposeEn: 'Used to check Freedom Fighter Honorarium criteria.',
    inputType: 'boolean',
  },
  occupation_band: {
    field: 'occupation_band',
    questionBn: 'আবেদনকারীর প্রধান পেশা কী?',
    questionEn: 'What is the applicant’s primary occupation?',
    purposeBn: 'কৃষক প্রণোদনা বা পেশাভিত্তিক কর্মসূচি যাচাইয়ের জন্য।',
    purposeEn: 'Used to match occupation-specific subsidies like farmer grants.',
    inputType: 'select',
    options: [
      { value: 'farmer', labelBn: 'কৃষক', labelEn: 'Farmer' },
      { value: 'student', labelBn: 'শিক্ষার্থী', labelEn: 'Student' },
      { value: 'worker', labelBn: 'কর্মজীবী / শ্রমিক', labelEn: 'Worker' },
      { value: 'unemployed', labelBn: 'কর্মপ্রত্যাশী / বেকার', labelEn: 'Job seeker / Unemployed' },
      { value: 'other', labelBn: 'অন্যান্য', labelEn: 'Other' },
    ],
  },
  cultivable_land_acres: {
    field: 'cultivable_land_acres',
    questionBn: 'আবাদযোগ্য জমির পরিমাণ কত একর?',
    questionEn: 'How many acres of cultivable land does the farmer hold?',
    purposeBn: 'ক্ষুদ্র ও প্রান্তিক কৃষক সংজ্ঞা (≤ ২.৫ একর) যাচাইয়ের জন্য।',
    purposeEn: 'Used to check small/marginal farmer landholding criteria.',
    inputType: 'number',
  },
  has_valid_work_visa: {
    field: 'has_valid_work_visa',
    questionBn: 'বিদেশে চাকরির বৈধ ভিসা আছে কি?',
    questionEn: 'Do you hold a valid overseas work visa?',
    purposeBn: 'প্রবাসী কল্যাণ ব্যাংক অভিবাসন ঋণ যাচাইয়ের জন্য।',
    purposeEn: 'Required for Probashi Kallyan Bank migration loans.',
    inputType: 'boolean',
  },
  has_critical_illness_diagnosis: {
    field: 'has_critical_illness_diagnosis',
    questionBn: 'ক্যান্সার, কিডনি বা তালিকাভুক্ত জটিল রোগের মেডিকেল রিপোর্ট আছে কি?',
    questionEn: 'Is there a medical diagnosis of cancer, kidney failure, or listed critical illness?',
    purposeBn: 'সমাজসেবার চিকিৎসা অনুদান যাচাইয়ের জন্য (চিকিৎসা নির্ণয়ের জন্য নয়)।',
    purposeEn: 'Used strictly to check DSS medical grant paperwork criteria (not diagnosis).',
    inputType: 'boolean',
  },
  student_level: {
    field: 'student_level',
    questionBn: 'শিক্ষার্থী বর্তমানে কোন স্তরে অধ্যয়নরত?',
    questionEn: 'What education level is the student currently enrolled in?',
    purposeBn: 'সঠিক উপবৃত্তি ও মেধাবৃত্তি নির্বাচন করার জন্য।',
    purposeEn: 'Used to match stipends and fellowships to the student’s education stage.',
    inputType: 'select',
    options: [
      { value: 'primary', labelBn: 'প্রাথমিক (১ম–৫ম)', labelEn: 'Primary' },
      { value: 'secondary', labelBn: 'মাধ্যমিক (৬ষ্ঠ–১০ম)', labelEn: 'Secondary' },
      { value: 'higher_secondary', labelBn: 'উচ্চমাধ্যমিক (১১শ–১২শ)', labelEn: 'Higher Secondary' },
      { value: 'technical', labelBn: 'কারিগরি / পলিটেকনিক', labelEn: 'Technical / Diploma' },
      { value: 'undergraduate', labelBn: 'স্নাতক (পাস/সম্মান)', labelEn: 'Undergraduate' },
      { value: 'postgraduate', labelBn: 'স্নাতকোত্তর / গবেষণা', labelEn: 'Postgraduate / Research' },
      { value: 'none', labelBn: 'শিক্ষার্থী নন', labelEn: 'Not a student' },
    ],
  },
  attends_govt_school: {
    field: 'attends_govt_school',
    questionBn: 'শিক্ষার্থী কি সরকারি প্রাথমিক বিদ্যালয়ে পড়ে?',
    questionEn: 'Does the student attend a government primary school?',
    purposeBn: 'প্রাথমিক উপবৃত্তি কর্মসূচির শর্ত যাচাইয়ের জন্য।',
    purposeEn: 'Primary stipend requires government primary school enrollment.',
    inputType: 'boolean',
  },
  attendance_percent: {
    field: 'attendance_percent',
    questionBn: 'ক্লাসে গড় উপস্থিতির হার কত শতাংশ (%)?',
    questionEn: 'What is the student’s average class attendance (%)?',
    purposeBn: 'কারিগরি উপবৃত্তির ন্যূনতম ৭৫% উপস্থিতি শর্ত যাচাইয়ের জন্য।',
    purposeEn: 'Technical stipends require at least 75% attendance.',
    inputType: 'number',
  },
  gpa: {
    field: 'gpa',
    questionBn: 'সর্বশেষ বোর্ড পরীক্ষায় প্রাপ্ত জিপিএ কত?',
    questionEn: 'What GPA was achieved in the latest board exam?',
    purposeBn: 'বোর্ড মেধাবৃত্তির প্রাথমিক যোগ্যতা যাচাইয়ের জন্য।',
    purposeEn: 'Used to check board merit scholarship GPA threshold.',
    inputType: 'number',
  },
  stem_or_agri_major: {
    field: 'stem_or_agri_major',
    questionBn: 'গবেষণার বিষয় কি বিজ্ঞান, প্রকৌশল বা কৃষি?',
    questionEn: 'Is the research field in Science, Engineering, or Agriculture?',
    purposeBn: 'জাতীয় বিজ্ঞান ও প্রযুক্তি (NST) ফেলোশিপের বিষয় যাচাইয়ের জন্য।',
    purposeEn: 'NST Fellowship applies to STEM and Agriculture fields.',
    inputType: 'boolean',
  },
};

export function getQuestionForField(
  field: string,
  metaList?: readonly CriterionExplanationMeta[],
): WizardQuestion {
  const known = WIZARD_QUESTION_BANK[field];
  if (known) return known;
  const meta = metaList?.find((m) => m.field === field);
  return {
    field,
    questionBn: meta?.labelBn ?? `${field} সম্পর্কিত তথ্য দিন`,
    questionEn: meta?.labelEn ?? `Provide value for ${field}`,
    purposeBn: meta?.purposeBn ?? 'যোগ্যতা যাচাইয়ের জন্য প্রয়োজনীয়।',
    purposeEn: meta?.purposeEn ?? 'Required to evaluate eligibility criterion.',
    inputType: 'boolean',
  };
}

/** Collects all `{"var": "<field>"}` variable names referenced by a JSON-Logic AST */
export function extractReferencedFields(node: unknown, acc: Set<string> = new Set()): Set<string> {
  if (!node || typeof node !== 'object') return acc;
  if (Array.isArray(node)) {
    for (const item of node) extractReferencedFields(item, acc);
    return acc;
  }
  const obj = node as Record<string, unknown>;
  if (typeof obj.var === 'string') {
    acc.add(obj.var);
    return acc;
  }
  for (const value of Object.values(obj)) {
    extractReferencedFields(value, acc);
  }
  return acc;
}

function resolveValue(node: unknown, answers: Readonly<Record<string, unknown>>): unknown {
  if (node !== null && typeof node === 'object' && !Array.isArray(node)) {
    const obj = node as Record<string, unknown>;
    if (typeof obj.var === 'string') {
      const val = answers[obj.var];
      return val === undefined || val === null ? undefined : val;
    }
  }
  return node;
}

/**
 * Deterministic Three-Valued JSON-Logic Evaluator (Kleene logic: true | false | 'unknown').
 * Never uses eval/Function. Strictly deterministic (Rule R7).
 */
export function evaluateJsonLogicTri(
  rule: unknown,
  answers: Readonly<Record<string, unknown>>,
): TriValue {
  if (typeof rule === 'boolean') return rule;
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return 'unknown';

  const entries = Object.entries(rule as Record<string, unknown>);
  if (entries.length === 0) return true;
  const [op, rawArgs] = entries[0]!;

  if (op === 'and') {
    const args = Array.isArray(rawArgs) ? rawArgs : [rawArgs];
    let hasUnknown = false;
    for (const child of args) {
      const res = evaluateJsonLogicTri(child, answers);
      if (res === false) return false;
      if (res === 'unknown') hasUnknown = true;
    }
    return hasUnknown ? 'unknown' : true;
  }

  if (op === 'or') {
    const args = Array.isArray(rawArgs) ? rawArgs : [rawArgs];
    let hasUnknown = false;
    for (const child of args) {
      const res = evaluateJsonLogicTri(child, answers);
      if (res === true) return true;
      if (res === 'unknown') hasUnknown = true;
    }
    return hasUnknown ? 'unknown' : false;
  }

  if (op === '!') {
    const inner = Array.isArray(rawArgs) ? rawArgs[0] : rawArgs;
    const res = evaluateJsonLogicTri(inner, answers);
    if (res === 'unknown') return 'unknown';
    return !res;
  }

  if (Array.isArray(rawArgs) && rawArgs.length === 2) {
    const left = resolveValue(rawArgs[0], answers);
    const right = resolveValue(rawArgs[1], answers);
    if (left === undefined || right === undefined) return 'unknown';

    switch (op) {
      case '==':
        return left === right;
      case '!=':
        return left !== right;
      case '>=':
        return Number(left) >= Number(right);
      case '>':
        return Number(left) > Number(right);
      case '<=':
        return Number(left) <= Number(right);
      case '<':
        return Number(left) < Number(right);
      case 'in':
        if (Array.isArray(right)) return right.includes(left);
        if (typeof right === 'string') return right.includes(String(left));
        return false;
      default:
        return 'unknown';
    }
  }

  return 'unknown';
}

/** Extracts top-level atomic clauses for granular per-criterion explanations */
function collectAtomicClauses(node: unknown, out: Array<Record<string, unknown>> = []): Array<Record<string, unknown>> {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return out;
  const obj = node as Record<string, unknown>;
  if (Array.isArray(obj.and)) {
    for (const child of obj.and) collectAtomicClauses(child, out);
  } else {
    out.push(obj);
  }
  return out;
}

/** Evaluates a single program/scholarship rule with full bilingual reasons and missing questions */
export function evaluateProgramRule(params: {
  ruleJsonLogic: Record<string, unknown>;
  criteriaExplanations: readonly CriterionExplanationMeta[];
  sourceUrl: string;
  agency: string;
  answers: Readonly<Record<string, unknown>>;
}): {
  outcome: EligibilityOutcome;
  reasons: CriterionReason[];
  missingQuestions: WizardQuestion[];
} {
  const overall = evaluateJsonLogicTri(params.ruleJsonLogic, params.answers);
  const outcome: EligibilityOutcome =
    overall === true
      ? 'LIKELY_ELIGIBLE'
      : overall === false
        ? 'NOT_ELIGIBLE'
        : 'POSSIBLY_ELIGIBLE';

  const clauses = collectAtomicClauses(params.ruleJsonLogic);
  const reasons: CriterionReason[] = [];
  const missingFields = new Set<string>();

  for (const clause of clauses) {
    const clauseResult = evaluateJsonLogicTri(clause, params.answers);
    const fields = [...extractReferencedFields(clause)];
    const primaryField = fields[0] ?? 'criterion';
    const meta = params.criteriaExplanations.find((m) => fields.includes(m.field));
    const qMeta = getQuestionForField(primaryField, params.criteriaExplanations);

    const status: CriterionStatus =
      clauseResult === true ? 'met' : clauseResult === false ? 'unmet' : 'unknown';

    reasons.push({
      field: primaryField,
      status,
      labelBn: meta?.labelBn ?? qMeta.questionBn,
      labelEn: meta?.labelEn ?? qMeta.questionEn,
      sourceUrl: params.sourceUrl,
      agency: params.agency,
    });

    if (clauseResult === 'unknown') {
      for (const f of fields) {
        if (params.answers[f] === undefined || params.answers[f] === null) {
          missingFields.add(f);
        }
      }
    }
  }

  // Also ensure any referenced field absent from answers is captured if outcome is POSSIBLY_ELIGIBLE
  if (outcome === 'POSSIBLY_ELIGIBLE') {
    for (const f of extractReferencedFields(params.ruleJsonLogic)) {
      if (params.answers[f] === undefined || params.answers[f] === null) {
        missingFields.add(f);
      }
    }
  }

  const missingQuestions = [...missingFields].map((f) =>
    getQuestionForField(f, params.criteriaExplanations),
  );

  return { outcome, reasons, missingQuestions };
}

/**
 * Adaptive Information-Gain Question Selector:
 * Picks the unanswered field that maximally splits the remaining POSSIBLY_ELIGIBLE programs
 * (maximizing binary split balance & coverage across remaining candidates).
 */
export function selectBestNextQuestion(
  remainingRules: ReadonlyArray<{
    ruleJsonLogic: Record<string, unknown>;
    criteriaExplanations: readonly CriterionExplanationMeta[];
  }>,
  answers: Readonly<Record<string, unknown>>,
): WizardQuestion | null {
  if (remainingRules.length === 0) return null;

  const fieldStats = new Map<string, { count: number; meta?: CriterionExplanationMeta[] }>();
  for (const r of remainingRules) {
    for (const f of extractReferencedFields(r.ruleJsonLogic)) {
      if (answers[f] !== undefined && answers[f] !== null) continue;
      const prev = fieldStats.get(f) ?? { count: 0, meta: [...r.criteriaExplanations] };
      prev.count += 1;
      fieldStats.set(f, prev);
    }
  }

  if (fieldStats.size === 0) return null;

  // Information gain heuristic: maximize coverage × split balance p * (1 - p) + coverage tiebreak
  const n = remainingRules.length;
  let bestField: string | null = null;
  let bestScore = -1;

  for (const [field, stat] of fieldStats.entries()) {
    const p = stat.count / n;
    const entropy =
      p > 0 && p < 1 ? -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p)) : 0.25;
    const score = entropy * 0.6 + p * 0.4;
    if (score > bestScore) {
      bestScore = score;
      bestField = field;
    }
  }

  if (!bestField) return null;
  return getQuestionForField(bestField, fieldStats.get(bestField)?.meta);
}
