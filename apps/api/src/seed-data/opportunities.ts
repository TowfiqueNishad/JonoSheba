/**
 * Opportunities Seed Data:
 * - 12 Government Benefit / Financial Assistance Programs
 * - 8 Scholarships & Education Stipends
 *   => Total = 20 seeded programs & scholarships, EVERY ONE with a versioned deterministic JSON-Logic rule (Rule R7)
 * - Sample Government Job Circulars
 */

export interface CriterionExplanation {
  field: string;
  labelBn: string;
  labelEn: string;
  purposeBn: string;
  purposeEn: string;
}

export interface ProgramSeed {
  kind: 'program' | 'scholarship';
  slug: string;
  titleBn: string;
  titleEn: string;
  summaryBn: string;
  summaryEn: string;
  agencyOrProvider: string;
  categoryOrLevel: string;
  benefitAmountInfo?: string;
  applicationUrl: string;
  requiredDocuments: string[];
  ruleJsonLogic: Record<string, unknown>;
  criteriaExplanations: CriterionExplanation[];
}

export const OPPORTUNITIES_WITH_RULES_SEED: readonly ProgramSeed[] = [
  // --- 12 Benefit / Financial Assistance Programs ---
  {
    kind: 'program',
    slug: 'old-age-allowance',
    titleBn: 'বয়স্ক ভাতা কর্মসূচি',
    titleEn: 'Old Age Allowance Programme',
    summaryBn: 'প্রবীণ ও স্বল্প-আয়ের নাগরিকদের জন্য সমাজসেবা অধিদপ্তরের মাসিক ভাতা।',
    summaryEn: 'Monthly social safety-net allowance for eligible senior citizens via DSS.',
    agencyOrProvider: 'Department of Social Services (DSS)',
    categoryOrLevel: 'social_protection',
    benefitAmountInfo: 'মাসিক সরকারি নির্ধারিত হারে (জিটুপি মোবাইল ব্যাংকিং)',
    applicationUrl: 'https://mis.bhata.gov.bd/onlineApplication',
    requiredDocuments: ['জাতীয় পরিচয়পত্র (NID)', 'নিজ নামে সক্রিয় মোবাইল ব্যাংকিং নম্বর'],
    ruleJsonLogic: {
      and: [
        { or: [{ and: [{ '==': [{ var: 'gender' }, 'male'] }, { '>=': [{ var: 'age' }, 65] }] }, { and: [{ '==': [{ var: 'gender' }, 'female'] }, { '>=': [{ var: 'age' }, 62] }] }] },
        { '<=': [{ var: 'annual_income_bdt' }, 10000] },
        { '==': [{ var: 'receives_govt_pension' }, false] },
      ],
    },
    criteriaExplanations: [
      { field: 'age', labelBn: 'পুরুষ ≥ ৬৫ বছর বা নারী ≥ ৬২ বছর', labelEn: 'Age ≥ 65 (male) or ≥ 62 (female)', purposeBn: 'বয়স্ক ভাতার ন্যূনতম বয়স যাচাই করতে', purposeEn: 'Verify minimum age threshold' },
      { field: 'annual_income_bdt', labelBn: 'বার্ষিক ব্যক্তিগত আয় ≤ ১০,০০০ টাকা', labelEn: 'Annual personal income ≤ 10,000 BDT', purposeBn: 'আর্থিক অসচ্ছলতা যাচাই করতে', purposeEn: 'Check income eligibility ceiling' },
      { field: 'receives_govt_pension', labelBn: 'সরকারি পেনশনভোগী নন', labelEn: 'Not receiving government pension', purposeBn: 'দ্বৈত সরকারি সুবিধা এড়াতে', purposeEn: 'Avoid duplicate government pension' },
    ],
  },
  {
    kind: 'program',
    slug: 'widow-deserted-women-allowance',
    titleBn: 'বিধবা ও স্বামী নিগৃহীতা মহিলা ভাতা',
    titleEn: 'Widow & Deserted Women Allowance',
    summaryBn: 'অসচ্ছল বিধবা ও স্বামী নিগৃহীতা নারীদের মাসিক আর্থিক সহায়তা।',
    summaryEn: 'Monthly allowance for financially vulnerable widows and deserted women.',
    agencyOrProvider: 'Department of Social Services (DSS)',
    categoryOrLevel: 'social_protection',
    benefitAmountInfo: 'মাসিক সরকারি হারে',
    applicationUrl: 'https://mis.bhata.gov.bd/onlineApplication',
    requiredDocuments: ['জাতীয় পরিচয়পত্র', 'স্বামীর মৃত্যু সনদ বা স্থানীয় প্রত্যয়ন'],
    ruleJsonLogic: {
      and: [
        { '==': [{ var: 'gender' }, 'female'] },
        { in: [{ var: 'marital_status' }, ['widowed', 'deserted']] },
        { '<=': [{ var: 'annual_income_bdt' }, 15000] },
      ],
    },
    criteriaExplanations: [
      { field: 'gender', labelBn: 'আবেদনকারী নারী', labelEn: 'Applicant is female', purposeBn: 'কর্মসূচির লক্ষ্যগোষ্ঠী যাচাই', purposeEn: 'Program target group check' },
      { field: 'marital_status', labelBn: 'বিধবা বা স্বামী নিগৃহীতা', labelEn: 'Widowed or deserted', purposeBn: 'বৈবাহিক অবস্থা যাচাই', purposeEn: 'Eligibility status check' },
      { field: 'annual_income_bdt', labelBn: 'বার্ষিক আয় ≤ ১৫,০০০ টাকা', labelEn: 'Annual income ≤ 15,000 BDT', purposeBn: 'অসচ্ছলতা যাচাই', purposeEn: 'Income ceiling check' },
    ],
  },
  {
    kind: 'program',
    slug: 'disability-allowance-dss',
    titleBn: 'অসচ্ছল প্রতিবন্ধী ভাতা',
    titleEn: 'Financially Insolvent Persons with Disabilities Allowance',
    summaryBn: 'সুবর্ণ নাগরিক কার্ডধারী অসচ্ছল প্রতিবন্ধী নাগরিকদের মাসিক ভাতা।',
    summaryEn: 'Monthly allowance for registered persons with disabilities holding Suborna Nagorik ID.',
    agencyOrProvider: 'Department of Social Services (DSS)',
    categoryOrLevel: 'disability',
    benefitAmountInfo: 'মাসিক সরকারি হারে',
    applicationUrl: 'https://mis.bhata.gov.bd/onlineApplication',
    requiredDocuments: ['সুবর্ণ নাগরিক কার্ড', 'এনআইডি বা জন্ম নিবন্ধন'],
    ruleJsonLogic: {
      and: [
        { '==': [{ var: 'has_disability' }, true] },
        { '==': [{ var: 'has_suborna_card' }, true] },
        { '<=': [{ var: 'annual_income_bdt' }, 36000] },
      ],
    },
    criteriaExplanations: [
      { field: 'has_disability', labelBn: 'প্রতিবন্ধী ব্যক্তি', labelEn: 'Person with disability', purposeBn: 'প্রতিবন্ধী ভাতার মূল শর্ত', purposeEn: 'Core eligibility condition' },
      { field: 'has_suborna_card', labelBn: 'সুবর্ণ নাগরিক পরিচয়পত্র আছে', labelEn: 'Holds Suborna Nagorik ID card', purposeBn: 'সমাজসেবা নিবন্ধন যাচাই', purposeEn: 'Verify official DSS registration' },
    ],
  },
  {
    kind: 'program',
    slug: 'mother-child-benefit-programme',
    titleBn: 'মা ও শিশু সহায়তা কর্মসূচি (MCBP)',
    titleEn: 'Mother & Child Benefit Programme (MCBP)',
    summaryBn: 'গর্ভবতী ও প্রসূতি মায়েদের পুষ্টি ও শিশুর বিকাশে মাসিক সহায়তা।',
    summaryEn: 'Monthly nutrition & cash support for eligible pregnant mothers.',
    agencyOrProvider: 'Department of Women Affairs (DWA)',
    categoryOrLevel: 'maternal_child',
    benefitAmountInfo: 'মাসিক সরকারি হারে (৩৬ মাস পর্যন্ত)',
    applicationUrl: 'https://mcbp.gov.bd',
    requiredDocuments: ['জাতীয় পরিচয়পত্র', 'সরকারি স্বাস্থ্যকেন্দ্রের গর্ভকালীন কার্ড'],
    ruleJsonLogic: {
      and: [
        { '==': [{ var: 'gender' }, 'female'] },
        { '==': [{ var: 'is_pregnant' }, true] },
        { '>=': [{ var: 'age' }, 20] },
        { '<=': [{ var: 'age' }, 35] },
        { '<=': [{ var: 'existing_children_count' }, 1] },
      ],
    },
    criteriaExplanations: [
      { field: 'age', labelBn: 'বয়স ২০ থেকে ৩৫ বছর', labelEn: 'Age between 20 and 35', purposeBn: 'সরকারি বয়সসীমা যাচাই', purposeEn: 'Check official age range' },
      { field: 'is_pregnant', labelBn: 'বর্তমানে গর্ভবতী (১ম বা ২য় সন্তান)', labelEn: 'Currently pregnant (1st or 2nd child)', purposeBn: 'কর্মসূচির প্রযোজ্যতা যাচাই', purposeEn: 'Verify pregnancy criteria' },
    ],
  },
  {
    kind: 'program',
    slug: 'vwb-vulnerable-women-benefit',
    titleBn: 'ভালনারেবল উইমেন বেনিফিট (VWB) খাদ্য সহায়তা',
    titleEn: 'Vulnerable Women Benefit (VWB) Programme',
    summaryBn: 'গ্রামীণ দুস্থ নারীদের মাসিক খাদ্যশস্য ও প্রশিক্ষণ সহায়তা।',
    summaryEn: 'Monthly food grain support and livelihood training for rural vulnerable women.',
    agencyOrProvider: 'Department of Women Affairs (DWA)',
    categoryOrLevel: 'food_security',
    applicationUrl: 'https://dwavwb.gov.bd',
    requiredDocuments: ['জাতীয় পরিচয়পত্র', 'ইউনিয়ন পরিষদের প্রত্যয়ন'],
    ruleJsonLogic: {
      and: [
        { '==': [{ var: 'gender' }, 'female'] },
        { '>=': [{ var: 'age' }, 20] },
        { '<=': [{ var: 'age' }, 50] },
        { '==': [{ var: 'is_rural' }, true] },
      ],
    },
    criteriaExplanations: [
      { field: 'is_rural', labelBn: 'গ্রামীণ (ইউনিয়ন) বাসিন্দা', labelEn: 'Rural resident', purposeBn: 'গ্রামীণ খাদ্য নিরাপত্তা লক্ষ্যগোষ্ঠী', purposeEn: 'Rural program scope' },
    ],
  },
  {
    kind: 'program',
    slug: 'vgf-emergency-food-support',
    titleBn: 'ভিজিএফ (VGF) জরুরি খাদ্য সহায়তা',
    titleEn: 'Vulnerable Group Feeding (VGF) Support',
    summaryBn: 'দুর্যোগকালীন বা ঈদ উপলক্ষে অতিদরিদ্র পরিবারের জন্য বিনামূল্যে চাল বিতরণ।',
    summaryEn: 'Emergency and festive food grain relief for ultra-poor households.',
    agencyOrProvider: 'Department of Disaster Management',
    categoryOrLevel: 'disaster_relief',
    applicationUrl: 'https://ddm.gov.bd',
    requiredDocuments: ['এনআইডি', 'ওয়ার্ড/ইউনিয়ন তালিকাভুক্তি'],
    ruleJsonLogic: {
      and: [
        { '<=': [{ var: 'household_monthly_income_bdt' }, 8000] },
        { or: [{ '==': [{ var: 'disaster_affected' }, true] }, { '==': [{ var: 'is_day_laborer' }, true] }] },
      ],
    },
    criteriaExplanations: [
      { field: 'household_monthly_income_bdt', labelBn: 'পরিবারের মাসিক আয় ≤ ৮,০০০ টাকা', labelEn: 'Household monthly income ≤ 8,000 BDT', purposeBn: 'অতিদরিদ্র পরিবার অগ্রাধিকার', purposeEn: 'Priority for ultra-poor households' },
    ],
  },
  {
    kind: 'program',
    slug: 'tcb-family-card',
    titleBn: 'টিসিবি (TCB) ফ্যামিলি কার্ড ভর্তুকি পণ্য',
    titleEn: 'TCB Family Card Subsidized Essentials',
    summaryBn: 'স্বল্প আয়ের পরিবারের জন্য ভর্তুকি মূল্যে তেল, ডাল ও চাল।',
    summaryEn: 'Subsidized essential commodities for low-income cardholding households.',
    agencyOrProvider: 'Trading Corporation of Bangladesh (TCB)',
    categoryOrLevel: 'food_security',
    applicationUrl: 'https://www.tcb.gov.bd',
    requiredDocuments: ['স্মার্ট এনআইডি', 'পৌরসভা/ইউনিয়ন তালিকা'],
    ruleJsonLogic: {
      and: [
        { '<=': [{ var: 'household_monthly_income_bdt' }, 15000] },
        { '==': [{ var: 'receives_govt_pension' }, false] },
      ],
    },
    criteriaExplanations: [
      { field: 'household_monthly_income_bdt', labelBn: 'স্বল্প আয়ের পরিবার', labelEn: 'Low-income household', purposeBn: 'ভর্তুকি কার্ডের যোগ্যতা যাচাই', purposeEn: 'Check low-income threshold' },
    ],
  },
  {
    kind: 'program',
    slug: 'freedom-fighter-honorarium',
    titleBn: 'বীর মুক্তিযোদ্ধা সম্মানী ভাতা',
    titleEn: 'Freedom Fighter Honorarium',
    summaryBn: 'গেজেটভুক্ত বীর মুক্তিযোদ্ধা ও তাঁদের পরিবারের মাসিক সম্মানী ভাতা।',
    summaryEn: 'Monthly state honorarium for gazetted Freedom Fighters and eligible heirs.',
    agencyOrProvider: 'Ministry of Liberation War Affairs',
    categoryOrLevel: 'honorarium',
    applicationUrl: 'https://molwa.gov.bd',
    requiredDocuments: ['মুক্তিযোদ্ধা গেজেট/সনদ', 'এনআইডি'],
    ruleJsonLogic: { '==': [{ var: 'is_gazetted_freedom_fighter_family' }, true] },
    criteriaExplanations: [
      { field: 'is_gazetted_freedom_fighter_family', labelBn: 'গেজেটভুক্ত বীর মুক্তিযোদ্ধা বা যোগ্য উত্তরাধিকারী', labelEn: 'Gazetted Freedom Fighter or eligible heir', purposeBn: 'মন্ত্রণালয়ের তালিকা যাচাই', purposeEn: 'Verify official gazette listing' },
    ],
  },
  {
    kind: 'program',
    slug: 'agri-seed-fertilizer-incentive',
    titleBn: 'ক্ষুদ্র ও প্রান্তিক কৃষক বীজ ও সার প্রণোদনা',
    titleEn: 'Small & Marginal Farmer Seed/Fertilizer Incentive',
    summaryBn: 'ক্ষুদ্র কৃষকদের জন্য মৌসুমী বিনামূল্যে বীজ ও রাসায়নিক সার সহায়তা।',
    summaryEn: 'Seasonal seed and fertilizer grants for small and marginal farmers.',
    agencyOrProvider: 'Department of Agricultural Extension (DAE)',
    categoryOrLevel: 'agriculture',
    applicationUrl: 'https://dae.gov.bd',
    requiredDocuments: ['কৃষক কার্ড', 'এনআইডি'],
    ruleJsonLogic: {
      and: [
        { '==': [{ var: 'occupation_band' }, 'farmer'] },
        { '<=': [{ var: 'cultivable_land_acres' }, 2.5] },
      ],
    },
    criteriaExplanations: [
      { field: 'occupation_band', labelBn: 'পেশা: কৃষক', labelEn: 'Occupation: Farmer', purposeBn: 'কৃষি প্রণোদনার লক্ষ্যগোষ্ঠী', purposeEn: 'Verify agricultural occupation' },
      { field: 'cultivable_land_acres', labelBn: 'আবাদযোগ্য জমি ≤ ২.৫ একর', labelEn: 'Cultivable land ≤ 2.5 acres', purposeBn: 'ক্ষুদ্র ও প্রান্তিক কৃষক সংজ্ঞা', purposeEn: 'Small/marginal farmer definition' },
    ],
  },
  {
    kind: 'program',
    slug: 'youth-development-training-loan',
    titleBn: 'যুব উন্নয়ন প্রশিক্ষণ ও আত্মকর্মসংস্থান ঋণ',
    titleEn: 'Youth Development Training & Self-Employment Loan',
    summaryBn: '১৮–৩৫ বছর বয়সী বেকার যুবকদের প্রশিক্ষণ ও স্বল্পসুদে জামানতবিহীন ঋণ।',
    summaryEn: 'Vocational training and low-interest self-employment loans for youth aged 18–35.',
    agencyOrProvider: 'Department of Youth Development (DYD)',
    categoryOrLevel: 'livelihood',
    applicationUrl: 'https://dyd.gov.bd',
    requiredDocuments: ['এনআইডি', 'শিক্ষাগত যোগ্যতার সনদ', 'প্রশিক্ষণ সনদ (ঋণের জন্য)'],
    ruleJsonLogic: {
      and: [
        { '>=': [{ var: 'age' }, 18] },
        { '<=': [{ var: 'age' }, 35] },
      ],
    },
    criteriaExplanations: [
      { field: 'age', labelBn: 'বয়স ১৮ থেকে ৩৫ বছর', labelEn: 'Age 18 to 35 years', purposeBn: 'জাতীয় যুবনীতি অনুযায়ী বয়সসীমা', purposeEn: 'National Youth Policy age range' },
    ],
  },
  {
    kind: 'program',
    slug: 'probashi-kallyan-migration-loan',
    titleBn: 'প্রবাসী কল্যাণ ব্যাংক অভিবাসন ঋণ',
    titleEn: 'Probashi Kallyan Bank Migration Loan',
    summaryBn: 'বৈধ ভিসাপ্রাপ্ত বিদেশগামী কর্মীদের জন্য স্বল্পসুদে অভিবাসন ঋণ।',
    summaryEn: 'Low-interest migration loan for workers with verified overseas employment visas.',
    agencyOrProvider: 'Probashi Kallyan Bank',
    categoryOrLevel: 'migration',
    applicationUrl: 'https://pkb.gov.bd',
    requiredDocuments: ['বৈধ পাসপোর্ট ও ভিসা', 'বিএমইটি নিবন্ধন', 'জামিনদারের এনআইডি'],
    ruleJsonLogic: {
      and: [
        { '==': [{ var: 'has_valid_work_visa' }, true] },
        { '>=': [{ var: 'age' }, 18] },
        { '<=': [{ var: 'age' }, 55] },
      ],
    },
    criteriaExplanations: [
      { field: 'has_valid_work_visa', labelBn: 'বৈধ বিদেশি চাকরির ভিসা আছে', labelEn: 'Holds verified work visa', purposeBn: 'অভিবাসন ঋণের আবশ্যিক শর্ত', purposeEn: 'Required for migration financing' },
    ],
  },
  {
    kind: 'program',
    slug: 'cancer-kidney-medical-grant-dss',
    titleBn: 'ক্যান্সার, কিডনি ও লিভার সিরোসিস চিকিৎসা অনুদান',
    titleEn: 'Critical Illness Financial Grant (DSS)',
    summaryBn: 'জটিল রোগে আক্রান্ত অসচ্ছল রোগীদের জন্য এককালীন সরকারি চিকিৎসা অনুদান।',
    summaryEn: 'One-time financial assistance grant for insolvent patients with critical illnesses.',
    agencyOrProvider: 'Department of Social Services (DSS)',
    categoryOrLevel: 'health_grant',
    benefitAmountInfo: 'এককালীন ৫০,০০০ টাকা (সরকারি নীতিমালা অনুযায়ী)',
    applicationUrl: 'https://dss.gov.bd',
    requiredDocuments: ['রেজিস্টার্ড বিশেষজ্ঞ চিকিৎসকের প্রত্যয়ন ও রিপোর্ট', 'এনআইডি/জন্ম নিবন্ধন'],
    ruleJsonLogic: {
      and: [
        { '==': [{ var: 'has_critical_illness_diagnosis' }, true] },
        { '<=': [{ var: 'household_monthly_income_bdt' }, 20000] },
      ],
    },
    criteriaExplanations: [
      { field: 'has_critical_illness_diagnosis', labelBn: 'নির্ধারিত ৬টি জটিল রোগের মেডিকেল প্রমাণপত্র', labelEn: 'Medical certification of listed critical illness', purposeBn: 'অনুদান প্রাপ্যতা যাচাই', purposeEn: 'Verify medical grant criteria' },
    ],
  },

  // --- 8 Scholarships & Education Stipends ---
  {
    kind: 'scholarship',
    slug: 'primary-education-stipend',
    titleBn: 'প্রাথমিক শিক্ষা উপবৃত্তি কর্মসূচি',
    titleEn: 'Primary Education Stipend Programme',
    summaryBn: 'সরকারি প্রাথমিক বিদ্যালয়ের শিক্ষার্থীদের জন্য মাসিক উপবৃত্তি।',
    summaryEn: 'Monthly stipend for students enrolled in government primary schools.',
    agencyOrProvider: 'Directorate of Primary Education (DPE)',
    categoryOrLevel: 'primary',
    applicationUrl: 'https://pesp.finance.gov.bd',
    requiredDocuments: ['জন্ম নিবন্ধন সনদ', 'মাতার এনআইডি ও মোবাইল ব্যাংকিং'],
    ruleJsonLogic: {
      and: [
        { '==': [{ var: 'student_level' }, 'primary'] },
        { '==': [{ var: 'attends_govt_school' }, true] },
      ],
    },
    criteriaExplanations: [
      { field: 'student_level', labelBn: 'প্রাথমিক স্তরের শিক্ষার্থী', labelEn: 'Primary-level student', purposeBn: 'শিক্ষা স্তর যাচাই', purposeEn: 'Verify education level' },
    ],
  },
  {
    kind: 'scholarship',
    slug: 'pmeat-secondary-higher-secondary-stipend',
    titleBn: 'সমন্বিত উপবৃত্তি কর্মসূচি (ষষ্ঠ থেকে দ্বাদশ শ্রেণি)',
    titleEn: 'Harmonized Secondary & Higher Secondary Stipend (PMEAT)',
    summaryBn: 'ষষ্ঠ থেকে দ্বাদশ শ্রেণির অসচ্ছল ও মেধাবী শিক্ষার্থীদের উপবৃত্তি ও টিউশন ফি।',
    summaryEn: 'Stipend and tuition support for eligible Class 6–12 students.',
    agencyOrProvider: 'Prime Minister’s Education Assistance Trust (PMEAT)',
    categoryOrLevel: 'secondary',
    applicationUrl: 'https://hsp.pmeat.gov.bd',
    requiredDocuments: ['জন্ম নিবন্ধন', 'অভিভাবকের এনআইডি', 'প্রতিষ্ঠানের প্রত্যয়ন'],
    ruleJsonLogic: {
      and: [
        { in: [{ var: 'student_level' }, ['secondary', 'higher_secondary']] },
        { '<=': [{ var: 'household_annual_income_bdt' }, 100000] },
      ],
    },
    criteriaExplanations: [
      { field: 'student_level', labelBn: 'ষষ্ঠ থেকে দ্বাদশ শ্রেণির শিক্ষার্থী', labelEn: 'Class 6–12 student', purposeBn: 'শ্রেণি যাচাই', purposeEn: 'Check grade range' },
      { field: 'household_annual_income_bdt', labelBn: 'অভিভাবকের বার্ষিক আয় ≤ ১,০০,০০০ টাকা', labelEn: 'Guardian annual income ≤ 100,000 BDT', purposeBn: 'আর্থিক প্রয়োজন যাচাই', purposeEn: 'Check financial need' },
    ],
  },
  {
    kind: 'scholarship',
    slug: 'pmeat-undergraduate-stipend',
    titleBn: 'স্নাতক ও সমমান পর্যায়ের সরকারি উপবৃত্তি',
    titleEn: 'Undergraduate & Equivalent Government Stipend (PMEAT)',
    summaryBn: 'স্নাতক (পাস/সম্মান) পর্যায়ের অসচ্ছল মেধাবী শিক্ষার্থীদের বার্ষিক উপবৃত্তি।',
    summaryEn: 'Annual stipend for needy meritorious undergraduate students across Bangladesh.',
    agencyOrProvider: 'Prime Minister’s Education Assistance Trust (PMEAT)',
    categoryOrLevel: 'undergraduate',
    applicationUrl: 'https://estipend.pmeat.gov.bd',
    requiredDocuments: ['এনআইডি/জন্ম নিবন্ধন', 'ভর্তি রসিদ', 'আয়ের সনদ'],
    ruleJsonLogic: {
      and: [
        { '==': [{ var: 'student_level' }, 'undergraduate'] },
        { '<=': [{ var: 'household_annual_income_bdt' }, 200000] },
      ],
    },
    criteriaExplanations: [
      { field: 'student_level', labelBn: 'স্নাতক পর্যায়ের নিয়মিত শিক্ষার্থী', labelEn: 'Regular undergraduate student', purposeBn: 'শিক্ষা স্তর যাচাই', purposeEn: 'Check undergraduate enrollment' },
    ],
  },
  {
    kind: 'scholarship',
    slug: 'pmeat-admission-assistance',
    titleBn: 'ভর্তি সহায়তা অনুদান (মাধ্যমিক থেকে স্নাতক)',
    titleEn: 'Student Admission Assistance Grant (PMEAT)',
    summaryBn: 'অসচ্ছল শিক্ষার্থীদের ভর্তি ফি সহায়তায় এককালীন সরকারি অনুদান।',
    summaryEn: 'One-time admission grant for financially disadvantaged students.',
    agencyOrProvider: 'Prime Minister’s Education Assistance Trust (PMEAT)',
    categoryOrLevel: 'secondary',
    applicationUrl: 'https://www.eservice.pmeat.gov.bd/admission',
    requiredDocuments: ['ভর্তি প্রমাণপত্র', 'অভিভাবকের আয়ের সনদ'],
    ruleJsonLogic: {
      and: [
        { in: [{ var: 'student_level' }, ['secondary', 'higher_secondary', 'undergraduate']] },
        { '<=': [{ var: 'household_annual_income_bdt' }, 150000] },
      ],
    },
    criteriaExplanations: [
      { field: 'household_annual_income_bdt', labelBn: 'পরিবারের বার্ষিক আয় ≤ ১,৫০,০০০ টাকা', labelEn: 'Annual household income ≤ 150,000 BDT', purposeBn: 'ভর্তি সহায়তার আয়সীমা', purposeEn: 'Check income ceiling' },
    ],
  },
  {
    kind: 'scholarship',
    slug: 'technical-education-stipend',
    titleBn: 'কারিগরি ও ডিপ্লোমা শিক্ষা উপবৃত্তি',
    titleEn: 'Technical & Diploma Education Stipend',
    summaryBn: 'পলিটেকনিক ও কারিগরি প্রতিষ্ঠানের শিক্ষার্থীদের সেমিস্টারভিত্তিক উপবৃত্তি।',
    summaryEn: 'Semester stipend for polytechnic and vocational institute students.',
    agencyOrProvider: 'Directorate of Technical Education (DTE)',
    categoryOrLevel: 'technical',
    applicationUrl: 'https://techedu.gov.bd',
    requiredDocuments: ['প্রতিষ্ঠান নিবন্ধন', 'জন্ম নিবন্ধন/এনআইডি', 'হাজিরা প্রমাণ'],
    ruleJsonLogic: {
      and: [
        { '==': [{ var: 'student_level' }, 'technical'] },
        { '>=': [{ var: 'attendance_percent' }, 75] },
      ],
    },
    criteriaExplanations: [
      { field: 'student_level', labelBn: 'কারিগরি/ডিপ্লোমা শিক্ষার্থী', labelEn: 'Technical/Diploma student', purposeBn: 'কারিগরি শিক্ষা যাচাই', purposeEn: 'Verify technical enrollment' },
      { field: 'attendance_percent', labelBn: 'ক্লাসে উপস্থিতি ≥ ৭৫%', labelEn: 'Class attendance ≥ 75%', purposeBn: 'নিয়মিত উপস্থিতি শর্ত', purposeEn: 'Verify attendance rule' },
    ],
  },
  {
    kind: 'scholarship',
    slug: 'disability-education-stipend-dss',
    titleBn: 'প্রতিবন্ধী শিক্ষার্থীদের শিক্ষা উপবৃত্তি',
    titleEn: 'Education Stipend for Students with Disabilities',
    summaryBn: 'প্রাথমিক থেকে বিশ্ববিদ্যালয় পর্যায়ের প্রতিবন্ধী শিক্ষার্থীদের মাসিক উপবৃত্তি।',
    summaryEn: 'Monthly education stipend from primary to university for students with disabilities.',
    agencyOrProvider: 'Department of Social Services (DSS)',
    categoryOrLevel: 'all_levels',
    applicationUrl: 'https://mis.bhata.gov.bd/onlineApplication',
    requiredDocuments: ['সুবর্ণ নাগরিক কার্ড', 'শিক্ষা প্রতিষ্ঠানের প্রত্যয়ন'],
    ruleJsonLogic: {
      and: [
        { '==': [{ var: 'has_disability' }, true] },
        { '==': [{ var: 'has_suborna_card' }, true] },
        { in: [{ var: 'student_level' }, ['primary', 'secondary', 'higher_secondary', 'undergraduate', 'postgraduate']] },
      ],
    },
    criteriaExplanations: [
      { field: 'has_disability', labelBn: 'প্রতিবন্ধী শিক্ষার্থী', labelEn: 'Student with disability', purposeBn: 'কর্মসূচির লক্ষ্যগোষ্ঠী', purposeEn: 'Target eligibility check' },
    ],
  },
  {
    kind: 'scholarship',
    slug: 'board-merit-scholarship-ssc-hsc',
    titleBn: 'শিক্ষা বোর্ড মেধাবৃত্তি ও সাধারণ বৃত্তি (এসএসসি/এইচএসসি)',
    titleEn: 'Education Board Talentpool & General Scholarship',
    summaryBn: 'পাবলিক পরীক্ষায় সর্বোচ্চ ফলাফল অর্জনকারী শিক্ষার্থীদের সরকারি বৃত্তি।',
    summaryEn: 'Merit-based talentpool and general scholarships for top SSC/HSC performers.',
    agencyOrProvider: 'Directorate of Secondary and Higher Education (DSHE)',
    categoryOrLevel: 'higher_secondary',
    applicationUrl: 'https://dshe.gov.bd',
    requiredDocuments: ['বোর্ড রেজাল্ট ও গেজেট তালিকা', 'ব্যাংক হিসাব নম্বর'],
    ruleJsonLogic: {
      and: [
        { in: [{ var: 'student_level' }, ['higher_secondary', 'undergraduate']] },
        { '>=': [{ var: 'gpa' }, 4.5] },
      ],
    },
    criteriaExplanations: [
      { field: 'gpa', labelBn: 'উচ্চ জিপিএ (≥ ৪.৫০)', labelEn: 'High GPA (≥ 4.50)', purposeBn: 'মেধাভিত্তিক প্রাথমিক যোগ্যতা', purposeEn: 'Merit screening indicator' },
    ],
  },
  {
    kind: 'scholarship',
    slug: 'nst-fellowship-postgraduate',
    titleBn: 'জাতীয় বিজ্ঞান ও প্রযুক্তি (NST) ফেলোশিপ',
    titleEn: 'National Science & Technology (NST) Fellowship',
    summaryBn: 'বিজ্ঞান, প্রকৌশল ও কৃষি বিষয়ে এমএস/এমফিল/পিএইচডি গবেষকদের সরকারি ফেলোশিপ।',
    summaryEn: 'Government research fellowship for MS, MPhil, and PhD students in STEM & Agriculture.',
    agencyOrProvider: 'Ministry of Science and Technology',
    categoryOrLevel: 'postgraduate',
    applicationUrl: 'https://most.gov.bd',
    requiredDocuments: ['বিশ্ববিদ্যালয় সুপারভাইজারের সুপারিশ', 'গবেষণা প্রস্তাবনা', 'স্নাতক নম্বরপত্র'],
    ruleJsonLogic: {
      and: [
        { '==': [{ var: 'student_level' }, 'postgraduate'] },
        { '==': [{ var: 'stem_or_agri_major' }, true] },
      ],
    },
    criteriaExplanations: [
      { field: 'student_level', labelBn: 'স্নাতকোত্তর/গবেষণা শিক্ষার্থী', labelEn: 'Postgraduate research student', purposeBn: 'ফেলোশিপ স্তর যাচাই', purposeEn: 'Verify postgraduate enrollment' },
    ],
  },
];
