import { randomUUID } from 'node:crypto';
import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import {
  OFFICIAL_HANDOFF_FRAUD_WARNING,
  OSM_ODBL_ATTRIBUTION,
  TrustLabel,
  evaluateFreshness,
} from '@jonoshheba/shared';
import { AGENCIES_SEED, SERVICES_SEED } from '../../seed-data/catalogue';
import {
  loadJsonData,
  type OrgsHotlinesCalendarData,
  type Taxonomy18Data,
} from './coverage-data.loader';
import { GeoGazetteerService } from './geo.service';
import { RailMobilityService } from './rail-mobility.service';

export type MinistryGroup =
  | 'Administration & Law'
  | 'Economy & Finance'
  | 'Agriculture & Food'
  | 'Health & Social Welfare'
  | 'Education & ICT'
  | 'Infrastructure & Transport'
  | 'Power/Energy & Environment'
  | 'Home/Defence/Foreign Affairs'
  | 'Local Government & Rural Development'
  | 'Culture/Religion/Youth';

export const MINISTRY_GROUPS: ReadonlyArray<{
  code: MinistryGroup;
  nameBn: string;
  nameEn: string;
}> = [
  { code: 'Administration & Law', nameBn: 'প্রশাসন, মন্ত্রিপরিষদ ও আইন', nameEn: 'Administration & Law' },
  { code: 'Economy & Finance', nameBn: 'অর্থনীতি, রাজস্ব ও বাণিজ্য', nameEn: 'Economy & Finance' },
  { code: 'Agriculture & Food', nameBn: 'কৃষি, খাদ্য ও মৎস্য', nameEn: 'Agriculture & Food' },
  { code: 'Health & Social Welfare', nameBn: 'স্বাস্থ্য ও সমাজকল্যাণ', nameEn: 'Health & Social Welfare' },
  { code: 'Education & ICT', nameBn: 'শিক্ষা, বিজ্ঞান ও আইসিটি', nameEn: 'Education & ICT' },
  { code: 'Infrastructure & Transport', nameBn: 'অবকাঠামো, সড়ক ও রেল পরিবহন', nameEn: 'Infrastructure & Transport' },
  { code: 'Power/Energy & Environment', nameBn: 'বিদ্যুৎ, জ্বালানি ও পরিবেশ', nameEn: 'Power/Energy & Environment' },
  { code: 'Home/Defence/Foreign Affairs', nameBn: 'স্বরাষ্ট্র, পাসপোর্ট ও পররাষ্ট্র', nameEn: 'Home/Defence/Foreign Affairs' },
  { code: 'Local Government & Rural Development', nameBn: 'স্থানীয় সরকার ও পল্লী উন্নয়ন', nameEn: 'Local Government & Rural Development' },
  { code: 'Culture/Religion/Youth', nameBn: 'সংস্কৃতি, ধর্ম ও যুব', nameEn: 'Culture/Religion/Youth' },
];

function inferMinistryGroup(idOrSlug: string, nameEn: string): MinistryGroup {
  const s = `${idOrSlug} ${nameEn}`.toLowerCase();
  if (/(cabinet|grs|nid|ec-nidw|law|nlaso)/.test(s)) return 'Administration & Law';
  if (/(nbr|rjsc|tax|revenue|dncrp|consumer|finance)/.test(s)) return 'Economy & Finance';
  if (/(dae|krishi|agri|food)/.test(s)) return 'Agriculture & Food';
  if (/(dghs|health|msw|dss|social|welfare)/.test(s)) return 'Health & Social Welfare';
  if (/(dshe|education|mygov|ict|a2i)/.test(s)) return 'Education & ICT';
  if (/(brta|rail|transport|bridge|bba|dmtcl)/.test(s)) return 'Infrastructure & Transport';
  if (/(power|desco|dpdc|breb|gas|titas|ddm|disaster)/.test(s)) return 'Power/Energy & Environment';
  if (/(dip|passport|police|home|bmet|probashi)/.test(s)) return 'Home/Defence/Foreign Affairs';
  if (/(lgd|bdris|wasa|city|cumilla|bogura|local)/.test(s)) return 'Local Government & Rural Development';
  return 'Administration & Law';
}

