import { detectCrisisCategory } from './jono-crisis';

export type JonoIntent =
  | 'greeting'
  | 'thanks'
  | 'goodbye'
  | 'identity'
  | 'app_help'
  | 'emergency'
  | 'crisis_self_harm'
  | 'abuse_violence'
  | 'followup'
  | 'service_question'
  | 'transport_query'
  | 'directory_lookup'
  | 'education_lookup'
  | 'benefit_eligibility'
  | 'complaint'
  | 'notice_lookup'
  | 'out_of_scope';

export interface SessionTopicContext {
  lastTopicBn?: string;
  lastTopicEn?: string;
  lastServiceSlug?: string;
  lastIntent?: JonoIntent;
  rollingSummary: string[];
}

const GREETING_RE =
  /^(?:hi+|hello+|hey+|hlw|salam|assalamu\s*alaikum|good\s*(?:morning|afternoon|evening)|হ্যালো|হাই|সালাম|আসসালামু\s*আলাইকুম|নমস্কার|শুভ\s*সকাল|শুভ\s*সন্ধ্যা|কেমন\s*আছেন|কেমন\s*আছো|kemon\s*achen|kemon\s*acho)[\s!?.]*$/i;

const THANKS_RE =
  /^(?:thanks|thank\s*you(?:\s*so\s*much)?|thx|tnx|shukriya|dhonnobad|অনেক\s*ধন্যবাদ|ধন্যবাদ|থ্যাংকস|থ্যাংক\s*ইউ|শুকরিয়া)[\s!?.]*$/i;

const GOODBYE_RE =
  /^(?:bye+|good\s*bye|see\s*you|allah\s*hafez|khoda\s*hafez|টাটা|বাই|বিদায়|আল্লাহ\s*হাফেজ|খোদা\s*হাফেজ)[\s!?.]*$/i;

const IDENTITY_RE =
  /(?:^(?:আপনি\s*কে|তুমি\s*কে|আপনার\s*নাম\s*কি|তোমার\s*নাম\s*কি|জনো\s*কি|জনো\s*কে|tumi\s*ke|apni\s*ke|tomar\s*nam\s*ki|who\s*are\s*you|what\s*are\s*you|what\s*is\s*jono|what\s*is\s*jonoshheba)[\s!?.]*$)/i;

const APP_HELP_RE =
  /(?:^(?:কি\s*কি\s*সেবা\s*আছে|তুমি\s*কি\s*করতে\s*পারো|আপনি\s*কি\s*করতে\s*পারেন|কীভাবে\s*সাহায্য\s*করতে\s*পারেন|কিভাবে\s*ব্যবহার\s*করব|help|what\s*can\s*you\s*do|how\s*can\s*you\s*help|ki\s*ki\s*seba\s*ache)[\s!?.]*$)/i;

const EMERGENCY_DANGER_RE =
  /(?:(?:^|\b)(?:999|৯৯৯)(?:\b|$)|জরুরি\s*সাহায্য|আগুন\s*লেগেছে|অগ্নিকাণ্ড|অ্যাম্বুলেন্স\s*লাগবে|সড়ক\s*দুর্ঘটনা|রাস্তায়.*দুর্ঘটনা|বুক\s*ব্যথা|হার্ট\s*অ্যাটাক|ডাকাত|ছিনতাই|চুরি\s*হচ্ছে|fire\s*(?:at\s*home|in\s*building|emergency)|house\s*on\s*fire|emergency\s*fire|need\s*(?:an?\s*|emergency\s*)?ambulance|severe\s*chest\s*pain|chest\s*pain|heart\s*attack|robbery|immediate\s*danger|emergency\s*(?:police|fire|ambulance|help)|agun\s*legeche)/i;

const FOLLOWUP_SHORT_RE =
  /^(?:এটার?\s*|এর\s*|সেটার?\s*|তার\s*|ওটার?\s*)?(?:ফি\s*কত|কত\s*টাকা(?:\s*লাগে|\s*লাগবে)?|খরচ\s*কত|কি\s*কি\s*কাগজ(?:\s*লাগে|\s*লাগবে)?|কী\s*কী\s*কাগজপত্র?\s*লাগবে|কাগজপত্র\s*কি\s*লাগে|ডকুমেন্ট\s*কি\s*লাগে|কোথায়\s*আবেদন\s*করব|কিভাবে\s*আবেদন\s*করব|কীভাবে\s*করব|কত\s*দিন\s*লাগে|সময়\s*কত\s*লাগে|হটলাইন\s*(?:নম্বর\s*)?কত|লিঙ্ক\s*কি|ওয়েবসাইট\s*কি|নবায়ন\s*ফি\s*কত|fee\s*koto|koto\s*taka(?:\s*lage|\s*lagbe)?|ki\s*ki\s*kagoj\s*lagbe|kothay\s*abedon\s*korbo|koto\s*din\s*lage|how\s*much(?:\s*is\s*the\s*fee|\s*does\s*it\s*cost)?|what\s*is\s*the\s*fee|what\s*documents(?:\s*are\s*needed|\s*do\s*i\s*need)?|where\s*(?:do\s*i|to)\s*apply|how\s*long\s*does\s*it\s*take|what\s*is\s*the\s*hotline|official\s*link)[\s?।!]*$/i;

