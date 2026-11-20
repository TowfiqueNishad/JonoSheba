import { Injectable } from '@nestjs/common';
import { TrustLabel } from '@jonoshheba/shared';
import { uuidv7 } from '../../../common/uuidv7';
import {
  AGENCIES_SEED,
  CATEGORIES_SEED,
  HOTLINES_SEED,
  LIFE_EVENTS_SEED,
  SERVICES_SEED,
} from '../../../seed-data/catalogue';
import { OPPORTUNITIES_WITH_RULES_SEED } from '../../../seed-data/opportunities';
import { BUS_STOPS_SEED, RAIL_STATIONS_SEED } from '../../../seed-data/transport';
import type {
  AgencyRecord,
  CategoryRecord,
  ContentReportRecord,
  FacilityRecord,
  FaqRecord,
  LifeEventRecord,
  NoticeRecord,
  ReminderRecord,
  ReviewTaskRecord,
  SavedItemRecord,
  SearchDocument,
  ServiceRecord,
  ServiceVersionRecord,
  SourceRecord,
  UtilityOutageRecord,
} from '../domain/catalogue.types';
import type { CatalogueRepositoryPort } from '../ports/catalogue.repository.port';

@Injectable()
export class SeededCatalogueRepository implements CatalogueRepositoryPort {
  private readonly categories: CategoryRecord[] = [];
  private readonly agencies = new Map<string, AgencyRecord>();
  private readonly sources = new Map<string, SourceRecord>();
  private readonly services = new Map<string, ServiceRecord>(); // keyed by slug
  private readonly serviceVersions = new Map<string, ServiceVersionRecord[]>(); // keyed by serviceId
  private readonly lifeEvents = new Map<string, LifeEventRecord>();
  private readonly notices: NoticeRecord[] = [];
  private readonly facilities: FacilityRecord[] = [];
  private readonly outages: UtilityOutageRecord[] = [];
  private readonly faqs: FaqRecord[] = [];
  private readonly contentReports: ContentReportRecord[] = [];
  private readonly reviewTasks: ReviewTaskRecord[] = [];
  private readonly savedItems = new Map<string, SavedItemRecord>();
  private readonly reminders = new Map<string, ReminderRecord>();

  constructor() {
    this.bootstrapSeedData();
  }