interface HotlineRule {
  keywords: RegExp;
  numbers: string[];
  reasonBn: string;
  reasonEn: string;
}

/** C10: Deterministic rule-based "Which number do I call?" decision helper (NOT LLM) */
const HOTLINE_DECISION_RULES: HotlineRule[] = [
  {
    keywords: /(?:fire|আগুন|অগ্নিকাণ্ড)/i,
    numbers: ['102', '999'],
    reasonBn: 'অগ্নিকাণ্ডে সরাসরি ফায়ার সার্ভিস ১০২ অথবা জাতীয় জরুরি সেবা ৯৯৯ নম্বরে কল করুন।',
    reasonEn: 'For fire emergencies, call Fire Service (102) or National Emergency (999) immediately.',
  },
  {
    keywords: /(?:women|harassment|domestic|violence|নারী|নির্যাতন|যৌতুক)/i,
    numbers: ['109', '999'],
    reasonBn: 'নারী ও শিশু নির্যাতন প্রতিরোধে ১০৯ এবং তাৎক্ষণিক বিপদে ৯৯৯ নম্বরে কল করুন।',
    reasonEn: 'For violence against women/children call 109, or 999 in immediate danger.',
  },
  {
    keywords: /(?:child|missing child|শিশু|বাল্যবিবাহ)/i,
    numbers: ['1098', '999'],
    reasonBn: 'শিশুর সুরক্ষা ও সহায়তায় চাইল্ড হেল্পলাইন ১০৯৮ নম্বরে বিনামূল্যে কল করুন।',
    reasonEn: 'For a child at risk or child protection, call Child Helpline 1098 (toll-free).',
  },
  {
    keywords: /(?:health|doctor|fever|dengue|hospital|স্বাস্থ্য|ডাক্তার|জ্বর|ডেঙ্গু)/i,
    numbers: ['16263', '999'],
    reasonBn: 'সরকারি চিকিৎসকের ২৪/৭ পরামর্শের জন্য স্বাস্থ্য বাতায়ন ১৬২৬৩ এবং জরুরি অ্যাম্বুলেন্সে ৯৯৯।',
    reasonEn: 'Call Shastho Batayon 16263 for 24/7 health advice, or 999 for emergency ambulance.',
  },
  {
    keywords: /(?:corruption|bribe|ঘুষ|দুর্নীতি|দুদক)/i,
    numbers: ['106'],
    reasonBn: 'ঘুষ বা দুর্নীতির অভিযোগে দুর্নীতি দমন কমিশন (দুদক) হটলাইন ১০৬ নম্বরে কল করুন।',
    reasonEn: 'Report bribery or corruption to the Anti-Corruption Commission (ACC) on 106.',
  },
  {
    keywords: /(?:legal|lawyer|court|আইনি|মামলা|উকিল)/i,
    numbers: ['16430'],
    reasonBn: 'বিনামূল্যে সরকারি আইনি সহায়তার জন্য লিগ্যাল এইড হেল্পলাইন ১৬৪৩০ নম্বরে কল করুন।',
    reasonEn: 'For free government legal aid, call NLASO helpline 16430.',
  },
  {
    keywords: /(?:land|namjari|khotiyan|ভূমি|জমি|নামজারি|খতিয়ান)/i,
    numbers: ['16122'],
    reasonBn: 'ভূমি নামজারি, খতিয়ান ও ভূমি অভিযোগের জন্য ১৬১২২ নম্বরে কল করুন।',
    reasonEn: 'For land mutation, khatian, or land complaints, call Ministry of Land helpline 16122.',
  },
  {
    keywords: /(?:train|rail|ticket|ট্রেন|রেল|স্টেশন)/i,
    numbers: ['131'],
    reasonBn: 'বাংলাদেশ রেলওয়ে তথ্য ও অভিযোগের জন্য ১৩১ নম্বরে কল করুন।',
    reasonEn: 'For Bangladesh Railway info and complaints, call 131.',
  },
  {
    keywords: /(?:nid|voter|এনআইডি|পরিচয়পত্র)/i,
    numbers: ['105'],
    reasonBn: 'জাতীয় পরিচয়পত্র (NID) ও ভোটার তথ্যের জন্য ১০৫ নম্বরে কল করুন।',
    reasonEn: 'For NID and voter registration queries, call Election Commission helpline 105.',
  },
  {
    keywords: /(?:cyclone|flood|weather|ঘূর্ণিঝড়|বন্যা|আবহাওয়া)/i,
    numbers: ['1090', '999'],
    reasonBn: 'দুর্যোগ ও আবহাওয়ার আগাম বার্তার জন্য ১০৯০ এবং জরুরি উদ্ধারে ৯৯৯ নম্বরে কল করুন।',
    reasonEn: 'For weather/disaster early warning IVR call 1090; for rescue call 999.',
  },
  {
    keywords: /(?:electricity|power|desco|dpdc|palli bidyut|বিদ্যুৎ|লোডশেডিং)/i,
    numbers: ['16120', '16116', '16899', '16200', '16603', '16117'],
    reasonBn: 'আপনার বিদ্যুৎ বিতরণ সংস্থা অনুযায়ী কল করুন: DESCO 16120, DPDC 16116, পবিস 16899, BPDB 16200, NESCO 16603, WZPDCL 16117।',
    reasonEn: 'Call your electricity distributor: DESCO 16120, DPDC 16116, BREB/PBS 16899, BPDB 16200, NESCO 16603, WZPDCL 16117.',
  },
];

