import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';

export interface AssistedSession {
  id: string;
  operatorId: string;
  centerName: string;
  citizenConsentCaptured: boolean;
  consentMethod: 'VERBAL_WITNESSED' | 'OTP_SMS' | 'SIGNED_PAPER';
  purposeEn: string;
  purposeBn: string;
  serviceCategory: string;
  createdAt: string;
  expiresAt: string;
  storesThirdPartySecrets: false;
}

@Injectable()
export class InclusionService {
  private readonly assistedSessions = new Map<string, AssistedSession>();
  private readonly optedOutPhones = new Set<string>();

  handleInboundSms(params: { from: string; text: string; locale?: 'bn' | 'en' }) {
    const clean = params.text.trim();
    const upper = clean.toUpperCase();
    const locale: 'bn' | 'en' = params.locale ?? (/[\u0980-\u09FF]/.test(clean) ? 'bn' : 'en');

    if (upper === 'STOP' || clean === 'বন্ধ') {
      this.optedOutPhones.add(params.from);
      return {
        optedOut: true,
        reply:
          locale === 'bn'
            ? 'জনসেবা SMS সতর্কতা বন্ধ করা হয়েছে। পুনরায় চালু করতে START লিখুন।'
            : 'Jonoshheba SMS alerts stopped. Reply START to re-subscribe.',
      };
    }

    // Rule R8: Emergency first
    if (upper.includes('999') || upper.includes('HELP') || clean.includes('জরুরি')) {
      return {
        intent: 'emergency',
        priority: 'P0',
        reply:
          locale === 'bn'
            ? 'জরুরি বিপদে কল করুন: 999 (পুলিশ/ফায়ার/অ্যাম্বুলেন্স), 333 (সরকারি সেবা), 16263 (স্বাস্থ্য)।'
            : 'Emergency: Call 999 (Police/Fire/Ambulance), 333 (Gov Info), 16263 (Health).',
      };
    }

    if (upper.startsWith('TRAIN') || clean.includes('ট্রেন')) {
      return {
        intent: 'transport',
        reply:
          locale === 'bn'
            ? 'রেল টিকিট শুধুমাত্র eticket.railway.gov.bd এ পাওয়া যায় (সংরক্ষিত নয়)। জনসেবা স্বাধীন প্ল্যাটফর্ম।'
            : 'Railway tickets are sold only at eticket.railway.gov.bd (Not reserved). Independent platform.',
      };
    }

    if (upper.startsWith('BHATA') || clean.includes('ভাতা')) {
      return {
        intent: 'benefit',
        reply:
          locale === 'bn'
            ? 'বয়স্ক/বিধবা/প্রতিবন্ধী ভাতার অফিসিয়াল আবেদন: mis.bhata.gov.bd বা ইউনিয়ন সমাজসেবা অফিস।'
            : 'Check & apply for DSS allowances at mis.bhata.gov.bd or Union Social Services office.',
      };
    }

    if (upper.startsWith('SERVICE') || clean.includes('জন্ম')) {
      return {
        intent: 'service',
        reply:
          locale === 'bn'
            ? 'জন্ম নিবন্ধন: bdris.gov.bd (৪৫ দিন পর্যন্ত ফ্রি)। ই-পাসপোর্ট: epassport.gov.bd। কল: 333।'
            : 'Birth Reg: bdris.gov.bd (Free <=45d). e-Passport: epassport.gov.bd. Info: 333.',
      };
    }

    return {
      intent: 'menu',
      reply:
        locale === 'bn'
          ? 'জনসেবা SMS: লিখুন 999 (জরুরি), TRAIN (ট্রেন), SERVICE (সেবা), BHATA (ভাতা), STOP (বন্ধ)।'
          : 'Jonoshheba SMS: Reply 999 (Emergency), TRAIN, SERVICE, BHATA, or STOP.',
    };
  }

