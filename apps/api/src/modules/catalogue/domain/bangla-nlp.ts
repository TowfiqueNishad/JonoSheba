import type { IntentHint } from './catalogue.types';

const BANGLA_DIGITS: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

/**
 * Normalizes Bangla + English + Banglish text:
 * - Unicode NFC normalization
 * - Removes zero-width non-joiner / joiner artifacts
 * - Normalizes Nukta & Khanda-Ta variants (ৎ -> ত্, য় -> য়, ড় -> ড়, ঢ় -> ঢ়)
 * - Normalizes Bangla numerals (০-৯ -> 0-9)
 * - Strips punctuation & collapses whitespace
 */
export function normalizeBanglaText(input: string): string {
  return input
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/ৎ/g, 'ত্')
    .replace(/য়/g, 'য়')
    .replace(/ড়/g, 'ড়')
    .replace(/ঢ়/g, 'ঢ়')
    .replace(/[০-৯]/g, (d) => BANGLA_DIGITS[d] ?? d)
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Cross-lingual Bangla <-> English <-> Banglish synonym & transliteration clusters */
export const CROSS_LINGUAL_SYNONYMS: ReadonlyArray<readonly string[]> = [
  ['জন্ম নিবন্ধন', 'জন্ম সনদ', 'jonmo nibondhon', 'jonmo sonod', 'birth certificate', 'birth registration', 'bdris'],
  ['মৃত্যু নিবন্ধন', 'mrittu nibondhon', 'death certificate'],
  ['জাতীয় পরিচয়পত্র', 'এনআইডি', 'ভোটার আইডি', 'nid', 'national id', 'voter id', 'smart card', 'স্মার্ট কার্ড'],
  ['সংশোধন', 'songshodhon', 'correction', 'update', 'fix'],
  ['হারানো', 'harano', 'lost', 'reissue', 'রি ইস্যু'],
  ['ই পাসপোর্ট', 'পাসপোর্ট', 'epassport', 'e passport', 'passport', 'dip'],
  ['ড্রাইভিং লাইসেন্স', 'লার্নার লাইসেন্স', 'driving license', 'learner license', 'brta', 'বিআরটিএ'],
  ['নামজারি', 'ই নামজারি', 'মিউটেশন', 'namjari', 'e namjari', 'mutation', 'land mutation', 'জমির নামজারি'],
  ['খাজনা', 'ভূমি উন্নয়ন কর', 'khajna', 'ldtax', 'land tax', 'land development tax'],
  ['পর্চা', 'খতিয়ান', 'porcha', 'khatian', 'eporcha', 'mouza'],
  ['বয়স্ক ভাতা', 'boyosko bhata', 'old age allowance', 'senior allowance'],
  ['বিধবা ভাতা', 'bidhoba bhata', 'widow allowance'],
  ['প্রতিবন্ধী', 'সুবর্ণ নাগরিক', 'protibondhi', 'disability', 'suborna nagorik'],
  ['মাতৃত্বকালীন ভাতা', 'মা ও শিশু', 'matrikalin bhata', 'mcbp', 'mother child benefit'],
  ['টিন', 'ই টিন', 'আয়কর', 'tin', 'etin', 'tin certificate', 'income tax', 'ereturn', 'nbr'],
  ['ভ্যাট', 'vat', 'bin'],
  ['ট্রেড লাইসেন্স', 'trade license', 'business license'],
  ['পুলিশ ক্লিয়ারেন্স', 'police clearance', 'pcc'],
  ['জিডি', 'অনলাইন জিডি', 'সাধারণ ডায়েরি', 'gd', 'online gd', 'general diary'],
  ['অভিযোগ', 'জিআরএস', 'ovijog', 'grs', 'complaint', 'grievance'],
  ['ভোক্তা অধিকার', 'vokta odhikar', 'consumer rights', 'dncrp'],
  ['টিকা', 'ইপিআই', 'শিশুর টিকা', 'tika', 'vaccine', 'vaccination', 'epi', 'surokkha'],
  ['বৃত্তি', 'উপবৃত্তি', 'britti', 'upobritti', 'scholarship', 'stipend', 'pmeat'],
  ['বিদ্যুৎ', 'ডেসকো', 'ডিপিডিসি', 'পল্লী বিদ্যুৎ', 'biddut', 'electricity', 'desco', 'dpdc', 'outage'],
  ['পানি', 'ওয়াসা', 'pani', 'water', 'wasa'],
  ['গ্যাস', 'তিতাস', 'gas', 'titas'],
  ['কৃষি', 'কৃষক', 'krishi', 'krishok', 'farmer', 'agriculture'],
  ['প্রবাসী', 'বিএমইটি', 'ভিসা', 'probashi', 'bmet', 'visa', 'migration'],
  ['ট্রেন', 'রেল', 'রেলওয়ে', 'train', 'rail', 'railway', 'eticket', 'ticket', 'টিকিট'],
  ['বাস', 'bus', 'terminal', 'টার্মিনাল'],
  ['ঢাকা', 'dhaka', 'dhk', 'কমলাপুর', 'kamalapur'],
  ['চট্টগ্রাম', 'chattogram', 'chittagong', 'ctg'],
  ['রাজশাহী', 'rajshahi', 'raj'],
  ['সিলেট', 'sylhet', 'syl'],
  ['খুলনা', 'khulna', 'khl'],
  ['কক্সবাজার', 'coxsbazar', 'cox bazar', 'cox'],
  ['জরুরি', 'পুলিশ', 'অ্যাম্বুলেন্স', 'ফায়ার', '999', 'emergency', 'ambulance', 'fire', 'hotline', 'হটলাইন'],
];