  private bootstrapSeedData(): void {
    const importedAt = new Date();
    // Real recorded editorial verification snapshot date (never stamped with seed boot time — Finding D1)
    const verifiedSnapshotAt = new Date('2026-11-10T00:00:00Z');
    const nextYear = new Date(verifiedSnapshotAt.getTime() + 365 * 24 * 60 * 60 * 1000);
    const now = verifiedSnapshotAt;

    // 1. Categories
    const catBySlug = new Map<string, CategoryRecord>();
    CATEGORIES_SEED.forEach((cat, idx) => {
      const rec: CategoryRecord = {
        id: uuidv7(),
        parentId: null,
        slug: cat.slug,
        nameBn: cat.nameBn,
        nameEn: cat.nameEn,
        icon: cat.icon,
        sortOrder: idx,
      };
      this.categories.push(rec);
      catBySlug.set(rec.slug, rec);
    });

    // 2. Agencies
    for (const ag of AGENCIES_SEED) {
      const rec: AgencyRecord = {
        id: uuidv7(),
        slug: ag.slug,
        nameBn: ag.nameBn,
        nameEn: ag.nameEn,
        officialUrl: ag.officialUrl,
        contactPhone: ag.contactPhone ?? null,
      };
      this.agencies.set(rec.slug, rec);
    }

    const ensureSource = (url: string, agency: string, sourceType = 'official_portal'): SourceRecord => {
      for (const s of this.sources.values()) {
        if (s.url === url && s.agency === agency) return s;
      }
      const created: SourceRecord = {
        id: uuidv7(),
        url,
        agency,
        sourceType,
        contentHash: `seed-${Buffer.from(url).toString('hex').slice(0, 16)}`,
        fetchedAt: importedAt,
        verifiedAt: verifiedSnapshotAt,
        validFrom: verifiedSnapshotAt,
        validTo: nextYear,
        reviewerId: null,
        trustLabel: TrustLabel.OFFICIAL_SOURCE,
      };
      this.sources.set(created.id, created);
      return created;
    };

    // 3. 62 Services + Version 1
    for (const svc of SERVICES_SEED) {
      const agency = this.agencies.get(svc.agencySlug)!;
      const category = catBySlug.get(svc.categorySlug)!;
      const source = ensureSource(svc.officialUrl, agency.nameEn);
      const id = uuidv7();
      const record: ServiceRecord = {
        id,
        slug: svc.slug,
        titleBn: svc.titleBn,
        titleEn: svc.titleEn,
        summaryBn: svc.summaryBn,
        summaryEn: svc.summaryEn,
        descriptionMdBn: `${svc.summaryBn}\n\nসরকারি চ্যানেল: [${agency.nameBn}](${svc.officialUrl})`,
        descriptionMdEn: `${svc.summaryEn}\n\nOfficial channel: [${agency.nameEn}](${svc.officialUrl})`,
        whoCanApplyBn: 'সকল যোগ্য বাংলাদেশী নাগরিক (সরকারি পোর্টালের নীতিমালা অনুযায়ী)।',
        whoCanApplyEn: 'Eligible citizens of Bangladesh per the agency’s official criteria.',
        agencyId: agency.id,
        agencySlug: agency.slug,
        categoryId: category.id,
        categorySlug: category.slug,
        sourceId: source.id,
        deliveryChannels: svc.deliveryChannels ?? ['online', 'in_person'],
        officialUrl: svc.officialUrl,
        feeInfo: { bn: svc.feeTextBn, en: svc.feeTextEn },
        processingTime: svc.processingTime,
        status: 'published',
        trustLabel: TrustLabel.OFFICIAL_SOURCE,
        version: 1,
        authorId: null,
        verifiedBy: null,
        lastVerifiedAt: now,
        aliases: [...svc.aliases],
        requirements: [
          { documentNameBn: 'জাতীয় পরিচয়পত্র (NID) বা জন্ম নিবন্ধন সনদ', documentNameEn: 'NID or Birth Registration Certificate', isMandatory: true },
          { documentNameBn: 'সক্রিয় মোবাইল নম্বর', documentNameEn: 'Active mobile phone number', isMandatory: true },
        ],
        steps: [
          {
            stepOrder: 1,
            titleBn: 'প্রয়োজনীয় কাগজপত্র প্রস্তুত করুন',
            titleEn: 'Prepare required documents',
            instructionBn: 'আবেদনের পূর্বে মূল সনদ ও স্ক্যান কপি সাথে রাখুন।',
            instructionEn: 'Keep original certificates and clear scans ready before starting.',
            channel: 'preparation',
          },
          {
            stepOrder: 2,
            titleBn: 'অফিশিয়াল সরকারি পোর্টালে আবেদন করুন',
            titleEn: 'Apply via the official government portal',
            instructionBn: `${svc.officialUrl} লিংকে গিয়ে ফরম পূরণ করুন ও রসিদ সংরক্ষণ করুন।`,
            instructionEn: `Continue to ${svc.officialUrl}, submit your form, and save the tracking number.`,
            channel: 'online',
          },
        ],
        createdAt: now,
        updatedAt: now,
      };
      this.services.set(record.slug, record);
      this.serviceVersions.set(id, [
        {
          id: uuidv7(),
          serviceId: id,
          version: 1,
          changeSummary: 'Initial verified publication',
          authorId: null,
          reviewerId: null,
          publishedAt: now,
          snapshot: {
            titleBn: record.titleBn,
            titleEn: record.titleEn,
            summaryBn: record.summaryBn,
            summaryEn: record.summaryEn,
            feeInfo: record.feeInfo,
            processingTime: record.processingTime,
            officialUrl: record.officialUrl,
          },
        },
      ]);
    }

    // 4. Life Events with ordered steps linked to real services
    const lifeEventStepMap: Record<
      string,
      Array<{ titleBn: string; titleEn: string; serviceSlug: string | null; notesBn: string; notesEn: string }>
    > = {
      'eid-travel': [
        { titleBn: 'ট্রেন/বাস রুট ও সময়সূচি দেখুন', titleEn: 'Search train & bus options', serviceSlug: 'railway-eticket-guide', notesBn: 'আগাম টিকিট প্রকাশের তারিখ যাচাই করুন', notesEn: 'Check advance ticket release dates' },
        { titleBn: 'টিকিট অ্যালার্ট ও রিফান্ড নিয়ম জানুন', titleEn: 'Understand ticket alerts & refund rules', serviceSlug: 'railway-refund-rules', notesBn: 'সম্ভাব্য আসন পাওয়া গেলে অফিশিয়াল চ্যানেলে কিনুন', notesEn: 'Continue to official provider when alerted' },
      ],
      'new-baby': [
        { titleBn: '৪৫ দিনের মধ্যে বিনামূল্যে জন্ম নিবন্ধন করুন', titleEn: 'Register birth free within 45 days', serviceSlug: 'birth-registration-new', notesBn: 'হাসপাতালের ছাড়পত্র সংরক্ষণ করুন', notesEn: 'Keep hospital birth slip' },
        { titleBn: 'ইপিআই টিকা কার্ড ও সূচি অনুসরণ করুন', titleEn: 'Start EPI child vaccination schedule', serviceSlug: 'epi-child-vaccination', notesBn: 'নিকটস্থ টিকাদান কেন্দ্রে বিনামূল্যে টিকা', notesEn: 'Free vaccines at public EPI centers' },
        { titleBn: 'মা ও শিশু সহায়তা ভাতা যোগ্যতা দেখুন', titleEn: 'Check Mother & Child Benefit eligibility', serviceSlug: 'mother-child-benefit-mcbp', notesBn: 'সম্ভাব্য যোগ্যতা যাচাই করুন', notesEn: 'Run deterministic eligibility check' },
      ],
      'start-business': [
        { titleBn: 'ট্রেড লাইসেন্স সংগ্রহ করুন', titleEn: 'Obtain local Trade License', serviceSlug: 'trade-license-new', notesBn: 'সিটি কর্পোরেশন/পৌরসভা/ইউনিয়ন পরিষদ', notesEn: 'Via City Corp, Pourashava, or UP' },
        { titleBn: 'ই-টিন (e-TIN) নিবন্ধন করুন', titleEn: 'Register e-TIN online', serviceSlug: 'nbr-etin-registration', notesBn: 'এনবিআর পোর্টালে বিনামূল্যে তাৎক্ষণিক সনদ', notesEn: 'Free instant registration on NBR' },
        { titleBn: 'প্রয়োজনে ভ্যাট (BIN) ও কোম্পানি নিবন্ধন', titleEn: 'VAT BIN & RJSC incorporation (if applicable)', serviceSlug: 'rjsc-name-clearance', notesBn: 'লিমিটেড কোম্পানির জন্য আরজেএসসি নাম ছাড়পত্র', notesEn: 'Start with RJSC name clearance' },
      ],
      'lost-nid': [
        { titleBn: 'অনলাইনে পুলিশ জিডি করুন', titleEn: 'File an Online Police GD', serviceSlug: 'online-gd-police', notesBn: 'থানায় না গিয়েই জিডি নম্বর নিন', notesEn: 'Get verified GD reference online' },
        { titleBn: 'এনআইডি রি-ইস্যু আবেদন করুন', titleEn: 'Apply for NID Re-issue', serviceSlug: 'nid-reissue-lost', notesBn: 'জিডি কপি আপলোড করে ফি জমা দিন', notesEn: 'Upload GD copy and pay official fee' },
      ],
      'admission-season': [
        { titleBn: 'বোর্ড পরীক্ষার ফলাফল যাচাই', titleEn: 'Verify Board Exam Result', serviceSlug: 'education-board-result', notesBn: 'অফিশিয়াল মার্কশিট সংরক্ষণ করুন', notesEn: 'Download official marksheet' },
        { titleBn: 'একাদশ শ্রেণিতে ভর্তি আবেদন', titleEn: 'Apply for XI Class Admission', serviceSlug: 'xi-class-admission', notesBn: 'নির্ধারিত সময়সীমার মধ্যে পছন্দক্রম দিন', notesEn: 'Submit college choices before deadline' },
      ],
      'flood-emergency': [
        { titleBn: 'জরুরি হটলাইন ৯৯৯ / ১০৯০-এ যোগাযোগ', titleEn: 'Call 999 or 1090 Disaster Early Warning', serviceSlug: null, notesBn: 'তাৎক্ষণিক বিপদে সরাসরি ৯৯৯-এ কল করুন', notesEn: 'Immediate danger: dial 999 directly' },
        { titleBn: 'স্বাস্থ্য বাতায়ন (১৬২৬৩) ও আশ্রয়কেন্দ্র', titleEn: 'Health Helpline (16263) & Nearest Shelter', serviceSlug: 'shastho-batayon-16263', notesBn: 'নিকটস্থ আশ্রয়কেন্দ্র ও স্বাস্থ্যসেবা খুঁজুন', notesEn: 'Locate nearest public shelter and hospital' },
      ],
    };

    LIFE_EVENTS_SEED.forEach((ev, idx) => {
      const steps = (lifeEventStepMap[ev.slug] ?? []).map((s, sIdx) => ({
        stepOrder: sIdx + 1,
        ...s,
      }));
      this.lifeEvents.set(ev.slug, {
        id: uuidv7(),
        slug: ev.slug,
        titleBn: ev.titleBn,
        titleEn: ev.titleEn,
        summaryBn: ev.summaryBn,
        summaryEn: ev.summaryEn,
        icon: ev.icon,
        sortOrder: idx,
        steps,
      });
    });

    // 5. Notices
    const brSource = ensureSource('https://eticket.railway.gov.bd', 'Bangladesh Railway', 'circular');
    const ddmSource = ensureSource('https://ddm.gov.bd', 'Department of Disaster Management', 'disaster_alert');
    const dghsSource = ensureSource('https://dghs.gov.bd', 'Directorate General of Health Services', 'health_notice');
    const descoSource = ensureSource('https://desco.gov.bd', 'DESCO', 'utility_notice');

    this.notices.push(
      {
        id: uuidv7(),
        titleBn: 'ঈদ উপলক্ষে ট্রেনের আগাম টিকিট বিক্রয়ের সময়সূচি (অফিশিয়াল পোর্টাল দেখুন)',
        titleEn: 'Eid Advance Train Ticket Schedule Notice (Verify on Official Railway Portal)',
        bodyBn: 'বাংলাদেশ রেলওয়ের নির্ধারিত সময়সূচি অনুযায়ী অফিশিয়াল ই-টিকিট পোর্টালে আগাম টিকিট ছাড়া হবে।',
        bodyEn: 'Advance intercity train tickets open per Bangladesh Railway official schedule on eticket.railway.gov.bd.',
        agency: 'Bangladesh Railway',
        kind: 'deadline',
        publishedAt: now,
        expiresAt: new Date(now.getTime() + 30 * 86_400_000),
        regionScope: { national: true },
        sourceId: brSource.id,
        trustLabel: TrustLabel.OFFICIAL_SOURCE,
        attribution: { trustLabel: TrustLabel.OFFICIAL_SOURCE, sourceUrl: brSource.url, agency: brSource.agency, lastVerifiedAt: now.toISOString() },
      },
      {
        id: uuidv7(),
        titleBn: 'উপকূলীয় এলাকায় দুর্যোগ প্রস্তুতি ও ১০৯০ আগাম বার্তা নির্দেশনা',
        titleEn: 'Coastal Disaster Preparedness & 1090 Early Warning Advisory',
        bodyBn: 'আবহাওয়া সতর্কতা জানতে ১০৯০ ডায়াল করুন এবং জরুরি প্রয়োজনে নিকটস্থ আশ্রয়কেন্দ্রে যান।',
        bodyEn: 'Dial 1090 for official weather advisories and locate your nearest public cyclone shelter.',
        agency: 'Department of Disaster Management',
        kind: 'disaster',
        publishedAt: now,
        expiresAt: new Date(now.getTime() + 14 * 86_400_000),
        regionScope: { districts: ["Cox's Bazar", 'Chattogram', 'Bhola', 'Patuakhali'] },
        sourceId: ddmSource.id,
        trustLabel: TrustLabel.OFFICIAL_SOURCE,
        attribution: { trustLabel: TrustLabel.OFFICIAL_SOURCE, sourceUrl: ddmSource.url, agency: ddmSource.agency, lastVerifiedAt: now.toISOString() },
      },
      {
        id: uuidv7(),
        titleBn: 'ডেঙ্গু প্রতিরোধ ও সরকারি হাসপাতালে পরীক্ষা সংক্রান্ত স্বাস্থ্য অধিদপ্তরের নির্দেশনা',
        titleEn: 'DGHS Dengue Prevention & Public Hospital Testing Advisory',
        bodyBn: 'জ্বর হলে দ্রুত নিকটস্থ সরকারি হাসপাতাল বা ১৬২৬৩ নম্বরে যোগাযোগ করুন।',
        bodyEn: 'For fever or warning signs, visit the nearest public hospital or call 16263.',
        agency: 'DGHS',
        kind: 'health',
        publishedAt: now,
        expiresAt: new Date(now.getTime() + 45 * 86_400_000),
        regionScope: { national: true },
        sourceId: dghsSource.id,
        trustLabel: TrustLabel.OFFICIAL_SOURCE,
        attribution: { trustLabel: TrustLabel.OFFICIAL_SOURCE, sourceUrl: dghsSource.url, agency: dghsSource.agency, lastVerifiedAt: now.toISOString() },
      },
    );

    // 6. Facilities (for geo / nearby search)
    const policeSource = ensureSource('https://police.gov.bd', 'Bangladesh Police', 'facility_directory');
    const fireSource = ensureSource('https://fireservice.gov.bd', 'Bangladesh Fire Service', 'facility_directory');
    this.facilities.push(
      {
        id: uuidv7(),
        facilityType: 'hospital',
        nameBn: 'ঢাকা মেডিকেল কলেজ হাসপাতাল (DMCH)',
        nameEn: 'Dhaka Medical College Hospital (DMCH)',
        districtEn: 'Dhaka',
        addressBn: 'সচিবালয় রোড, ঢাকা-১০০০',
        addressEn: 'Secretariat Road, Dhaka-1000',
        lat: 23.7259,
        lng: 90.3976,
        hours: '24/7 Emergency; OPD 08:00–14:30',
        contact: '16263',
        trustLabel: TrustLabel.OFFICIAL_SOURCE,
        attribution: { trustLabel: TrustLabel.OFFICIAL_SOURCE, sourceUrl: dghsSource.url, agency: 'DGHS', lastVerifiedAt: now.toISOString() },
      },
      {
        id: uuidv7(),
        facilityType: 'hospital',
        nameBn: 'চট্টগ্রাম মেডিকেল কলেজ হাসপাতাল (CMCH)',
        nameEn: 'Chattogram Medical College Hospital (CMCH)',
        districtEn: 'Chattogram',
        addressBn: '৫৭ কে বি ফজলুল কাদের রোড, চট্টগ্রাম',
        addressEn: '57 KB Fazlul Kader Rd, Chattogram',
        lat: 22.3596,
        lng: 91.8304,
        hours: '24/7 Emergency',
        contact: '16263',
        trustLabel: TrustLabel.OFFICIAL_SOURCE,
        attribution: { trustLabel: TrustLabel.OFFICIAL_SOURCE, sourceUrl: dghsSource.url, agency: 'DGHS', lastVerifiedAt: now.toISOString() },
      },
      {
        id: uuidv7(),
        facilityType: 'hospital',
        nameBn: 'রাজশাহী মেডিকেল কলেজ হাসপাতাল (RMCH)',
        nameEn: 'Rajshahi Medical College Hospital (RMCH)',
        districtEn: 'Rajshahi',
        addressBn: 'লক্ষ্মীপুর, রাজশাহী',
        addressEn: 'Laxmipur, Rajshahi',
        lat: 24.3718,
        lng: 88.5861,
        hours: '24/7 Emergency',
        contact: '16263',
        trustLabel: TrustLabel.OFFICIAL_SOURCE,
        attribution: { trustLabel: TrustLabel.OFFICIAL_SOURCE, sourceUrl: dghsSource.url, agency: 'DGHS', lastVerifiedAt: now.toISOString() },
      },
      {
        id: uuidv7(),
        facilityType: 'police',
        nameBn: 'ঢাকা মেট্রোপলিটন পুলিশ সদর দপ্তর',
        nameEn: 'Dhaka Metropolitan Police Headquarters',
        districtEn: 'Dhaka',
        addressBn: '৩৬ শহীদ ক্যাপ্টেন মনসুর আলী সরণি, রমনা, ঢাকা',
        addressEn: '36 Shaheed Captain Mansur Ali Sarani, Ramna, Dhaka',
        lat: 23.7435,
        lng: 90.4027,
        hours: '24/7',
        contact: '999',
        trustLabel: TrustLabel.OFFICIAL_SOURCE,
        attribution: { trustLabel: TrustLabel.OFFICIAL_SOURCE, sourceUrl: policeSource.url, agency: 'Bangladesh Police', lastVerifiedAt: now.toISOString() },
      },
      {
        id: uuidv7(),
        facilityType: 'fire',
        nameBn: 'ফায়ার সার্ভিস ও সিভিল ডিফেন্স সদর দপ্তর (সিদ্দিকবাজার)',
        nameEn: 'Fire Service & Civil Defence HQ (Siddikbazar)',
        districtEn: 'Dhaka',
        addressBn: 'কাজী আলাউদ্দিন রোড, ঢাকা',
        addressEn: 'Kazi Alauddin Road, Dhaka',
        lat: 23.7244,
        lng: 90.4058,
        hours: '24/7',
        contact: '102',
        trustLabel: TrustLabel.OFFICIAL_SOURCE,
        attribution: { trustLabel: TrustLabel.OFFICIAL_SOURCE, sourceUrl: fireSource.url, agency: 'Bangladesh Fire Service', lastVerifiedAt: now.toISOString() },
      },
      {
        id: uuidv7(),
        facilityType: 'shelter',
        nameBn: 'কক্সবাজার সদর সরকারি ঘূর্ণিঝড় আশ্রয়কেন্দ্র',
        nameEn: "Cox's Bazar Sadar Public Cyclone Shelter",
        districtEn: "Cox's Bazar",
        addressBn: 'কক্সবাজার সদর',
        addressEn: "Cox's Bazar Sadar",
        lat: 21.4272,
        lng: 92.0058,
        hours: 'Open during disaster warnings',
        contact: '1090',
        trustLabel: TrustLabel.OFFICIAL_SOURCE,
        attribution: { trustLabel: TrustLabel.OFFICIAL_SOURCE, sourceUrl: ddmSource.url, agency: 'DDM', lastVerifiedAt: now.toISOString() },
      },
    );

    // 7. Utility Outages
    this.outages.push({
      id: uuidv7(),
      utilityType: 'electricity',
      providerName: 'DESCO',
      districtEn: 'Dhaka',
      areaDescriptionBn: 'মিরপুর সেকশন-১০ ও কাজীপাড়া ফিডার (পরিকল্পিত রক্ষণাবেক্ষণ)',
      areaDescriptionEn: 'Mirpur Section-10 & Kazipara feeder (scheduled maintenance)',
      startsAt: now,
      expectedEndAt: new Date(now.getTime() + 4 * 3600_000),
      status: 'active',
      trustLabel: TrustLabel.OFFICIAL_SOURCE,
      attribution: { trustLabel: TrustLabel.OFFICIAL_SOURCE, sourceUrl: descoSource.url, agency: 'DESCO', lastVerifiedAt: now.toISOString() },
    });

    // 8. FAQs
    const bdrisSrc = ensureSource('https://bdris.gov.bd', 'BDRIS');
    this.faqs.push(
      {
        id: uuidv7(),
        serviceSlug: 'birth-registration-new',
        questionBn: 'নবজাতকের জন্ম নিবন্ধন কত দিনের মধ্যে ফ্রি?',
        questionEn: 'Within how many days is newborn birth registration free?',
        answerBn: 'জন্মের ৪৫ দিনের মধ্যে জন্ম নিবন্ধন সম্পূর্ণ বিনামূল্যে করা যায় (সরকারি BDRIS নীতিমালা অনুযায়ী)।',
        answerEn: 'Birth registration is free within 45 days of birth per official BDRIS rules.',
        trustLabel: TrustLabel.OFFICIAL_SOURCE,
        attribution: { trustLabel: TrustLabel.OFFICIAL_SOURCE, sourceUrl: bdrisSrc.url, agency: 'BDRIS', lastVerifiedAt: now.toISOString() },
      },
      {
        id: uuidv7(),
        serviceSlug: 'epassport-new',
        questionBn: 'ই-পাসপোর্টের জন্য কি পুলিশ ভেরিফিকেশন লাগে?',
        questionEn: 'Is police verification required for a new e-Passport?',
        answerBn: 'সাধারণ ই-পাসপোর্ট আবেদনে পুলিশ ভেরিফিকেশন বাতিল করা হয়েছে (সরকারি সিদ্ধান্ত ও ইমিগ্রেশন ও পাসপোর্ট অধিদপ্তরের নির্দেশনা, epassport.gov.bd)।',
        answerEn: 'Police verification has been removed for standard e-Passport applications per official government directive (epassport.gov.bd).',
        trustLabel: TrustLabel.OFFICIAL_SOURCE,
        attribution: { trustLabel: TrustLabel.OFFICIAL_SOURCE, sourceUrl: 'https://www.epassport.gov.bd', agency: 'DIP', lastVerifiedAt: now.toISOString() },
      },
    );
  }

