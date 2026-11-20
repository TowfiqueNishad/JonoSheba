import { normalizeBanglaText } from '../../catalogue/domain/bangla-nlp';

export interface HealthRedFlagAssessment {
  isRedFlag: boolean;
  matchedSignals: string[];
  immediateActionBn: string;
  immediateActionEn: string;
  noDiagnosisNoticeBn: string;
  noDiagnosisNoticeEn: string;
}

const RED_FLAG_RULES: ReadonlyArray<{ id: string; pattern: RegExp }> = [
  { id: 'chest_pain', pattern: /(বুকে ব্যথা|বুকে চাপ|হার্ট অ্যাটাক|chest pain|heart attack|buke betha)/ },
  { id: 'breathing_difficulty', pattern: /(শ্বাসকষ্ট|দম বন্ধ|নিশ্বাস নিতে পারছি না|shortness of breath|cant breathe|cannot breathe|shashkosto)/ },
  { id: 'unconscious_stroke', pattern: /(অজ্ঞান|স্ট্রোক|মুখ বেঁকে|হাত পা অবশ|unconscious|stroke|fainted|oggan)/ },
  { id: 'severe_bleeding', pattern: /(অতিরিক্ত রক্তপাত|রক্ত বন্ধ হচ্ছে না|heavy bleeding|severe bleeding|rokto pat)/ },
  { id: 'pregnancy_emergency', pattern: /(গর্ভাবস্থায় রক্তপাত|খিঁচুনি|pregnancy bleeding|eclampsia|seizure|khichuni)/ },
  { id: 'snakebite_poisoning', pattern: /(সাপে কাট|বিষ পান|poisoning|snakebite|snake bite|sape kat)/ },
  { id: 'severe_burn_trauma', pattern: /(গুরুতর পুড়ে|সড়ক দুর্ঘটনা|severe burn|head injury|accident)/ },
  { id: 'self_harm', pattern: /(আত্মহত্যা|নিজেকে শেষ|suicide|kill myself|self harm)/ },
];

/**
 * Deterministic Rule-Based Medical Red-Flag Detector (Rules R7 & R8).
 * Jonoshheba NEVER diagnoses medical conditions; red-flag symptoms immediately surface 999 + nearest hospital.
 */
export function assessHealthRedFlags(query: string): HealthRedFlagAssessment {
  const norm = normalizeBanglaText(query);
  const matchedSignals = RED_FLAG_RULES.filter((r) => r.pattern.test(norm)).map((r) => r.id);
  const isRedFlag = matchedSignals.length > 0;

  return {
    isRedFlag,
    matchedSignals,
    immediateActionBn: isRedFlag
      ? 'জরুরি লক্ষণ শনাক্ত হয়েছে — অবিলম্বে ৯৯৯-এ কল করুন অথবা নিকটস্থ হাসপাতালের জরুরি বিভাগে যান।'
      : 'সাধারণ সরকারি স্বাস্থ্য তথ্যের জন্য ১৬২৬৩ (স্বাস্থ্য বাতায়ন) নম্বরে কল করুন বা নিকটস্থ সরকারি হাসপাতালে যোগাযোগ করুন।',
    immediateActionEn: isRedFlag
      ? 'Urgent red-flag symptom detected — call 999 immediately or go to the nearest hospital emergency department.'
      : 'For official public health guidance, call 16263 (Shastho Batayon) or visit your nearest public hospital.',
    noDiagnosisNoticeBn:
      'জনসেবা AI কোনো রোগ নির্ণয় বা চিকিৎসা ব্যবস্থাপত্র দেয় না। সঠিক চিকিৎসার জন্য নিবন্ধিত চিকিৎসকের পরামর্শ নিন।',
    noDiagnosisNoticeEn:
      'Jonoshheba AI does not provide medical diagnosis or prescriptions. Consult a licensed doctor or public hospital.',
  };
}
