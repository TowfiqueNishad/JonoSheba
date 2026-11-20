import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  AGENCIES_SEED,
  CATEGORIES_SEED,
  COMPLAINT_GUIDES_SEED,
  HOTLINES_SEED,
  LIFE_EVENTS_SEED,
  SERVICES_SEED,
} from './seed-data/catalogue';
import { DISTRICTS_SEED, DIVISIONS_SEED } from './seed-data/geography';
import { OPPORTUNITIES_WITH_RULES_SEED } from './seed-data/opportunities';
import {
  BUS_STOPS_SEED,
  RAIL_STATIONS_SEED,
  TRANSPORT_PROVIDERS_SEED,
} from './seed-data/transport';

const prisma = new PrismaClient();

const RBAC_ROLES = [
  { code: 'guest', nameBn: 'অতিথি', nameEn: 'Guest', requiresMfa: false, permissions: ['catalogue:read', 'emergency:read'] },
  { code: 'citizen', nameBn: 'নাগরিক', nameEn: 'Citizen', requiresMfa: false, permissions: ['catalogue:read', 'watch:manage', 'case:manage', 'me:manage'] },
  { code: 'org_member', nameBn: 'সংস্থা সদস্য', nameEn: 'Organization Member', requiresMfa: false, permissions: ['assisted:session'] },
  { code: 'content_editor', nameBn: 'কনটেন্ট সম্পাদক', nameEn: 'Content Editor', requiresMfa: true, permissions: ['service:write', 'notice:write', 'kb:ingest'] },
  { code: 'reviewer', nameBn: 'পর্যালোচক', nameEn: 'Reviewer', requiresMfa: true, permissions: ['service:publish', 'hotline:approve', 'rule:publish'] },
  { code: 'moderator', nameBn: 'মডারেটর', nameEn: 'Moderator', requiresMfa: true, permissions: ['report:moderate', 'user:suspend'] },
  { code: 'support_agent', nameBn: 'সাপোর্ট এজেন্ট', nameEn: 'Support Agent', requiresMfa: true, permissions: ['support:respond'] },
  { code: 'platform_admin', nameBn: 'প্ল্যাটফর্ম অ্যাডমিন', nameEn: 'Platform Admin', requiresMfa: true, permissions: ['*'] },
  { code: 'agency_partner', nameBn: 'সংস্থা পার্টনার', nameEn: 'Agency Partner', requiresMfa: true, permissions: ['partner:analytics:read'] },
];