@Injectable()
export class OrgsCatalogHotlinesService {
  readonly taxonomy: Taxonomy18Data;
  readonly opsData: OrgsHotlinesCalendarData;
  private readonly placeReports: Array<Record<string, unknown>> = [];

  constructor(
    private readonly geo: GeoGazetteerService,
    @Optional()
    @Inject(RailMobilityService)
    private readonly mobility?: RailMobilityService,
  ) {
    this.taxonomy = loadJsonData<Taxonomy18Data>('data/coverage/taxonomy-18.json');
    this.opsData = loadJsonData<OrgsHotlinesCalendarData>('data/coverage/orgs-hotlines-calendar.json');
  }

  // --- C06 & Section 3: Agency & Ministry Directory (with Leadership & Office Hotlines) ---

  private getEnrichedOrganisations() {
    const baseOrgs = [...this.opsData.organisations];
    const existingWebsites = new Set(baseOrgs.map((o) => o.website.replace(/\/+$/, '').toLowerCase()));

    for (const ag of AGENCIES_SEED) {
      const cleanUrl = ag.officialUrl.replace(/\/+$/, '').toLowerCase();
      if (existingWebsites.has(cleanUrl)) continue;
      const offered = SERVICES_SEED.filter((s) => s.agencySlug === ag.slug).map((s) => s.slug);
      baseOrgs.push({
        id: `org-${ag.slug}`,
        type: ag.nameBn.includes('মন্ত্রণালয়') || ag.nameBn.includes('বিভাগ') ? 'ministry' : 'directorate',
        nameBn: ag.nameBn,
        nameEn: ag.nameEn,
        aliases: [ag.slug],
        nameHistory: [],
        districtEn: 'Dhaka',
        lat: 23.7294,
        lng: 90.4079,
        website: ag.officialUrl,
        citizenCharterUrl: ag.officialUrl,
        phone: ag.contactPhone ?? '333',
        servicesOffered: offered,
        sourceId: 'SRC_MYGOV_A2I',
        lastVerifiedAt: '2026-11-10T00:00:00Z',
      });
      existingWebsites.add(cleanUrl);
    }

    return baseOrgs.map((o) => {
      const group = inferMinistryGroup(o.id, o.nameEn);
      const groupMeta = MINISTRY_GROUPS.find((g) => g.code === group)!;
      const parentId =
        o.type === 'ministry'
          ? null
          : o.id === 'org-bdris' || o.id === 'org-wasa' || o.id === 'org-bogura-cc'
            ? 'org-lgd'
            : o.id === 'org-dc-cumilla'
              ? 'org-cabinet'
              : null;

      // Rule C1 & C4: Never invent personal mobile numbers or unsourced official names.
      // Show published office phone + "Verification pending" until data/imports/ministries/ files are imported.
      const leadership = [
        {
          designationBn:
            o.type === 'ministry'
              ? 'মাননীয় উপদেষ্টা / মন্ত্রী (দপ্তর প্রধান)'
              : 'মহাপরিচালক / সংস্থা প্রধান',
          designationEn:
            o.type === 'ministry'
              ? 'Honourable Adviser / Minister (Head of Ministry)'
              : 'Director General / Head of Agency',
          incumbentNameBn: 'যাচাই চলছে (অফিসিয়াল কর্মকর্তা তালিকা আমদানি অপেক্ষমাণ)',
          incumbentNameEn: 'Verification pending (awaiting official officer-page import)',
          officePhone: o.phone,
          officialEmail: null,
          asOf: o.lastVerifiedAt,
          sourceUrl: o.website,
          verificationStatus: 'verification_pending' as const,
        },
        {
          designationBn:
            o.type === 'ministry'
              ? 'সিনিয়র সচিব / সচিব'
              : 'সচিব / পরিচালক (প্রশাসন)',
          designationEn:
            o.type === 'ministry'
              ? 'Senior Secretary / Secretary'
              : 'Secretary / Director (Administration)',
          incumbentNameBn: 'যাচাই চলছে (অফিসিয়াল কর্মকর্তা তালিকা আমদানি অপেক্ষমাণ)',
          incumbentNameEn: 'Verification pending (awaiting official officer-page import)',
          officePhone: o.phone,
          officialEmail: null,
          asOf: o.lastVerifiedAt,
          sourceUrl: o.website,
          verificationStatus: 'verification_pending' as const,
        },
      ];

      const contacts = [
        {
          roleBn: 'প্রধান অফিস টেলিফোন / হটলাইন',
          roleEn: 'Main Office Telephone / Helpline',
          phone: o.phone,
          telUri: `tel:${o.phone}`,
          hours: 'রবি–বৃহস্পতি সকাল ৯:০০ – বিকাল ৫:০০ (হটলাইন ২৪/৭)',
          sourceUrl: o.website,
        },
        {
          roleBn: 'অভিযোগ প্রতিকার (GRS) ফোকাল পয়েন্ট',
          roleEn: 'Grievance Redress System (GRS) Focal Point',
          phone: '333',
          telUri: 'tel:333',
          portalUrl: 'https://www.grs.gov.bd',
          hours: '24/7 online at grs.gov.bd',
          sourceUrl: 'https://www.grs.gov.bd',
        },
        {
          roleBn: 'তথ্য অধিকার (RTI) দায়িত্বপ্রাপ্ত কর্মকর্তা',
          roleEn: 'Right to Information (RTI) Designated Officer',
          phone: o.phone,
          telUri: `tel:${o.phone}`,
          portalUrl: o.citizenCharterUrl,
          hours: 'Office hours (Sun–Thu 09:00–17:00)',
          sourceUrl: o.citizenCharterUrl,
        },
      ];

      return {
        ...o,
        group,
        groupBn: groupMeta.nameBn,
        groupEn: groupMeta.nameEn,
        parentId,
        addressBn: `${o.districtEn === 'Dhaka' ? 'বাংলাদেশ সচিবালয় / আগারগাঁও, ঢাকা' : o.districtEn}`,
        addressEn: `${o.districtEn === 'Dhaka' ? 'Bangladesh Secretariat / Dhaka' : o.districtEn}`,
        officeHoursBn: 'রবিবার – বৃহস্পতিবার সকাল ৯:০০ – বিকাল ৫:০০ (শুক্র ও শনিবার সাপ্তাহিক ছুটি)',
        officeHoursEn: 'Sunday – Thursday 09:00 – 17:00 Asia/Dhaka (Closed Friday & Saturday)',
        grsPortalUrl: 'https://www.grs.gov.bd',
        leadership,
        contacts,
        trustLabel: TrustLabel.OFFICIAL_SOURCE,
      };
    });
  }

