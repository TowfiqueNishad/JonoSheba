import { describe, expect, it } from 'vitest';
import { AvailabilityState, OSM_ODBL_ATTRIBUTION, TrustLabel, evaluateFreshness } from '@jonoshheba/shared';
import { loadJsonData, type ReferenceCountsData } from '../src/modules/coverage/coverage-data.loader';
import { CoverageOpsService } from '../src/modules/coverage/coverage-ops.service';
import { GeoGazetteerService } from '../src/modules/coverage/geo.service';
import { OrgsCatalogHotlinesService } from '../src/modules/coverage/orgs-catalog-hotlines.service';
import { RailMobilityService } from '../src/modules/coverage/rail-mobility.service';

describe('PROMPT C14 — Full-Coverage QA & PM Verification Audit (C01–C13)', () => {
  const geo = new GeoGazetteerService();
  const mobility = new RailMobilityService();
  const catalog = new OrgsCatalogHotlinesService(geo);
  const ops = new CoverageOpsService(geo, mobility, catalog);
  const refCounts = loadJsonData<ReferenceCountsData>('data/coverage/reference-counts.json').counts;

  it('C01 & C04: National gazetteer matches reference data counts (zero hard-coded counts), resolves all districts & old 2018 spellings', () => {
    expect(geo.divisions.length).toBe(refCounts.divisions);
    expect(geo.districts.length).toBe(refCounts.districts);
    expect(geo.upazilas.length).toBe(refCounts.upazilasExpectedBaseline);

    // Every upazila belongs to a valid district; every union belongs to a valid upazila
    const distIds = new Set(geo.districts.map((d) => d.id));
    const upzIds = new Set(geo.upazilas.map((u) => u.id));
    expect(geo.upazilas.every((u) => u.parentId && distIds.has(u.parentId))).toBe(true);
    expect(geo.unions.every((un) => un.parentId && upzIds.has(un.parentId))).toBe(true);

    // Point-in-hierarchy resolution works across every loaded district centroid
    for (const d of geo.districts) {
      const resolved = geo.resolvePoint(d.lat, d.lng);
      expect(resolved.district.id).toBe(d.id);
      expect(resolved.division).not.toBeNull();
    }

    // Rule C3: 2018 old spellings match canonical names & disambiguated autocomplete works
    for (const [oldSpelling, canonical] of [
      ['Chittagong', 'Chattogram'],
      ['Comilla', 'Cumilla'],
      ['Jessore', 'Jashore'],
      ['Bogra', 'Bogura'],
      ['Barisal', 'Barishal'],
    ]) {
      const hits = geo.listLevel('district', undefined, oldSpelling);
      expect(hits.some((h) => h.nameEn === canonical)).toBe(true);
    }
    const sadarHits = geo.searchAll('Sadar', 10);
    expect(sadarHits.length).toBeGreaterThan(0);
    expect(sadarHits.some((h) => h.disambiguatedLabel.includes(','))).toBe(true);
  });

  it('C02–C05: Rail any-stop-to-any-stop, off-day logic, Metro MRT-6, Tolls name_history, BRTA fares & multimodal planner', () => {
    // Intermediate stop-to-stop query: Airport (BMB) -> Cumilla (CML) -> catches Mahanagar Godhuli 704
    const inter = mobility.findTrainsBetween({ from: 'Airport', to: 'Comilla', date: '2026-11-20' });
    expect(inter.trains.some((t) => t.number === '704')).toBe(true);
    expect(inter.fraudWarning.en).toContain('Fraud warning');
    // Rule R6: Never fabricates SOLD_OUT from timetable fixture without live official API
    expect(inter.trains.every((t) => t.availabilityState !== AvailabilityState.SOLD_OUT)).toBe(true);
    expect(inter.trains.every((t) => t.notReserved === true)).toBe(true);

    // Off-day logic in Asia/Dhaka: Suborno Express (702) is off on Monday (2026-11-23 is Monday)
    const mon = mobility.findTrainsBetween({ from: 'Kamalapur', to: 'Chittagong', date: '2026-11-23' });
    const subornoMon = mon.trains.find((t) => t.number === '702');
    expect(subornoMon?.runsOnDate).toBe(false);

    // Padma Bridge rail link (Dhaka -> Jessore old spelling)
    const padmaRail = mobility.findTrainsBetween({ from: 'Dhaka', to: 'Jessore', date: '2026-11-20' });
    expect(padmaRail.trains.some((t) => t.number === '825')).toBe(true);

    // C03: Metro operational count read from data matches reference-counts.json
    const mrt = mobility.getMetroLines();
    expect(mrt.operationalStationCount).toBe(refCounts.mrtLine6OperationalStations);
    const fare = mobility.getMetroFare('Uttara North', 'Motijheel');
    expect(fare.singleJourneyFareBdt).toBe(100);
    expect(fare.mrtOrRapidPassFareBdt).toBe(90);

    // C03: Tolls match renamed bridges via name_history (Rule C3)
    const jamuna = mobility.getTolls('Bangabandhu Bridge', 'car_jeep');
    expect(jamuna.items[0]?.code).toBe('JAMUNA_BRIDGE');
    expect(jamuna.items[0]?.selectedVehicleRateBdt).toBe(550);

    // C04 & C05: BRTA fare estimate, OSM attribution & multimodal planner
    const busEst = mobility.estimateBrtaBusFare('Dhaka', 'Chattogram', 'intercity');
    expect(busEst.officialFareEstimateBdt).toBeGreaterThan(400);
    expect(mobility.listBusTerminals().attribution).toBe(OSM_ODBL_ATTRIBUTION);

    const plan = mobility.planMultimodalJourney({ from: 'Dhaka', to: 'Barishal', preference: 'cheapest' });
    expect(plan.itineraries.length).toBeGreaterThanOrEqual(2);
    expect(plan.attribution).toContain('OpenStreetMap');
  });

  it('C06–C10: Orgs resolver, 18-category taxonomy, 40+ life-event bundles, Family Card 2026 negative list, places & hotline decision helper', () => {
    // C06: "Who handles this here?" in Cumilla resolves Cumilla DC office
    const resolved = catalog.resolveResponsibleOffice('birth-registration', 23.4607, 91.1809);
    expect(resolved.responsibleOffice.districtEn).toBe('Cumilla');
    expect(resolved.fraudWarning.bn).toContain('সতর্কতা');

    // C07: Complete 18 categories & >= 40 life-event bundles (counts from reference data)
    expect(catalog.getTaxonomy().categoryCount).toBe(refCounts.serviceTaxonomyCategories);
    expect(catalog.getLifeEventBundles().count).toBeGreaterThanOrEqual(refCounts.lifeEventBundlesMinimum ?? 40);

    // C07: Family Card 2026 deterministic negative-list evaluation
    const eligible = catalog.evaluateProgrammeEligibility('family-card-2026', {
      householdMembers: 4,
      government_pension_or_permanent_govt_employee: false,
    });
    expect(eligible.status).toBe('POSSIBLE_MATCH');
    const excluded = catalog.evaluateProgrammeEligibility('family-card-2026', {
      owns_registered_private_car_or_commercial_vehicle: true,
    });
    expect(excluded.status).toBe('NOT_ELIGIBLE');

    // C08: District offline pack includes OSM ODbL attribution & emergency hotlines
    const pack = catalog.getDistrictOfflinePack('Dhaka');
    expect(pack.attribution).toBe(OSM_ODBL_ATTRIBUTION);
    expect(pack.emergencyHotlinesBundled.some((h) => h.number === '999')).toBe(true);

    // C09: National calendar & .ics export
    const ics = catalog.buildCalendarIcs();
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('Income Tax e-Return');

    // C10: Deterministic hotline decision helper (NOT LLM)
    const fire = catalog.decideHotline('আগুন লেগেছে fire emergency');
    expect(fire.decisionEngine).toBe('DETERMINISTIC_RULES_C10_NOT_LLM');
    expect(fire.recommendedHotlines.map((h) => h.number)).toContain('102');
    expect(fire.recommendedHotlines.map((h) => h.number)).toContain('999');

    const land = catalog.decideHotline('ভূমি নামজারি অভিযোগ');
    expect(land.recommendedHotlines.map((h) => h.number)).toContain('16122');

    const rail = catalog.decideHotline('train ticket complaint');
    expect(rail.recommendedHotlines.map((h) => h.number)).toContain('131');
  });

  it('C12 & C14: Coverage heatmap, gap queue, data quality audit (0 High issues), freshness SLA (C5) & Import Studio', () => {
    const heatmap = ops.getHeatmap();
    expect(heatmap.loadedCounts.districts).toBe(refCounts.districts);
    expect(heatmap.loadedCounts.serviceTaxonomyCategories).toBe(refCounts.serviceTaxonomyCategories);

    // Gaps are honestly surfaced & assignable (Rule C2)
    const gaps = ops.listGaps();
    expect(gaps.count).toBeGreaterThan(0);
    const assigned = ops.assignGap(gaps.items[0]!.id, 'ngo-partner-dhaka-01');
    expect(assigned.assignedEditor).toBe('ngo-partner-dhaka-01');
    expect(assigned.status).toBe('IN_PROGRESS');

    // Automated quality audit checks Bangla-first (C8), BD bounding box, hotline 30d SLA (C5), and phone formats
    const quality = ops.runQualityAudit();
    expect(quality.passedAllChecks).toBe(true);
    expect(quality.issueCount).toBe(0);

    // Freshness SLA auto-flags records older than 30 days as UNAVAILABLE_STALE (Rule C5)
    const staleCheck = evaluateFreshness({
      entityType: 'hotline',
      lastVerifiedAt: '2026-09-01T00:00:00Z',
      baseTrustLabel: TrustLabel.OFFICIAL_SOURCE,
      now: new Date('2026-11-20T00:00:00Z'),
    });
    expect(staleCheck.isStale).toBe(true);
    expect(staleCheck.effectiveTrustLabel).toBe(TrustLabel.UNAVAILABLE_STALE);

    // Import Studio always queues as PENDING_REVIEW (Rule C1)
    const job = ops.createImportJob({
      kind: 'timetable',
      sourceId: 'SRC_BR_OFFICIAL',
      sourceUrl: 'https://railway.gov.bd',
      submittedBy: 'editor-01',
      rawContent: '702,Suborno Express,DA,16:30,CTG,21:25\n704,Mahanagar Godhuli,DA,15:00,CTG,20:55',
    });
    expect(job.reviewStatus).toBe('PENDING_REVIEW');
    expect(job.parsedRecordsCount).toBe(2);
  });
});
