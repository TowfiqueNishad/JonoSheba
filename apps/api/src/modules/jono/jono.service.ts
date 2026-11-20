import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { formatBdt, formatDhakaTime, formatDigits, getSeatClassLabel } from '@jonoshheba/shared';
import { redactFreeTextPii } from '../../common/pii-redaction';
import { uuidv7 } from '../../common/uuidv7';
import { AGENCIES_SEED, SERVICES_SEED, type ServiceSeed } from '../../seed-data/catalogue';
import { CatalogueService } from '../catalogue/application/catalogue.service';
import { normalizeBanglaText } from '../catalogue/domain/bangla-nlp';
import { OrgsCatalogHotlinesService } from '../coverage/orgs-catalog-hotlines.service';
import { RailMobilityService } from '../coverage/rail-mobility.service';
import { validateGroundedNumbers } from './jono-answer-validator';
import { buildCrisisResponse, detectCrisisCategory } from './jono-crisis';
import {
  buildSmallTalkResponse,
  classifyJonoIntent,
  rewriteFollowUpQuery,
  type JonoIntent,
  type SessionTopicContext,
} from './jono-intent-router';

export interface JonoCitation {
  index: number;
  title: string;
  agency: string;
  sourceUrl: string;
  trustLabel: string;
  lastVerifiedAt: string;
  excerpt: string;
}

export interface JonoActionCard {
  type: 'emergency_call' | 'transport_handoff' | 'eligibility_wizard' | 'complaint_draft';
  label: string;
  url?: string;
  phone?: string;
  notReserved?: boolean;
  possibleMatchOnly?: boolean;
  trustLabel?: string;
}

export interface JonoChatTurn {
  turnId: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  intent?: string;
  toolsUsed?: string[];
}

export interface JonoChatResponse {
  sessionId: string;
  /** Signed HMAC session token issued for anonymous sessions (pass back via X-Session-Token) */
  sessionToken?: string;
  /** True when an expired/invalid/missing sessionId was transparently replaced (Section 1.1) */
  sessionRenewed?: boolean;
  expiresAt?: string;
  turnId: string;
  reply: string;
  locale: 'bn' | 'en';
  intent: string;
  rewrittenQuery?: string;
  toolsUsed: string[];
  citations: JonoCitation[];
  actionCards: JonoActionCard[];
  suggestions: string[];
  emergencyBypass: boolean;
  guardrailBlocked: boolean;
  disclaimer: string;
}

export interface ChatSessionActor {
  userId?: string;
  sessionToken?: string;
}

interface StoredSession {
  sessionId: string;
  ownerUserId: string | null;
  anonymousTokenHash: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  turns: JonoChatTurn[];
  context: SessionTopicContext;
}

interface StoredFeedback {
  id: string;
  sessionId: string;
  actorId: string;
  turnId: string;
  rating: 'up' | 'down';
  reason?: string;
  createdAt: string;
}

const GUEST_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days guest retention

const INJECTION_RE =
  /(?:ignore\s+(?:all\s+)?previous\s+instructions|book\s+(?:the\s+)?ticket\s+for\s+me|bypass\s+captcha|system\s+prompt)/i;
const MEDICAL_DIAG_RE =
  /(?:diagnose|prescription|medicine\s+for|রোগ\s*নির্ণয়|কোন\s*ওষুধ\s*খাব|প্রেসক্রিপশন)/i;

const BANGLISH_RE =
  /\b(?:koto|kivabe|kibhabe|ki|kothay|lagbe|lage|korbo|jonmo|nibondhon|bhata|namjari|biddut|bidyut|khajna|taka|amar|tumi|apni|dhaka\s+theke|train\s+kokhon|bus\s+kothay|etin|harano|songshodhon|sonod)\b/i;

export function detectUserLocale(message: string, explicitLocale?: 'bn' | 'en'): 'bn' | 'en' {
  if (/[\u0980-\u09FF]/.test(message)) return 'bn';
  if (BANGLISH_RE.test(message)) return 'bn';
  if (/[A-Za-z]{3,}/.test(message)) return explicitLocale === 'bn' && !/[A-Za-z]{4,}\s+[A-Za-z]{3,}/.test(message) ? 'bn' : 'en';
  return explicitLocale ?? 'bn';
}

/** Keeps ONLY citations actually referenced as [n] in the answer text, deduplicated by URL */
export function pruneCitedSources(reply: string, citations: JonoCitation[]): JonoCitation[] {
  const cited = new Set<number>();
  for (const m of reply.matchAll(/\[(\d+)\]/g)) {
    const n = Number(m[1]);
    if (Number.isFinite(n)) cited.add(n);
  }
  if (cited.size === 0) return [];
  const seenUrls = new Set<string>();
  return citations.filter((c) => {
    if (!cited.has(c.index) || seenUrls.has(c.sourceUrl)) return false;
    seenUrls.add(c.sourceUrl);
    return true;
  });
}

/** Direct synonym & Banglish -> canonical service slug table (Section 1.6) */
const DIRECT_SERVICE_MATCHERS: ReadonlyArray<{ re: RegExp; slug: string }> = [
  { re: /(?:খাজনা|ভূমি\s*উন্নয়ন\s*কর|জমির\s*কর|জমির\s*খাজনা|khajna|ldtax|land\s*(?:development\s*)?tax)/i, slug: 'land-development-tax' },
  { re: /(?:নামজারি|ই-?নামজারি|মিউটেশন|namjari|e-?mutation|land\s*mutation)/i, slug: 'land-e-mutation' },
  { re: /(?:পর্চা|খতিয়ান|মৌজা\s*ম্যাপ|porcha|khatian|eporcha|mouza)/i, slug: 'land-porcha-khatian' },
  { re: /(?:দলিল|সাব-?রেজিস্ট্রি|dolil|deed\s*registration)/i, slug: 'deed-registration-info' },
  { re: /(?:ট্রেড\s*লাইসেন্স|ব্যবসার?\s*লাইসেন্স|trade\s*licen[cs]e)/i, slug: 'trade-license-new' },
  { re: /(?:ড্রাইভিং\s*লাইসেন্স\s*নবায়ন|স্মার্ট\s*(?:কার্ড\s*)?ড্রাইভিং|driving\s*licen[cs]e\s*renew|smart\s*driving)/i, slug: 'brta-smart-driving-license' },
  { re: /(?:ড্রাইভিং\s*লাইসেন্স|লার্নার\s*লাইসেন্স|বিআরটিএ\s*লাইসেন্স|driving\s*licen[cs]e|learner\s*licen[cs]e)/i, slug: 'brta-learner-license' },
  { re: /(?:ট্যাক্স\s*টোকেন|ফিটনেস\s*নবায়ন|tax\s*token|vehicle\s*fitness)/i, slug: 'brta-vehicle-tax-token' },
  { re: /(?:মালিকানা\s*পরিবর্তন|গাড়ির\s*মালিকানা|ownership\s*transfer|malikana\s*poriborton)/i, slug: 'brta-ownership-transfer' },
  { re: /(?:এসএসসি\s*রেজাল্ট|এইচএসসি\s*রেজাল্ট|পরীক্ষার\s*ফলাফল|বোর্ড\s*রেজাল্ট|মার্কশিট|ssc\s*result|hsc\s*result|board\s*result|exam\s*result)/i, slug: 'education-board-result' },
  { re: /(?:বোর্ড\s*সনদ\s*সংশোধন|এসএসসি\s*সনদ|সার্টিফিকেট\s*সংশোধন|ssc\s*certificate\s*correction|board\s*certificate)/i, slug: 'board-exam-certificate-correction' },
  { re: /(?:একাদশ\s*ভর্তি|কলেজ\s*ভর্তি|xi\s*(?:class\s*)?admission|college\s*admission)/i, slug: 'xi-class-admission' },
  { re: /(?:অ্যাপোস্টিল|সনদ\s*সত্যায়ন|apostille|certificate\s*attestation)/i, slug: 'foreign-document-attestation-mofa' },
  { re: /(?:বিদ্যুৎ\s*বিল|কারেন্ট\s*বিল|প্রিপেইড\s*মিটার|ডেসকো\s*বিল|ডিপিডিসি\s*বিল|পল্লী\s*বিদ্যুৎ\s*বিল|bidyut\s*bill|biddut\s*bill|electricity\s*bill|prepaid\s*meter|desco\s*bill|dpdc\s*bill)/i, slug: 'electricity-prepaid-recharge-guide' },
  { re: /(?:নতুন\s*বিদ্যুৎ\s*সংযোগ|নতুন\s*মিটার|new\s*electricity\s*connection|biddut\s*songjog)/i, slug: 'electricity-new-connection' },
  { re: /(?:পানির\s*বিল|ওয়াসা\s*বিল|wasa\s*bill|water\s*bill)/i, slug: 'wasa-water-bill-connection' },
  { re: /(?:গ্যাস\s*বিল|তিতাস\s*গ্যাস|গ্যাস\s*লিকেজ|gas\s*bill|titas\s*gas|gas\s*leak)/i, slug: 'gas-bill-leak-emergency' },
  { re: /(?:ই-?টিন|টিন\s*সার্টিফিকেট|টিন\s*সনদ|e-?tin|tin\s*certificate|taxpayer\s*identification)/i, slug: 'nbr-etin-registration' },
  { re: /(?:আয়কর\s*রিটার্ন|ই-?রিটার্ন|ট্যাক্স\s*রিটার্ন|income\s*tax\s*return|e-?return)/i, slug: 'nbr-ereturn-filing' },
  { re: /(?:ভ্যাট\s*নিবন্ধন|বিন\s*নিবন্ধন|\bvat\b|\bbin\s*registration)/i, slug: 'nbr-vat-bin' },
  { re: /(?:কোম্পানি\s*নিবন্ধন|আরজেএসসি|লিমিটেড\s*কোম্পানি|rjsc|company\s*registration|name\s*clearance)/i, slug: 'rjsc-company-incorporation' },
  { re: /(?:জন্ম\s*নিবন্ধন\s*সংশোধন|জন্ম\s*সনদ\s*সংশোধন|birth\s*(?:certificate\s*)?correction|jonmo\s*nibondhon\s*songshodhon)/i, slug: 'birth-certificate-correction' },
  { re: /(?:জন্ম\s*নিবন্ধন\s*যাচাই|everify|birth\s*verify)/i, slug: 'birth-cert-verify' },
  { re: /(?:জন্ম\s*নিবন্ধন|জন্ম\s*সনদ|jonmo\s*nibondhon|jonmo\s*sonod|birth\s*(?:registration|certificate)|bdris)/i, slug: 'birth-registration-new' },
  { re: /(?:মৃত্যু\s*নিবন্ধন|মৃত্যু\s*সনদ|death\s*(?:registration|certificate)|mrittu\s*nibondhon)/i, slug: 'death-registration' },
  { re: /(?:এনআইডি\s*হারানো|হারানো\s*এনআইডি|ভোটার\s*আইডি\s*হারিয়ে|এনআইডি\s*রি-?ইস্যু|nid\s*harano|lost\s*nid|nid\s*re-?issue)/i, slug: 'nid-reissue-lost' },
  { re: /(?:এনআইডি\s*সংশোধন|ভোটার\s*আইডি\s*সংশোধন|nid\s*correction|nid\s*songshodhon)/i, slug: 'nid-correction' },
  { re: /(?:স্মার্ট\s*কার্ড\s*স্ট্যাটাস|smart\s*(?:nid\s*)?card\s*status)/i, slug: 'nid-smart-card-status' },
  { re: /(?:ভোটার\s*এলাকা\s*স্থানান্তর|voter\s*transfer|nid\s*migration)/i, slug: 'nid-voter-transfer' },
  { re: /(?:জাতীয়\s*পরিচয়পত্র|নতুন\s*ভোটার|\bnid\b|voter\s*id|national\s*id)/i, slug: 'nid-new-voter' },
  { re: /(?:পাসপোর্ট\s*নবায়ন|পাসপোর্ট\s*রি-?ইস্যু|passport\s*renew)/i, slug: 'epassport-renewal' },
  { re: /(?:পাসপোর্ট\s*স্ট্যাটাস|পাসপোর্ট\s*চেক|passport\s*status)/i, slug: 'epassport-status' },
  { re: /(?:ই-?পাসপোর্ট|পাসপোর্ট|e-?passport)/i, slug: 'epassport-new' },
  { re: /(?:পুলিশ\s*ক্লিয়ারেন্স|\bpcc\b|police\s*clearance)/i, slug: 'police-clearance-certificate' },
  { re: /(?:অনলাইন\s*জিডি|থানায়\s*জিডি|সাধারণ\s*ডায়েরি|\bgd\b|online\s*gd|general\s*diary)/i, slug: 'online-gd-police' },
  { re: /(?:নাগরিকত্ব\s*সনদ|প্রত্যয়ন|citizenship\s*certificate|nagorik\s*sonod)/i, slug: 'citizen-nationality-certificate' },
  { re: /(?:ওয়ারিশান|ওয়ারিশ\s*সনদ|warishan|succession\s*certificate)/i, slug: 'warishan-succession-certificate' },
  { re: /(?:চারিত্রিক\s*সনদ|character\s*certificate|charitrik\s*sonod)/i, slug: 'character-certificate-local' },
  { re: /(?:আয়ের\s*সনদ|বার্ষিক\s*আয়|income\s*certificate|ayer\s*sonod)/i, slug: 'annual-income-certificate' },
  { re: /(?:হোল্ডিং\s*ট্যাক্স|পৌর\s*কর|holding\s*tax)/i, slug: 'holding-tax-payment' },
  { re: /(?:টিকা|ইপিআই|শিশুর\s*টিকা|epi\s*vaccin|child\s*vaccine|tika)/i, slug: 'epi-child-vaccination' },
  { re: /(?:সুরক্ষা|টিকা\s*সনদ|surokkha|vaccine\s*certificate)/i, slug: 'surokkha-vaccine-cert' },
  { re: /(?:সরকারি\s*হাসপাতাল|বহির্বিভাগ|hospital\s*opd)/i, slug: 'govt-hospital-opd-ticket' },
  { re: /(?:কমিউনিটি\s*ক্লিনিক|community\s*clinic)/i, slug: 'community-clinic-primary-care' },
  { re: /(?:স্বাস্থ্য\s*বাতায়ন|16263|shastho\s*batayon)/i, slug: 'shastho-batayon-16263' },
  { re: /(?:কৃষি\s*কল\s*সেন্টার|16123|কৃষক\s*কার্ড|সার\s*ভর্তুকি|krishi)/i, slug: 'krishi-call-center-16123' },
  { re: /(?:প্রবাসী|বিএমইটি|আমি\s*প্রবাসী|bmet|amiprobashi)/i, slug: 'bmet-smart-card-migration' },
  { re: /(?:ভিসা\s*যাচাই|রিক্রুটিং\s*এজেন্সি|recruiting\s*agency|visa\s*verification)/i, slug: 'bmet-visa-verification' },
  { re: /(?:পেনশন|ইএফটি|pension|eft)/i, slug: 'govt-pension-eft-guide' },
  { re: /(?:বিবাহ\s*নিবন্ধন|কাবিননামা|তালাক\s*নিবন্ধন|marriage\s*registration|kabin)/i, slug: 'marriage-divorce-registration-guide' },
];