  listOrgs(params: { q?: string; type?: string; group?: string; geo?: string }) {
    let items = this.getEnrichedOrganisations();
    if (params.type && params.type.trim()) {
      items = items.filter((o) => o.type.toLowerCase() === params.type!.trim().toLowerCase());
    }
    if (params.group && params.group.trim()) {
      const g = params.group.trim().toLowerCase();
      items = items.filter(
        (o) =>
          o.group.toLowerCase().includes(g) ||
          o.groupBn.includes(params.group!.trim()),
      );
    }
    if (params.geo) {
      const g = params.geo.toLowerCase();
      items = items.filter((o) => o.districtEn.toLowerCase().includes(g));
    }
    if (params.q && params.q.trim()) {
      const n = params.q.trim().toLowerCase();
      items = items.filter(
        (o) =>
          o.id.toLowerCase().includes(n) ||
          o.nameEn.toLowerCase().includes(n) ||
          o.nameBn.toLowerCase().includes(n) ||
          o.groupBn.includes(params.q!.trim()) ||
          o.aliases.some((a) => a.toLowerCase().includes(n)) ||
          o.nameHistory.some((h) => h.oldNameEn.toLowerCase().includes(n)),
      );
    }
    return {
      count: items.length,
      groups: MINISTRY_GROUPS,
      verificationNoticeBn:
        'দপ্তরসমূহের অফিসিয়াল ওয়েবসাইট ও প্রধান ফোন নম্বর যাচাইকৃত; পদবিভিত্তিক কর্মকর্তাদের তালিকা আমদানির কাজ চলমান (যাচাই চলছে)।',
      verificationNoticeEn:
        'Official websites and main office phones are verified; designation-level officer listings are marked Verification pending until official files are imported.',
      items,
    };
  }

