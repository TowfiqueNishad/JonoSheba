import { normalizeBanglaText } from '../../catalogue/domain/bangla-nlp';
import type { ComplaintGuideRecord } from './support.types';

export interface DraftClassification {
  category: string;
  confidence: number;
  structuredSummary: {
    what: string;
    when: string | null;
    where: string | null;
    service: string | null;
    reference: string | null;
  };
  formalBanglaDraft: string;
}

/** Deterministic complaint classifier + tone-cleaned formal Bangla draft builder (Rule R1 & R7) */
export function classifyAndDraftComplaint(params: {
  description: string;
  explicitCategory?: string;
  location?: string;
  guides: readonly ComplaintGuideRecord[];
}): { guide: ComplaintGuideRecord; result: DraftClassification } {
  const norm = normalizeBanglaText(params.description);

  let category = params.explicitCategory ?? 'public_service_delay';
  let confidence = params.explicitCategory ? 0.95 : 0.72;

  if (!params.explicitCategory) {
    if (/(দাম বেশি|ভেজাল|মেয়াদোত্তীর্ণ|ওজনে কম|ভোক্তা|overcharg|expired|adulterat|consumer)/.test(norm)) {
      category = 'consumer_rights';
      confidence = 0.89;
    } else if (/(বিদ্যুৎ|লোডশেডিং|মিটার|পানি|ওয়াসা|গ্যাস|desco|dpdc|wasa|titas|outage|power)/.test(norm)) {
      category = 'utility_outage';
      confidence = 0.9;
    } else if (/(বাস|ট্রেন|ভাড়া বেশি|টিকিট|কনডাক্টর|ড্রাইভার|bus|train|brta|fare)/.test(norm)) {
      category = 'transport_issue';
      confidence = 0.87;
    } else if (/(ঘুষ|হয়রানি|বিলম্ব|জন্ম নিবন্ধন|নামজারি|পাসপোর্ট|এনআইডি|অফিস|delay|bribe|office)/.test(norm)) {
      category = 'public_service_delay';
      confidence = 0.86;
    }
  }

  const guide =
    params.guides.find((g) => g.category === category) ??
    params.guides[0]!;

  // Clean harsh/informal tone into calm, factual formal Bangla
  const cleanedBody = params.description
    .replace(/\b(stupid|idiot|chor|corrupt bastards?)\b/gi, '[অসংযত শব্দ অপসারিত]')
    .replace(/\s+/g, ' ')
    .trim();

  const refMatch = params.description.match(/(?:ref|tracking|id|নম্বর|নং)\s*[:-]?\s*([A-Za-z0-9-]{4,24})/i);
  const dateMatch = params.description.match(/(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/);

  const locationText = params.location?.trim() || 'উল্লেখিত এলাকা/দপ্তর';

  const formalBanglaDraft = [
    `বরাবর,`,
    `সংশ্লিষ্ট কর্তৃপক্ষ, ${guide.authorityBn}`,
    ``,
    `বিষয়: সেবা সংক্রান্ত আনুষ্ঠানিক অভিযোগ ও প্রতিকারের আবেদন।`,
    ``,
    `মহোদয়,`,
    `যথাবিহিত সম্মানপূর্বক জানাচ্ছি যে, ${locationText}-এ নিম্নোক্ত সমস্যার সম্মুখীন হয়েছি:`,
    ``,
    `"${cleanedBody}"`,
    ``,
    refMatch?.[1] ? `সংশ্লিষ্ট রেফারেন্স/ট্র্যাকিং নম্বর: ${refMatch[1]}` : `সংশ্লিষ্ট রেফারেন্স/রসিদ: [সংযুক্ত করুন]`,
    `অতএব, বিষয়টি যাচাই করে প্রয়োজনীয় ব্যবস্থা গ্রহণের জন্য বিনীত অনুরোধ করছি।`,
    ``,
    `বিনীত,`,
    `[আপনার নাম ও যোগাযোগের নম্বর]`,
  ].join('\n');

  return {
    guide,
    result: {
      category: guide.category,
      confidence,
      structuredSummary: {
        what: cleanedBody.slice(0, 240),
        when: dateMatch?.[1] ?? null,
        where: params.location ?? null,
        service: guide.authorityEn,
        reference: refMatch?.[1] ?? null,
      },
      formalBanglaDraft,
    },
  };
}