  async listCategories(): Promise<CategoryRecord[]> {
    return [...this.categories].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async listLifeEvents(): Promise<LifeEventRecord[]> {
    return [...this.lifeEvents.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async findLifeEventBySlug(slug: string): Promise<LifeEventRecord | null> {
    return this.lifeEvents.get(slug) ?? null;
  }

  async listAgencies(): Promise<AgencyRecord[]> {
    return [...this.agencies.values()];
  }

  async findAgencyBySlug(slug: string): Promise<AgencyRecord | null> {
    return this.agencies.get(slug) ?? null;
  }

  async listServices(filters?: {
    category?: string;
    agency?: string;
    channel?: string;
    includeNonPublished?: boolean;
  }): Promise<ServiceRecord[]> {
    return [...this.services.values()].filter((svc) => {
      if (!filters?.includeNonPublished && svc.status !== 'published') return false;
      if (filters?.category && svc.categorySlug !== filters.category) return false;
      if (filters?.agency && svc.agencySlug !== filters.agency) return false;
      if (filters?.channel && !svc.deliveryChannels.includes(filters.channel)) return false;
      return true;
    });
  }

  async findServiceBySlug(slug: string): Promise<ServiceRecord | null> {
    return this.services.get(slug) ?? null;
  }

  async listServiceVersions(serviceId: string): Promise<ServiceVersionRecord[]> {
    return [...(this.serviceVersions.get(serviceId) ?? [])].sort((a, b) => b.version - a.version);
  }

  async findSourceById(sourceId: string): Promise<SourceRecord | null> {
    return this.sources.get(sourceId) ?? null;
  }

  async listSources(): Promise<SourceRecord[]> {
    return [...this.sources.values()];
  }

  async listNotices(filters?: {
    kind?: string;
    region?: string;
    activeOnly?: boolean;
  }): Promise<NoticeRecord[]> {
    const now = new Date();
    return this.notices.filter((n) => {
      if (filters?.kind && n.kind !== filters.kind) return false;
      if (filters?.activeOnly && n.expiresAt && n.expiresAt <= now) return false;
      if (filters?.region) {
        const reg = filters.region.toLowerCase();
        const matchesDistrict = (n.regionScope.districts ?? []).some(
          (d) => d.toLowerCase() === reg,
        );
        if (!n.regionScope.national && !matchesDistrict) return false;
      }
      return true;
    });
  }

  async listFacilities(filters?: { type?: string }): Promise<FacilityRecord[]> {
    return this.facilities.filter((f) => (!filters?.type ? true : f.facilityType === filters.type));
  }

  async listUtilityOutages(filters?: { district?: string }): Promise<UtilityOutageRecord[]> {
    return this.outages.filter((o) =>
      !filters?.district
        ? true
        : o.districtEn.toLowerCase() === filters.district.toLowerCase(),
    );
  }

  async listFaqs(serviceSlug?: string): Promise<FaqRecord[]> {
    return this.faqs.filter((f) => (!serviceSlug ? true : f.serviceSlug === serviceSlug));
  }

  async getAllSearchDocuments(): Promise<SearchDocument[]> {
    const docs: SearchDocument[] = [];
    const nowIso = new Date().toISOString();

    for (const svc of this.services.values()) {
      if (svc.status !== 'published') continue;
      const src = this.sources.get(svc.sourceId);
      docs.push({
        id: svc.id,
        type: 'service',
        slugOrCode: svc.slug,
        titleBn: svc.titleBn,
        titleEn: svc.titleEn,
        summaryBn: svc.summaryBn,
        summaryEn: svc.summaryEn,
        keywords: [svc.slug.replace(/-/g, ' '), svc.categorySlug, svc.agencySlug, ...svc.aliases],
        url: `/services/${svc.slug}`,
        trustLabel: svc.trustLabel,
        attribution: {
          trustLabel: svc.trustLabel,
          sourceUrl: src?.url ?? svc.officialUrl,
          agency: src?.agency ?? svc.agencySlug,
          lastVerifiedAt: svc.lastVerifiedAt?.toISOString() ?? null,
        },
      });
    }

    for (const notice of this.notices) {
      docs.push({
        id: notice.id,
        type: 'notice',
        slugOrCode: notice.id,
        titleBn: notice.titleBn,
        titleEn: notice.titleEn,
        summaryBn: notice.bodyBn,
        summaryEn: notice.bodyEn,
        keywords: [notice.kind, notice.agency],
        url: `/notices/${notice.id}`,
        trustLabel: notice.trustLabel,
        attribution: notice.attribution,
      });
    }

    for (const opp of OPPORTUNITIES_WITH_RULES_SEED) {
      docs.push({
        id: `opp-${opp.slug}`,
        type: opp.kind,
        slugOrCode: opp.slug,
        titleBn: opp.titleBn,
        titleEn: opp.titleEn,
        summaryBn: opp.summaryBn,
        summaryEn: opp.summaryEn,
        keywords: [opp.slug.replace(/-/g, ' '), opp.agencyOrProvider, opp.categoryOrLevel],
        url: opp.kind === 'program' ? `/programs/${opp.slug}` : `/scholarships/${opp.slug}`,
        trustLabel: TrustLabel.OFFICIAL_SOURCE,
        attribution: {
          trustLabel: TrustLabel.OFFICIAL_SOURCE,
          sourceUrl: opp.applicationUrl,
          agency: opp.agencyOrProvider,
          lastVerifiedAt: nowIso,
        },
      });
    }

    for (const hl of HOTLINES_SEED) {
      docs.push({
        id: `hotline-${hl.number}`,
        type: 'hotline',
        slugOrCode: hl.number,
        titleBn: `${hl.number} — ${hl.nameBn}`,
        titleEn: `${hl.number} — ${hl.nameEn}`,
        summaryBn: `জরুরি ও সরকারি হটলাইন ${hl.number} (${hl.agency})`,
        summaryEn: `Official helpline ${hl.number} (${hl.agency})`,
        keywords: [hl.number, hl.category, 'hotline', 'হটলাইন', 'emergency'],
        url: `tel:${hl.number}`,
        trustLabel: TrustLabel.OFFICIAL_SOURCE,
        attribution: {
          trustLabel: TrustLabel.OFFICIAL_SOURCE,
          sourceUrl: hl.sourceUrl,
          agency: hl.agency,
          lastVerifiedAt: null,
        },
        extra: { telUri: `tel:${hl.number}`, verifyBeforeRelease: true },
      });
    }

    for (const fac of this.facilities) {
      docs.push({
        id: fac.id,
        type: 'facility',
        slugOrCode: fac.id,
        titleBn: fac.nameBn,
        titleEn: fac.nameEn,
        summaryBn: fac.addressBn,
        summaryEn: fac.addressEn,
        keywords: [fac.facilityType, fac.districtEn],
        url: `/facilities/${fac.id}`,
        trustLabel: fac.trustLabel,
        attribution: fac.attribution,
      });
    }

    for (const faq of this.faqs) {
      docs.push({
        id: faq.id,
        type: 'faq',
        slugOrCode: faq.id,
        titleBn: faq.questionBn,
        titleEn: faq.questionEn,
        summaryBn: faq.answerBn,
        summaryEn: faq.answerEn,
        keywords: faq.serviceSlug ? [faq.serviceSlug] : [],
        url: faq.serviceSlug ? `/services/${faq.serviceSlug}#faqs` : '/faqs',
        trustLabel: faq.trustLabel,
        attribution: faq.attribution,
      });
    }

    for (const stop of [...RAIL_STATIONS_SEED, ...BUS_STOPS_SEED]) {
      docs.push({
        id: `stop-${stop.code}`,
        type: 'station',
        slugOrCode: stop.code,
        titleBn: stop.nameBn,
        titleEn: stop.nameEn,
        summaryBn: `${stop.mode === 'train' ? 'রেলওয়ে স্টেশন' : 'বাস স্ট্যান্ড/টার্মিনাল'} — ${stop.districtEn}`,
        summaryEn: `${stop.mode === 'train' ? 'Railway station' : 'Bus stop/terminal'} — ${stop.districtEn}`,
        keywords: [stop.code, stop.mode, stop.districtEn, ...stop.aliases],
        url: `/transport?stop=${stop.code}`,
        trustLabel: TrustLabel.VERIFIED_BY_JONOSHHEBA,
        attribution: {
          trustLabel: TrustLabel.VERIFIED_BY_JONOSHHEBA,
          sourceUrl: 'https://eticket.railway.gov.bd',
          agency: stop.mode === 'train' ? 'Bangladesh Railway' : 'Jonoshheba Transport Directory',
          lastVerifiedAt: nowIso,
        },
        extra: { mode: stop.mode, lat: stop.lat, lng: stop.lng },
      });
    }

    // Life events
    for (const ev of this.lifeEvents.values()) {
      docs.push({
        id: `le-${ev.slug}`,
        type: 'life_event',
        slugOrCode: ev.slug,
        titleBn: ev.titleBn,
        titleEn: ev.titleEn,
        summaryBn: ev.summaryBn,
        summaryEn: ev.summaryEn,
        keywords: [ev.slug.replace(/-/g, ' '), 'life event', 'জীবনের ধাপ'],
        url: `/life-events/${ev.slug}`,
        trustLabel: TrustLabel.OFFICIAL_SOURCE,
        attribution: {
          trustLabel: TrustLabel.OFFICIAL_SOURCE,
          sourceUrl: 'https://www.mygov.bd',
          agency: 'myGov Bangladesh',
          lastVerifiedAt: nowIso,
        },
      });
    }

    // Major intercity train corridors (for "dhaka ctg", "dhaka rajshahi", etc.)
    const trainCorridors = [
      {
        code: 'train-da-ctg',
        from: 'DA',
        to: 'CTG',
        titleBn: 'ঢাকা → চট্টগ্রাম ট্রেন (সুবর্ণ, মহানগর, কক্সবাজার এক্সপ্রেস)',
        titleEn: 'Dhaka → Chattogram Trains (Suborno, Mahanagar, Cox’s Bazar Express)',
        keywords: ['dhaka ctg', 'dhaka chattogram', 'dhaka chittagong', 'ঢাকা চট্টগ্রাম ট্রেন', 'suborno express', '702', '704'],
      },
      {
        code: 'train-da-raj',
        from: 'DA',
        to: 'RAJ',
        titleBn: 'ঢাকা → রাজশাহী ট্রেন (সিল্কসিটি এক্সপ্রেস ৭৫৩)',
        titleEn: 'Dhaka → Rajshahi Trains (Silkcity Express 753)',
        keywords: ['dhaka rajshahi', 'dhaka raj', 'ঢাকা রাজশাহী ট্রেন', 'silkcity express', '753'],
      },
      {
        code: 'train-da-syl',
        from: 'DA',
        to: 'SYL',
        titleBn: 'ঢাকা → সিলেট ট্রেন (পারাবত এক্সপ্রেস ৭০৯)',
        titleEn: 'Dhaka → Sylhet Trains (Parabat Express 709)',
        keywords: ['dhaka sylhet', 'dhaka syl', 'ঢাকা সিলেট ট্রেন', 'parabat express', '709'],
      },
      {
        code: 'train-da-cxb',
        from: 'DA',
        to: 'CXB',
        titleBn: 'ঢাকা → কক্সবাজার ট্রেন (কক্সবাজার এক্সপ্রেস ৮১৪)',
        titleEn: 'Dhaka → Cox’s Bazar Trains (Cox’s Bazar Express 814)',
        keywords: ['dhaka cox', 'dhaka coxsbazar', 'ঢাকা কক্সবাজার ট্রেন', 'coxs bazar express', '814'],
      },
      {
        code: 'train-da-kln',
        from: 'DA',
        to: 'KLN',
        titleBn: 'ঢাকা → খুলনা ট্রেন (জাহানাবাদ এক্সপ্রেস ৮২৫)',
        titleEn: 'Dhaka → Khulna Trains (Jahanabad Express 825)',
        keywords: ['dhaka khulna', 'dhaka jessore', 'ঢাকা খুলনা ট্রেন', 'jahanabad express', '825'],
      },
      {
        code: 'train-da-rgp',
        from: 'DA',
        to: 'RGP',
        titleBn: 'ঢাকা → রংপুর ট্রেন (রংপুর এক্সপ্রেস ৭৭১)',
        titleEn: 'Dhaka → Rangpur Trains (Rangpur Express 771)',
        keywords: ['dhaka rangpur', 'dhaka bogura', 'ঢাকা রংপুর ট্রেন', 'rangpur express', '771'],
      },
    ];
    for (const tc of trainCorridors) {
      docs.push({
        id: tc.code,
        type: 'station',
        slugOrCode: tc.code,
        titleBn: tc.titleBn,
        titleEn: tc.titleEn,
        summaryBn: 'বাংলাদেশ রেলওয়ে আন্তঃনগর ট্রেন সময়সূচি ও ভাড়া',
        summaryEn: 'Bangladesh Railway intercity train schedule & official fares',
        keywords: tc.keywords,
        url: `/transport?from=${tc.from}&to=${tc.to}`,
        trustLabel: TrustLabel.OFFICIAL_SOURCE,
        attribution: {
          trustLabel: TrustLabel.OFFICIAL_SOURCE,
          sourceUrl: 'https://eticket.railway.gov.bd',
          agency: 'Bangladesh Railway',
          lastVerifiedAt: nowIso,
        },
      });
    }

    // Bus routes
    const busRoutes = [
      {
        code: 'bus-da-ctg',
        from: 'Dhaka',
        to: 'Chattogram',
        titleBn: 'ঢাকা → চট্টগ্রাম আন্তঃজেলা বাস ও বিআরটিএ ভাড়া',
        titleEn: 'Dhaka → Chattogram Intercity Bus & BRTA Fare',
        keywords: ['dhaka ctg bus', 'dhaka chattogram bus', 'ঢাকা চট্টগ্রাম বাস', 'brtc', 'greenline', 'hanif'],
      },
      {
        code: 'bus-da-syl',
        from: 'Dhaka',
        to: 'Sylhet',
        titleBn: 'ঢাকা → সিলেট আন্তঃজেলা বাস ও কাউন্টার',
        titleEn: 'Dhaka → Sylhet Intercity Bus & Counters',
        keywords: ['dhaka sylhet bus', 'sylhet bus', 'ঢাকা সিলেট বাস', 'সিলেট বাস'],
      },
      {
        code: 'bus-da-bsl',
        from: 'Dhaka',
        to: 'Barishal',
        titleBn: 'ঢাকা → বরিশাল বিআরটিসি বাস (পদ্মা সেতু রুট)',
        titleEn: 'Dhaka → Barishal BRTC Bus (Padma Bridge Route)',
        keywords: ['dhaka barishal bus', 'barishal bus', 'ঢাকা বরিশাল বাস'],
      },
    ];
    for (const br of busRoutes) {
      docs.push({
        id: br.code,
        type: 'bus_route',
        slugOrCode: br.code,
        titleBn: br.titleBn,
        titleEn: br.titleEn,
        summaryBn: 'বিআরটিএ সরকারি বাস ভাড়া ও নিবন্ধিত অপারেটর',
        summaryEn: 'BRTA official bus fare estimate & listed operators',
        keywords: br.keywords,
        url: `/transport?tab=bus&from=${br.from}&to=${br.to}`,
        trustLabel: TrustLabel.OFFICIAL_SOURCE,
        attribution: {
          trustLabel: TrustLabel.OFFICIAL_SOURCE,
          sourceUrl: 'https://bsp.brta.gov.bd/',
          agency: 'BRTA / BRTC',
          lastVerifiedAt: nowIso,
        },
      });
    }

    // Ministries & Agencies
    for (const ag of this.agencies.values()) {
      docs.push({
        id: `min-${ag.slug}`,
        type: 'ministry',
        slugOrCode: ag.slug,
        titleBn: ag.nameBn,
        titleEn: ag.nameEn,
        summaryBn: `সরকারি দপ্তর ও হটলাইন ${ag.contactPhone ?? '333'} — ${ag.officialUrl}`,
        summaryEn: `Official government office & helpline ${ag.contactPhone ?? '333'} — ${ag.officialUrl}`,
        keywords: [ag.slug, 'ministry', 'মন্ত্রণালয়', 'অধিদপ্তর', ag.contactPhone ?? '333'],
        url: `/ministries?q=${encodeURIComponent(ag.slug)}`,
        trustLabel: TrustLabel.OFFICIAL_SOURCE,
        attribution: {
          trustLabel: TrustLabel.OFFICIAL_SOURCE,
          sourceUrl: ag.officialUrl,
          agency: ag.nameEn,
          lastVerifiedAt: nowIso,
        },
      });
    }

    // Education Institutions & Universities (UGC / BANBEIS lookup)
    const eduEntries = [
      {
        code: 'ugc-dhaka-university',
        titleBn: 'ঢাকা বিশ্ববিদ্যালয় (ইউজিসি পাবলিক বিশ্ববিদ্যালয় তালিকা)',
        titleEn: 'University of Dhaka (UGC Public University Listing)',
        summaryBn: 'বিশ্ববিদ্যালয়ের সাধারণত BANBEIS EIIN থাকে না — ইউজিসি তালিকা দেখুন',
        summaryEn: 'Universities are listed under UGC (no BANBEIS school EIIN)',
        keywords: ['uni', 'university', 'dhaka uni', 'dhaka university', 'university of dhaka', 'du', 'ঢাকা বিশ্ববিদ্যালয়', 'বিশ্ববিদ্যালয়', 'ugc'],
        url: '/education?tab=universities&q=Dhaka%20University',
      },
      {
        code: 'ugc-buet',
        titleBn: 'বাংলাদেশ প্রকৌশল বিশ্ববিদ্যালয় — বুয়েট (UGC তালিকা)',
        titleEn: 'Bangladesh University of Engineering and Technology — BUET (UGC)',
        summaryBn: 'ইউজিসি তালিকাভুক্ত পাবলিক প্রকৌশল বিশ্ববিদ্যালয়',
        summaryEn: 'UGC-listed public engineering university',
        keywords: ['uni', 'university', 'buet', 'বুয়েট', 'engineering university', 'ugc'],
        url: '/education?tab=universities&q=BUET',
      },
      {
        code: 'ugc-rajshahi-university',
        titleBn: 'রাজশাহী বিশ্ববিদ্যালয় (ইউজিসি পাবলিক বিশ্ববিদ্যালয় তালিকা)',
        titleEn: 'University of Rajshahi (UGC Public University Listing)',
        summaryBn: 'ইউজিসি তালিকাভুক্ত পাবলিক বিশ্ববিদ্যালয়',
        summaryEn: 'UGC-listed public university in Rajshahi',
        keywords: ['uni', 'university', 'rajshahi university', 'রাজশাহী বিশ্ববিদ্যালয়', 'ugc'],
        url: '/education?tab=universities&q=Rajshahi',
      },
      {
        code: 'banbeis-eiin-directory',
        titleBn: 'শিক্ষা প্রতিষ্ঠান ও EIIN অনুসন্ধান (ব্যানবেইস / শিক্ষা বোর্ড)',
        titleEn: 'Education Institution & EIIN Directory (BANBEIS / Boards)',
        summaryBn: 'স্কুল, কলেজ, মাদ্রাসা ও কারিগরি প্রতিষ্ঠানের EIIN ও কোড অনুসন্ধান',
        summaryEn: 'Search schools, colleges, madrasas & technical institutes by EIIN or code',
        keywords: ['eiin', 'ইআইআইএন', 'banbeis', 'ব্যানবেইস', 'school', 'college', 'institution', 'কলেজ কোড'],
        url: '/education',
      },
    ];
    for (const ed of eduEntries) {
      docs.push({
        id: `edu-${ed.code}`,
        type: 'institution',
        slugOrCode: ed.code,
        titleBn: ed.titleBn,
        titleEn: ed.titleEn,
        summaryBn: ed.summaryBn,
        summaryEn: ed.summaryEn,
        keywords: ed.keywords,
        url: ed.url,
        trustLabel: TrustLabel.OFFICIAL_SOURCE,
        attribution: {
          trustLabel: TrustLabel.OFFICIAL_SOURCE,
          sourceUrl: 'https://dshe.gov.bd',
          agency: 'DSHE / UGC / BANBEIS',
          lastVerifiedAt: nowIso,
        },
      });
    }

    return docs;
  }

  async saveService(service: ServiceRecord): Promise<ServiceRecord> {
    service.updatedAt = new Date();
    this.services.set(service.slug, service);
    return service;
  }

  async addServiceVersion(version: ServiceVersionRecord): Promise<ServiceVersionRecord> {
    const existing = this.serviceVersions.get(version.serviceId) ?? [];
    existing.push(version);
    this.serviceVersions.set(version.serviceId, existing);
    return version;
  }

  async saveSource(source: SourceRecord): Promise<SourceRecord> {
    this.sources.set(source.id, source);
    return source;
  }

  async addContentReport(report: ContentReportRecord): Promise<ContentReportRecord> {
    this.contentReports.push(report);
    return report;
  }

  async addReviewTask(task: ReviewTaskRecord): Promise<ReviewTaskRecord> {
    this.reviewTasks.push(task);
    return task;
  }

  async listReviewTasks(): Promise<ReviewTaskRecord[]> {
    return [...this.reviewTasks];
  }

  async listSavedItems(userId: string): Promise<SavedItemRecord[]> {
    return [...this.savedItems.values()].filter((s) => s.userId === userId);
  }

  async addSavedItem(item: SavedItemRecord): Promise<SavedItemRecord> {
    this.savedItems.set(item.id, item);
    return item;
  }

  async findSavedItemById(id: string): Promise<SavedItemRecord | null> {
    return this.savedItems.get(id) ?? null;
  }

  async deleteSavedItem(id: string): Promise<void> {
    this.savedItems.delete(id);
  }

  async listReminders(userId: string): Promise<ReminderRecord[]> {
    return [...this.reminders.values()].filter((r) => r.userId === userId);
  }

  async findReminderById(id: string): Promise<ReminderRecord | null> {
    return this.reminders.get(id) ?? null;
  }

  async saveReminder(reminder: ReminderRecord): Promise<ReminderRecord> {
    this.reminders.set(reminder.id, reminder);
    return reminder;
  }

  async deleteReminder(id: string): Promise<void> {
    this.reminders.delete(id);
  }
}