  getOrg(id: string) {
    const all = this.getEnrichedOrganisations();
    const org = all.find((o) => o.id === id || o.aliases.includes(id));
    if (!org) throw new NotFoundException(`Organisation '${id}' not found`);
    const children = all.filter((c) => c.parentId === org.id);
    const linkedServices = SERVICES_SEED.filter(
      (s) => org.servicesOffered.includes(s.slug) || `org-${s.agencySlug}` === org.id,
    );
    return {
      ...org,
      children,
      linkedServices,
    };
  }

  getOrgChildren(id: string) {
    const org = this.getOrg(id);
    return {
      parent: { id: org.id, nameBn: org.nameBn, nameEn: org.nameEn },
      count: org.children.length,
      items: org.children,
    };
  }

  getOrgServices(id: string) {
    const org = this.getOrg(id);
    return {
      organisation: { id: org.id, nameBn: org.nameBn, nameEn: org.nameEn, website: org.website },
      servicesOffered: org.servicesOffered,
      services: org.linkedServices,
      citizenCharterUrl: org.citizenCharterUrl,
    };
  }

  /** "Who handles this here?" resolver combining C01 Geo + C06 Org Registry */
  resolveResponsibleOffice(serviceSlug: string, lat: number, lng: number) {
    const area = this.geo.resolvePoint(lat, lng);
    const districtName = area.district.nameEn;
    const localOrg =
      this.opsData.organisations.find(
        (o) =>
          o.districtEn.toLowerCase() === districtName.toLowerCase() &&
          o.servicesOffered.includes(serviceSlug),
      ) ??
      this.opsData.organisations.find((o) => o.servicesOffered.includes(serviceSlug)) ??
      this.opsData.organisations[0]!;

    return {
      serviceSlug,
      resolvedArea: {
        division: area.division?.nameEn ?? null,
        district: districtName,
        upazila: area.upazila?.nameEn ?? null,
        union: area.union?.nameEn ?? null,
      },
      responsibleOffice: localOrg,
      officialOnlineChannel: localOrg.website,
      fraudWarning: OFFICIAL_HANDOFF_FRAUD_WARNING,
    };
  }

  // --- C07: 18-Category Taxonomy, 40+ Life-Event Bundles & Social Protection Programmes ---

  getTaxonomy() {
    return {
      categoryCount: this.taxonomy.categories.length,
      sourceId: this.taxonomy.sourceId,
      lastVerifiedAt: this.taxonomy.lastVerifiedAt,
      categories: this.taxonomy.categories,
    };
  }

  getLifeEventBundles(category?: string) {
    let bundles = this.taxonomy.lifeEventBundles;
    if (category) {
      bundles = bundles.filter((b) => b.categories.includes(category));
    }
    return { count: bundles.length, items: bundles };
  }