async function seed(): Promise<void> {
  console.info('[seed] Starting Jonoshheba AI Bangladesh database seed...');

  // 1. Identity: RBAC roles
  for (const role of RBAC_ROLES) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { nameBn: role.nameBn, nameEn: role.nameEn, requiresMfa: role.requiresMfa, permissions: role.permissions },
      create: role,
    });
  }
  console.info(`[seed] Upserted ${RBAC_ROLES.length} RBAC roles.`);

  // 2. Geography: 8 divisions, 64 districts, 495 upazilas
  const divisionMap = new Map<string, string>();
  for (const div of DIVISIONS_SEED) {
    const saved = await prisma.division.upsert({
      where: { bbsCode: div.bbsCode },
      update: { nameBn: div.nameBn, nameEn: div.nameEn, lat: div.lat, lng: div.lng },
      create: div,
    });
    divisionMap.set(div.bbsCode, saved.id);
  }

  const districtMapByEn = new Map<string, string>();
  let upazilaCount = 0;
  for (const dist of DISTRICTS_SEED) {
    const divisionId = divisionMap.get(dist.divisionBbs);
    if (!divisionId) continue;
    const savedDist = await prisma.district.upsert({
      where: { bbsCode: dist.bbsCode },
      update: { nameBn: dist.nameBn, nameEn: dist.nameEn, lat: dist.lat, lng: dist.lng, divisionId },
      create: {
        bbsCode: dist.bbsCode,
        divisionId,
        nameBn: dist.nameBn,
        nameEn: dist.nameEn,
        lat: dist.lat,
        lng: dist.lng,
      },
    });
    districtMapByEn.set(dist.nameEn, savedDist.id);

    for (let i = 0; i < dist.upazilas.length; i++) {
      const pair = dist.upazilas[i];
      if (!pair) continue;
      const [nameEn, nameBn] = pair;
      const bbsCode = `${dist.bbsCode}${String(i + 1).padStart(2, '0')}`;
      await prisma.upazila.upsert({
        where: { bbsCode },
        update: { nameBn, nameEn, districtId: savedDist.id },
        create: { bbsCode, districtId: savedDist.id, nameBn, nameEn },
      });
      upazilaCount++;
    }
  }
  console.info(
    `[seed] Upserted ${DIVISIONS_SEED.length} divisions, ${DISTRICTS_SEED.length} districts, ${upazilaCount} upazilas.`,
  );

  // 3. Catalogue: Categories, Agencies, Sources, 62 Services, Life Events, 9 Hotlines
  const categoryMap = new Map<string, string>();
  for (let i = 0; i < CATEGORIES_SEED.length; i++) {
    const cat = CATEGORIES_SEED[i]!;
    const saved = await prisma.serviceCategory.upsert({
      where: { slug: cat.slug },
      update: { nameBn: cat.nameBn, nameEn: cat.nameEn, icon: cat.icon, sortOrder: i },
      create: { slug: cat.slug, nameBn: cat.nameBn, nameEn: cat.nameEn, icon: cat.icon, sortOrder: i },
    });
    categoryMap.set(cat.slug, saved.id);
  }

  const agencyMap = new Map<string, string>();
  const sourceMapByUrl = new Map<string, string>();

  async function ensureSource(url: string, agency: string, sourceType = 'official_portal'): Promise<string> {
    const cached = sourceMapByUrl.get(url);
    if (cached) return cached;
    const existing = await prisma.source.findFirst({ where: { url, agency } });
    if (existing) {
      sourceMapByUrl.set(url, existing.id);
      return existing.id;
    }
    const created = await prisma.source.create({
      data: {
        url,
        agency,
        sourceType,
        trustLabel: 'OFFICIAL_SOURCE',
        verifiedAt: new Date(),
      },
    });
    sourceMapByUrl.set(url, created.id);
    return created.id;
  }

  for (const ag of AGENCIES_SEED) {
    const saved = await prisma.agency.upsert({
      where: { slug: ag.slug },
      update: { nameBn: ag.nameBn, nameEn: ag.nameEn, officialUrl: ag.officialUrl, contactPhone: ag.contactPhone },
      create: { slug: ag.slug, nameBn: ag.nameBn, nameEn: ag.nameEn, officialUrl: ag.officialUrl, contactPhone: ag.contactPhone },
    });
    agencyMap.set(ag.slug, saved.id);
  }

  const serviceMap = new Map<string, string>();
  for (const svc of SERVICES_SEED) {
    const agencyId = agencyMap.get(svc.agencySlug)!;
    const categoryId = categoryMap.get(svc.categorySlug)!;
    const sourceId = await ensureSource(svc.officialUrl, svc.agencySlug);

    const saved = await prisma.service.upsert({
      where: { slug: svc.slug },
      update: {
        titleBn: svc.titleBn,
        titleEn: svc.titleEn,
        summaryBn: svc.summaryBn,
        summaryEn: svc.summaryEn,
        officialUrl: svc.officialUrl,
        feeInfo: { bn: svc.feeTextBn, en: svc.feeTextEn },
        processingTime: svc.processingTime,
        aliases: svc.aliases,
        status: 'published',
        trustLabel: 'OFFICIAL_SOURCE',
        lastVerifiedAt: new Date(),
      },
      create: {
        slug: svc.slug,
        titleBn: svc.titleBn,
        titleEn: svc.titleEn,
        summaryBn: svc.summaryBn,
        summaryEn: svc.summaryEn,
        descriptionMdBn: `${svc.summaryBn}\n\nসরকারি পোর্টাল: ${svc.officialUrl}`,
        descriptionMdEn: `${svc.summaryEn}\n\nOfficial portal: ${svc.officialUrl}`,
        agencyId,
        categoryId,
        sourceId,
        deliveryChannels: svc.deliveryChannels ?? ['online', 'in_person'],
        officialUrl: svc.officialUrl,
        feeInfo: { bn: svc.feeTextBn, en: svc.feeTextEn },
        processingTime: svc.processingTime,
        aliases: svc.aliases,
        status: 'published',
        trustLabel: 'OFFICIAL_SOURCE',
        lastVerifiedAt: new Date(),
      },
    });
    serviceMap.set(svc.slug, saved.id);
  }
  console.info(`[seed] Upserted ${SERVICES_SEED.length} Bangladesh citizen services.`);

  for (let i = 0; i < LIFE_EVENTS_SEED.length; i++) {
    const ev = LIFE_EVENTS_SEED[i]!;
    await prisma.lifeEvent.upsert({
      where: { slug: ev.slug },
      update: { titleBn: ev.titleBn, titleEn: ev.titleEn, summaryBn: ev.summaryBn, summaryEn: ev.summaryEn, icon: ev.icon, sortOrder: i },
      create: { slug: ev.slug, titleBn: ev.titleBn, titleEn: ev.titleEn, summaryBn: ev.summaryBn, summaryEn: ev.summaryEn, icon: ev.icon, sortOrder: i },
    });
  }

  for (let i = 0; i < HOTLINES_SEED.length; i++) {
    const hl = HOTLINES_SEED[i]!;
    const sourceId = await ensureSource(hl.sourceUrl, hl.agency, 'hotline_directory');
    await prisma.hotline.upsert({
      where: { number: hl.number },
      update: {
        nameBn: hl.nameBn,
        nameEn: hl.nameEn,
        category: hl.category,
        sourceId,
        verifyBeforeRelease: true,
        sortOrder: i,
      },
      create: {
        number: hl.number,
        nameBn: hl.nameBn,
        nameEn: hl.nameEn,
        category: hl.category,
        sourceId,
        trustLabel: 'OFFICIAL_SOURCE',
        verifyBeforeRelease: true,
        sortOrder: i,
      },
    });
  }
  console.info(`[seed] Upserted ${HOTLINES_SEED.length} emergency & public hotlines (all flagged verify_before_release).`);

  // 4. Transport: Providers (MOCK & LINK_ONLY), 52 Rail Stations, 102 Bus Stops
  const providerMap = new Map<string, string>();
  for (const prov of TRANSPORT_PROVIDERS_SEED) {
    const saved = await prisma.transportProvider.upsert({
      where: { code: prov.code },
      update: {
        name: prov.name,
        officialUrl: prov.officialUrl,
        integrationType: prov.integrationType,
        rateLimitPerMin: prov.rateLimitPerMin,
        termsUrl: prov.termsUrl,
      },
      create: {
        code: prov.code,
        mode: prov.mode,
        name: prov.name,
        officialUrl: prov.officialUrl,
        integrationType: prov.integrationType,
        rateLimitPerMin: prov.rateLimitPerMin,
        termsUrl: prov.termsUrl,
      },
    });
    providerMap.set(prov.code, saved.id);
  }

  const allStops = [...RAIL_STATIONS_SEED, ...BUS_STOPS_SEED];
  const stopMap = new Map<string, string>();
  for (const stop of allStops) {
    const districtId = districtMapByEn.get(stop.districtEn) ?? null;
    const saved = await prisma.stationStop.upsert({
      where: { code: stop.code },
      update: { nameBn: stop.nameBn, nameEn: stop.nameEn, districtId, lat: stop.lat, lng: stop.lng, aliases: stop.aliases },
      create: {
        code: stop.code,
        mode: stop.mode,
        nameBn: stop.nameBn,
        nameEn: stop.nameEn,
        districtId,
        lat: stop.lat,
        lng: stop.lng,
        aliases: stop.aliases,
      },
    });
    stopMap.set(stop.code, saved.id);
  }
  console.info(
    `[seed] Upserted ${TRANSPORT_PROVIDERS_SEED.length} transport providers, ${RAIL_STATIONS_SEED.length} rail stations, ${BUS_STOPS_SEED.length} bus stops.`,
  );

  // Sample route & seat classes for MOCK rail
  const mockRailId = providerMap.get('mock-rail');
  const dhakaRailId = stopMap.get('RAIL-DA');
  const ctgRailId = stopMap.get('RAIL-CTG');
  if (mockRailId && dhakaRailId && ctgRailId) {
    await prisma.route.upsert({
      where: { routeKey: 'mock-rail:RAIL-DA:RAIL-CTG' },
      update: {},
      create: {
        providerId: mockRailId,
        routeKey: 'mock-rail:RAIL-DA:RAIL-CTG',
        mode: 'train',
        originId: dhakaRailId,
        destinationId: ctgRailId,
        nameBn: 'ঢাকা — চট্টগ্রাম ইন্টারসিটি (MOCK)',
        nameEn: 'Dhaka — Chattogram Intercity (MOCK)',
        distanceKm: 321,
      },
    });
    for (const sc of [
      { code: 'S_CHAIR', nameBn: 'শোভন চেয়ার', nameEn: 'Shovan Chair', baseFareBdt: 405 },
      { code: 'SNIGDHA', nameBn: 'স্নিগ্ধা (এসি চেয়ার)', nameEn: 'Snigdha (AC Chair)', baseFareBdt: 777 },
      { code: 'AC_S', nameBn: 'এসি সিট', nameEn: 'AC Seat', baseFareBdt: 932 },
    ]) {
      await prisma.seatClass.upsert({
        where: { providerId_code: { providerId: mockRailId, code: sc.code } },
        update: sc,
        create: { providerId: mockRailId, ...sc },
      });
    }
  }

  // 5. Opportunities: 20 Programs & Scholarships with versioned JSON-Logic rules
  for (const opp of OPPORTUNITIES_WITH_RULES_SEED) {
    const sourceId = await ensureSource(opp.applicationUrl, opp.agencyOrProvider, 'program_policy');
    let targetId: string;
    if (opp.kind === 'program') {
      const saved = await prisma.program.upsert({
        where: { slug: opp.slug },
        update: {
          titleBn: opp.titleBn,
          titleEn: opp.titleEn,
          summaryBn: opp.summaryBn,
          summaryEn: opp.summaryEn,
          applicationUrl: opp.applicationUrl,
          requiredDocuments: opp.requiredDocuments,
        },
        create: {
          slug: opp.slug,
          titleBn: opp.titleBn,
          titleEn: opp.titleEn,
          summaryBn: opp.summaryBn,
          summaryEn: opp.summaryEn,
          agency: opp.agencyOrProvider,
          category: opp.categoryOrLevel,
          benefitAmountInfo: opp.benefitAmountInfo,
          requiredDocuments: opp.requiredDocuments,
          applicationUrl: opp.applicationUrl,
          sourceId,
          lastVerifiedAt: new Date(),
        },
      });
      targetId = saved.id;
    } else {
      const saved = await prisma.scholarship.upsert({
        where: { slug: opp.slug },
        update: {
          titleBn: opp.titleBn,
          titleEn: opp.titleEn,
          summaryBn: opp.summaryBn,
          summaryEn: opp.summaryEn,
          applicationUrl: opp.applicationUrl,
          requiredDocuments: opp.requiredDocuments,
        },
        create: {
          slug: opp.slug,
          titleBn: opp.titleBn,
          titleEn: opp.titleEn,
          summaryBn: opp.summaryBn,
          summaryEn: opp.summaryEn,
          provider: opp.agencyOrProvider,
          educationLevel: opp.categoryOrLevel,
          requiredDocuments: opp.requiredDocuments,
          applicationUrl: opp.applicationUrl,
          sourceId,
          lastVerifiedAt: new Date(),
        },
      });
      targetId = saved.id;
    }

    await prisma.eligibilityRule.upsert({
      where: {
        targetType_targetId_version: {
          targetType: opp.kind,
          targetId,
          version: 1,
        },
      },
      update: {
        ruleJsonLogic: opp.ruleJsonLogic as object,
        criteriaExplanations: opp.criteriaExplanations as unknown as object,
      },
      create: {
        targetType: opp.kind,
        targetId,
        version: 1,
        ruleJsonLogic: opp.ruleJsonLogic as object,
        criteriaExplanations: opp.criteriaExplanations as unknown as object,
        sourceId,
        isActive: true,
      },
    });
  }
  console.info(
    `[seed] Upserted ${OPPORTUNITIES_WITH_RULES_SEED.length} benefit programs & scholarships with JSON-Logic rules.`,
  );

  // 6. Cases: Complaint Guides
  for (const guide of COMPLAINT_GUIDES_SEED) {
    const sourceId = await ensureSource(guide.officialChannelUrl, guide.authorityEn, 'complaint_guide');
    await prisma.complaintGuide.upsert({
      where: { slug: guide.slug },
      update: {
        authorityBn: guide.authorityBn,
        authorityEn: guide.authorityEn,
        officialChannelUrl: guide.officialChannelUrl,
        evidenceChecklist: guide.evidenceChecklist as unknown as object,
      },
      create: {
        slug: guide.slug,
        category: guide.category,
        authorityBn: guide.authorityBn,
        authorityEn: guide.authorityEn,
        officialChannelUrl: guide.officialChannelUrl,
        supportsAnonymity: guide.supportsAnonymity,
        anonymityNotesBn: guide.anonymityNotesBn,
        anonymityNotesEn: guide.anonymityNotesEn,
        evidenceChecklist: guide.evidenceChecklist as unknown as object,
        sourceId,
      },
    });
  }

  // 7. Notify: Starter R1-compliant templates
  for (const tpl of [
    {
      key: 'watch.matched',
      channel: 'in_app' as const,
      locale: 'bn',
      subject: 'সম্ভাব্য টিকিট পাওয়া যেতে পারে',
      body: '{{routeName}} ({{journeyDate}}) রুটে সম্ভাব্য আসন দেখা গেছে। আসন সংরক্ষিত নয় — বুকিংয়ের জন্য অফিশিয়াল চ্যানেলে যান: {{officialUrl}}',
    },
    {
      key: 'watch.matched',
      channel: 'in_app' as const,
      locale: 'en',
      subject: 'Possible ticket availability detected',
      body: 'Possible availability detected for {{routeName}} on {{journeyDate}}. Seat is not reserved — continue to official provider: {{officialUrl}}',
    },
  ]) {
    await prisma.notificationTemplate.upsert({
      where: {
        key_channel_locale_version: {
          key: tpl.key,
          channel: tpl.channel,
          locale: tpl.locale,
          version: 1,
        },
      },
      update: { subject: tpl.subject, body: tpl.body },
      create: { ...tpl, version: 1 },
    });
  }

  // 8. Admin: Starter Feature Flags
  for (const flag of [
    { key: 'transport.mock_adapters_enabled', description: 'Enable MOCK rail/bus adapters in dev', enabled: true },
    { key: 'assistant.jono_voice_ws_enabled', description: 'Enable Phase 2 real-time voice WebSocket', enabled: false },
    { key: 'notify.sms_channel_enabled', description: 'Enable outbound SMS channel (requires budget cap)', enabled: false },
  ]) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: { description: flag.description },
      create: flag,
    });
  }

  console.info('[seed] Jonoshheba AI seed completed cleanly.');
}

seed()
  .catch((err) => {
    console.error('[seed] Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