/** Expands a normalized query with cross-lingual Bangla/English/Banglish equivalents */
export function expandCrossLingualQuery(normalizedQuery: string): string[] {
  const expanded = new Set<string>([normalizedQuery]);
  for (const cluster of CROSS_LINGUAL_SYNONYMS) {
    const normalizedCluster = cluster.map(normalizeBanglaText);
    const matched = normalizedCluster.some(
      (term) =>
        term.length >= 2 &&
        (normalizedQuery.includes(term) || term.includes(normalizedQuery) && normalizedQuery.length >= 3),
    );
    if (matched) {
      for (const synonym of normalizedCluster) {
        expanded.add(synonym);
      }
    }
  }
  return [...expanded];
}

/** Generates character trigrams mirroring PostgreSQL pg_trgm behavior */
export function toTrigrams(text: string): Set<string> {
  const padded = `  ${text} `;
  const grams = new Set<string>();
  for (let i = 0; i <= padded.length - 3; i++) {
    grams.add(padded.slice(i, i + 3));
  }
  return grams;
}

/** Jaccard trigram similarity in [0, 1] */
export function trigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const ga = toTrigrams(a);
  const gb = toTrigrams(b);
  if (ga.size === 0 || gb.size === 0) return 0;
  let intersection = 0;
  for (const g of ga) {
    if (gb.has(g)) intersection++;
  }
  const union = ga.size + gb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Compact Levenshtein edit distance for "Did you mean" typo correction */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (curr[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost,
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j] ?? 0;
  }
  return prev[b.length] ?? 0;
}

const KNOWN_CITIES: Array<{ en: string; terms: string[] }> = [
  { en: 'Dhaka', terms: ['ঢাকা', 'dhaka', 'dhk', 'কমলাপুর', 'kamalapur'] },
  { en: 'Chattogram', terms: ['চট্টগ্রাম', 'chattogram', 'chittagong', 'ctg'] },
  { en: 'Rajshahi', terms: ['রাজশাহী', 'rajshahi', 'raj'] },
  { en: 'Sylhet', terms: ['সিলেট', 'sylhet', 'syl'] },
  { en: 'Khulna', terms: ['খুলনা', 'khulna', 'khl'] },
  { en: "Cox's Bazar", terms: ['কক্সবাজার', 'coxsbazar', 'cox'] },
  { en: 'Rangpur', terms: ['রংপুর', 'rangpur'] },
  { en: 'Barishal', terms: ['বরিশাল', 'barishal', 'barisal'] },
];

/** Deterministic intent router (fallback when AI /nlp/intent is not called synchronously) */
export function detectIntentHint(rawQuery: string): IntentHint {
  const norm = normalizeBanglaText(rawQuery);

  // Rule R8: Immediate emergency detection first!
  if (/(999|জরুরি|আগুন|fire|ambulance|অ্যাম্বুলেন্স|দুর্ঘটনা|accident|নির্যাতন|help me)/.test(norm)) {
    return {
      module: 'emergency',
      confidence: 0.95,
      actionCard: {
        type: 'emergency_call',
        payload: { number: '999', telUri: 'tel:999' },
      },
    };
  }

  // Transport intent (e.g. "ঢাকা চট্টগ্রাম ট্রেন" -> transport search card on top)
  if (/(ট্রেন|train|রেল|rail|বাস|bus|টিকিট|ticket|স্টেশন|station)/.test(norm)) {
    const matchedCities = KNOWN_CITIES.filter((c) => c.terms.some((t) => norm.includes(t))).map(
      (c) => c.en,
    );
    const mode = /(বাস|bus)/.test(norm) ? 'bus' : 'train';
    return {
      module: 'transport',
      confidence: 0.92,
      actionCard: {
        type: 'transport_search',
        payload: {
          mode,
          origin: matchedCities[0] ?? null,
          destination: matchedCities[1] ?? null,
        },
      },
    };
  }

  if (/(ভাতা|bhata|allowance|vurtuki|ভর্তুকি|মাতৃত্বকালীন|বয়স্ক|বিধবা|প্রতিবন্ধী)/.test(norm)) {
    return {
      module: 'benefit',
      confidence: 0.88,
      actionCard: { type: 'eligibility_wizard', payload: { need: 'benefits' } },
    };
  }

  if (/(বৃত্তি|উপবৃত্তি|britti|scholarship|stipend|ভর্তি|admission)/.test(norm)) {
    return { module: 'scholarship', confidence: 0.88 };
  }

  if (/(চাকরি|নিয়োগ|circular|job|bcs)/.test(norm)) {
    return { module: 'job', confidence: 0.85 };
  }

  if (/(অভিযোগ|ovijog|grs|complaint|ভোক্তা|vokta)/.test(norm)) {
    return { module: 'complaint', confidence: 0.88 };
  }

  if (/(হাসপাতাল|hospital|টিকা|tika|vaccine|স্বাস্থ্য|clinic|16263)/.test(norm)) {
    return { module: 'health', confidence: 0.85 };
  }

  if (/(বিদ্যুৎ|biddut|desco|dpdc|পল্লী বিদ্যুৎ|ওয়াসা|wasa|গ্যাস|gas|outage)/.test(norm)) {
    return { module: 'utility', confidence: 0.85 };
  }

  return { module: 'service', confidence: 0.7 };
}