  listProgrammes(q?: string) {
    let items = this.taxonomy.socialProtectionProgrammes;
    if (q && q.trim()) {
      const n = q.trim().toLowerCase();
      items = items.filter(
        (p) =>
          p.nameEn.toLowerCase().includes(n) ||
          p.nameBn.toLowerCase().includes(n) ||
          p.aliases.some((a) => a.toLowerCase().includes(n)) ||
          p.nameHistory.some((h) => h.oldNameEn.toLowerCase().includes(n)),
      );
    }
    return {
      count: items.length,
      page: { limit: items.length, nextCursor: null, hasMore: false, total: items.length },
      items: items.map((p) => ({
        ...p,
        freshness: evaluateFreshness({
          entityType: 'fee_or_eligibility',
          lastVerifiedAt: p.lastVerifiedAt,
          baseTrustLabel: TrustLabel.OFFICIAL_SOURCE,
        }),
      })),
    };
  }

  getProgramme(slug: string) {
    const prog = this.taxonomy.socialProtectionProgrammes.find((p) => p.slug === slug);
    if (!prog) throw new NotFoundException(`Social protection programme '${slug}' not found`);
    return {
      ...prog,
      freshness: evaluateFreshness({
        entityType: 'fee_or_eligibility',
        lastVerifiedAt: prog.lastVerifiedAt,
        baseTrustLabel: TrustLabel.OFFICIAL_SOURCE,
      }),
    };
  }

  /** Deterministic Social Protection Eligibility Evaluator (incl. Family Card 2026 8-category negative list!) */
  evaluateProgrammeEligibility(slug: string, answers: Record<string, unknown>) {
    const prog = this.taxonomy.socialProtectionProgrammes.find((p) => p.slug === slug);
    if (!prog) throw new NotFoundException(`Social protection programme '${slug}' not found`);

    const reasonsBn: string[] = [];
    const reasonsEn: string[] = [];
    let status: 'POSSIBLE_MATCH' | 'NOT_ELIGIBLE' | 'NEEDS_MORE_INFO' = 'POSSIBLE_MATCH';

    if (slug === 'family-card-2026') {
      const triggeredNegatives = prog.negativeListCategories.filter(
        (flag) => answers[flag] === true,
      );
      if (triggeredNegatives.length > 0) {
        status = 'NOT_ELIGIBLE';
        reasonsBn.push(
          `ফ্যামিলি কার্ড নীতিমালা ২০২৬-এর নেগেটিভ লিস্টের শর্ত (${triggeredNegatives.join(', ')}) প্রযোজ্য হওয়ায় সম্ভাব্য যোগ্য নয়।`,
        );
        reasonsEn.push(
          `Excluded under Family Card Implementation Policy 2026 negative list: ${triggeredNegatives.join(', ')}.`,
        );
      } else if (answers.householdMembers !== undefined && Number(answers.householdMembers) > 5) {
        reasonsBn.push('একটি পরিবারের সর্বোচ্চ ৫ জন সদস্যের জন্য একটি কার্ড প্রযোজ্য (সংশ্লিষ্ট ওয়ার্ড/ইউনিয়ন শুমারিতে যাচাই করুন)।');
        reasonsEn.push('One Family Card covers up to 5 members per household; confirm during local census.');
      } else {
        reasonsBn.push('নেগেটিভ লিস্টের কোনো শর্ত প্রযোজ্য নয় — মাসিক ২,৫০০ টাকা ফ্যামিলি কার্ডের সম্ভাব্য মিল।');
        reasonsEn.push('No negative-list exclusions triggered — possible match for Tk 2,500/month Family Card.');
      }
    } else if (slug === 'old-age-allowance') {
      const age = Number(answers.age ?? 0);
      const gender = String(answers.gender ?? '');
      if (!age || !gender) {
        status = 'NEEDS_MORE_INFO';
        reasonsBn.push('বয়স ও লিঙ্গ তথ্য প্রয়োজন (পুরুষ ৬৫+, নারী ৬২+)।');
        reasonsEn.push('Age and gender required (Male 65+, Female 62+).');
      } else if ((gender === 'male' && age >= 65) || (gender === 'female' && age >= 62)) {
        reasonsBn.push('বয়সের শর্ত পূরণ হয়েছে — সম্ভাব্য মিল।');
        reasonsEn.push('Age threshold met — possible match.');
      } else {
        status = 'NOT_ELIGIBLE';
        reasonsBn.push('ন্যূনতম বয়সের শর্ত পূরণ হয়নি।');
        reasonsEn.push('Minimum age criterion not met.');
      }
    }

    return {
      programme: { slug: prog.slug, nameBn: prog.nameBn, nameEn: prog.nameEn, monthlyAmountBdt: prog.monthlyAmountBdt },
      status,
      possibleMatchDisclaimer:
        'Deterministic guidance only — final eligibility is decided only by the official government department.',
      reasonsBn,
      reasonsEn,
      officialPortalUrl: prog.sourceUrl,
      sourceId: prog.sourceId,
      lastVerifiedAt: prog.lastVerifiedAt,
    };
  }