const OUT_OF_SCOPE_TRULY_RE =
  /(?:কৌতুক\s*বলো|জোকস\s*বলো|tell\s*(?:me\s*)?a\s*joke|একটি\s*কবিতা\s*লেখো|write\s*a\s*poem|কে\s*ভালো\s*নেতা|কোন\s*দল\s*ভালো|political\s*opinion|who\s*will\s*win\s*the\s*election|ক্রিকেট\s*স্কোর|cricket\s*score|বিরিয়ানি\s*রান্নার\s*রেসিপি|recipe\s*for|write\s*python\s*code\s*for\s*fibonacci)/i;

const TRANSPORT_RE =
  /(?:ট্রেন|রেল|রেলওয়ে|আন্তঃনগর|সুবর্ণ|মহানগর|কক্সবাজার\s*এক্সপ্রেস|পারাবত|সিল্কসিটি|জাহানাবাদ|রংপুর\s*এক্সপ্রেস|হাওর\s*এক্সপ্রেস|পাহাড়িকা|কমলাপুর|মেট্রো|মেট্রোরেল|এমআরটি|বাস(?:ের)?|বিআরটিসি|গ্রিন\s*লাইন|হানিফ|লঞ্চ|ফেরি|বিমান|টোল|পদ্মা\s*সেতু\s*টোল|যমুনা\s*সেতু\s*টোল|train|railway|intercity|eticket\.railway|metro\s*rail|mrt|bus\s*(?:route|fare|ticket|operator|counter|terminal)|brtc|launch|ferry|sadarghat|(?:ঢাকা|চট্টগ্রাম|রাজশাহী|সিলেট|খুলনা|কক্সবাজার|রংপুর|ময়মনসিংহ|বগুড়া|যশোর|কুমিল্লা|বরিশাল|dhaka|chattogram|chittagong|ctg|rajshahi|sylhet|khulna|cox'?s?\s*bazar|rangpur|mymensingh|bogura|bogra|jashore|jessore|cumilla|comilla|barishal|barisal).*(?:থেকে|টু|গামী|যাব|ট্রেন|বাস|লঞ্চ|ভাড়া|theke|to|train|bus|launch|fare))/i;

const EDUCATION_LOOKUP_RE =
  /(?:\bEIIN\b|ইআইআইএন|ঢাকা\s*বিশ্ববিদ্যালয়|রাজশাহী\s*বিশ্ববিদ্যালয়|চট্টগ্রাম\s*বিশ্ববিদ্যালয়|জাহাঙ্গীরনগর\s*বিশ্ববিদ্যালয়|বুয়েট|মেডিকেল\s*কলেজ|জাতীয়\s*বিশ্ববিদ্যালয়|কারিগরি\s*বোর্ড|ইউজিসি|ব্যানবেইস|কলেজ\s*কোড|dhaka\s*university|university\s*of\s*dhaka|buet|rajshahi\s*university|chittagong\s*university|national\s*university|\bugc\b|\bbanbeis\b|school\s*eiin|college\s*eiin)/i;

const DIRECTORY_LOOKUP_RE =
  /(?:মন্ত্রণালয়|মন্ত্রণালয়ের|অধিদপ্তর|পরিদপ্তর|সচিব|সিনিয়র\s*সচিব|উপদেষ্টা|মন্ত্রী|মহাপরিচালক|জেলা\s*প্রশাসক|ডিসি\s*অফিস|সিটি\s*কর্পোরেশন|অফিস\s*নম্বর|দপ্তরের\s*ফোন|হটলাইন\s*নম্বর|ministry\s*of|directorate\s*of|secretary\s*of|office\s*phone|ministry\s*hotline|cabinet\s*division|শিক্ষা\s*মন্ত্রণালয়|স্বাস্থ্য\s*মন্ত্রণালয়|ভূমি\s*মন্ত্রণালয়|সমাজকল্যাণ\s*মন্ত্রণালয়|অর্থ\s*মন্ত্রণালয়|স্বরাষ্ট্র\s*মন্ত্রণালয়|পররাষ্ট্র\s*মন্ত্রণালয়|কৃষি\s*মন্ত্রণালয়)/i;

const BENEFIT_RE =
  /(?:ফ্যামিলি\s*কার্ড|family\s*card|বয়স্ক\s*ভাতা|বিধবা\s*ভাতা|প্রতিবন্ধী\s*ভাতা|মাতৃত্বকালীন\s*ভাতা|মা\s*ও\s*শিশু\s*সহায়তা|ভাতা\s*পাব|যোগ্যতা\s*যাচাই|উপবৃত্তি|শিক্ষাবৃত্তি|boyosko\s*bhata|bidhoba\s*bhata|protibondhi\s*bhata|old\s*age\s*allowance|widow\s*allowance|disability\s*allowance|mcbp|stipend|scholarship)/i;

const COMPLAINT_RE =
  /(?:অভিযোগ|জিআরএস|\bgrs\b|হয়রানি|ঘুষ|দুর্নীতি|দুদক|ভোক্তা\s*অধিকার|ওজনে\s*কম|ভেজাল|অতিরিক্ত\s*দাম|complaint|grievance|bribe|corruption|overcharging|consumer\s*rights|ovijog)/i;

const NOTICE_RE =
  /(?:নোটিশ|বিজ্ঞপ্তি|সার্কুলার|সরকারি\s*ছুটি|আয়কর\s*শেষ\s*তারিখ|ঈদ\s*টিকিট\s*কবে|notice|circular|deadline\s*calendar|public\s*holiday)/i;

export function classifyJonoIntent(
  message: string,
  sessionContext?: SessionTopicContext,
): JonoIntent {
  const trimmed = message.trim();

  // 1. Highest priority: crisis & abuse safety (Section 1.4)
  const crisis = detectCrisisCategory(trimmed);
  if (crisis) return crisis;

  // 2. Immediate physical/fire/medical danger (Rule R8)
  if (EMERGENCY_DANGER_RE.test(trimmed)) return 'emergency';

  // 3. Conversational small-talk & identity (Section 1.2)
  if (GREETING_RE.test(trimmed)) return 'greeting';
  if (THANKS_RE.test(trimmed)) return 'thanks';
  if (GOODBYE_RE.test(trimmed)) return 'goodbye';
  if (IDENTITY_RE.test(trimmed)) return 'identity';
  if (APP_HELP_RE.test(trimmed)) return 'app_help';

  // 4. Follow-up detection (Section 1.3)
  if (
    FOLLOWUP_SHORT_RE.test(trimmed) &&
    sessionContext &&
    (sessionContext.lastTopicBn || sessionContext.lastTopicEn || sessionContext.lastServiceSlug)
  ) {
    return 'followup';
  }

  // 5. Truly out-of-scope (Section 1.7)
  if (OUT_OF_SCOPE_TRULY_RE.test(trimmed)) return 'out_of_scope';

  // 6. Domain intents
  if (EDUCATION_LOOKUP_RE.test(trimmed)) return 'education_lookup';
  if (TRANSPORT_RE.test(trimmed)) return 'transport_query';
  if (BENEFIT_RE.test(trimmed)) return 'benefit_eligibility';
  if (COMPLAINT_RE.test(trimmed)) return 'complaint';
  if (DIRECTORY_LOOKUP_RE.test(trimmed)) return 'directory_lookup';
  if (NOTICE_RE.test(trimmed)) return 'notice_lookup';

  return 'service_question';
}

/** Rewrites a context-dependent follow-up ("ফি কত?", "কি কি কাগজ লাগবে?") into a standalone query */
export function rewriteFollowUpQuery(
  rawMessage: string,
  ctx: SessionTopicContext,
  locale: 'bn' | 'en',
): string {
  const topic =
    locale === 'bn'
      ? ctx.lastTopicBn || ctx.lastTopicEn || ctx.lastServiceSlug || ''
      : ctx.lastTopicEn || ctx.lastTopicBn || ctx.lastServiceSlug || '';
  if (!topic) return rawMessage;
  return `${topic} — ${rawMessage.trim()}`;
}

export function buildSmallTalkResponse(
  intent: 'greeting' | 'thanks' | 'goodbye' | 'identity' | 'app_help',
  locale: 'bn' | 'en',
): { reply: string; suggestions: string[] } {
  const defaultChipsBn = [
    'ই-পাসপোর্ট আবেদন ও ফি',
    'ঢাকা থেকে রাজশাহী ট্রেন কখন?',
    'জমির খাজনা অনলাইনে কীভাবে দেবো?',
    'বয়স্ক ভাতা বা ফ্যামিলি কার্ড যোগ্যতা',
  ];
  const defaultChipsEn = [
    'e-Passport application & fees',
    'Dhaka to Rajshahi train times',
    'How to pay land tax (Khajna) online',
    'Old Age Allowance & Family Card eligibility',
  ];

  switch (intent) {
    case 'greeting':
      return {
        reply:
          locale === 'bn'
            ? 'আসসালামু আলাইকুম ও স্বাগতম! আমি **জনো (Jono)** — জনসেবা AI-এর নাগরিক সহায়ক। সরকারি সেবা, ট্রেন ও বাসের সময়সূচি, ভাতা ও বৃত্তি, মন্ত্রণালয় ও শিক্ষা প্রতিষ্ঠানের তথ্য বা জরুরি হটলাইন জানতে আমাকে যেকোনো প্রশ্ন করতে পারেন।'
            : 'Hello and welcome! I am **Jono**, your citizen-service assistant on Jonoshheba AI. Ask me about Bangladesh public services, train and bus schedules, allowances, ministries, education institutions (EIIN), or emergency hotlines.',
        suggestions: locale === 'bn' ? defaultChipsBn : defaultChipsEn,
      };
    case 'thanks':
      return {
        reply:
          locale === 'bn'
            ? 'আপনাকেও আন্তরিক ধন্যবাদ! আপনার আর কোনো সরকারি সেবা, পরিবহন বা তথ্যের প্রয়োজন হলে নির্দ্বিধায় জিজ্ঞাসা করুন।'
            : 'You are very welcome! Feel free to ask whenever you need help with any public service, transport route, or official hotline.',
        suggestions: locale === 'bn' ? defaultChipsBn : defaultChipsEn,
      };
    case 'goodbye':
      return {
        reply:
          locale === 'bn'
            ? 'ধন্যবাদ, ভালো ও নিরাপদে থাকবেন! জরুরি প্রয়োজনে সবসময় **999** এবং সরকারি তথ্যের জন্য **333** মনে রাখবেন।'
            : 'Take care and stay safe! Remember **999** for immediate emergencies and **333** for general government information.',
        suggestions: locale === 'bn' ? defaultChipsBn : defaultChipsEn,
      };
    case 'identity':
      return {
        reply:
          locale === 'bn'
            ? 'আমি **জনো (Jono)** — **জনসেবা AI (Jonoshheba AI)** প্ল্যাটফর্মের এআই নাগরিক সহায়ক। আমরা একটি স্বাধীন নাগরিক তথ্য, নির্দেশনা ও ট্র্যাকিং প্ল্যাটফর্ম (কোনো সরকারি দপ্তর নয়)। আমি যাচাইকৃত সরকারি উৎস থেকে সেবা, ফি, প্রয়োজনীয় কাগজপত্র, ট্রেন/বাসের সময়সূচি ও হটলাইন খুঁজে দিতে সাহায্য করি।'
            : 'I am **Jono**, the AI citizen assistant on **Jonoshheba AI** — an independent citizen-service discovery and guidance platform for Bangladesh (not an official government agency). I help you find verified government services, fees, checklists, train/bus schedules, and official hotlines with citations.',
        suggestions: locale === 'bn' ? defaultChipsBn : defaultChipsEn,
      };
    case 'app_help':
      return {
        reply:
          locale === 'bn'
            ? 'আমি আপনাকে নিচের বিষয়গুলোতে যাচাইকৃত উৎসসহ সাহায্য করতে পারি:\n\n' +
              '- **সরকারি সেবা:** জন্ম নিবন্ধন, এনআইডি, ই-পাসপোর্ট, ড্রাইভিং লাইসেন্স, নামজারি, জমির খাজনা, ট্রেড লাইসেন্স, ই-টিন, বিদ্যুৎ বিল ও জিডি।\n' +
              '- **পরিবহন:** ট্রেন ও বাসের সময়সূচি, মেট্রোরেল ভাড়া ও সেতুর টোল।\n' +
              '- **ভাতা ও বৃত্তি:** ফ্যামিলি কার্ড ২০২৬, বয়স্ক/বিধবা/প্রতিবন্ধী ভাতা ও শিক্ষাবৃত্তির সম্ভাব্য যোগ্যতা।\n' +
              '- **ডিরেক্টরি ও শিক্ষা:** মন্ত্রণালয়, দপ্তরের হটলাইন, বোর্ড রেজাল্ট ও শিক্ষা প্রতিষ্ঠানের তথ্য (EIIN/UGC)।'
            : 'Here is what I can help you with using verified official sources:\n\n' +
              '- **Public Services:** Birth registration, NID, e-Passport, driving licence, land mutation & tax (Khajna), trade licence, e-TIN, electricity bills, and online GD.\n' +
              '- **Transport:** Train schedules & fares, intercity buses, Dhaka Metro Rail fares, and bridge tolls.\n' +
              '- **Benefits & Scholarships:** Family Card 2026, Old Age / Widow / Disability allowances, and stipends.\n' +
              '- **Directories & Education:** Ministries, official hotlines, board exam results, and institutions (EIIN/UGC).',
        suggestions: locale === 'bn' ? defaultChipsBn : defaultChipsEn,
      };
  }
}
