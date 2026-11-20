import type { JonoActionCard, JonoCitation } from './jono.service';

export type CrisisCategory = 'crisis_self_harm' | 'abuse_violence' | null;

const SELF_HARM_RE =
  /(?:বাঁচতে\s*ইচ্ছা\s*করে\s*না|বাঁচতে\s*চাই\s*না|মরে\s*যেতে\s*চাই|আত্মহত্যা|নিজেকে\s*শেষ|জীবন\s*শেষ\s*করে|বেঁচে\s*থেকে\s*লাভ\s*নেই|আর\s*পারছি\s*না\s*বাঁচতে|গলায়\s*দড়ি|বিষ\s*খেয়ে|sob\s*sesh\s*kore\s*dite\s*chai|bachte\s*iccha\s*kore\s*na|bachte\s*chai\s*na|more\s*jete\s*chai|atmohatya|suicide|suicidal|kill\s*myself|end\s*my\s*life|don'?t\s*want\s*to\s*live|want\s*to\s*die|self[\s-]*harm|no\s*reason\s*to\s*live)/i;

const ABUSE_VIOLENCE_RE =
  /(?:নারী\s*নির্যাতন|শিশু\s*নির্যাতন|ঘরোয়া\s*নির্যাতন|স্বামী\s*মারধর|মারধর\s*করছে|যৌতুক|ধর্ষণ|যৌন\s*হয়রানি|শিশু\s*হারিয়ে|বাচ্চা\s*হারিয়ে|বাচ্চা\s*খুঁজে\s*পাচ্ছি\s*না|বাল্যবিবাহ|domestic\s*violence|beating\s*me|sexual\s*assault|rape|child\s*abuse|missing\s*child|child\s*marriage|dowry\s*violence|harassment\s*at\s*home)/i;

export function detectCrisisCategory(message: string): CrisisCategory {
  const text = message.trim();
  if (!text) return null;
  if (SELF_HARM_RE.test(text)) return 'crisis_self_harm';
  if (ABUSE_VIOLENCE_RE.test(text)) return 'abuse_violence';
  return null;
}

export interface CrisisResponsePayload {
  intent: 'crisis_self_harm' | 'abuse_violence';
  reply: string;
  citations: JonoCitation[];
  actionCards: JonoActionCard[];
  suggestions: string[];
}

export function buildCrisisResponse(
  category: 'crisis_self_harm' | 'abuse_violence',
  locale: 'bn' | 'en',
): CrisisResponsePayload {
  if (category === 'crisis_self_harm') {
    const reply =
      locale === 'bn'
        ? 'আপনার কষ্টের কথা শুনে আমরা আন্তরিকভাবে উদ্বিগ্ন। অনুগ্রহ করে জানবেন — **আপনি একা নন**, এবং এই কঠিন মুহূর্তে সাহায্য চাওয়া সাহসের কাজ।\n\n' +
          '- **এখনই কারো সাথে কথা বলুন:** আপনার বিশ্বস্ত কোনো পরিবারের সদস্য, বন্ধু বা কাছের মানুষকে এই মুহূর্তে ফোন করুন বা কাছে ডাকুন।\n' +
          '- **তাৎক্ষণিক শারীরিক ঝুঁকিতে:** এখনই **999** (জাতীয় জরুরি সেবা — বিনামূল্যে, ২৪/৭) নম্বরে কল করুন [1]।\n' +
          '- **স্বাস্থ্য ও মানসিক স্বাস্থ্য পরামর্শ (২৪/৭):** সরকারি **স্বাস্থ্য বাতায়ন 16263** নম্বরে কল করে চিকিৎসকের সহায়তা নিন [1]।\n' +
          '- **নারী ও শিশু সহায়তায়:** **109** (নারী ও শিশু হেল্পলাইন) অথবা **1098** (শিশু হেল্পলাইন) নম্বরে বিনামূল্যে কল করুন [1]।\n' +
          '- *(বিশেষায়িত মানসিক স্বাস্থ্য হেল্পলাইনের তালিকা বর্তমানে যাচাই চলছে।)*\n\n' +
          'আপনি চাইলে এখানে আমার সাথেও কথা চালিয়ে যেতে পারেন। আমি শুনছি।'
        : 'I am truly sorry you are going through such intense pain right now. Please know that **you are not alone**, and support is available.\n\n' +
          '- **Reach out to someone you trust:** Please call or sit with a trusted family member, friend, or neighbor right now.\n' +
          '- **If you are in immediate physical danger:** Call **999** (National Emergency Service — toll-free, 24/7) immediately [1].\n' +
          '- **24/7 Government Health & Medical Guidance:** Call **16263** (Shastho Batayon) to speak with a doctor [1].\n' +
          '- **Women & Child Support Helplines:** Call **109** or **1098** (toll-free, 24/7) [1].\n' +
          '- *(Dedicated mental-health crisis line listings are currently undergoing source verification.)*\n\n' +
          'If you would like to keep talking here, I am here to listen.';

    return {
      intent: 'crisis_self_harm',
      reply,
      citations: [
        {
          index: 1,
          title:
            locale === 'bn'
              ? 'জাতীয় জরুরি ও স্বাস্থ্য হেল্পলাইন (৯৯৯, ১৬২৬৩, ১০৯, ১০৯৮)'
              : 'National Emergency & Health Helplines (999, 16263, 109, 1098)',
          agency: 'Bangladesh Police / DGHS / MoWCA / DSS',
          sourceUrl: 'https://nhd.gov.bd',
          trustLabel: 'OFFICIAL_SOURCE',
          lastVerifiedAt: '2026-11-15T00:00:00Z',
          excerpt: '999 Emergency (24/7), 16263 Shastho Batayon (24/7), 109 MoWCA, 1098 DSS.',
        },
      ],
      actionCards: [
        {
          type: 'emergency_call',
          label: locale === 'bn' ? '999 — জাতীয় জরুরি সেবা (২৪/৭)' : 'Call 999 — National Emergency (24/7)',
          phone: '999',
          url: 'tel:999',
          trustLabel: 'OFFICIAL_SOURCE',
        },
        {
          type: 'emergency_call',
          label: locale === 'bn' ? '16263 — স্বাস্থ্য বাতায়ন (২৪/৭ ডাক্তার)' : 'Call 16263 — Shastho Batayon (24/7)',
          phone: '16263',
          url: 'tel:16263',
          trustLabel: 'OFFICIAL_SOURCE',
        },
        {
          type: 'emergency_call',
          label: locale === 'bn' ? '109 — সহায়তা হেল্পলাইন (বিনামূল্যে)' : 'Call 109 — Support Helpline (Toll-Free)',
          phone: '109',
          url: 'tel:109',
          trustLabel: 'OFFICIAL_SOURCE',
        },
      ],
      suggestions:
        locale === 'bn'
          ? ['নিকটস্থ সরকারি হাসপাতাল কোথায়?', '১৬২৬৩ স্বাস্থ্য বাতায়ন কী?', '৯৯৯ জরুরি সেবা', 'সরকারি আইনি সহায়তা ১৬৪৩০']
          : ['Nearest government hospital', 'What is 16263 Shastho Batayon?', '999 emergency help', 'Free legal aid 16430'],
    };
  }

  // abuse_violence
  const reply =
    locale === 'bn'
      ? 'আপনার বা আপনার আশেপাশের কারো নিরাপত্তার বিষয়টি অত্যন্ত গুরুত্বপূর্ণ। **আপনি একা নন** — সরকারি জরুরি ও সুরক্ষা সেবা ২৪ ঘণ্টা আপনার পাশে আছে:\n\n' +
        '- **তাৎক্ষণিক বিপদে পুলিশি উদ্ধার:** এখনই **999** নম্বরে কল করুন [1]।\n' +
        '- **নারী ও শিশু নির্যাতন প্রতিরোধ হেল্পলাইন:** **109** (বিনামূল্যে, ২৪/৭, মহিলা ও শিশু বিষয়ক মন্ত্রণালয়) [1]।\n' +
        '- **শিশু সুরক্ষা ও হারানো শিশু সহায়তা:** **1098** (চাইল্ড হেল্পলাইন, বিনামূল্যে, ২৪/৭) [1]।\n' +
        '- **বিনামূল্যে সরকারি আইনি সহায়তা:** **16430** (জাতীয় আইনগত সহায়তা প্রদান সংস্থা) [1]।\n\n' +
        'নিরাপদ স্থানে থাকুন এবং প্রয়োজনে বিশ্বস্ত কারো সহায়তা নিন। আমি আর কীভাবে সাহায্য করতে পারি জানাবেন।'
      : 'Your safety and the safety of those around you come first. **You are not alone** — official 24/7 protection services are ready to help:\n\n' +
        '- **Immediate Police Rescue:** Call **999** right away [1].\n' +
        '- **Violence Against Women & Children Helpline:** Call **109** (toll-free, 24/7, MoWCA) [1].\n' +
        '- **Child Protection & Missing Child Helpline:** Call **1098** (toll-free, 24/7, DSS) [1].\n' +
        '- **Free Government Legal Aid:** Call **16430** (NLASO) [1].\n\n' +
        'Please stay in a safe place if possible. Let me know if you need the nearest hospital, police station, or shelter.';

  return {
    intent: 'abuse_violence',
    reply,
    citations: [
      {
        index: 1,
        title:
          locale === 'bn'
            ? 'নারী ও শিশু সুরক্ষা এবং জরুরি হেল্পলাইন (৯৯৯, ১০৯, ১০৯৮, ১৬৪৩০)'
            : 'Women & Child Protection and Emergency Helplines (999, 109, 1098, 16430)',
        agency: 'Bangladesh Police / MoWCA / DSS / NLASO',
        sourceUrl: 'https://nhd.gov.bd',
        trustLabel: 'OFFICIAL_SOURCE',
        lastVerifiedAt: '2026-11-15T00:00:00Z',
        excerpt: '999 Police Rescue, 109 Women & Children Helpline, 1098 Child Helpline, 16430 Legal Aid.',
      },
    ],
    actionCards: [
      {
        type: 'emergency_call',
        label: locale === 'bn' ? '999 — তাৎক্ষণিক পুলিশ সহায়তা' : 'Call 999 — Immediate Police Help',
        phone: '999',
        url: 'tel:999',
        trustLabel: 'OFFICIAL_SOURCE',
      },
      {
        type: 'emergency_call',
        label: locale === 'bn' ? '109 — নারী ও শিশু হেল্পলাইন' : 'Call 109 — Women & Children Helpline',
        phone: '109',
        url: 'tel:109',
        trustLabel: 'OFFICIAL_SOURCE',
      },
      {
        type: 'emergency_call',
        label: locale === 'bn' ? '1098 — চাইল্ড হেল্পলাইন' : 'Call 1098 — Child Helpline',
        phone: '1098',
        url: 'tel:1098',
        trustLabel: 'OFFICIAL_SOURCE',
      },
    ],
    suggestions:
      locale === 'bn'
        ? ['সরকারি আইনি সহায়তা ১৬৪৩০', 'অনলাইন জিডি করার নিয়ম', 'নিকটস্থ হাসপাতাল', 'পুলিশ সাইবার সাপোর্ট ফর উইমেন']
        : ['Free government legal aid 16430', 'How to file an online GD', 'Nearest hospital', 'Police Cyber Support for Women'],
  };
}