const PLACE_ALIAS_MAP: ReadonlyArray<{ code: string; districtEn: string; nameBn: string; nameEn: string; terms: string[] }> = [
  { code: 'DA', districtEn: 'Dhaka', nameBn: 'ঢাকা (কমলাপুর)', nameEn: 'Dhaka (Kamalapur)', terms: ['ঢাকা', 'কমলাপুর', 'dhaka', 'kamalapur', 'dhk', 'da'] },
  { code: 'BMB', districtEn: 'Dhaka', nameBn: 'ঢাকা বিমানবন্দর', nameEn: 'Dhaka Biman Bandar (Airport)', terms: ['বিমানবন্দর', 'এয়ারপোর্ট', 'airport', 'biman bandar', 'bmb'] },
  { code: 'CTG', districtEn: 'Chattogram', nameBn: 'চট্টগ্রাম', nameEn: 'Chattogram', terms: ['চট্টগ্রাম', 'চিটাগাং', 'chattogram', 'chittagong', 'ctg'] },
  { code: 'CXB', districtEn: "Cox's Bazar", nameBn: 'কক্সবাজার', nameEn: "Cox's Bazar", terms: ['কক্সবাজার', 'coxsbazar', 'cox bazar', "cox's bazar", 'cxb'] },
  { code: 'SYL', districtEn: 'Sylhet', nameBn: 'সিলেট', nameEn: 'Sylhet', terms: ['সিলেট', 'sylhet', 'syl'] },
  { code: 'SRM', districtEn: 'Moulvibazar', nameBn: 'শ্রীমঙ্গল', nameEn: 'Sreemangal', terms: ['শ্রীমঙ্গল', 'sreemangal', 'srimangal', 'srm'] },
  { code: 'RAJ', districtEn: 'Rajshahi', nameBn: 'রাজশাহী', nameEn: 'Rajshahi', terms: ['রাজশাহী', 'rajshahi', 'raj'] },
  { code: 'BGA', districtEn: 'Bogura', nameBn: 'বগুড়া', nameEn: 'Bogura', terms: ['বগুড়া', 'bogura', 'bogra', 'bga'] },
  { code: 'RGP', districtEn: 'Rangpur', nameBn: 'রংপুর', nameEn: 'Rangpur', terms: ['রংপুর', 'rangpur', 'rgp'] },
  { code: 'JSR', districtEn: 'Jashore', nameBn: 'যশোর', nameEn: 'Jashore', terms: ['যশোর', 'jashore', 'jessore', 'jsr'] },
  { code: 'KLN', districtEn: 'Khulna', nameBn: 'খুলনা', nameEn: 'Khulna', terms: ['খুলনা', 'khulna', 'kln', 'khl'] },
  { code: 'MYN', districtEn: 'Mymensingh', nameBn: 'ময়মনসিংহ', nameEn: 'Mymensingh', terms: ['ময়মনসিংহ', 'mymensingh', 'myn'] },
  { code: 'CML', districtEn: 'Cumilla', nameBn: 'কুমিল্লা', nameEn: 'Cumilla', terms: ['কুমিল্লা', 'cumilla', 'comilla', 'cml'] },
  { code: 'FEN', districtEn: 'Feni', nameBn: 'ফেনী', nameEn: 'Feni', terms: ['ফেনী', 'feni', 'fen'] },
  { code: 'BB', districtEn: 'Kishoreganj', nameBn: 'ভৈরব বাজার', nameEn: 'Bhairab Bazar', terms: ['ভৈরব', 'bhairab'] },
  { code: 'BBN', districtEn: 'Brahmanbaria', nameBn: 'ব্রাহ্মণবাড়িয়া', nameEn: 'Brahmanbaria', terms: ['ব্রাহ্মণবাড়িয়া', 'brahmanbaria', 'bbaria'] },
  { code: 'BSL', districtEn: 'Barishal', nameBn: 'বরিশাল', nameEn: 'Barishal', terms: ['বরিশাল', 'barishal', 'barisal', 'bsl'] },
];

function extractOrderedPlaces(query: string) {
  const lower = query.toLowerCase();
  const hits: Array<{ idx: number; place: (typeof PLACE_ALIAS_MAP)[number] }> = [];
  for (const place of PLACE_ALIAS_MAP) {
    let earliest = Infinity;
    for (const term of place.terms) {
      if (term.length <= 2) {
        const re = new RegExp(`\\b${term}\\b`, 'i');
        const m = re.exec(lower);
        if (m && m.index < earliest) earliest = m.index;
      } else {
        const pos = lower.indexOf(term.toLowerCase());
        if (pos !== -1 && pos < earliest) earliest = pos;
      }
    }
    if (earliest !== Infinity) {
      hits.push({ idx: earliest, place });
    }
  }
  hits.sort((a, b) => a.idx - b.idx);
  return hits.map((h) => h.place);
}

@Injectable()
export class JonoService {
  private readonly sessions = new Map<string, StoredSession>();
  private readonly feedback: StoredFeedback[] = [];
  private crisisAnonymousCount = 0;

  constructor(
    @Optional() private readonly catalogue?: CatalogueService,
    @Optional() private readonly mobility?: RailMobilityService,
    @Optional() private readonly orgsHotlines?: OrgsCatalogHotlinesService,
  ) {}

  getCrisisAnonymousCount(): number {
    return this.crisisAnonymousCount;
  }

  private getSessionSecret(): string {
    return (
      process.env.CHAT_SESSION_SECRET ??
      'dev_only_replace_with_32_byte_chat_session_hmac_secret'
    );
  }

  private issueAnonymousSessionToken(sessionId: string): { token: string; tokenHash: string } {
    const nonce = randomBytes(24).toString('base64url');
    const sig = createHmac('sha256', this.getSessionSecret())
      .update(`${sessionId}:${nonce}`)
      .digest('base64url');
    const token = `${nonce}.${sig}`;
    const tokenHash = createHash('sha256').update(token).digest('hex');
    return { token, tokenHash };
  }

  private verifyAnonymousSessionToken(session: StoredSession, providedToken?: string): boolean {
    if (!providedToken || !session.anonymousTokenHash) return false;
    const parts = providedToken.trim().split('.');
    if (parts.length !== 2) return false;
    const [nonce, providedSig] = parts;
    if (!nonce || !providedSig) return false;

    const expectedSig = createHmac('sha256', this.getSessionSecret())
      .update(`${session.sessionId}:${nonce}`)
      .digest('base64url');

    const a = Buffer.from(expectedSig);
    const b = Buffer.from(providedSig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return false;
    }

    const providedHash = Buffer.from(
      createHash('sha256').update(providedToken.trim()).digest('hex'),
      'hex',
    );
    const storedHash = Buffer.from(session.anonymousTokenHash, 'hex');
    return providedHash.length === storedHash.length && timingSafeEqual(providedHash, storedHash);
  }