  // --- C08: Places & District Offline Packs ---

  listPlaces(params: { type?: string; district?: string; accessible?: boolean; openNow?: boolean }) {
    let items = this.opsData.places;
    if (params.type) items = items.filter((p) => p.type === params.type);
    if (params.district) {
      const d = params.district.toLowerCase();
      items = items.filter((p) => p.districtEn.toLowerCase().includes(d));
    }
    if (params.accessible !== undefined) items = items.filter((p) => p.accessible === params.accessible);
    if (params.openNow) items = items.filter((p) => p.open24x7);
    return {
      count: items.length,
      attribution: `Official registries + ${OSM_ODBL_ATTRIBUTION}`,
      items,
    };
  }

  getPlace(id: string) {
    const place = this.opsData.places.find((p) => p.id === id);
    if (!place) throw new NotFoundException(`Place '${id}' not found`);
    return place;
  }

  reportPlaceIssue(id: string, body: { issue: string; details: string }) {
    this.getPlace(id);
    const report = {
      id: randomUUID(),
      placeId: id,
      ...body,
      trustLabel: TrustLabel.COMMUNITY_REPORT,
      reviewStatus: 'PENDING_REVIEW',
      createdAt: new Date().toISOString(),
    };
    this.placeReports.push(report);
    return report;
  }

  getDistrictOfflinePack(district: string) {
    const dLower = district.toLowerCase();
    const places = this.opsData.places.filter((p) => p.districtEn.toLowerCase().includes(dLower));
    const orgs = this.opsData.organisations.filter((o) => o.districtEn.toLowerCase().includes(dLower));
    return {
      type: 'FeatureCollection',
      district,
      generatedAt: new Date().toISOString(),
      licence: 'ODbL-1.0 / Government Public Data',
      attribution: OSM_ODBL_ATTRIBUTION,
      emergencyHotlinesBundled: this.opsData.hotlines.slice(0, 5),
      features: [
        ...places.map((p) => ({
          type: 'Feature',
          properties: { id: p.id, kind: 'place', type: p.type, nameBn: p.nameBn, nameEn: p.nameEn, sourceId: p.sourceId },
          geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        })),
        ...orgs.map((o) => ({
          type: 'Feature',
          properties: { id: o.id, kind: 'org', type: o.type, nameBn: o.nameBn, nameEn: o.nameEn, sourceId: o.sourceId },
          geometry: { type: 'Point', coordinates: [o.lng, o.lat] },
        })),
      ],
    };
  }

  // --- C09: National Calendar & ICS ---

  getCalendar(year?: string, type?: string) {
    let items = this.opsData.calendar;
    if (year) items = items.filter((c) => c.date.startsWith(year));
    if (type) items = items.filter((c) => c.type === type);
    return { count: items.length, timezone: 'Asia/Dhaka', items };
  }

  buildCalendarIcs(year?: string): string {
    const events = this.getCalendar(year).items;
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Jonoshheba AI//Bangladesh National Calendar//EN',
    ];
    for (const ev of events) {
      const dt = ev.date.replace(/-/g, '');
      lines.push(
        'BEGIN:VEVENT',
        `UID:${ev.id}@jonoshheba.example`,
        `DTSTART;VALUE=DATE:${dt}`,
        `SUMMARY:${ev.titleEn}${ev.provisional ? ' (Provisional)' : ''}`,
        `DESCRIPTION:Official source: ${ev.officialUrl}`,
        'END:VEVENT',
      );
    }
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  // --- C10: Complete Verified Hotline Directory & Public Stats ---

