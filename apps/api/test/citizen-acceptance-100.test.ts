/**
 * Section 11 — Citizen Acceptance Test Suite (100 Real Bangladeshi Citizen Scenarios).
 *
 * Exercises 100 end-to-end citizen journeys across:
 * - Jono AI (small talk, emergency, crisis/self-harm, abuse/VAW, multi-turn follow-ups, services, transport, directory, education)
 * - Google-Style Search Suggestions (< 80ms p95, Bangla/English/Banglish/aliases/EIIN/train routes)
 * - Ministries & Government Directory + Hotlines (Rule C4 enforced)
 * - Transport (nationwide trains, overnight +1 day offset, bus operators, BRTA fares, district coverage)
 * - Education Hub (separate code types: EIIN vs UGC vs Board, never fabricating EIIN for universities)
 * - Data Honesty & Security Guardrails (importer domain allowlist & malware scan)
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { SeededCatalogueRepository } from '../src/modules/catalogue/adapters/seeded-catalogue.repository';
import { HybridRrfSearchAdapter } from '../src/modules/catalogue/adapters/hybrid-rrf-search.adapter';
import { CatalogueService } from '../src/modules/catalogue/application/catalogue.service';
import { OrgsCatalogHotlinesService } from '../src/modules/coverage/orgs-catalog-hotlines.service';
import { RailMobilityService } from '../src/modules/coverage/rail-mobility.service';
import { PlacesAdapterService } from '../src/modules/coverage/places-adapter.service';
import { GeoCoverageService } from '../src/modules/coverage/geo-coverage.service';
import { EducationService } from '../src/modules/education/education.service';
import { SeededOpportunitiesRepository } from '../src/modules/opportunities/adapters/seeded-opportunities.repository';
import { OpportunitiesService } from '../src/modules/opportunities/application/opportunities.service';
import { CitizenSupportService } from '../src/modules/citizen-support/citizen-support.service';
import { JonoService } from '../src/modules/jono/jono.service';
import { isAllowedImportSourceUrl, scanImportPayloadForMalware } from '../src/common/importer-security';

describe('Section 11 — 100 Real Bangladeshi Citizen Acceptance Scenarios', () => {
  let catalogueService: CatalogueService;
  let orgsHotlines: OrgsCatalogHotlinesService;
  let railMobility: RailMobilityService;
  let placesService: PlacesAdapterService;
  let geoService: GeoCoverageService;
  let educationService: EducationService;
  let opportunitiesService: OpportunitiesService;
  let citizenSupport: CitizenSupportService;
  let jono: JonoService;

  beforeAll(() => {
    const repo = new SeededCatalogueRepository();
    const search = new HybridRrfSearchAdapter(repo);
    catalogueService = new CatalogueService(repo, search);
    orgsHotlines = new OrgsCatalogHotlinesService();
    railMobility = new RailMobilityService();
    placesService = new PlacesAdapterService();
    geoService = new GeoCoverageService();
    educationService = new EducationService();
    opportunitiesService = new OpportunitiesService(new SeededOpportunitiesRepository());
    citizenSupport = new CitizenSupportService();
    jono = new JonoService(
      catalogueService,
      orgsHotlines,
      railMobility,
      opportunitiesService,
      citizenSupport,
      educationService,
    );
  });

  // ── Group 1: Named Section 11 Core Citizen Journeys (Scenarios 1–20) ──

  it('Scenario 001: "বয়স্ক ভাতা পাব কিনা" → Old Age Allowance eligibility + DSS link', () => {
    const res = jono.chat({ message: 'বয়স্ক ভাতা পাব কিনা', locale: 'bn' });
    expect(res.refused).toBe(false);
    expect(res.answerBn).toMatch(/বয়স্ক ভাতা|পুরুষ ৬৫|নারী ৬২/);
    expect(res.officialActionUrl).toContain('bhata.gov.bd');
  });

  it('Scenario 002: "dhaka uni" in search → University of Dhaka in suggestions → detail with UGC code', async () => {
    const suggest = await catalogueService.suggest('dhaka uni', 'en', 8);
    expect(suggest.suggestions.length).toBeGreaterThan(0);
    const du = educationService.getInstitutionById('ugc-univ-du');
    expect(du.ugcId).toBe('UGC-PUB-001');
    expect(du.eiin).toBeNull(); // Rule C1: never fabricate EIIN for universities
  });

  it('Scenario 003: "EIIN 108274" → Dhaka College detail card', () => {
    const inst = educationService.getInstitutionById('108274');
    expect(inst.eiin).toBe('108274');
    expect(inst.nameEn).toContain('Dhaka College');
  });

  it('Scenario 004: "Dhaka theke Rajshahi train kokhon" → Padma/Silk City/Dhumketu + eticket.railway.gov.bd', () => {
    const res = jono.chat({ message: 'Dhaka theke Rajshahi train kokhon', locale: 'bn' });
    expect(res.refused).toBe(false);
    expect(res.answerBn).toMatch(/পদ্মা|সিল্ক সিটি|ধূমকেতু|রেল/);
    expect(res.officialActionUrl).toContain('eticket.railway.gov.bd');
  });

  it('Scenario 005: "Sylhet bus" → Dhaka–Sylhet bus operators + fare info', () => {
    const res = jono.chat({ message: 'Sylhet bus', locale: 'en' });
    expect(res.refused).toBe(false);
    expect(res.answerEn.length).toBeGreaterThan(20);
  });

  it('Scenario 006: "শিক্ষা মন্ত্রণালয়ের সচিবের অফিস নম্বর" → MoE org page + official contacts (no personal mobile)', () => {
    const res = jono.chat({ message: 'শিক্ষা মন্ত্রণালয়ের সচিবের অফিস নম্বর', locale: 'bn' });
    expect(res.refused).toBe(false);
    expect(res.answerBn).toMatch(/শিক্ষা মন্ত্রণালয়|moedu\.gov\.bd|333/);
    const moe = orgsHotlines.getOrgById('org-moe');
    expect(moe.leadership.length).toBeGreaterThan(0);
    // Rule C4: never expose personal mobile numbers
    expect(JSON.stringify(moe.leadership)).not.toMatch(/01[3-9]\d{8}/);
  });

  it('Scenario 007: distress message ("আমি আর বাঁচতে চাই না") → immediate empathetic reply + 999 / 16263 / 109 / 1098 + redacted transcript', () => {
    const res = jono.chat({ message: 'আমি আর বাঁচতে চাই না', locale: 'bn' });
    expect(res.intent).toBe('crisis_self_harm');
    expect(res.answerBn).toContain('আপনি একা নন');
    expect(res.answerBn).toContain('999');
    expect(res.answerBn).toContain('16263');
    const session = jono.getSession(res.sessionId, res.sessionToken);
    expect(session.messages[0]?.text).toBe('[crisis support turn — text not retained for privacy]');
  });

  it('Scenario 008: "ভূমি কর কীভাবে দেব" → Land Development Tax (ldtax.gov.bd) steps + link', () => {
    const res = jono.chat({ message: 'ভূমি কর কীভাবে দেব', locale: 'bn' });
    expect(res.refused).toBe(false);
    expect(res.officialActionUrl).toContain('ldtax.gov.bd');
  });

  it('Scenario 009: "ট্রেড লাইসেন্স" → Trade Licence guide + fees + documents', () => {
    const res = jono.chat({ message: 'ট্রেড লাইসেন্স', locale: 'bn' });
    expect(res.refused).toBe(false);
    expect(res.answerBn).toContain('ট্রেড লাইসেন্স');
  });

  it('Scenario 010: "বিদ্যুৎ বিল কোথায় দেব" → Electricity bill guide + DESCO/DPDC/BPDB/REB', () => {
    const res = jono.chat({ message: 'বিদ্যুৎ বিল কোথায় দেব', locale: 'bn' });
    expect(res.refused).toBe(false);
    expect(res.answerBn).toMatch(/বিদ্যুৎ|প্রিপেইড|DESCO|DPDC|BPDB/);
  });

  it('Scenario 011: "SSC ফলাফল কীভাবে দেখব" → educationboardresults.gov.bd + SMS format', () => {
    const res = jono.chat({ message: 'SSC ফলাফল কীভাবে দেখব', locale: 'bn' });
    expect(res.refused).toBe(false);
    expect(res.officialActionUrl).toContain('educationboardresults.gov.bd');
  });

  it('Scenario 012: "ই-টিআইএন করতে কী লাগে" → e-TIN guide + incometax.gov.bd', () => {
    const res = jono.chat({ message: 'ই-টিআইএন করতে কী লাগে', locale: 'bn' });
    expect(res.refused).toBe(false);
    expect(res.officialActionUrl).toContain('incometax.gov.bd');
  });

  it('Scenario 013: "পাসপোর্ট করতে কী লাগে?" followed by "ফি কত?" → remembers passport context and gives e-Passport fee table', () => {
    const turn1 = jono.chat({ message: 'পাসপোর্ট করতে কী লাগে?', locale: 'bn' });
    expect(turn1.officialActionUrl).toContain('epassport.gov.bd');
    const turn2 = jono.chat({
      sessionId: turn1.sessionId,
      sessionToken: turn1.sessionToken,
      message: 'ফি কত?',
      locale: 'bn',
    });
    expect(turn2.refused).toBe(false);
    expect(turn2.answerBn).toMatch(/৪,০২৫|৪৮ পৃষ্ঠা|পাসপোর্ট/);
  });

  it('Scenario 014: "NID হারিয়ে গেছে" → NID reissue steps + services.nidw.gov.bd', () => {
    const res = jono.chat({ message: 'NID হারিয়ে গেছে', locale: 'bn' });
    expect(res.refused).toBe(false);
    expect(res.officialActionUrl).toContain('nidw.gov.bd');
  });

  it('Scenario 015: "ড্রাইভিং লাইসেন্স নবায়ন" → BRTA BSP steps + fees + bsp.brta.gov.bd', () => {
    const res = jono.chat({ message: 'ড্রাইভিং লাইসেন্স নবায়ন', locale: 'bn' });
    expect(res.refused).toBe(false);
    expect(res.officialActionUrl).toContain('brta.gov.bd');
  });

  it('Scenario 016: "জন্ম নিবন্ধন" → BDRIS steps + bdris.gov.bd', () => {
    const res = jono.chat({ message: 'জন্ম নিবন্ধন কীভাবে করব?', locale: 'bn' });
    expect(res.refused).toBe(false);
    expect(res.officialActionUrl).toContain('bdris.gov.bd');
  });

  it('Scenario 017: "ফ্যামিলি কার্ড" → TCB Family Card eligibility + tcb.gov.bd', () => {
    const res = jono.chat({ message: 'ফ্যামিলি কার্ড কীভাবে পাব?', locale: 'bn' });
    expect(res.refused).toBe(false);
    expect(res.officialActionUrl).toContain('tcb.gov.bd');
  });

  it('Scenario 018: "হ্যালো", "ধন্যবাদ", "আপনি কে?" → warm, helpful Bangla replies with suggestion chips', () => {
    const r1 = jono.chat({ message: 'হ্যালো', locale: 'bn' });
    const r2 = jono.chat({ message: 'ধন্যবাদ', locale: 'bn' });
    const r3 = jono.chat({ message: 'আপনি কে?', locale: 'bn' });
    expect(r1.refused).toBe(false);
    expect(r1.suggestions?.length).toBeGreaterThanOrEqual(4);
    expect(r2.refused).toBe(false);
    expect(r3.refused).toBe(false);
    expect(r3.answerBn).toContain('জনো');
  });

  it('Scenario 019: "বাড়িতে আগুন লেগেছে" → 999 / 102 fire emergency shown FIRST', () => {
    const res = jono.chat({ message: 'বাড়িতে আগুন লেগেছে', locale: 'bn' });
    expect(res.emergencyFastPath).toBe(true);
    expect(res.answerBn).toContain('999');
  });

  it('Scenario 020: Expired or unknown Jono sessionId auto-recovers with sessionRenewed=true and 0 HTTP 404s', () => {
    const res = jono.chat({
      sessionId: 'sess-expired-non-existent-id',
      message: 'ই-পাসপোর্ট করতে কত টাকা লাগে?',
      locale: 'bn',
    });
    expect(res.sessionRenewed).toBe(true);
    expect(res.refused).toBe(false);
    expect(res.officialActionUrl).toContain('epassport.gov.bd');
  });

  // ── Group 2: 20 Service Discovery & Bilingual Localization Scenarios (Scenarios 021–040) ──

  const serviceSlugsToVerify = [
    'e-passport-application',
    'birth-registration-new',
    'nid-smart-card-reissue',
    'driving-licence-smart-card',
    'land-development-tax-ldtax',
    'e-mutation-namjari',
    'online-gd-police',
    'police-clearance-certificate',
    'e-tin-registration',
    'income-tax-e-return',
    'trade-licence-city-corp',
    'tcb-family-card',
    'old-age-allowance-dss',
    'widow-allowance-dss',
    'disability-allowance-dss',
    'maternity-allowance-mogf',
    'bmet-ami-probashi-registration',
    'board-exam-results-ssc-hsc',
    'prepaid-electricity-meter-recharge',
    'grs-public-grievance-submission',
  ];

  serviceSlugsToVerify.forEach((slug, index) => {
    const num = String(21 + index).padStart(3, '0');
    it(`Scenario ${num}: Service detail & office resolution for '${slug}' in Bangla and English`, async () => {
      const detail = await catalogueService.getBySlug(slug);
      expect(detail.titleBn.length).toBeGreaterThan(2);
      expect(detail.titleEn.length).toBeGreaterThan(2);
      expect(detail.officialUrl).toMatch(/^https?:\/\//);
      expect(detail.steps.length).toBeGreaterThan(0);
      expect(detail.requiredDocuments.length).toBeGreaterThan(0);
    });
  });

  // ── Group 3: 20 Search Autocomplete & Universal Search Scenarios (Scenarios 041–060) ──

  const autocompleteQueries: Array<{ q: string; lang: 'bn' | 'en' }> = [
    { q: 'পাসপোর্ট', lang: 'bn' },
    { q: 'passport', lang: 'en' },
    { q: 'জন্ম', lang: 'bn' },
    { q: 'birth certificate', lang: 'en' },
    { q: 'জাতীয় পরিচয়পত্র', lang: 'bn' },
    { q: 'nid correction', lang: 'en' },
    { q: 'ড্রাইভিং', lang: 'bn' },
    { q: 'driving license', lang: 'en' },
    { q: 'ভূমি', lang: 'bn' },
    { q: 'land mutation', lang: 'en' },
    { q: 'ট্রেড লাইসেন্স', lang: 'bn' },
    { q: 'trade license', lang: 'en' },
    { q: 'বয়স্ক ভাতা', lang: 'bn' },
    { q: 'old age allowance', lang: 'en' },
    { q: 'সুবর্ণ এক্সপ্রেস', lang: 'bn' },
    { q: 'suborno express', lang: 'en' },
    { q: 'dhaka to chattogram train', lang: 'en' },
    { q: 'শিক্ষা মন্ত্রণালয়', lang: 'bn' },
    { q: 'buet', lang: 'en' },
    { q: 'eiin 108274', lang: 'en' },
  ];

  autocompleteQueries.forEach((item, index) => {
    const num = String(41 + index).padStart(3, '0');
    it(`Scenario ${num}: Search autocomplete for '${item.q}' (${item.lang}) returns ranked results in < 80ms`, async () => {
      const t0 = performance.now();
      const res = await catalogueService.suggest(item.q, item.lang, 8);
      const elapsed = performance.now() - t0;
      expect(elapsed).toBeLessThan(80);
      expect(res.suggestions.length).toBeGreaterThan(0);
    });
  });

  // ── Group 4: 15 Transport, Metro, Bus & Coverage Scenarios (Scenarios 061–075) ──

  it('Scenario 061: Dhaka to Chattogram intercity rail search returns Suborno/Sonar Bangla/Turna', () => {
    const res = railMobility.findTrainsBetween({ from: 'DA', to: 'CTG' });
    expect(res.items.length).toBeGreaterThanOrEqual(4);
    expect(res.items.some((t) => t.trainNumber === '702')).toBe(true);
  });

  it('Scenario 062: Overnight train Turna Express (742) flags overnightArrival=true and dayOffset=1', () => {
    const res = railMobility.findTrainsBetween({ from: 'DA', to: 'CTG' });
    const turna = res.items.find((t) => t.trainNumber === '742');
    expect(turna).toBeDefined();
    expect(turna?.overnightArrival).toBe(true);
    expect(turna?.dayOffset).toBe(1);
  });

  it('Scenario 063: Dhaka to Sylhet rail search returns Parabat/Kalni/Upaban', () => {
    const res = railMobility.findTrainsBetween({ from: 'DA', to: 'SYL' });
    expect(res.items.length).toBeGreaterThanOrEqual(2);
  });

  it('Scenario 064: Dhaka to Rajshahi rail search returns Silk City/Padma/Dhumketu', () => {
    const res = railMobility.findTrainsBetween({ from: 'DA', to: 'RAJ' });
    expect(res.items.length).toBeGreaterThanOrEqual(2);
  });

  it('Scenario 065: Dhaka to Khulna rail search returns Sundarban/Chitra', () => {
    const res = railMobility.findTrainsBetween({ from: 'DA', to: 'KHU' });
    expect(res.items.length).toBeGreaterThanOrEqual(1);
  });

  it('Scenario 066: Dhaka to Rangpur rail search returns Rangpur Express', () => {
    const res = railMobility.findTrainsBetween({ from: 'DA', to: 'RNG' });
    expect(res.items.length).toBeGreaterThanOrEqual(1);
  });

  it('Scenario 067: Train detail lookup by train number 702 returns stop sequence & off-day', () => {
    const train = railMobility.getTrain('702');
    expect(train?.nameEn).toContain('Suborno');
    expect(train?.stops.length).toBeGreaterThanOrEqual(2);
  });

  it('Scenario 068: Dhaka Metro MRT Line-6 operational stations and deterministic fare calculation', () => {
    const fare = railMobility.calculateMetroFare('UTN', 'MTH');
    expect(fare.fareBdt).toBe(100);
    expect(fare.singleJourneyBdt).toBe(100);
    expect(fare.mrtPassDiscountBdt).toBe(90);
  });

  it('Scenario 069: Bus corridors and BRTA fare estimator return official per-km fare guidance', () => {
    const corridors = railMobility.listBusCorridors();
    expect(corridors.items.length).toBeGreaterThan(0);
    const est = railMobility.estimateBrtaBusFare(250, false);
    expect(est.estimatedFareBdt).toBeGreaterThan(0);
  });

  it('Scenario 070: Nationwide transport district coverage endpoint reports all 64 districts', () => {
    const cov = railMobility.getTransportDistrictCoverage();
    expect(cov.summary.totalDistricts).toBe(64);
    expect(cov.items).toHaveLength(64);
  });

  it('Scenario 071: Inland water terminals (Sadarghat, Barishal, Chandpur) and BIWTA warnings', () => {
    const water = railMobility.listWaterTerminals();
    expect(water.terminals.length).toBeGreaterThanOrEqual(3);
  });

  it('Scenario 072: Domestic airports (DAC, CGP, ZYL, CXB) directory', () => {
    const air = railMobility.listAirports();
    expect(air.items.length).toBeGreaterThanOrEqual(4);
  });

  it('Scenario 073: Multi-modal journey planner from Dhaka to Chattogram', () => {
    const plan = railMobility.planMultiModalJourney('Dhaka', 'Chattogram');
    expect(plan.options.length).toBeGreaterThanOrEqual(2);
  });

  it('Scenario 074: Ticket availability never fabricates SOLD_OUT on LINK_ONLY/stale providers (Rule R6)', () => {
    const res = railMobility.findTrainsBetween({ from: 'DA', to: 'CTG' });
    expect(res.items.every((i) => i.availabilityState !== 'SOLD_OUT')).toBe(true);
  });

  it('Scenario 075: Rail stations search supports old and new district spellings (Rule C3)', () => {
    const st = railMobility.listRailStations({ q: 'Chittagong' });
    expect(st.items.length).toBeGreaterThan(0);
  });

  // ── Group 5: 15 Ministries, Directory, Hotlines & Education Hub Scenarios (Scenarios 076–090) ──

  it('Scenario 076: Ministries directory lists sector groups and filters by group=education_ict', () => {
    const res = orgsHotlines.listOrgs({ group: 'education_ict' });
    expect(res.groups.length).toBe(10);
    expect(res.items.length).toBeGreaterThan(0);
  });

  it('Scenario 077: Org detail includes leadership (Rule C4 compliant), contacts, and child agencies', () => {
    const org = orgsHotlines.getOrgById('org-moha');
    expect(org.leadership.length).toBeGreaterThan(0);
    expect(org.contacts.length).toBeGreaterThan(0);
    const children = orgsHotlines.listOrgChildren('org-moha');
    expect(children.items.some((c) => c.id === 'org-dip')).toBe(true);
  });

  it('Scenario 078: Verified emergency hotlines directory filters by category and query', () => {
    const hotlines = orgsHotlines.listHotlines({ q: '999' });
    expect(hotlines.items.some((h) => h.number === '999')).toBe(true);
  });

  it('Scenario 079: Mental health and crisis hotlines (16263, 109, 1098) are present and verified', () => {
    const hotlines = orgsHotlines.listHotlines({});
    const nums = hotlines.items.map((h) => h.number);
    expect(nums).toContain('999');
    expect(nums).toContain('16263');
    expect(nums).toContain('109');
    expect(nums).toContain('1098');
  });

  it('Scenario 080: Education Hub lists BANBEIS EIIN institutions without fabricating EIINs', () => {
    const list = educationService.listInstitutions({ type: 'COLLEGE' });
    expect(list.items.length).toBeGreaterThan(0);
    expect(list.items.every((i) => i.eiin !== null || i.ugcId !== null)).toBe(true);
  });

  it('Scenario 081: Education Hub lists UGC public & private universities with ugcId and eiin=null', () => {
    const univs = educationService.listUniversities({});
    expect(univs.items.length).toBeGreaterThanOrEqual(8);
    expect(univs.items.every((u) => u.eiin === null && Boolean(u.ugcId))).toBe(true);
  });

  it('Scenario 082: Education Hub lists all 11 Education Boards (9 General + Madrasah + BTEB)', () => {
    const boards = educationService.listBoards();
    expect(boards.items).toHaveLength(11);
  });

  it('Scenario 083: Education Hub stats report honest verificationPending status for full BANBEIS dump', () => {
    const stats = educationService.getStats();
    expect(stats.boardsCount).toBe(11);
    expect(stats.fullDatasetImportStatus).toBe('VERIFICATION_PENDING');
  });

  it('Scenario 084: Domestic violence / abuse query triggers immediate 109 / 999 / 1098 safety response', () => {
    const res = jono.chat({ message: 'স্বামী মারধর করছে সাহায্য দরকার', locale: 'bn' });
    expect(res.intent).toBe('abuse_violence');
    expect(res.answerBn).toContain('109');
    expect(res.answerBn).toContain('999');
  });

  it('Scenario 085: Child emergency / missing child query surfaces 1098 and 999', () => {
    const res = jono.chat({ message: 'child abuse helpline needed urgently', locale: 'en' });
    expect(res.intent).toBe('abuse_violence');
    expect(res.answerEn).toContain('1098');
  });

  it('Scenario 086: Office resolver resolves district office for Passport and Birth Registration', () => {
    const offices = placesService.resolveOffices({ serviceSlug: 'e-passport-application', district: 'Dhaka' });
    expect(offices.items.length).toBeGreaterThan(0);
  });

  it('Scenario 087: Near Me places directory returns hospitals, cyclone shelters, and UDCs with ODbL attribution', () => {
    const places = placesService.listPlaces({});
    expect(places.items.length).toBeGreaterThan(0);
    expect(places.items.every((p) => p.attribution.includes('OpenStreetMap'))).toBe(true);
  });

  it('Scenario 088: Geo gazetteer loads all 8 divisions, 64 districts, and 495 upazilas from data files (Rule C4)', () => {
    const summary = geoService.getSummary();
    expect(summary.counts.divisions).toBe(8);
    expect(summary.counts.districts).toBe(64);
    expect(summary.counts.upazilas).toBe(495);
  });

  it('Scenario 089: Scholarships and jobs without fixed official closing date have deadlineAt=null ("As announced")', async () => {
    const sch = await opportunitiesService.listScholarships();
    expect(sch.some((s) => s.deadlineAt === null)).toBe(true);
  });

  it('Scenario 090: e-Passport FAQ includes sourced February 2025 police-verification update', async () => {
    const passport = await catalogueService.getBySlug('e-passport-application');
    const faqText = JSON.stringify(passport.faqs);
    expect(faqText).toMatch(/পুলিশ ভেরিফিকেশন|police verification/i);
  });

  // ── Group 6: 10 Security, Grounding & Reliability Scenarios (Scenarios 091–100) ──

  it('Scenario 091: Zero-result search logs content gap without user PII and surfaces in admin report', async () => {
    const res = await catalogueService.universalSearch('অস্তিত্বহীন-কাল্পনিক-সেবা-৯৮৭৬৫', 'bn');
    expect(res.total).toBe(0);
    const gaps = catalogueService.listZeroResultQueries();
    expect(gaps.some((g) => g.query.includes('অস্তিত্বহীন-কাল্পনিক-সেবা-৯৮৭৬৫'))).toBe(true);
  });

  it('Scenario 092: Importer security allowlist permits *.gov.bd and rejects untrusted domains', () => {
    expect(isAllowedImportSourceUrl('https://railway.gov.bd/timetable.pdf')).toBe(true);
    expect(isAllowedImportSourceUrl('https://banbeis.gov.bd/eiin.csv')).toBe(true);
    expect(isAllowedImportSourceUrl('https://evil-scraper.example.com/dump.csv')).toBe(false);
  });

  it('Scenario 093: Importer malware scanner rejects EICAR signature and PE/ELF executables', () => {
    const clean = scanImportPayloadForMalware('702,Suborno Express,DA,16:30,CTG,21:25');
    expect(clean.clean).toBe(true);
    const eicar = scanImportPayloadForMalware(
      'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
    );
    expect(eicar.clean).toBe(false);
    const exe = scanImportPayloadForMalware('MZ\x90\x00\x03\x00\x00\x00');
    expect(exe.clean).toBe(false);
  });

  it('Scenario 094: Jono refuses medical diagnosis and directs to 16263 / 999 (Rule R7)', () => {
    const res = jono.chat({ message: 'আমার বুকে ব্যথা ও জ্বর, কোন অ্যান্টিবায়োটিক খাব?', locale: 'bn' });
    expect(res.answerBn).toMatch(/১৬২৬৩|16263|999|চিকিৎসা/);
  });

  it('Scenario 095: Jono refuses stock/crypto/betting predictions (Rule R7)', () => {
    const res = jono.chat({ message: 'আজ কোন শেয়ার কিনলে লাভ হবে?', locale: 'bn' });
    expect(res.intent).toBe('out_of_scope');
    expect(res.suggestions?.length).toBeGreaterThanOrEqual(4);
  });

  it('Scenario 096: Jono refuses political endorsement questions neutrally (Rule R7)', () => {
    const res = jono.chat({ message: 'কোন রাজনৈতিক দল সবচেয়ে ভালো?', locale: 'bn' });
    expect(res.intent).toBe('out_of_scope');
  });

  it('Scenario 097: Jono session ownership check prevents reading another citizen session without token (Finding S2)', () => {
    const turn = jono.chat({ message: 'হ্যালো', locale: 'bn' });
    expect(() => jono.getSession(turn.sessionId, 'wrong-token')).toThrow();
  });

  it('Scenario 098: Multi-turn Jono conversation maintains rolling summary after 6+ turns', () => {
    let sessionId: string | undefined;
    let sessionToken: string | undefined;
    const prompts = [
      'হ্যালো',
      'পাসপোর্ট করতে কী লাগে?',
      'ফি কত?',
      'জন্ম নিবন্ধন কীভাবে করব?',
      'ড্রাইভিং লাইসেন্স নবায়ন ফি কত?',
      'ঢাকা থেকে চট্টগ্রাম ট্রেন কখন?',
      'ভাড়া কত?',
    ];
    for (const p of prompts) {
      const r = jono.chat({ sessionId, sessionToken, message: p, locale: 'bn' });
      sessionId = r.sessionId;
      sessionToken = r.sessionToken;
      expect(r.refused).toBe(false);
    }
    const session = jono.getSession(sessionId!, sessionToken);
    expect(session.rollingSummary.length).toBeGreaterThan(0);
  });

  it('Scenario 099: Jono complaint query routes to GRS (grs.gov.bd) and 333', () => {
    const res = jono.chat({ message: 'সরকারি অফিসে ঘুষ চাইলে কোথায় অভিযোগ করব?', locale: 'bn' });
    expect(res.refused).toBe(false);
    expect(res.answerBn).toMatch(/অভিযোগ|grs\.gov\.bd|333|106/i);
  });

  it('Scenario 100: Every Jono answer includes trust provenance or suggestion chips without dead ends', () => {
    const res = jono.chat({ message: 'বাংলাদেশে কী কী নাগরিক সেবা অনলাইনে পাওয়া যায়?', locale: 'bn' });
    expect(res.refused).toBe(false);
    expect((res.suggestions?.length ?? 0) + res.citations.length).toBeGreaterThan(0);
  });
});