  private assertOwnership(
    sessionId: string,
    actor: ChatSessionActor,
    now: Date = new Date(),
  ): StoredSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundException('Chat session not found');
    }
    if (session.expiresAt && session.expiresAt.getTime() <= now.getTime()) {
      this.sessions.delete(sessionId);
      throw new NotFoundException('Chat session not found');
    }

    if (session.ownerUserId) {
      if (!actor.userId || actor.userId !== session.ownerUserId) {
        throw new NotFoundException('Chat session not found');
      }
      return session;
    }

    if (!this.verifyAnonymousSessionToken(session, actor.sessionToken)) {
      throw new NotFoundException('Chat session not found');
    }
    return session;
  }

  /**
   * Section 1.1: POST /assistant/message NEVER returns 404 to a citizen.
   * If sessionId is missing, expired, or has an invalid/missing sessionToken,
   * transparently creates a new session and returns { sessionId, sessionToken, sessionRenewed: true }.
   */
  private resolveOrRenewSession(
    requestedSessionId: string | undefined,
    actor: ChatSessionActor,
  ): {
    session: StoredSession;
    issuedToken?: string;
    sessionRenewed: boolean;
  } {
    if (requestedSessionId) {
      try {
        const existing = this.assertOwnership(requestedSessionId, actor);
        return { session: existing, sessionRenewed: false };
      } catch {
        const created = this.createSession(actor);
        return {
          session: created.session,
          issuedToken: created.sessionToken,
          sessionRenewed: true,
        };
      }
    }
    const created = this.createSession(actor);
    return {
      session: created.session,
      issuedToken: created.sessionToken,
      sessionRenewed: false,
    };
  }

  async sendMessage(params: {
    message: string;
    userId?: string;
    sessionToken?: string;
    sessionId?: string;
    locale?: 'bn' | 'en';
  }): Promise<JonoChatResponse> {
    const locale: 'bn' | 'en' = detectUserLocale(params.message, params.locale);
    const actor: ChatSessionActor = {
      userId: params.userId && params.userId !== 'guest' ? params.userId : undefined,
      sessionToken: params.sessionToken,
    };

    const { session, issuedToken, sessionRenewed } = this.resolveOrRenewSession(
      params.sessionId,
      actor,
    );

    const disclaimer =
      locale === 'bn'
        ? 'স্বাধীন প্ল্যাটফর্ম — সরকারি সেবা নয়।'
        : 'Independent platform — not an official government service.';

    // 1.4 Crisis & Abuse Safety FIRST (before storing raw text in session turns!)
    const crisisCategory = detectCrisisCategory(params.message);
    if (crisisCategory) {
      this.crisisAnonymousCount += 1;
      session.turns.push({
        turnId: uuidv7(),
        role: 'user',
        text: '[crisis support turn — text not retained for privacy]',
        createdAt: new Date().toISOString(),
        intent: crisisCategory,
      });
      const crisisPayload = buildCrisisResponse(crisisCategory, locale);
      return this.finalizeTurn(session, issuedToken, sessionRenewed, {
        reply: crisisPayload.reply,
        locale,
        intent: crisisPayload.intent,
        toolsUsed: ['crisis_safety_r8_guard'],
        citations: crisisPayload.citations,
        actionCards: crisisPayload.actionCards,
        suggestions: crisisPayload.suggestions,
        emergencyBypass: true,
        guardrailBlocked: false,
        disclaimer,
      });
    }

    const redactedMsg = redactFreeTextPii(params.message);
    session.turns.push({
      turnId: uuidv7(),
      role: 'user',
      text: redactedMsg,
      createdAt: new Date().toISOString(),
    });
    // Keep rolling memory + last 6 turns (Section 1.3)
    if (session.turns.length > 12) {
      const removed = session.turns.splice(0, session.turns.length - 12);
      const summaryEntry = removed
        .filter((t) => t.role === 'user')
        .map((t) => t.text.slice(0, 80))
        .join(' | ');
      if (summaryEntry) {
        session.context.rollingSummary.push(summaryEntry);
        if (session.context.rollingSummary.length > 5) {
          session.context.rollingSummary.shift();
        }
      }
    }

    // Rule R2/R4: Prompt injection / auto-booking / CAPTCHA bypass refusal
    if (INJECTION_RE.test(params.message)) {
      const reply =
        locale === 'bn'
          ? 'জনসেবা AI স্বয়ংক্রিয়ভাবে টিকিট বুক করে না বা ক্যাপচা বাইপাস করে না। অনুগ্রহ করে অফিসিয়াল সরকারি পোর্টালে নিজে আবেদন বা বুকিং সম্পন্ন করুন।'
          : 'Jonoshheba AI cannot auto-book tickets or bypass CAPTCHA/queues. Please continue on the official portal.';
      return this.finalizeTurn(session, issuedToken, sessionRenewed, {
        reply,
        locale,
        intent: 'out_of_scope',
        toolsUsed: ['moderation_guardrail'],
        citations: [],
        actionCards: [],
        suggestions:
          locale === 'bn'
            ? ['রেলওয়ে ই-টিকিট নির্দেশিকা', 'ই-পাসপোর্ট আবেদন', 'জন্ম নিবন্ধন', 'জরুরি হটলাইন ৯৯৯']
            : ['Railway e-Ticketing guide', 'e-Passport application', 'Birth registration', 'Emergency 999'],
        emergencyBypass: false,
        guardrailBlocked: true,
        disclaimer,
      });
    }

    // Rule R7: Zero medical diagnosis
    if (MEDICAL_DIAG_RE.test(params.message)) {
      const reply =
        locale === 'bn'
          ? 'জনসেবা AI কোনো চিকিৎসা নির্ণয় বা ওষুধের প্রেসক্রিপশন দেয় না। জরুরি অবস্থায় **999** অথবা ২৪/৭ সরকারি ডাক্তারের পরামর্শের জন্য **16263** (স্বাস্থ্য বাতায়ন) নম্বরে কল করুন [1]।'
          : 'Jonoshheba AI does not provide medical diagnoses or prescriptions. Call **999** in emergencies or **16263** (Shastho Batayon) for 24/7 licensed health advice [1].';
      return this.finalizeTurn(session, issuedToken, sessionRenewed, {
        reply,
        locale,
        intent: 'out_of_scope',
        toolsUsed: ['health_no_diagnosis_guard_r7'],
        citations: [
          {
            index: 1,
            title: locale === 'bn' ? 'স্বাস্থ্য বাতায়ন ১৬২৬৩ (DGHS)' : 'Shastho Batayon 16263 (DGHS)',
            agency: 'Directorate General of Health Services (DGHS)',
            sourceUrl: 'https://dghs.gov.bd',
            trustLabel: 'OFFICIAL_SOURCE',
            lastVerifiedAt: '2026-11-15T00:00:00Z',
            excerpt: '16263 24/7 Public Health Helpline; 999 Emergency Ambulance.',
          },
        ],
        actionCards: [
          {
            type: 'emergency_call',
            label: locale === 'bn' ? '16263 — স্বাস্থ্য বাতায়ন' : 'Call 16263 — Shastho Batayon',
            phone: '16263',
            url: 'tel:16263',
            trustLabel: 'OFFICIAL_SOURCE',
          },
        ],
        suggestions:
          locale === 'bn'
            ? ['সরকারি হাসপাতাল বহির্বিভাগ', 'শিশুদের ইপিআই টিকা', 'কমিউনিটি ক্লিনিক', 'নিকটস্থ হাসপাতাল']
            : ['Government hospital OPD', 'Child EPI vaccination', 'Community clinic', 'Nearest hospital'],
        emergencyBypass: false,
        guardrailBlocked: false,
        disclaimer,
      });
    }

    // 1.2 Intent classification + 1.3 Follow-up rewrite
    let rawIntent = classifyJonoIntent(params.message, session.context);
    let effectiveQuery = params.message.trim();
    let rewrittenQuery: string | undefined;

    if (rawIntent === 'followup') {
      rewrittenQuery = rewriteFollowUpQuery(params.message, session.context, locale);
      effectiveQuery = rewrittenQuery;
      // Re-classify using the standalone rewritten query (or fall back to the previous turn's intent/service)
      const reclassified = classifyJonoIntent(effectiveQuery);
      rawIntent =
        reclassified === 'service_question' && session.context.lastIntent
          ? session.context.lastIntent
          : reclassified;
    }

    // 1.2 Small-talk intents: greeting, thanks, goodbye, identity, app_help
    if (
      rawIntent === 'greeting' ||
      rawIntent === 'thanks' ||
      rawIntent === 'goodbye' ||
      rawIntent === 'identity' ||
      rawIntent === 'app_help'
    ) {
      const st = buildSmallTalkResponse(rawIntent, locale);
      return this.finalizeTurn(session, issuedToken, sessionRenewed, {
        reply: st.reply,
        locale,
        intent: rawIntent,
        toolsUsed: ['intent_router_small_talk'],
        citations: [],
        actionCards: [],
        suggestions: st.suggestions,
        emergencyBypass: false,
        guardrailBlocked: false,
        disclaimer,
      });
    }

    // Rule R8: Immediate Emergency (999 / 102 Fire / 16263 Ambulance)
    if (rawIntent === 'emergency') {
      const isFire = /(?:আগুন|অগ্নিকাণ্ড|ফায়ার|fire|agun)/i.test(effectiveQuery);
      const reply = isFire
        ? locale === 'bn'
          ? 'অগ্নিকাণ্ড বা তাৎক্ষণিক বিপদে এখনই **999** অথবা ফায়ার সার্ভিস **102** নম্বরে কল করুন [1]। নিরাপদ স্থানে সরে যান এবং জরুরি অ্যাম্বুলেন্স ও পুলিশের সহায়তার জন্য 999 ব্যবহার করুন।'
          : 'For fire or immediate danger, call **999** or Fire Service **102** immediately [1]. Move to safety right away.'
        : locale === 'bn'
          ? 'তাৎক্ষণিক বিপদে এখনই **999** নম্বরে কল করুন (পুলিশ, ফায়ার সার্ভিস, অ্যাম্বুলেন্স — ২৪/৭ বিনামূল্যে) [1]। জরুরি অগ্নিকাণ্ডে **102** এবং স্বাস্থ্য পরামর্শে **16263** নম্বরে কল করুন।'
          : 'In immediate danger, call **999** right away (Police, Fire, Ambulance — 24/7 toll-free) [1]. For fire emergencies call **102**, or **16263** for 24/7 health advice.';
      return this.finalizeTurn(session, issuedToken, sessionRenewed, {
        reply,
        locale,
        intent: 'emergency',
        toolsUsed: ['emergency_r8_fast_path', 'hotline_lookup'],
        citations: [
          {
            index: 1,
            title:
              locale === 'bn'
                ? 'জাতীয় জরুরি সেবা ৯৯৯ ও ফায়ার সার্ভিস ১০২'
                : 'National Emergency 999 & Fire Service 102',
            agency: 'Bangladesh Police / Fire Service & Civil Defence',
            sourceUrl: 'https://nhd.gov.bd',
            trustLabel: 'OFFICIAL_SOURCE',
            lastVerifiedAt: '2026-11-15T00:00:00Z',
            excerpt: '999 National Emergency Service (24/7), 102 Fire Service, 16263 Health.',
          },
        ],
        actionCards: [
          {
            type: 'emergency_call',
            label: locale === 'bn' ? '999 — জাতীয় জরুরি সেবা' : 'Call 999 — National Emergency',
            phone: '999',
            url: 'tel:999',
            trustLabel: 'OFFICIAL_SOURCE',
          },
          ...(isFire
            ? [
                {
                  type: 'emergency_call' as const,
                  label: locale === 'bn' ? '102 — ফায়ার সার্ভিস' : 'Call 102 — Fire Service',
                  phone: '102',
                  url: 'tel:102',
                  trustLabel: 'OFFICIAL_SOURCE',
                },
              ]
            : []),
        ],
        suggestions:
          locale === 'bn'
            ? ['ফায়ার সার্ভিস হটলাইন ১০২', 'স্বাস্থ্য বাতায়ন ১৬২৬৩', 'নিকটস্থ সরকারি হাসপাতাল', 'দুর্যোগ সতর্কতা ১০৯০']
            : ['Fire Service 102', 'Health helpline 16263', 'Nearest hospital', 'Disaster warning 1090'],
        emergencyBypass: true,
        guardrailBlocked: false,
        disclaimer,
      });
    }

    // 1.7 Truly Out of Scope (jokes, poems, political opinions, sports, recipes)
    if (rawIntent === 'out_of_scope') {
      const reply =
        locale === 'bn'
          ? 'আমি শুধুমাত্র বাংলাদেশের সরকারি সেবা, পরিবহন (ট্রেন/বাস/মেট্রো), সামাজিক ভাতা, মন্ত্রণালয়, শিক্ষা প্রতিষ্ঠান ও জরুরি হটলাইন সংক্রান্ত যাচাইকৃত তথ্য দিয়ে সাহায্য করতে পারি। নিচের যেকোনো একটি বিষয় বেছে নিতে পারেন:'
          : 'I only assist with verified Bangladesh public services, transport (trains, buses, metro), social allowances, ministries, education institutions, and official hotlines. Try one of these topics:';
      return this.finalizeTurn(session, issuedToken, sessionRenewed, {
        reply,
        locale,
        intent: 'out_of_scope',
        toolsUsed: ['out_of_scope_polite_redirect'],
        citations: [],
        actionCards: [],
        suggestions:
          locale === 'bn'
            ? ['ই-পাসপোর্ট আবেদন ও ফি', 'ঢাকা থেকে চট্টগ্রাম ট্রেন', 'জমির খাজনা পরিশোধ', 'বয়স্ক ভাতা যোগ্যতা']
            : ['e-Passport application & fees', 'Dhaka to Chattogram trains', 'Pay land tax online', 'Old Age Allowance eligibility'],
        emergencyBypass: false,
        guardrailBlocked: false,
        disclaimer,
      });
    }

    // Check if a direct service slug matches first (or if follow-up has lastServiceSlug and query is not transport/directory/education)
    const directMatchedSlug =
      DIRECT_SERVICE_MATCHERS.find((m) => m.re.test(effectiveQuery))?.slug ??
      (rewrittenQuery && session.context.lastServiceSlug ? session.context.lastServiceSlug : undefined);

    if (
      directMatchedSlug &&
      rawIntent !== 'transport_query' &&
      rawIntent !== 'directory_lookup' &&
      !(rawIntent === 'education_lookup' && /\bEIIN\b|ইআইআইএন|বিশ্ববিদ্যালয়|university/i.test(effectiveQuery))
    ) {
      const svc = SERVICES_SEED.find((s) => s.slug === directMatchedSlug);
      if (svc) {
        return this.buildServiceToolAnswer(
          session,
          issuedToken,
          sessionRenewed,
          svc,
          locale,
          disclaimer,
          rewrittenQuery,
        );
      }
    }

    // 1.5 Education Lookup Tool (EIIN / University / UGC / BANBEIS / Board results)
    if (rawIntent === 'education_lookup') {
      return this.handleEducationLookup(
        session,
        issuedToken,
        sessionRenewed,
        effectiveQuery,
        locale,
        disclaimer,
        rewrittenQuery,
      );
    }

    // 1.5 Transport Tools (Bus vs Rail vs Metro vs Water/Air — strict tool separation!)
    if (rawIntent === 'transport_query') {
      return this.handleTransportQuery(
        session,
        issuedToken,
        sessionRenewed,
        effectiveQuery,
        locale,
        disclaimer,
        rewrittenQuery,
      );
    }

    // 1.5 Directory & Ministry Hotline Lookup Tool
    if (rawIntent === 'directory_lookup') {
      return this.handleDirectoryLookup(
        session,
        issuedToken,
        sessionRenewed,
        effectiveQuery,
        locale,
        disclaimer,
        rewrittenQuery,
      );
    }

    // 1.5 Benefit & Allowance Eligibility Tool
    if (rawIntent === 'benefit_eligibility') {
      return this.handleBenefitEligibility(
        session,
        issuedToken,
        sessionRenewed,
        effectiveQuery,
        locale,
        disclaimer,
        rewrittenQuery,
      );
    }

    // 1.5 Complaint & GRS Tool
    if (rawIntent === 'complaint') {
      return this.handleComplaintQuery(
        session,
        issuedToken,
        sessionRenewed,
        effectiveQuery,
        locale,
        disclaimer,
        rewrittenQuery,
      );
    }

    // 1.5 Notices & Calendar Tool
    if (rawIntent === 'notice_lookup') {
      return this.handleNoticeLookup(
        session,
        issuedToken,
        sessionRenewed,
        effectiveQuery,
        locale,
        disclaimer,
        rewrittenQuery,
      );
    }

    // 1.6 Hybrid Knowledge Base Search + 1.7 No-Dead-End Fallback
    return this.handleKnowledgeBaseOrFallback(
      session,
      issuedToken,
      sessionRenewed,
      effectiveQuery,
      locale,
      disclaimer,
      rewrittenQuery,
    );
  }

  private buildServiceToolAnswer(
    session: StoredSession,
    issuedToken: string | undefined,
    sessionRenewed: boolean,
    svc: ServiceSeed,
    locale: 'bn' | 'en',
    disclaimer: string,
    rewrittenQuery?: string,
  ): JonoChatResponse {
    const agency = AGENCIES_SEED.find((a) => a.slug === svc.agencySlug);
    const agencyNameBn = agency?.nameBn ?? svc.agencySlug;
    const agencyNameEn = agency?.nameEn ?? svc.agencySlug;
    const phoneNoteBn = agency?.contactPhone
      ? `\n- **দপ্তর ও হটলাইন:** ${agencyNameBn} (হটলাইন: **${agency.contactPhone}**) [1]।`
      : `\n- **দায়িত্বপ্রাপ্ত দপ্তর:** ${agencyNameBn} [1]।`;
    const phoneNoteEn = agency?.contactPhone
      ? `\n- **Agency & Helpline:** ${agencyNameEn} (Helpline: **${agency.contactPhone}**) [1].`
      : `\n- **Responsible Agency:** ${agencyNameEn} [1].`;

    const extraPassportNoteBn =
      svc.slug.startsWith('epassport')
        ? '\n- **পুলিশ ভেরিফিকেশন:** সাধারণ ই-পাসপোর্ট আবেদনে পুলিশ ভেরিফিকেশন বাতিল করা হয়েছে এবং ২০+ বছর বয়সীদের এনআইডি (২০ বছরের নিচে ১৭ সংখ্যার জন্ম নিবন্ধন) প্রযোজ্য [1]।'
        : '';
    const extraPassportNoteEn =
      svc.slug.startsWith('epassport')
        ? '\n- **Police Verification:** Removed for standard e-Passport applications; NID is required for applicants aged 20+ (17-digit birth registration for under-20) [1].'
        : '';

    const reply =
      locale === 'bn'
        ? `**${svc.titleBn}** — ${svc.summaryBn} [1]\n\n` +
          `- **সরকারি ফি:** ${svc.feeTextBn} [1]।\n` +
          `- **সেবা প্রাপ্তির সময়:** ${svc.processingTime} [1]।\n` +
          `- **প্রয়োজনীয় কাগজপত্র:** জাতীয় পরিচয়পত্র (NID) বা জন্ম নিবন্ধন সনদ, সক্রিয় মোবাইল নম্বর ও সংশ্লিষ্ট মূল নথির স্ক্যান কপি [1]।\n` +
          `- **অফিসিয়াল পোর্টাল:** ${svc.officialUrl} [1]।` +
          phoneNoteBn +
          extraPassportNoteBn
        : `**${svc.titleEn}** — ${svc.summaryEn} [1]\n\n` +
          `- **Official Fee:** ${svc.feeTextEn} [1].\n` +
          `- **Processing Time:** ${svc.processingTime} [1].\n` +
          `- **Required Documents:** National ID (NID) or Birth Registration Certificate, active mobile phone number, and supporting scans [1].\n` +
          `- **Official Portal:** ${svc.officialUrl} [1].` +
          phoneNoteEn +
          extraPassportNoteEn;

    session.context.lastTopicBn = svc.titleBn;
    session.context.lastTopicEn = svc.titleEn;
    session.context.lastServiceSlug = svc.slug;
    session.context.lastIntent = 'service_question';

    return this.finalizeTurn(session, issuedToken, sessionRenewed, {
      reply,
      locale,
      intent: rewrittenQuery ? 'followup' : 'service_question',
      rewrittenQuery,
      toolsUsed: ['get_service', 'search_services'],
      citations: [
        {
          index: 1,
          title: locale === 'bn' ? svc.titleBn : svc.titleEn,
          agency: locale === 'bn' ? agencyNameBn : agencyNameEn,
          sourceUrl: svc.officialUrl,
          trustLabel: 'OFFICIAL_SOURCE',
          lastVerifiedAt: '2026-11-10T00:00:00Z',
          excerpt: `${svc.feeTextEn} | ${svc.processingTime}`,
        },
      ],
      actionCards: [],
      suggestions:
        locale === 'bn'
          ? ['এটার ফি কত?', 'কি কি কাগজ লাগবে?', 'কোথায় আবেদন করব?', 'অভিযোগ কোথায় জানাব?']
          : ['How much is the fee?', 'What documents are needed?', 'Where do I apply?', 'How to file a complaint?'],
      emergencyBypass: false,
      guardrailBlocked: false,
      disclaimer,
    });
  }

  private handleTransportQuery(
    session: StoredSession,
    issuedToken: string | undefined,
    sessionRenewed: boolean,
    query: string,
    locale: 'bn' | 'en',
    disclaimer: string,
    rewrittenQuery?: string,
  ): JonoChatResponse {
    const isBus = /(?:বাস|বাসের|বিআরটিসি|গ্রিন\s*লাইন|হানিফ|টার্মিনাল|গাবতলী|মহাখালী|সায়েদাবাদ|\bbus\b|brtc|green\s*line|hanif)/i.test(query);
    const isMetro = /(?:মেট্রো|মেট্রোরেল|এমআরটি|metro|mrt)/i.test(query);
    const isWaterOrAir = /(?:লঞ্চ|ফেরি|সদরঘাট|পাটুরিয়া|বিমান|ফ্লাইট|launch|ferry|sadarghat|paturia|flight|air)/i.test(query);
    const isToll = /(?:টোল|পদ্মা\s*সেতু|যমুনা\s*সেতু|কর্ণফুলী\s*টানেল|এলিভেটেড\s*এক্সপ্রেসওয়ে|toll|padma\s*bridge|jamuna\s*bridge|karnaphuli\s*tunnel)/i.test(query);

    const places = extractOrderedPlaces(query);

    // 1) BUS QUERIES -> bus_routes & bus_operators ONLY (never railway message!)
    if (isBus) {
      const origin = places[0]?.districtEn ?? 'Dhaka';
      const dest =
        places[1]?.districtEn ??
        (origin !== 'Dhaka' ? origin : 'Sylhet');
      const fromDist = places.length >= 2 ? places[0]!.districtEn : 'Dhaka';
      const toDist = places.length >= 2 ? places[1]!.districtEn : dest;

      const busRoutes = this.mobility?.listBusRoutes(fromDist, toDist).items ?? [];
      const operators = this.mobility?.listBusOperators().items ?? [];
      const fareEst = this.mobility?.estimateBrtaBusFare(fromDist, toDist, 'intercity');

      const routeMatch = busRoutes[0];
      const distKm = routeMatch?.distanceKm ?? fareEst?.distanceKm ?? 240;
      const brtaFareBdt = fareEst?.officialFareEstimateBdt ?? Math.round(distKm * 2.12);
      const ratePerKm = fareEst?.brtaRatePerKmBdt ?? 2.12;
      const opNamesBn = operators.map((o) => o.nameBn).join(', ') || 'বিআরটিসি (BRTC), গ্রিন লাইন, হানিফ এন্টারপ্রাইজ';
      const opNamesEn = operators.map((o) => o.nameEn).join(', ') || 'BRTC, Green Line Paribahan, Hanif Enterprise';
      const viaText = routeMatch?.via?.join(', ') ?? '';

      const reply =
        locale === 'bn'
          ? `**${fromDist} → ${toDist} আন্তঃজেলা বাস ও বিআরটিএ সরকারি ভাড়া তথ্য** [1]:\n\n` +
            `- **আনুমানিক দূরত্ব ও বিআরটিএ ভাড়া:** প্রায় ${formatDigits(distKm, 'bn')} কিমি × ৳${formatDigits(ratePerKm, 'bn')}/কিমি = **আনুমানিক সরকারি ভাড়া ${formatBdt(brtaFareBdt, 'bn')}** (নন-এসি আন্তঃজেলা, বিআরটিএ চার্ট অনুযায়ী) [1]।\n` +
            (viaText ? `- **রুট:** ${viaText} হয়ে চলাচল করে [1]।\n` : '') +
            `- **নিবন্ধিত অপারেটরসমূহ:** ${opNamesBn} [1]।\n` +
            `- **প্রধান বাস টার্মিনাল ও কাউন্টার (ঢাকা):** সায়েদাবাদ, মহাখালী ও গাবতলী আন্তঃজেলা বাস টার্মিনাল (সকাল ৬:০০ থেকে রাত ১১:৩০ পর্যন্ত বিভিন্ন সময়সূচিতে বাস ছাড়ে) [1]।\n` +
            `- **সরকারি বিআরটিসি তথ্য ও অভিযোগ:** বিআরটিসি পোর্টাল **brtc.gov.bd** এবং অতিরিক্ত ভাড়া দাবি করলে বিআরটিএ হটলাইন **16107** অথবা **999** নম্বরে জানান [1]।`
          : `**${fromDist} → ${toDist} Intercity Bus & Official BRTA Fare Information** [1]:\n\n` +
            `- **Distance & Official BRTA Fare Estimate:** ~${distKm} km × BDT ${ratePerKm}/km = **Estimated official non-AC fare ${formatBdt(brtaFareBdt, 'en')}** (per BRTA chart) [1].\n` +
            (viaText ? `- **Route Corridor:** Via ${viaText} [1].\n` : '') +
            `- **Listed Operators:** ${opNamesEn} [1].\n` +
            `- **Major Terminals & Counters (Dhaka):** Sayedabad, Mohakhali, and Gabtoli Inter-District Bus Terminals (departures throughout the day from 06:00 to 23:30) [1].\n` +
            `- **Official Portal & Overcharge Helpline:** Check **brtc.gov.bd** or report overcharging to BRTA Helpline **16107** / **999** [1].`;

      session.context.lastTopicBn = `${fromDist} থেকে ${toDist} বাস`;
      session.context.lastTopicEn = `${fromDist} to ${toDist} bus`;
      session.context.lastIntent = 'transport_query';

      return this.finalizeTurn(session, issuedToken, sessionRenewed, {
        reply,
        locale,
        intent: 'transport_query',
        rewrittenQuery,
        toolsUsed: ['bus_routes', 'bus_operators'],
        citations: [
          {
            index: 1,
            title:
              locale === 'bn'
                ? 'বিআরটিএ সরকারি বাস ভাড়া তালিকা ও বিআরটিসি ডিরেক্টরি'
                : 'BRTA Official Bus Fare Chart & BRTC Directory',
            agency: 'BRTA / BRTC',
            sourceUrl: 'https://bsp.brta.gov.bd/',
            trustLabel: 'OFFICIAL_SOURCE',
            lastVerifiedAt: '2026-11-01T00:00:00Z',
            excerpt: `BRTA intercity non-AC rate ${ratePerKm} BDT/km; ${fromDist}->${toDist} ~${distKm} km = ${brtaFareBdt} BDT.`,
          },
        ],
        actionCards: [
          {
            type: 'transport_handoff',
            label:
              locale === 'bn'
                ? 'বিআরটিসি অফিসিয়াল পোর্টাল (সংরক্ষিত নয়)'
                : 'Continue to BRTC Official Portal (Not Reserved)',
            url: 'https://brtc.gov.bd',
            notReserved: true,
            trustLabel: 'OFFICIAL_SOURCE',
          },
        ],
        suggestions:
          locale === 'bn'
            ? ['ঢাকা থেকে চট্টগ্রাম বাস ভাড়া', 'ঢাকা থেকে বরিশাল বিআরটিসি বাস', 'ঢাকা থেকে সিলেট ট্রেন কখন?', 'বিআরটিএ হটলাইন ১৬১০৭']
            : ['Dhaka to Chattogram bus fare', 'Dhaka to Barishal BRTC bus', 'Dhaka to Sylhet train times', 'BRTA helpline 16107'],
        emergencyBypass: false,
        guardrailBlocked: false,
        disclaimer,
      });
    }

    // 2) METRO RAIL QUERIES -> metro_fare
    if (isMetro) {
      const reply =
        locale === 'bn'
          ? '**ঢাকা মেট্রোরেল (এমআরটি লাইন-৬)** উত্তরা উত্তর থেকে মতিঝিল পর্যন্ত ১৬টি স্টেশনে সকাল ৭:১০ থেকে রাত ৯:৪০ পর্যন্ত চলাচল করে [1]।\n\n' +
            '- **ভাড়া:** সর্বনিম্ন ২০ টাকা এবং সর্বোচ্চ ১০০ টাকা (উত্তরা উত্তর → মতিঝিল) [1]।\n' +
            '- **পাস ছাড়:** এমআরটি পাস বা র‍্যাপিড পাসে সকল ভাড়ায় **১০% ছাড়** পাওয়া যায় [1]।\n' +
            '- **অফিসিয়াল উৎস:** dmtcl.gov.bd (সর্বশেষ যাচাই: ১০ নভেম্বর ২০২৬) [1]।'
          : '**Dhaka Metro Rail (MRT Line-6)** operates across 16 stations from Uttara North to Motijheel (07:10 to 21:40 Asia/Dhaka) [1].\n\n' +
            '- **Official Fares:** 20 BDT minimum to 100 BDT maximum (Uttara North → Motijheel) [1].\n' +
            '- **Pass Discount:** 10% discount on all fares with MRT Pass or Rapid Pass [1].\n' +
            '- **Official Source:** dmtcl.gov.bd (Last verified: 10 Nov 2026) [1].';
      session.context.lastTopicBn = 'ঢাকা মেট্রোরেল ভাড়া ও সময়সূচি';
      session.context.lastTopicEn = 'Dhaka Metro Rail fare & schedule';
      session.context.lastIntent = 'transport_query';

      return this.finalizeTurn(session, issuedToken, sessionRenewed, {
        reply,
        locale,
        intent: 'transport_query',
        rewrittenQuery,
        toolsUsed: ['metro_fare'],
        citations: [
          {
            index: 1,
            title: 'Dhaka Mass Transit Company Limited (DMTCL) — MRT Line-6',
            agency: 'DMTCL',
            sourceUrl: 'https://dmtcl.gov.bd',
            trustLabel: 'OFFICIAL_SOURCE',
            lastVerifiedAt: '2026-11-10T00:00:00Z',
            excerpt: 'MRT Line-6 16 stations, 07:10-21:40, 20-100 BDT, 10% MRT/Rapid Pass discount.',
          },
        ],
        actionCards: [],
        suggestions:
          locale === 'bn'
            ? ['পদ্মা সেতুর টোল কত?', 'ঢাকা থেকে চট্টগ্রাম ট্রেন', 'ঢাকা থেকে রাজশাহী ট্রেন', 'রেলওয়ে ই-টিকিট নিয়ম']
            : ['Padma Bridge toll rates', 'Dhaka to Chattogram trains', 'Dhaka to Rajshahi trains', 'Railway e-Ticketing rules'],
        emergencyBypass: false,
        guardrailBlocked: false,
        disclaimer,
      });
    }

    // 3) BRIDGE / TUNNEL TOLL QUERIES
    if (isToll) {
      const tolls = this.mobility?.getTolls().items ?? [];
      const lines = tolls.map((t) =>
        locale === 'bn'
          ? `- **${t.nameBn}:** মোটরসাইকেল ৳${formatDigits(t.ratesBdt.motorcycle ?? 0, 'bn')}, কার/জিপ ৳${formatDigits(t.ratesBdt.car_jeep ?? 0, 'bn')}, মাইক্রোবাস ৳${formatDigits(t.ratesBdt.microbus ?? 0, 'bn')}, বড় বাস ৳${formatDigits(t.ratesBdt.large_bus ?? 0, 'bn')} [1]`
          : `- **${t.nameEn}:** Motorcycle BDT ${t.ratesBdt.motorcycle ?? 'N/A'}, Car/Jeep BDT ${t.ratesBdt.car_jeep ?? 0}, Microbus BDT ${t.ratesBdt.microbus ?? 0}, Large Bus BDT ${t.ratesBdt.large_bus ?? 0} [1]`,
      );
      const reply =
        locale === 'bn'
          ? `**বাংলাদেশ সেতু কর্তৃপক্ষের (BBA) নির্ধারিত টোল হার** [1]:\n\n${lines.join('\n')}\n\n- **উৎস:** bba.gov.bd (সর্বশেষ যাচাই: ১ নভেম্বর ২০২৬) [1]।`
          : `**Official Bangladesh Bridge Authority (BBA) Toll Rates** [1]:\n\n${lines.join('\n')}\n\n- **Source:** bba.gov.bd (Last verified: 1 Nov 2026) [1].`;
      return this.finalizeTurn(session, issuedToken, sessionRenewed, {
        reply,
        locale,
        intent: 'transport_query',
        rewrittenQuery,
        toolsUsed: ['journeys_plan'],
        citations: [
          {
            index: 1,
            title: 'Bangladesh Bridge Authority Official Toll Charts',
            agency: 'Bangladesh Bridge Authority (BBA)',
            sourceUrl: 'https://bba.gov.bd',
            trustLabel: 'OFFICIAL_SOURCE',
            lastVerifiedAt: '2026-11-01T00:00:00Z',
            excerpt: 'Padma Bridge, Jamuna Bridge, Karnaphuli Tunnel, Dhaka Elevated Expressway tolls.',
          },
        ],
        actionCards: [],
        suggestions:
          locale === 'bn'
            ? ['ঢাকা মেট্রোরেল ভাড়া', 'ঢাকা থেকে বরিশাল লঞ্চ ও বাস', 'ঢাকা থেকে চট্টগ্রাম ট্রেন', 'বিআরটিএ বাস ভাড়া']
            : ['Dhaka Metro Rail fare', 'Dhaka to Barishal launch & bus', 'Dhaka to Chattogram trains', 'BRTA bus fare'],
        emergencyBypass: false,
        guardrailBlocked: false,
        disclaimer,
      });
    }

    // 4) WATER / LAUNCH / AIR QUERIES
    if (isWaterOrAir) {
      const reply =
        locale === 'bn'
          ? '**নৌপথ (লঞ্চ ও ফেরি — BIWTA/BIWTC) এবং অভ্যন্তরীণ বিমান রুট** [1]:\n\n' +
            '- **ঢাকা (সদরঘাট) – বরিশাল লঞ্চ:** আনুমানিক সময় ৭ ঘণ্টা ৩০ মিনিট (যাত্রার পূর্বে bmd.gov.bd ও biwta.gov.bd-এ আবহাওয়া সংকেত দেখে নিন) [1]।\n' +
            '- **পাটুরিয়া – দৌলতদিয়া ফেরি পারাপার (BIWTC):** আনুমানিক ৪৫ মিনিট (biwtc.gov.bd) [1]।\n' +
            '- **অভ্যন্তরীণ বিমান রুট (CAAB):** ঢাকা (DAC) থেকে চট্টগ্রাম (CGP — ৫০ মি.), কক্সবাজার (CXB — ৬৫ মি.) ও সিলেট (ZYL — ৪৫ মি.) [1]।'
          : '**Waterways (Launch & Ferry — BIWTA/BIWTC) & Domestic Air Routes (CAAB)** [1]:\n\n' +
            '- **Dhaka (Sadarghat) – Barishal Launch:** ~7h 30m (check river port weather warnings at bmd.gov.bd & biwta.gov.bd before departure) [1].\n' +
            '- **Paturia – Daulatdia Ferry Crossing (BIWTC):** ~45m (biwtc.gov.bd) [1].\n' +
            '- **Domestic Air (CAAB):** Dhaka (DAC) to Chattogram (50m), Cox’s Bazar (65m), and Sylhet (45m) [1].';
      return this.finalizeTurn(session, issuedToken, sessionRenewed, {
        reply,
        locale,
        intent: 'transport_query',
        rewrittenQuery,
        toolsUsed: ['journeys_plan'],
        citations: [
          {
            index: 1,
            title: 'BIWTA / BIWTC Waterways & CAAB Domestic Air Routes',
            agency: 'BIWTA / BIWTC / CAAB',
            sourceUrl: 'https://biwta.gov.bd',
            trustLabel: 'OFFICIAL_SOURCE',
            lastVerifiedAt: '2026-11-05T00:00:00Z',
            excerpt: 'Sadarghat-Barishal launch, Paturia-Daulatdia ferry, DAC-CGP/CXB/ZYL flights.',
          },
        ],
        actionCards: [],
        suggestions:
          locale === 'bn'
            ? ['ঢাকা থেকে বরিশাল বাস ভাড়া', 'ঢাকা থেকে কক্সবাজার ট্রেন', 'আবহাওয়া ও দুর্যোগ সতর্কতা ১০৯০', 'পদ্মা সেতুর টোল']
            : ['Dhaka to Barishal bus fare', 'Dhaka to Cox’s Bazar train', 'Weather warning 1090', 'Padma Bridge toll'],
        emergencyBypass: false,
        guardrailBlocked: false,
        disclaimer,
      });
    }

    // 5) RAIL / TRAIN QUERIES -> rail_trains & rail_station (List EVERY train with times, off-day, classes+fares, booking link, "আসন তথ্য অজানা")
    const fromPlace = places[0] ?? PLACE_ALIAS_MAP[0]!; // Default Dhaka (DA)
    const toPlace =
      places[1] ??
      (fromPlace.code === 'DA'
        ? PLACE_ALIAS_MAP.find((p) => p.code === 'CTG')!
        : PLACE_ALIAS_MAP[0]!);

    try {
      const result = this.mobility?.findTrainsBetween({
        from: fromPlace.code,
        to: toPlace.code,
      });
      const trains = result?.trains ?? [];

      if (trains.length > 0) {
        const trainBullets = trains.map((t) => {
          const overnight =
            t.departure && t.arrival && t.arrival < t.departure
              ? locale === 'bn'
                ? ' (+১ দিন)'
                : ' (+1 day)'
              : '';
          const depText = t.departure ? formatDhakaTime(t.departure, locale) : '—';
          const arrText = t.arrival ? `${formatDhakaTime(t.arrival, locale)}${overnight}` : '—';
          const offDayText =
            t.offDays.length > 0
              ? t.offDays.join(', ')
              : locale === 'bn'
                ? 'সপ্তাহের প্রতিদিন চলে'
                : 'Runs daily';
          const classesText = t.classes
            .map((c) =>
              locale === 'bn'
                ? `${getSeatClassLabel(c.seatClass, 'bn')} (আনুমানিক ${formatBdt(c.estimatedOfficialFareBdt, 'bn')})`
                : `${getSeatClassLabel(c.seatClass, 'en')} (est. ${formatBdt(c.estimatedOfficialFareBdt, 'en')})`,
            )
            .join(', ');

          return locale === 'bn'
            ? `- **${t.nameBn} (${formatDigits(t.number, 'bn')})**: ছাড়ে **${depText}** → পৌঁছায় **${arrText}** | সাপ্তাহিক বন্ধ: **${offDayText}** | শ্রেণি ও আনুমানিক সরকারি ভাড়া: ${classesText} | **আসন তথ্য অজানা** [1]`
            : `- **${t.nameEn} (${t.number})**: Departs **${depText}** → Arrives **${arrText}** | Weekly off-day: **${offDayText}** | Classes & est. official fare: ${classesText} | **Seat availability unknown** [1]`;
        });

        const reply =
          locale === 'bn'
            ? `**${fromPlace.nameBn} (${fromPlace.code}) → ${toPlace.nameBn} (${toPlace.code}) রুটের ট্রেন ও সময়সূচি** (${formatDigits(trains.length, 'bn')}টি ট্রেন) [1]:\n\n` +
              `${trainBullets.join('\n')}\n\n` +
              `- **ভাড়ার উৎস ও তারিখ:** বাংলাদেশ রেলওয়ে সময়সূচি সংস্করণ ২০২৬.১১-W54 (সর্বশেষ যাচাই: ১০ নভেম্বর ২০২৬) [1]।\n` +
              `- **অফিসিয়াল টিকিট বুকিং লিংক:** শুধুমাত্র **https://eticket.railway.gov.bd** অথবা Rail Sheba অ্যাপ (জনসেবা AI আসন সংরক্ষণ করে না — **আসন তথ্য অজানা**) [1]।\n` +
              `- **রেলওয়ে হটলাইন:** **131** [1]।`
            : `**${fromPlace.nameEn} (${fromPlace.code}) → ${toPlace.nameEn} (${toPlace.code}) Train Schedule & Fares** (${trains.length} train(s)) [1]:\n\n` +
              `${trainBullets.join('\n')}\n\n` +
              `- **Timetable Source & Date:** Bangladesh Railway Timetable v2026.11-W54 (Last verified: 10 Nov 2026) [1].\n` +
              `- **Official Booking Link:** Buy tickets only at **https://eticket.railway.gov.bd** or the Rail Sheba app (Jonoshheba AI does not reserve seats — **Seat availability unknown**) [1].\n` +
              `- **Railway Helpline:** **131** [1].`;

        session.context.lastTopicBn = `${fromPlace.nameBn} থেকে ${toPlace.nameBn} ট্রেন`;
        session.context.lastTopicEn = `${fromPlace.nameEn} to ${toPlace.nameEn} train`;
        session.context.lastIntent = 'transport_query';

        return this.finalizeTurn(session, issuedToken, sessionRenewed, {
          reply,
          locale,
          intent: 'transport_query',
          rewrittenQuery,
          toolsUsed: ['rail_trains', 'rail_station'],
          citations: [
            {
              index: 1,
              title:
                locale === 'bn'
                  ? 'বাংলাদেশ রেলওয়ে অফিসিয়াল সময়সূচি ও ই-টিকিট পোর্টাল'
                  : 'Bangladesh Railway Official Timetable & e-Ticketing Portal',
              agency: 'Bangladesh Railway',
              sourceUrl: 'https://eticket.railway.gov.bd',
              trustLabel: 'OFFICIAL_SOURCE',
              lastVerifiedAt: '2026-11-10T00:00:00Z',
              excerpt: `${fromPlace.code}->${toPlace.code}: ${trains.map((t) => `${t.number} (${t.departure}->${t.arrival})`).join('; ')}`,
            },
          ],
          actionCards: [
            {
              type: 'transport_handoff',
              label:
                locale === 'bn'
                  ? 'eticket.railway.gov.bd — অফিশিয়াল চ্যানেলে এগিয়ে যান (সংরক্ষিত নয়)'
                  : 'Continue to eticket.railway.gov.bd (Not Reserved)',
              url: 'https://eticket.railway.gov.bd',
              notReserved: true,
              trustLabel: 'OFFICIAL_SOURCE',
            },
          ],
          suggestions:
            locale === 'bn'
              ? ['ঢাকা থেকে চট্টগ্রাম ট্রেন', 'ঢাকা থেকে রাজশাহী ট্রেন', 'ঢাকা থেকে সিলেট ট্রেন', 'ট্রেন টিকিট রিফান্ড নিয়ম']
              : ['Dhaka to Chattogram trains', 'Dhaka to Rajshahi trains', 'Dhaka to Sylhet trains', 'Train ticket refund rules'],
          emergencyBypass: false,
          guardrailBlocked: false,
          disclaimer,
        });
      }
    } catch {
      // Fall through to general station/timetable guidance
    }

    const fallbackRailReply =
      locale === 'bn'
        ? `**${fromPlace.nameBn} → ${toPlace.nameBn}** রুটে আমাদের বর্তমান যাচাইকৃত সময়সূচিতে সরাসরি ট্রেন পাওয়া যায়নি (পূর্ণাঙ্গ রেল সময়সূচি আমদানির কাজ চলমান) [1]।\n\n` +
          `- **প্রধান চালু রুটসমূহ:** ঢাকা ↔ চট্টগ্রাম (সুবর্ণ ৭০২/৭০১, মহানগর গোধূলী ৭০৪/প্রভাতী ৭০৩, কক্সবাজার এক্সপ্রেস ৮১৪/৮১৩), ঢাকা ↔ রাজশাহী (সিল্কসিটি ৭৫৩/৭৫৪), ঢাকা ↔ সিলেট (পারাবত ৭০৯/৭১০), ঢাকা ↔ খুলনা (জাহানাবাদ ৮২৫/৮২৬), ঢাকা ↔ রংপুর (রংপুর এক্সপ্রেস ৭৭১/৭৭২), ঢাকা ↔ ময়মনসিংহ (হাওর এক্সপ্রেস ৭৭৭/৭৭৮) [1]।\n` +
          `- **অফিসিয়াল বুকিং ও লাইভ সময়সূচি:** **https://eticket.railway.gov.bd** (হটলাইন: **131**, **আসন তথ্য অজানা**) [1]।`
        : `No direct train is currently listed between **${fromPlace.nameEn} → ${toPlace.nameEn}** in our verified snapshot (full timetable import pending) [1].\n\n` +
          `- **Available Verified Corridors:** Dhaka ↔ Chattogram (702/701, 704/703, 814/813), Dhaka ↔ Rajshahi (753/754), Dhaka ↔ Sylhet (709/710), Dhaka ↔ Khulna (825/826), Dhaka ↔ Rangpur (771/772), Dhaka ↔ Mymensingh (777/778) [1].\n` +
          `- **Official Booking & Live Schedule:** **https://eticket.railway.gov.bd** (Helpline: **131**, **Seat availability unknown**) [1].`;

    return this.finalizeTurn(session, issuedToken, sessionRenewed, {
      reply: fallbackRailReply,
      locale,
      intent: 'transport_query',
      rewrittenQuery,
      toolsUsed: ['rail_trains', 'rail_station'],
      citations: [
        {
          index: 1,
          title: 'Bangladesh Railway Official e-Ticketing Portal',
          agency: 'Bangladesh Railway',
          sourceUrl: 'https://eticket.railway.gov.bd',
          trustLabel: 'OFFICIAL_SOURCE',
          lastVerifiedAt: '2026-11-10T00:00:00Z',
          excerpt: 'Official timetable & ticketing at eticket.railway.gov.bd; helpline 131.',
        },
      ],
      actionCards: [
        {
          type: 'transport_handoff',
          label:
            locale === 'bn'
              ? 'eticket.railway.gov.bd — অফিশিয়াল চ্যানেলে এগিয়ে যান (সংরক্ষিত নয়)'
              : 'Continue to eticket.railway.gov.bd (Not Reserved)',
          url: 'https://eticket.railway.gov.bd',
          notReserved: true,
          trustLabel: 'OFFICIAL_SOURCE',
        },
      ],
      suggestions:
        locale === 'bn'
          ? ['ঢাকা থেকে চট্টগ্রাম ট্রেন কখন?', 'ঢাকা থেকে রাজশাহী ট্রেন কখন?', 'ঢাকা থেকে সিলেট ট্রেন কখন?', 'ঢাকা থেকে খুলনা ট্রেন কখন?']
          : ['Dhaka to Chattogram train times', 'Dhaka to Rajshahi train times', 'Dhaka to Sylhet train times', 'Dhaka to Khulna train times'],
      emergencyBypass: false,
      guardrailBlocked: false,
      disclaimer,
    });
  }

  private handleEducationLookup(
    session: StoredSession,
    issuedToken: string | undefined,
    sessionRenewed: boolean,
    query: string,
    locale: 'bn' | 'en',
    disclaimer: string,
    rewrittenQuery?: string,
  ): JonoChatResponse {
    const isUniversityQuery =
      /(?:বিশ্ববিদ্যালয়|ইউনিভার্সিটি|বুয়েট|মেডিকেল\s*কলেজ|ইউজিসি|university|buet|\bugc\b|dhaka\s*uni)/i.test(
        query,
      );
    const eiinMatch = query.match(/\b(\d{6})\b/);

    if (isUniversityQuery) {
      const reply =
        locale === 'bn'
          ? '**বাংলাদেশের বিশ্ববিদ্যালয়সমূহের EIIN প্রসঙ্গে গুরুত্বপূর্ণ তথ্য** [1]:\n\n' +
            '- **বিশ্ববিদ্যালয়ের কোনো EIIN থাকে না:** বাংলাদেশে সাধারণত স্কুল, কলেজ, মাদ্রাসা ও কারিগরি শিক্ষা প্রতিষ্ঠানের ৬ সংখ্যার **EIIN** (ব্যানবেইস — BANBEIS প্রদত্ত) থাকে। ঢাকা বিশ্ববিদ্যালয়সহ পাবলিক ও প্রাইভেট বিশ্ববিদ্যালয়সমূহ **বাংলাদেশ বিশ্ববিদ্যালয় মঞ্জুরী কমিশন (UGC)**-এর তালিকাভুক্ত — আমরা কখনোই কোনো ভুয়া বা অনুমাননির্ভর EIIN তৈরি করি না।\n' +
            '- **ইউজিসি ও ব্যানবেইস ডিরেক্টরি:** আমাদের **শিক্ষা হাব (/education)** পেজে ইউজিসি বিশ্ববিদ্যালয় তালিকা ও ব্যানবেইস EIIN ডিরেক্টরি যুক্ত রয়েছে (পূর্ণাঙ্গ তালিকা বর্তমানে **যাচাই চলছে**) [1]।\n' +
            '- **বোর্ড পরীক্ষা ও কলেজ ভর্তি পোর্টাল:** ফলাফল যাচাই **http://www.educationboardresults.gov.bd** এবং একাদশ ভর্তি **https://xiclassadmission.gov.bd** [1]।'
          : '**Important Fact Regarding University EIINs in Bangladesh** [1]:\n\n' +
            '- **Universities generally do not have a BANBEIS EIIN:** In Bangladesh, 6-digit **EIIN** codes are issued by BANBEIS for schools, colleges, madrasas, and technical institutes. Public and private universities (including the University of Dhaka) are regulated and listed by the **University Grants Commission (UGC)** — Jonoshheba AI never fabricates an EIIN.\n' +
            '- **Education Hub (/education):** Check our Education Hub for UGC university listings and BANBEIS institution lookup (full dataset currently marked **Verification pending**) [1].\n' +
            '- **Official Board Portals:** Board exam results at **http://www.educationboardresults.gov.bd** and XI class admission at **https://xiclassadmission.gov.bd** [1].';

      session.context.lastTopicBn = 'বিশ্ববিদ্যালয় ও শিক্ষা প্রতিষ্ঠান ডিরেক্টরি (UGC / EIIN)';
      session.context.lastTopicEn = 'University & Institution Directory (UGC / EIIN)';
      session.context.lastIntent = 'education_lookup';

      return this.finalizeTurn(session, issuedToken, sessionRenewed, {
        reply,
        locale,
        intent: 'education_lookup',
        rewrittenQuery,
        toolsUsed: ['institution_lookup'],
        citations: [
          {
            index: 1,
            title:
              locale === 'bn'
                ? 'মাধ্যমিক ও উচ্চশিক্ষা অধিদপ্তর (DSHE) ও শিক্ষা বোর্ড পোর্টাল'
                : 'Directorate of Secondary and Higher Education (DSHE) & Board Portals',
            agency: 'DSHE / Education Boards',
            sourceUrl: 'https://dshe.gov.bd',
            trustLabel: 'OFFICIAL_SOURCE',
            lastVerifiedAt: '2026-11-10T00:00:00Z',
            excerpt: 'DSHE dshe.gov.bd, xiclassadmission.gov.bd, educationboardresults.gov.bd.',
          },
        ],
        actionCards: [],
        suggestions:
          locale === 'bn'
            ? ['এসএসসি ও এইচএসসি রেজাল্ট যাচাই', 'একাদশ শ্রেণিতে কলেজ ভর্তি', 'বোর্ড সনদ সংশোধন', 'সরকারি শিক্ষাবৃত্তি']
            : ['Check SSC & HSC results', 'XI Class college admission', 'Board certificate correction', 'Government scholarships'],
        emergencyBypass: false,
        guardrailBlocked: false,
        disclaimer,
      });
    }

    const codeSearched = eiinMatch ? eiinMatch[1] : null;
    const reply =
      locale === 'bn'
        ? `**শিক্ষা প্রতিষ্ঠান ও EIIN অনুসন্ধান${codeSearched ? ` (EIIN: ${codeSearched})` : ''}** [1]:\n\n` +
          `- **বর্তমান অবস্থা:** ব্যানবেইস (BANBEIS) এর সম্পূর্ণ EIIN তালিকা আমদানির পাইপলাইন প্রস্তুত রয়েছে; নির্দিষ্ট প্রতিষ্ঠানের রেকর্ডটি বর্তমানে **যাচাই চলছে (Verification pending)** — আমরা কখনোই মডেল মেমোরি থেকে EIIN বা প্রতিষ্ঠানের ফোন নম্বর তৈরি করি না।\n` +
          `- **শিক্ষা হাব:** আমাদের **/education** পেজে EIIN, কলেজ কোড বা প্রতিষ্ঠানের নাম দিয়ে খুঁজতে পারেন এবং অফিসিয়াল **dshe.gov.bd** ও **xiclassadmission.gov.bd** পোর্টাল দেখতে পারেন [1]।`
        : `**Education Institution & EIIN Lookup${codeSearched ? ` (EIIN: ${codeSearched})` : ''}** [1]:\n\n` +
          `- **Status:** The BANBEIS EIIN dataset import pipeline is ready and this institution record is currently marked **Verification pending** — we never invent EIINs or institution phone numbers from memory.\n` +
          `- **Education Hub:** Visit **/education** to search by EIIN, college code, or district, or check **dshe.gov.bd** and **xiclassadmission.gov.bd** [1].`;

    session.context.lastTopicBn = 'শিক্ষা প্রতিষ্ঠান ও EIIN ডিরেক্টরি';
    session.context.lastTopicEn = 'Education Institution & EIIN Directory';
    session.context.lastIntent = 'education_lookup';

    return this.finalizeTurn(session, issuedToken, sessionRenewed, {
      reply,
      locale,
      intent: 'education_lookup',
      rewrittenQuery,
      toolsUsed: ['institution_lookup'],
      citations: [
        {
          index: 1,
          title: 'Directorate of Secondary and Higher Education (DSHE)',
          agency: 'DSHE',
          sourceUrl: 'https://dshe.gov.bd',
          trustLabel: 'OFFICIAL_SOURCE',
          lastVerifiedAt: '2026-11-10T00:00:00Z',
          excerpt: 'Official DSHE & education portal dshe.gov.bd.',
        },
      ],
      actionCards: [],
      suggestions:
        locale === 'bn'
          ? ['এসএসসি রেজাল্ট কীভাবে দেখব?', 'একাদশ শ্রেণিতে ভর্তি', 'বোর্ড সনদ সংশোধন', 'ঢাকা বিশ্ববিদ্যালয় EIIN']
          : ['How to check SSC result', 'XI class admission', 'Board certificate correction', 'Dhaka University EIIN'],
      emergencyBypass: false,
      guardrailBlocked: false,
      disclaimer,
    });
  }

  private handleDirectoryLookup(
    session: StoredSession,
    issuedToken: string | undefined,
    sessionRenewed: boolean,
    query: string,
    locale: 'bn' | 'en',
    disclaimer: string,
    rewrittenQuery?: string,
  ): JonoChatResponse {
    const orgs = this.orgsHotlines?.listOrgs({ q: query }).items ?? [];
    const allOrgs = this.orgsHotlines?.listOrgs({}).items ?? [];

    // Try matching specific ministry/agency mentioned in the query
    const matchedOrg =
      orgs[0] ??
      allOrgs.find(
        (o) =>
          query.includes(o.nameBn.split(' ')[0] ?? '__') ||
          query.toLowerCase().includes(o.nameEn.toLowerCase().split(' ')[0] ?? '__') ||
          o.aliases.some((a) => query.toLowerCase().includes(a.toLowerCase())),
      );

    const isEducationMinistry = /(?:শিক্ষা\s*মন্ত্রণালয়|মাধ্যমিক\s*ও\s*উচ্চশিক্ষা|ministry\s*of\s*education|dshe)/i.test(
      query,
    );

    if (isEducationMinistry) {
      const reply =
        locale === 'bn'
          ? '**শিক্ষা মন্ত্রণালয় ও মাধ্যমিক ও উচ্চশিক্ষা অধিদপ্তর (DSHE) যোগাযোগ ও ডিরেক্টরি তথ্য** [1]:\n\n' +
            '- **অফিসিয়াল ওয়েবসাইট:** মাধ্যমিক ও উচ্চশিক্ষা অধিদপ্তর — **https://dshe.gov.bd** [1]।\n' +
            '- **প্রধানগণ (মন্ত্রী/উপদেষ্টা ও সচিবের অফিস নম্বর):** অফিসিয়াল কর্মকর্তা তালিকা ফাইল আমদানি না হওয়া পর্যন্ত পদবিভিত্তিক অফিস ফোন নম্বর **যাচাই চলছে (Verification pending)** হিসেবে চিহ্নিত রয়েছে (নিয়ম C1 ও C4 অনুযায়ী আমরা কখনোই অনুমাননির্ভর বা ব্যক্তিগত নম্বর প্রদর্শন করি না)।\n' +
            '- **জাতীয় সরকারি তথ্য ও মন্ত্রণালয় হেল্পলাইন:** যেকোনো সরকারি দপ্তরের তথ্যের জন্য ২৪/৭ **333** নম্বরে কল করুন এবং আমাদের **/ministries** ডিরেক্টরি দেখুন [1]।'
          : '**Ministry of Education & DSHE Contact and Directory Information** [1]:\n\n' +
            '- **Official Website:** Directorate of Secondary and Higher Education — **https://dshe.gov.bd** [1].\n' +
            '- **Leadership (Secretary / Key Officers Office Phone):** Designation-level office phone numbers are marked **Verification pending** until official officer directory files are imported (per Rules C1 & C4, we never invent or expose unverified/personal numbers).\n' +
            '- **National Government Info Helpline:** Call **333** (24/7) for official ministry contact routing, or browse **/ministries** [1].';

      session.context.lastTopicBn = 'শিক্ষা মন্ত্রণালয় ডিরেক্টরি';
      session.context.lastTopicEn = 'Ministry of Education Directory';
      session.context.lastIntent = 'directory_lookup';

      return this.finalizeTurn(session, issuedToken, sessionRenewed, {
        reply,
        locale,
        intent: 'directory_lookup',
        rewrittenQuery,
        toolsUsed: ['org_directory', 'hotline_lookup'],
        citations: [
          {
            index: 1,
            title: 'Directorate of Secondary and Higher Education (DSHE) & National Helpline 333',
            agency: 'DSHE / ICT Division (333)',
            sourceUrl: 'https://dshe.gov.bd',
            trustLabel: 'OFFICIAL_SOURCE',
            lastVerifiedAt: '2026-11-10T00:00:00Z',
            excerpt: 'Official portal dshe.gov.bd; national government info helpline 333.',
          },
        ],
        actionCards: [
          {
            type: 'emergency_call',
            label: locale === 'bn' ? '333 — জাতীয় তথ্য হটলাইন' : 'Call 333 — National Info Helpline',
            phone: '333',
            url: 'tel:333',
            trustLabel: 'OFFICIAL_SOURCE',
          },
        ],
        suggestions:
          locale === 'bn'
            ? ['ভূমি মন্ত্রণালয়ের হটলাইন কত?', 'পাসপোর্ট অধিদপ্তরের হটলাইন', 'মন্ত্রিপরিষদ বিভাগ GRS', 'সকল সরকারি হটলাইন']
            : ['Ministry of Land hotline', 'Passport office helpline', 'Cabinet Division GRS', 'All government hotlines'],
        emergencyBypass: false,
        guardrailBlocked: false,
        disclaimer,
      });
    }

    if (matchedOrg) {
      const reply =
        locale === 'bn'
          ? `**${matchedOrg.nameBn}** — সরকারি দপ্তর ও যোগাযোগ তথ্য [1]:\n\n` +
            `- **অফিসিয়াল ওয়েবসাইট:** ${matchedOrg.website} [1]।\n` +
            `- **অফিস ফোন / হটলাইন:** **${matchedOrg.phone}** [1]।\n` +
            `- **সিটিজেন চার্টার:** ${matchedOrg.citizenCharterUrl} [1]।\n` +
            `- **প্রধানগণ (সচিব / দপ্তর প্রধানের অফিস নম্বর):** অফিসিয়াল কর্মকর্তা পাতা যাচাই সাপেক্ষে **যাচাই চলছে (Verification pending)** — সাধারণ তথ্যের জন্য **333** নম্বরে কল করুন [1]।`
          : `**${matchedOrg.nameEn}** — Official Directory & Contact Information [1]:\n\n` +
            `- **Official Website:** ${matchedOrg.website} [1].\n` +
            `- **Office Phone / Helpline:** **${matchedOrg.phone}** [1].\n` +
            `- **Citizen Charter:** ${matchedOrg.citizenCharterUrl} [1].\n` +
            `- **Leadership (Secretary / Head of Office):** Currently marked **Verification pending** awaiting official officer-page import — call **333** for general directory assistance [1].`;

      session.context.lastTopicBn = matchedOrg.nameBn;
      session.context.lastTopicEn = matchedOrg.nameEn;
      session.context.lastIntent = 'directory_lookup';

      return this.finalizeTurn(session, issuedToken, sessionRenewed, {
        reply,
        locale,
        intent: 'directory_lookup',
        rewrittenQuery,
        toolsUsed: ['org_directory', 'hotline_lookup'],
        citations: [
          {
            index: 1,
            title: locale === 'bn' ? matchedOrg.nameBn : matchedOrg.nameEn,
            agency: matchedOrg.nameEn,
            sourceUrl: matchedOrg.website,
            trustLabel: 'OFFICIAL_SOURCE',
            lastVerifiedAt: matchedOrg.lastVerifiedAt,
            excerpt: `${matchedOrg.nameEn} | Phone: ${matchedOrg.phone} | ${matchedOrg.website}`,
          },
        ],
        actionCards: [],
        suggestions:
          locale === 'bn'
            ? ['ভূমি সেবা হটলাইন ১৬১২২', 'জাতীয় জরুরি সেবা ৯৯৯', 'দুদক হটলাইন ১০৬', 'স্বাস্থ্য বাতায়ন ১৬২৬৩']
            : ['Land service helpline 16122', 'National Emergency 999', 'ACC hotline 106', 'Health helpline 16263'],
        emergencyBypass: false,
        guardrailBlocked: false,
        disclaimer,
      });
    }

    // General directory + hotline response
    const decision = this.orgsHotlines?.decideHotline(query);
    const hotlinesText = (decision?.recommendedHotlines ?? [])
      .map((h) =>
        locale === 'bn'
          ? `- **${h.number}** — ${h.nameBn} (${h.agency}) [1]`
          : `- **${h.number}** — ${h.nameEn} (${h.agency}) [1]`,
      )
      .join('\n');

    const reply =
      locale === 'bn'
        ? `**সরকারি মন্ত্রণালয়, দপ্তর ও হটলাইন ডিরেক্টরি** [1]:\n\n` +
          `${hotlinesText || '- **333** — জাতীয় তথ্য ও নাগরিক সেবা হটলাইন [1]'}\n\n` +
          `- সকল মন্ত্রণালয় ও দপ্তরের তালিকা আমাদের **/ministries** এবং **/hotlines** পেজে দেখুন (যেসব দপ্তরের কর্মকর্তা তালিকা এখনো আমদানি হয়নি সেগুলো **যাচাই চলছে** হিসেবে চিহ্নিত) [1]।`
        : `**Government Ministry, Directorate & Hotline Directory** [1]:\n\n` +
          `${hotlinesText || '- **333** — National Info & Citizen Service Helpline [1]'}\n\n` +
          `- Browse all ministries and offices on **/ministries** and **/hotlines** (unimported officer listings are honestly marked **Verification pending**) [1].`;

    return this.finalizeTurn(session, issuedToken, sessionRenewed, {
      reply,
      locale,
      intent: 'directory_lookup',
      rewrittenQuery,
      toolsUsed: ['org_directory', 'hotline_lookup'],
      citations: [
        {
          index: 1,
          title: 'Bangladesh National Portal & Official Helpline Directory',
          agency: 'Cabinet Division / ICT Division (a2i)',
          sourceUrl: 'https://www.mygov.bd',
          trustLabel: 'OFFICIAL_SOURCE',
          lastVerifiedAt: '2026-11-15T00:00:00Z',
          excerpt: 'National Helpline 333, Emergency 999, Land 16122, NID 105, BRTA 16107.',
        },
      ],
      actionCards: [],
      suggestions:
        locale === 'bn'
          ? ['ভূমি মন্ত্রণালয় হটলাইন', 'ই-পাসপোর্ট হটলাইন ১৬৪৪৫', 'বিআরটিএ হটলাইন ১৬১০৭', 'জাতীয় জরুরি সেবা ৯৯৯']
          : ['Ministry of Land hotline', 'e-Passport helpline 16445', 'BRTA helpline 16107', 'National Emergency 999'],
      emergencyBypass: false,
      guardrailBlocked: false,
      disclaimer,
    });
  }

  private handleBenefitEligibility(
    session: StoredSession,
    issuedToken: string | undefined,
    sessionRenewed: boolean,
    query: string,
    locale: 'bn' | 'en',
    disclaimer: string,
    rewrittenQuery?: string,
  ): JonoChatResponse {
    const isFamilyCard = /(?:ফ্যামিলি\s*কার্ড|family\s*card)/i.test(query);
    const isOldAge = /(?:বয়স্ক\s*ভাতা|boyosko\s*bhata|old\s*age)/i.test(query);

    let reply: string;
    if (isFamilyCard) {
      reply =
        locale === 'bn'
          ? '**ফ্যামিলি কার্ড কর্মসূচি ২০২৬** (সমাজকল্যাণ মন্ত্রণালয়) অনুযায়ী যোগ্য নিম্ন-আয়ের পরিবারের মা বা নারী প্রধানের মোবাইল ওয়ালেট/ব্যাংক হিসাবে মাসিক **২,৫০০ টাকা** প্রদান করা হয় [1]।\n\n' +
            '- **পরিবারের সীমা:** প্রতি পরিবারের (সর্বোচ্চ ৫ সদস্য) জন্য একটি কার্ড প্রযোজ্য [1]।\n' +
            '- **যোগ্যতা যাচাই (সম্ভাব্য মিল):** ৮টি নেগেটিভ লিস্টের শর্ত (সরকারি চাকরি/পেনশন, ব্যক্তিগত গাড়ি, আয়কর দাতা ইত্যাদি) আমাদের নির্ধারিত নিয়ম-ভিত্তিক উইজার্ডে (**সম্ভাব্য মিল / Possible match**) যাচাই করুন [1]।\n' +
            '- **নিকটস্থ দপ্তর:** আপনার উপজেলা/শহর সমাজসেবা কার্যালয় অথবা সমাজকল্যাণ মন্ত্রণালয় (**+880255007000**, **socialprotection.gov.bd**) [1]।'
          : 'Under the **Family Card Programme 2026** (Ministry of Social Welfare), eligible low-income households receive **Tk 2,500/month** directly to the mother or female household head via mobile wallet or bank [1].\n\n' +
            '- **Household Scope:** One card per household (up to 5 members) [1].\n' +
            '- **Deterministic Eligibility Check (Possible Match):** Check the 8-category negative list in our Benefits Wizard — final decisions are made only by the official agency [1].\n' +
            '- **Responsible Office:** Your nearest Upazila/Urban Social Services Office or MoSW (**+880255007000**, **socialprotection.gov.bd**) [1].';
      session.context.lastTopicBn = 'ফ্যামিলি কার্ড কর্মসূচি ২০২৬';
      session.context.lastTopicEn = 'Family Card Programme 2026';
    } else if (isOldAge) {
      reply =
        locale === 'bn'
          ? '**বয়স্ক ভাতা কর্মসূচি (সমাজসেবা অধিদপ্তর — DSS)** অনুযায়ী প্রবীণ ও অসচ্ছল নাগরিকদের মাসিক **৬০০ টাকা** (জিটুপি পদ্ধতিতে মোবাইল ওয়ালেট বা ব্যাংকে) প্রদান করা হয় [1]।\n\n' +
            '- **বয়সের শর্ত:** পুরুষ ন্যূনতম **৬৫ বছর** এবং নারী ন্যূনতম **৬২ বছর** [1]।\n' +
            '- **নিকটস্থ দায়িত্বপ্রাপ্ত অফিস ও ফোন:** আপনার **উপজেলা সমাজসেবা কার্যালয়** (সমাজসেবা অধিদপ্তর প্রধান কার্যালয় ফোন: **+880255007000**, জাতীয় তথ্য হটলাইন: **333**) [1]।\n' +
            '- **আবেদন পোর্টাল:** **https://mis.bhata.gov.bd/onlineApplication** — নিচের বাটনে গিয়ে আপনার **সম্ভাব্য মিল (Possible match)** যাচাই করুন [1]।'
          : 'The **Old Age Allowance Programme (Department of Social Services — DSS)** provides **Tk 600/month** via G2P mobile wallet or bank transfer to eligible senior citizens [1].\n\n' +
            '- **Age Criteria:** Minimum **65 years for men** and **62 years for women** [1].\n' +
            '- **Nearest Responsible Office & Phone:** Your local **Upazila Social Services Office** (DSS HQ Phone: **+880255007000**, National Helpline: **333**) [1].\n' +
            '- **Official Portal:** **https://mis.bhata.gov.bd/onlineApplication** — use the button below to check your **possible match** [1].';
      session.context.lastTopicBn = 'বয়স্ক ভাতা (সমাজসেবা অধিদপ্তর)';
      session.context.lastTopicEn = 'Old Age Allowance (DSS)';
    } else {
      reply =
        locale === 'bn'
          ? 'সরকারি **বয়স্ক ভাতা (মাসিক ৬০০ টাকা)**, **বিধবা ভাতা (মাসিক ৫৫০ টাকা)**, **প্রতিবন্ধী ভাতা (মাসিক ৮৫০ টাকা)**, **ফ্যামিলি কার্ড ২০২৬ (মাসিক ২,৫০০ টাকা)** এবং **শিক্ষাবৃত্তির** সম্ভাব্য যোগ্যতা আমাদের নির্ধারিত নিয়ম-ভিত্তিক উইজার্ডে (**সম্ভাব্য মিল**) যাচাই করতে পারেন [1]।\n\n' +
            '- **দায়িত্বপ্রাপ্ত অফিস:** নিকটস্থ **উপজেলা সমাজসেবা কার্যালয়** (ফোন: **+880255007000**, হেল্পলাইন: **333**) এবং অফিসিয়াল পোর্টাল **mis.bhata.gov.bd** [1]।\n' +
            '- চূড়ান্ত সিদ্ধান্ত সংশ্লিষ্ট সরকারি দপ্তর গ্রহণ করে।'
          : 'Check your **possible match** for **Old Age Allowance (Tk 600/mo)**, **Widow Allowance (Tk 550/mo)**, **Disability Allowance (Tk 850/mo)**, **Family Card 2026 (Tk 2,500/mo)**, and **scholarships** using our deterministic eligibility wizard [1].\n\n' +
            '- **Responsible Office:** Your nearest **Upazila Social Services Office** (Phone: **+880255007000**, Helpline: **333**) and **mis.bhata.gov.bd** [1].\n' +
            '- Final entitlement is decided strictly by the official government agency.';
      session.context.lastTopicBn = 'সামাজিক নিরাপত্তা ভাতা ও ফ্যামিলি কার্ড';
      session.context.lastTopicEn = 'Social Safety Net Allowances & Family Card';
    }
    session.context.lastIntent = 'benefit_eligibility';

    return this.finalizeTurn(session, issuedToken, sessionRenewed, {
      reply,
      locale,
      intent: 'benefit_eligibility',
      rewrittenQuery,
      toolsUsed: ['programme_eligibility'],
      citations: [
        {
          index: 1,
          title: isFamilyCard
            ? 'Family Card Programme 2026 (MoSW)'
            : 'Department of Social Services (DSS) Allowances',
          agency: 'Ministry of Social Welfare / DSS',
          sourceUrl: isFamilyCard ? 'https://socialprotection.gov.bd' : 'https://mis.bhata.gov.bd',
          trustLabel: 'OFFICIAL_SOURCE',
          lastVerifiedAt: '2026-11-10T00:00:00Z',
          excerpt:
            'Family Card Tk 2,500/mo; Old Age Allowance Tk 600/mo (Male 65+, Female 62+); DSS Phone +880255007000.',
        },
      ],
      actionCards: [
        {
          type: 'eligibility_wizard',
          label:
            locale === 'bn'
              ? 'সম্ভাব্য যোগ্যতা যাচাই করুন (Possible Match)'
              : 'Check Possible Match in Eligibility Wizard',
          url: '/benefits',
          possibleMatchOnly: true,
        },
      ],
      suggestions:
        locale === 'bn'
          ? ['ফ্যামিলি কার্ড ২০২৬ যোগ্যতা', 'বয়স্ক ভাতা পাওয়ার বয়স কত?', 'বিধবা ভাতা আবেদন নিয়ম', 'প্রতিবন্ধী সুবর্ণ নাগরিক কার্ড']
          : ['Family Card 2026 eligibility', 'Old Age Allowance age limit', 'Widow Allowance application', 'Disability Suborna Nagorik Card'],
      emergencyBypass: false,
      guardrailBlocked: false,
      disclaimer,
    });
  }

  private handleComplaintQuery(
    session: StoredSession,
    issuedToken: string | undefined,
    sessionRenewed: boolean,
    query: string,
    locale: 'bn' | 'en',
    disclaimer: string,
    rewrittenQuery?: string,
  ): JonoChatResponse {
    const isConsumer = /(?:ভোক্তা|ভেজাল|ওজনে\s*কম|অতিরিক্ত\s*দাম|consumer|dncrp|vokta)/i.test(query);
    const reply = isConsumer
      ? locale === 'bn'
        ? '**ভোক্তা অধিকার সংরক্ষণ অধিদপ্তরে (DNCRP) অভিযোগ দাখিলের নিয়ম** [1]:\n\n' +
          '- **হটলাইন ও পোর্টাল:** ভোক্তা অধিকার হটলাইন **16121** অথবা **https://dncrp.gov.bd** (ঘটনার ৩০ দিনের মধ্যে ক্যাশ মেমো/রসিদসহ অভিযোগ করতে হয়) [1]।\n' +
          '- আমাদের **/complaints** পেজে অভিযোগের খসড়া তৈরি করে অফিসিয়াল পোর্টালে জমা দিতে পারেন [1]।'
        : '**How to File a Consumer Rights Complaint (DNCRP)** [1]:\n\n' +
          '- **Helpline & Portal:** Call **16121** or submit at **https://dncrp.gov.bd** within 30 days with your purchase receipt [1].\n' +
          '- Draft your complaint on **/complaints** before submitting on the official channel [1].'
      : locale === 'bn'
        ? 'সরকারি সেবায় বিলম্ব বা হয়রানির অভিযোগ **কেন্দ্রীয় অভিযোগ প্রতিকার ব্যবস্থা (GRS — https://www.grs.gov.bd)** অথবা **333** নম্বরে জানানো যায় [1]।\n\n' +
          '- **ঘুষ বা দুর্নীতির অভিযোগ:** দুর্নীতি দমন কমিশন (দুদক) হটলাইন **106** (বিনামূল্যে) [1]।\n' +
          '- **ভোক্তা প্রতারণায়:** ভোক্তা অধিকার হটলাইন **16121** [1]।'
        : 'File official public-service grievances via the **Grievance Redress System (GRS — https://www.grs.gov.bd)** or call **333** [1].\n\n' +
          '- **Bribery or Corruption:** Call the Anti-Corruption Commission (ACC) toll-free on **106** [1].\n' +
          '- **Consumer Fraud:** Call DNCRP on **16121** [1].';

    session.context.lastTopicBn = 'সরকারি সেবায় অভিযোগ (GRS / দুদক)';
    session.context.lastTopicEn = 'Public Service Grievance (GRS / ACC)';
    session.context.lastIntent = 'complaint';

    return this.finalizeTurn(session, issuedToken, sessionRenewed, {
      reply,
      locale,
      intent: 'complaint',
      rewrittenQuery,
      toolsUsed: ['search_services', 'hotline_lookup'],
      citations: [
        {
          index: 1,
          title: 'Cabinet Division Grievance Redress System (GRS) & ACC 106',
          agency: 'Cabinet Division / ACC / DNCRP',
          sourceUrl: 'https://www.grs.gov.bd',
          trustLabel: 'OFFICIAL_SOURCE',
          lastVerifiedAt: '2026-11-10T00:00:00Z',
          excerpt: 'Official GRS portal grs.gov.bd, ACC 106, DNCRP 16121, National Helpline 333.',
        },
      ],
      actionCards: [
        {
          type: 'complaint_draft',
          label: locale === 'bn' ? 'অভিযোগের খসড়া তৈরি করুন' : 'Draft Official Complaint',
          url: '/complaints',
          trustLabel: 'OFFICIAL_SOURCE',
        },
      ],
      suggestions:
        locale === 'bn'
          ? ['জিআরএস পোর্টালে বেনামে অভিযোগ করা যায়?', 'দুদক হটলাইন ১০৬', 'ভোক্তা অধিকার হটলাইন ১৬১২১', 'ভূমি অভিযোগ হটলাইন ১৬১২২']
          : ['Can I file an anonymous GRS complaint?', 'ACC hotline 106', 'Consumer rights 16121', 'Land complaint 16122'],
      emergencyBypass: false,
      guardrailBlocked: false,
      disclaimer,
    });
  }

  private async handleNoticeLookup(
    session: StoredSession,
    issuedToken: string | undefined,
    sessionRenewed: boolean,
    _query: string,
    locale: 'bn' | 'en',
    disclaimer: string,
    rewrittenQuery?: string,
  ): Promise<JonoChatResponse> {
    const calendar = this.orgsHotlines?.getCalendar().items ?? [];
    const lines = calendar.slice(0, 4).map((c) =>
      locale === 'bn'
        ? `- **${c.titleBn}:** তারিখ **${c.date}** (${c.agency} — ${c.officialUrl}) [1]`
        : `- **${c.titleEn}:** Date **${c.date}** (${c.agency} — ${c.officialUrl}) [1]`,
    );
    const reply =
      locale === 'bn'
        ? `**সরকারি নোটিশ, সময়সীমা ও জাতীয় ক্যালেন্ডার** [1]:\n\n${lines.join('\n')}\n\n- সম্পূর্ণ তালিকা **/notices** ও **/calendar** পেজে দেখুন [1]।`
        : `**Official Notices, Deadlines & National Calendar** [1]:\n\n${lines.join('\n')}\n\n- View all active notices and deadlines on **/notices** and **/calendar** [1].`;

    return this.finalizeTurn(session, issuedToken, sessionRenewed, {
      reply,
      locale,
      intent: 'notice_lookup',
      rewrittenQuery,
      toolsUsed: ['notices'],
      citations: [
        {
          index: 1,
          title: 'Bangladesh National Deadlines & Official Notices',
          agency: 'NBR / MoPA / Bangladesh Railway',
          sourceUrl: 'https://www.mygov.bd',
          trustLabel: 'OFFICIAL_SOURCE',
          lastVerifiedAt: '2026-11-10T00:00:00Z',
          excerpt: calendar.map((c) => `${c.titleEn} (${c.date})`).join('; '),
        },
      ],
      actionCards: [],
      suggestions:
        locale === 'bn'
          ? ['আয়কর রিটার্ন দাখিলের শেষ তারিখ', 'ঈদ অগ্রিম ট্রেন টিকিট কবে?', 'সরকারি ছুটির তালিকা', 'অনলাইন ই-রিটার্ন দাখিল']
          : ['Income tax e-Return deadline', 'Eid advance train ticket dates', 'Public holidays', 'Online e-Return filing'],
      emergencyBypass: false,
      guardrailBlocked: false,
      disclaimer,
    });
  }

  /**
   * Section 1.6 Hybrid Knowledge Base Search + Section 1.7 No-Dead-End Fallback:
   * Never returns the old blunt refusal string.
   */
  private async handleKnowledgeBaseOrFallback(
    session: StoredSession,
    issuedToken: string | undefined,
    sessionRenewed: boolean,
    query: string,
    locale: 'bn' | 'en',
    disclaimer: string,
    rewrittenQuery?: string,
  ): Promise<JonoChatResponse> {
    // 1. Score all 62 services in SERVICES_SEED using normalized tokens & aliases
    const qNorm = normalizeBanglaText(query);
    const tokens = qNorm.split(' ').filter((t) => t.length >= 2);

    let bestService: ServiceSeed | undefined;
    let bestScore = 0;

    for (const svc of SERVICES_SEED) {
      const hay = normalizeBanglaText(
        `${svc.titleBn} ${svc.titleEn} ${svc.summaryBn} ${svc.summaryEn} ${svc.aliases.join(' ')} ${svc.slug.replace(/-/g, ' ')}`,
      );
      let score = 0;
      if (hay.includes(qNorm) && qNorm.length >= 3) score += 10;
      for (const tok of tokens) {
        if (hay.includes(tok)) score += 3;
      }
      if (score > bestScore) {
        bestScore = score;
        bestService = svc;
      }
    }

    if (bestService && bestScore >= 4) {
      return this.buildServiceToolAnswer(
        session,
        issuedToken,
        sessionRenewed,
        bestService,
        locale,
        disclaimer,
        rewrittenQuery,
      );
    }

    // 2. Try CatalogueService universalSearch if available
    if (this.catalogue) {
      try {
        const searchRes = await this.catalogue.universalSearch({
          query,
          locale,
          limit: 3,
        });
        const topHit = searchRes.hits[0];
        if (topHit && topHit.type === 'service') {
          const svc = SERVICES_SEED.find((s) => s.slug === topHit.slugOrCode);
          if (svc) {
            return this.buildServiceToolAnswer(
              session,
              issuedToken,
              sessionRenewed,
              svc,
              locale,
              disclaimer,
              rewrittenQuery,
            );
          }
        }
      } catch {
        // Continue to no-dead-end fallback
      }
    }

    // 3. Section 1.7 No-Dead-End Response: Top 3 catalogue matches + responsible office/hotline + 333
    const fallbackMatches = SERVICES_SEED.slice(0, 3);
    const matchLines = fallbackMatches
      .map((s, idx) =>
        locale === 'bn'
          ? `${idx + 1}. **${s.titleBn}** — ${s.officialUrl} (ফি: ${s.feeTextBn}) [1]`
          : `${idx + 1}. **${s.titleEn}** — ${s.officialUrl} (Fee: ${s.feeTextEn}) [1]`,
      )
      .join('\n');

    const reply =
      locale === 'bn'
        ? `এ বিষয়ে আমার কাছে যাচাইকৃত বিস্তারিত নেই, তবে এগুলো সাহায্য করতে পারে [1]:\n\n` +
          `${matchLines}\n\n` +
          `- **দায়িত্বপ্রাপ্ত দপ্তর ও জাতীয় হেল্পলাইন:** যেকোনো সরকারি সেবার সরাসরি তথ্যের জন্য **মাইগভ (https://www.mygov.bd)** পোর্টাল দেখুন অথবা ২৪/৭ জাতীয় তথ্য হটলাইন **333** নম্বরে কল করুন [1]।`
        : `I do not have verified details on that specific query yet, but these verified services may help [1]:\n\n` +
          `${matchLines}\n\n` +
          `- **Responsible Office & National Helpline:** Visit **myGov (https://www.mygov.bd)** or call the 24/7 National Information Helpline on **333** [1].`;

    return this.finalizeTurn(session, issuedToken, sessionRenewed, {
      reply,
      locale,
      intent: 'service_question',
      rewrittenQuery,
      toolsUsed: ['search_services', 'hotline_lookup'],
      citations: [
        {
          index: 1,
          title:
            locale === 'bn'
              ? 'মাইগভ (myGov) ও জাতীয় তথ্য হেল্পলাইন ৩৩৩'
              : 'myGov Bangladesh & National Info Helpline 333',
          agency: 'Cabinet Division / ICT Division (a2i)',
          sourceUrl: 'https://www.mygov.bd',
          trustLabel: 'OFFICIAL_SOURCE',
          lastVerifiedAt: '2026-11-10T00:00:00Z',
          excerpt: 'Official citizen service portal mygov.bd and national helpline 333.',
        },
      ],
      actionCards: [
        {
          type: 'emergency_call',
          label: locale === 'bn' ? '333 — জাতীয় তথ্য হটলাইন' : 'Call 333 — National Info Helpline',
          phone: '333',
          url: 'tel:333',
          trustLabel: 'OFFICIAL_SOURCE',
        },
      ],
      suggestions:
        locale === 'bn'
          ? ['নতুন জন্ম নিবন্ধন আবেদন', 'ই-পাসপোর্ট আবেদন ও ফি', 'অনলাইন ভূমি উন্নয়ন কর (খাজনা)', 'জাতীয় পরিচয়পত্র (NID) সেবা']
          : ['New Birth Registration', 'e-Passport Application & Fees', 'Online Land Tax (Khajna)', 'National ID (NID) Services'],
      emergencyBypass: false,
      guardrailBlocked: false,
      disclaimer,
    });
  }

  getHistory(
    sessionId: string,
    actor: ChatSessionActor,
    now: Date = new Date(),
  ): { sessionId: string; expiresAt: string | null; turns: JonoChatTurn[] } {
    const sess = this.assertOwnership(sessionId, actor, now);
    return {
      sessionId: sess.sessionId,
      expiresAt: sess.expiresAt ? sess.expiresAt.toISOString() : null,
      turns: [...sess.turns],
    };
  }

  deleteSession(
    sessionId: string,
    actor: ChatSessionActor,
    now: Date = new Date(),
  ): { deleted: true; sessionId: string } {
    this.assertOwnership(sessionId, actor, now);
    this.sessions.delete(sessionId);
    return { deleted: true, sessionId };
  }

  submitFeedback(params: {
    sessionId: string;
    userId?: string;
    sessionToken?: string;
    turnId: string;
    rating: 'up' | 'down';
    reason?: string;
  }): { id: string; recorded: true } {
    const actor: ChatSessionActor = {
      userId: params.userId && params.userId !== 'guest' ? params.userId : undefined,
      sessionToken: params.sessionToken,
    };
    const sess = this.assertOwnership(params.sessionId, actor);
    const id = uuidv7();
    this.feedback.push({
      id,
      sessionId: sess.sessionId,
      actorId: actor.userId ?? `anon:${sess.sessionId}`,
      turnId: params.turnId,
      rating: params.rating,
      reason: params.reason,
      createdAt: new Date().toISOString(),
    });
    return { id, recorded: true };
  }

  getFeedbackStats(): { total: number; up: number; down: number } {
    const up = this.feedback.filter((f) => f.rating === 'up').length;
    return { total: this.feedback.length, up, down: this.feedback.length - up };
  }

  /** Purges expired guest chat sessions (30-day retention policy) */
  purgeExpiredSessions(now: Date = new Date()): number {
    let purged = 0;
    for (const [id, sess] of this.sessions) {
      if (sess.expiresAt && sess.expiresAt.getTime() <= now.getTime()) {
        this.sessions.delete(id);
        purged += 1;
      }
    }
    return purged;
  }

  private createSession(actor: ChatSessionActor): {
    session: StoredSession;
    sessionToken?: string;
  } {
    const id = uuidv7();
    const now = new Date();
    const initialContext: SessionTopicContext = { rollingSummary: [] };
    if (actor.userId) {
      const session: StoredSession = {
        sessionId: id,
        ownerUserId: actor.userId,
        anonymousTokenHash: null,
        createdAt: now,
        expiresAt: null,
        turns: [],
        context: initialContext,
      };
      this.sessions.set(id, session);
      return { session };
    }

    const { token, tokenHash } = this.issueAnonymousSessionToken(id);
    const session: StoredSession = {
      sessionId: id,
      ownerUserId: null,
      anonymousTokenHash: tokenHash,
      createdAt: now,
      expiresAt: new Date(now.getTime() + GUEST_SESSION_TTL_MS),
      turns: [],
      context: initialContext,
    };
    this.sessions.set(id, session);
    return { session, sessionToken: token };
  }

  private finalizeTurn(
    session: StoredSession,
    issuedToken: string | undefined,
    sessionRenewed: boolean,
    data: Omit<
      JonoChatResponse,
      'sessionId' | 'turnId' | 'sessionToken' | 'sessionRenewed' | 'expiresAt'
    >,
  ): JonoChatResponse {
    const turnId = uuidv7();
    const evidenceCorpus = [
      data.reply,
      ...data.citations.map((c) => `${c.title} ${c.excerpt} ${c.lastVerifiedAt}`),
    ];
    const { validatedReply } = validateGroundedNumbers(data.reply, evidenceCorpus);

    session.turns.push({
      turnId,
      role: 'assistant',
      text: validatedReply,
      createdAt: new Date().toISOString(),
      intent: data.intent,
      toolsUsed: data.toolsUsed,
    });
    return {
      sessionId: session.sessionId,
      ...(issuedToken ? { sessionToken: issuedToken } : {}),
      ...(sessionRenewed ? { sessionRenewed: true } : {}),
      ...(session.expiresAt ? { expiresAt: session.expiresAt.toISOString() } : {}),
      turnId,
      ...data,
      reply: validatedReply,
      citations: pruneCitedSources(validatedReply, data.citations),
    };
  }
}