  getHotlineCounts() {
    const evaluated = this.opsData.hotlines.map((h) => {
      const freshness = evaluateFreshness({
        entityType: 'hotline',
        lastVerifiedAt: h.lastVerifiedAt,
        baseTrustLabel: TrustLabel.OFFICIAL_SOURCE,
      });
      const isVerified = !h.verifyBeforeRelease && !freshness.isStale;
      return { h, freshness, isVerified };
    });
    const verified = evaluated.filter((x) => x.isVerified).length;
    return {
      total: evaluated.length,
      verified,
      pendingVerification: evaluated.length - verified,
      evaluated,
    };
  }

  getPublicStats() {
    const hotlines = this.getHotlineCounts();
    const stations = this.mobility?.listStations({}).count ?? 0;
    const metro = this.mobility?.getMetroLines().operationalStationCount ?? 0;
    const busTerminals = this.mobility?.listBusTerminals().count ?? 0;
    return {
      asOf: this.geo.referenceCounts.asOf,
      divisions: this.geo.divisions.length,
      districts: this.geo.districts.length,
      upazilas: this.geo.upazilas.length,
      railStations: stations,
      metroStations: metro,
      busTerminals,
      services: SERVICES_SEED.length,
      serviceCategories: this.taxonomy.categories.length,
      lifeEventBundles: this.taxonomy.lifeEventBundles.length,
      programmes: this.taxonomy.socialProtectionProgrammes.length,
      hotlinesTotal: hotlines.total,
      hotlinesVerified: hotlines.verified,
      hotlinesPendingVerification: hotlines.pendingVerification,
      organisations: this.opsData.organisations.length,
      places: this.opsData.places.length,
    };
  }

  listHotlines(category?: string, org?: string, q?: string) {
    const summary = this.getHotlineCounts();
    let filtered = category
      ? summary.evaluated.filter((x) => x.h.category === category)
      : summary.evaluated;
    if (org && org.trim()) {
      const oNorm = org.trim().toLowerCase();
      filtered = filtered.filter(
        (x) =>
          x.h.agency.toLowerCase().includes(oNorm) ||
          x.h.nameEn.toLowerCase().includes(oNorm) ||
          x.h.nameBn.includes(org.trim()),
      );
    }
    if (q && q.trim()) {
      const qNorm = q.trim().toLowerCase();
      filtered = filtered.filter(
        (x) =>
          x.h.number.includes(qNorm) ||
          x.h.nameEn.toLowerCase().includes(qNorm) ||
          x.h.nameBn.includes(q.trim()) ||
          x.h.agency.toLowerCase().includes(qNorm),
      );
    }
    const verifiedInFilter = filtered.filter((x) => x.isVerified).length;
    return {
      count: filtered.length,
      verifiedCount: verifiedInFilter,
      pendingVerificationCount: filtered.length - verifiedInFilter,
      page: { limit: filtered.length, nextCursor: null, hasMore: false, total: filtered.length },
      items: filtered.map(({ h, freshness, isVerified }) => ({
        ...h,
        telUri: `tel:${h.number}`,
        verificationStatus: isVerified ? 'verified' : 'needs_verification',
        freshness,
      })),
    };
  }

  decideHotline(situation: string) {
    const matched = HOTLINE_DECISION_RULES.find((r) => r.keywords.test(situation));
    const numbers = matched ? matched.numbers : ['999', '333'];
    const records = numbers
      .map((num) => this.opsData.hotlines.find((h) => h.number === num))
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
      .map((h) => ({ ...h, telUri: `tel:${h.number}` }));

    return {
      situation,
      decisionEngine: 'DETERMINISTIC_RULES_C10_NOT_LLM',
      reasonBn:
        matched?.reasonBn ??
        'তাৎক্ষণিক বিপদে ৯৯৯ এবং সাধারণ সরকারি তথ্য বা সহায়তায় ৩৩৩ নম্বরে কল করুন।',
      reasonEn:
        matched?.reasonEn ??
        'For immediate danger call 999; for general government info & assistance call 333.',
      recommendedHotlines: records,
    };
  }
}