  handleUssd(params: { sessionId: string; text: string; locale?: 'bn' | 'en' }) {
    const input = params.text.trim();
    const bn = (params.locale ?? 'bn') === 'bn';

    if (!input) {
      return {
        action: 'CON',
        response: bn
          ? 'জনসেবা AI (স্বাধীন সেবা)\n1. জরুরি ৯৯৯\n2. ট্রেন/বাস তথ্য\n3. সরকারি সেবা\n4. ভাতা ও বৃত্তি\n5. অভিযোগ (GRS)'
          : 'Jonoshheba AI (Independent)\n1. Emergency 999\n2. Train/Bus Info\n3. Gov Services\n4. Allowances\n5. Complaints (GRS)',
      };
    }

    const parts = input.split('*');
    const root = parts[0];

    if (root === '1') {
      return {
        action: 'END',
        response: bn
          ? 'তাৎক্ষণিক বিপদে কল করুন:\n999: পুলিশ/ফায়ার/অ্যাম্বুলেন্স\n16263: স্বাস্থ্য\n333: সরকারি তথ্য'
          : 'Call immediately:\n999: Police/Fire/Ambulance\n16263: Health\n333: Gov Info',
      };
    }
    if (root === '2') {
      return {
        action: 'END',
        response: bn
          ? 'রেলওয়ে টিকিট: eticket.railway.gov.bd (যাত্রার ১০ দিন আগে ছাড়ে)। জনসেবা আসন বুক করে না।'
          : 'Railway e-Tickets: eticket.railway.gov.bd (10d advance). Jonoshheba does not reserve seats.',
      };
    }
    if (root === '3') {
      return {
        action: 'END',
        response: bn
          ? 'জন্ম নিবন্ধন: bdris.gov.bd\nপাসপোর্ট: epassport.gov.bd\nনামজারি: land.gov.bd'
          : 'Birth Reg: bdris.gov.bd\ne-Passport: epassport.gov.bd\nNamjari: land.gov.bd',
      };
    }
    if (root === '4') {
      return {
        action: 'END',
        response: bn
          ? 'বয়স্ক ভাতা (পুরুষ ৬৫+, নারী ৬২+), বিধবা ও প্রতিবন্ধী ভাতা: mis.bhata.gov.bd'
          : 'Old Age (M 65+, F 62+), Widow & Disability allowances: mis.bhata.gov.bd',
      };
    }
    if (root === '5') {
      return {
        action: 'END',
        response: bn
          ? 'সরকারি সেবায় অভিযোগ করতে ভিজিট করুন: grs.gov.bd অথবা কল করুন ৩৩৩।'
          : 'File official public-service grievances at grs.gov.bd or call 333.',
      };
    }

    return {
      action: 'END',
      response: bn ? 'সঠিক বিকল্প (1-5) নির্বাচন করুন।' : 'Please select a valid option (1-5).',
    };
  }

  buildIvrTwiml(digit?: string): string {
    if (digit === '1') {
      return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<Response>',
        '  <Say language="bn-BD">তাৎক্ষণিক বিপদে দয়া করে এখনই ৯৯৯ নম্বরে কল করুন। পুলিশ, ফায়ার সার্ভিস এবং অ্যাম্বুলেন্স ২৪ ঘণ্টা ফ্রি।</Say>',
        '  <Say language="en-US">In immediate danger, please hang up and dial 9 9 9 right now for free Police, Fire, or Ambulance dispatch.</Say>',
        '</Response>',
      ].join('\n');
    }
    if (digit === '2') {
      return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<Response>',
        '  <Say language="en-US">Official Bangladesh Railway tickets are sold only on e-ticket dot railway dot gov dot b-d. Jonoshheba is an independent guidance platform.</Say>',
        '</Response>',
      ].join('\n');
    }
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Response>',
      '  <Gather numDigits="1" action="/api/v1/channels/ivr" method="POST">',
      '    <Say language="bn-BD">জনসেবা এআই স্বাধীন নাগরিক তথ্য সেবায় স্বাগতম। জরুরি ৯৯৯ তথ্যের জন্য ১ চাপুন। ট্রেন ও পরিবহন তথ্যের জন্য ২ চাপুন।</Say>',
      '    <Say language="en-US">Welcome to Jonoshheba AI, an independent citizen guidance service. Press 1 for Emergency 999 info. Press 2 for transport guidance.</Say>',
      '  </Gather>',
      '</Response>',
    ].join('\n');
  }

  createAssistedSession(params: {
    operatorId: string;
    centerName: string;
    consentMethod: 'VERBAL_WITNESSED' | 'OTP_SMS' | 'SIGNED_PAPER';
    serviceCategory: string;
  }): AssistedSession {
    const now = Date.now();
    const session: AssistedSession = {
      id: randomUUID(),
      operatorId: params.operatorId,
      centerName: params.centerName,
      citizenConsentCaptured: true,
      consentMethod: params.consentMethod,
      purposeEn: 'One-time assisted citizen guidance at Union Digital Centre / community helpdesk.',
      purposeBn: 'ইউনিয়ন ডিজিটাল সেন্টারে নাগরিকের সম্মতিতে একবারের জন্য সেবা নির্দেশনা সহায়তা।',
      serviceCategory: params.serviceCategory,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 30 * 60 * 1000).toISOString(),
      storesThirdPartySecrets: false,
    };
    this.assistedSessions.set(session.id, session);
    return session;
  }

  getAssistedSession(id: string): AssistedSession {
    const sess = this.assistedSessions.get(id);
    if (!sess) {
      throw new NotFoundException(`Assisted session '${id}' not found`);
    }
    return sess;
  }
}
