import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { uuidv7 } from '../common/uuidv7';
import {
  AGENCIES_SEED,
  CATEGORIES_SEED,
  COMPLAINT_GUIDES_SEED,
  HOTLINES_SEED,
  LIFE_EVENTS_SEED,
  SERVICES_SEED,
} from '../../prisma/seed-data/catalogue';
import { DISTRICTS_SEED, DIVISIONS_SEED } from '../../prisma/seed-data/geography';
import { OPPORTUNITIES_WITH_RULES_SEED } from '../../prisma/seed-data/opportunities';
import {
  BUS_STOPS_SEED,
  RAIL_STATIONS_SEED,
  TRANSPORT_PROVIDERS_SEED,
} from '../../prisma/seed-data/transport';

describe('Phase 02: Database Schema, Migrations & Bangladesh Seed Data', () => {
  it('generates valid RFC 9562 time-ordered UUIDv7 keys', () => {
    const t1 = 1_760_000_000_000;
    const t2 = 1_760_000_005_000;
    const id1 = uuidv7(t1);
    const id2 = uuidv7(t2);
    const uuidV7Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(id1).toMatch(uuidV7Regex);
    expect(id2).toMatch(uuidV7Regex);
    expect(id1 < id2).toBe(true);
  });

  it('seeds exact Bangladesh geography: 8 divisions, 64 districts, 495 upazilas', () => {
    expect(DIVISIONS_SEED).toHaveLength(8);
    expect(DISTRICTS_SEED).toHaveLength(64);
    const totalUpazilas = DISTRICTS_SEED.reduce((sum, d) => sum + d.upazilas.length, 0);
    expect(totalUpazilas).toBe(495);

    const divisionCodes = new Set(DIVISIONS_SEED.map((d) => d.bbsCode));
    for (const dist of DISTRICTS_SEED) {
      expect(divisionCodes.has(dist.divisionBbs)).toBe(true);
    }
  });

  it('seeds >=50 rail stations, >=100 bus stops, and strictly MOCK/LINK_ONLY providers (Rule R2)', () => {
    expect(RAIL_STATIONS_SEED.length).toBeGreaterThanOrEqual(50);
    expect(BUS_STOPS_SEED.length).toBeGreaterThanOrEqual(100);
    expect(TRANSPORT_PROVIDERS_SEED.length).toBeGreaterThanOrEqual(2);
    for (const provider of TRANSPORT_PROVIDERS_SEED) {
      expect(['MOCK', 'LINK_ONLY']).toContain(provider.integrationType);
    }
  });

  it('seeds 60+ real Bangladesh services and all 9 hotlines flagged verifyBeforeRelease (R5, R8)', () => {
    expect(CATEGORIES_SEED.length).toBeGreaterThanOrEqual(10);
    expect(AGENCIES_SEED.length).toBeGreaterThanOrEqual(15);
    expect(LIFE_EVENTS_SEED.length).toBeGreaterThanOrEqual(6);
    expect(SERVICES_SEED.length).toBeGreaterThanOrEqual(60);
    expect(COMPLAINT_GUIDES_SEED.length).toBeGreaterThanOrEqual(4);

    const agencySlugs = new Set(AGENCIES_SEED.map((a) => a.slug));
    const catSlugs = new Set(CATEGORIES_SEED.map((c) => c.slug));
    for (const svc of SERVICES_SEED) {
      expect(agencySlugs.has(svc.agencySlug)).toBe(true);
      expect(catSlugs.has(svc.categorySlug)).toBe(true);
      expect(svc.titleBn.length).toBeGreaterThan(2);
      expect(svc.titleEn.length).toBeGreaterThan(2);
    }

    const requiredHotlines = ['999', '333', '102', '1090', '16430', '1098', '109', '16263', '106'];
    const seededNumbers = new Set(HOTLINES_SEED.map((h) => h.number));
    for (const num of requiredHotlines) {
      expect(seededNumbers.has(num)).toBe(true);
    }
    for (const hl of HOTLINES_SEED) {
      expect(hl.verifyBeforeRelease).toBe(true);
    }
  });

  it('seeds 20 scholarships & benefit programs with deterministic JSON-Logic rules (Rule R7)', () => {
    expect(OPPORTUNITIES_WITH_RULES_SEED).toHaveLength(20);
    for (const opp of OPPORTUNITIES_WITH_RULES_SEED) {
      expect(Object.keys(opp.ruleJsonLogic).length).toBeGreaterThan(0);
      expect(opp.criteriaExplanations.length).toBeGreaterThan(0);
    }
  });

  it('includes raw SQL migration with pgvector HNSW, trigram, partial indexes, append-only audit, and RLS', () => {
    const sqlPath = resolve(
      process.cwd(),
      'prisma/migrations/20261119000002_pgvector_trgm_partial_rls/migration.sql',
    );
    const sql = readFileSync(sqlPath, 'utf8');
    expect(sql).toContain('USING hnsw (embedding vector_cosine_ops)');
    expect(sql).toContain('USING gin (tsv)');
    expect(sql).toContain('gin_trgm_ops');
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('prevent_audit_log_mutation');
    expect(sql).toContain("WHERE status = 'active' AND deleted_at IS NULL");
  });

  it('exposes typed Prisma Client delegates for every one of the 9 bounded-context schemas', () => {
    const prisma = new PrismaClient();
    // 1. identity
    expect(prisma.user).toBeDefined();
    expect(prisma.session).toBeDefined();
    expect(prisma.otpChallenge).toBeDefined();
    expect(prisma.userProfileHint).toBeDefined();
    expect(prisma.consent).toBeDefined();
    expect(prisma.document).toBeDefined();
    // 2. catalogue
    expect(prisma.division).toBeDefined();
    expect(prisma.district).toBeDefined();
    expect(prisma.upazila).toBeDefined();
    expect(prisma.service).toBeDefined();
    expect(prisma.source).toBeDefined();
    expect(prisma.notice).toBeDefined();
    expect(prisma.hotline).toBeDefined();
    expect(prisma.facility).toBeDefined();
    // 3. transport
    expect(prisma.transportProvider).toBeDefined();
    expect(prisma.stationStop).toBeDefined();
    expect(prisma.ticketWatch).toBeDefined();
    expect(prisma.inventorySnapshot).toBeDefined();
    expect(prisma.watchMatch).toBeDefined();
    expect(prisma.demandAggregate).toBeDefined();
    // 4. notify
    expect(prisma.notificationTemplate).toBeDefined();
    expect(prisma.notification).toBeDefined();
    expect(prisma.notificationJob).toBeDefined();
    expect(prisma.notificationFeedback).toBeDefined();
    // 5. opportunities
    expect(prisma.program).toBeDefined();
    expect(prisma.scholarship).toBeDefined();
    expect(prisma.jobCircular).toBeDefined();
    expect(prisma.eligibilityRule).toBeDefined();
    // 6. cases
    expect(prisma.complaintGuide).toBeDefined();
    expect(prisma.citizenCase).toBeDefined();
    expect(prisma.caseEvent).toBeDefined();
    expect(prisma.duplicateCluster).toBeDefined();
    // 7. ai
    expect(prisma.kbDocument).toBeDefined();
    expect(prisma.kbChunk).toBeDefined();
    expect(prisma.conversation).toBeDefined();
    expect(prisma.message).toBeDefined();
    expect(prisma.aiEvalRun).toBeDefined();
    expect(prisma.promptVersion).toBeDefined();
    // 8. admin
    expect(prisma.featureFlag).toBeDefined();
    expect(prisma.providerHealthCheck).toBeDefined();
    // 9. audit
    expect(prisma.auditLog).toBeDefined();
    expect(prisma.outboxEvent).toBeDefined();
    expect(prisma.dataExportRequest).toBeDefined();
    expect(prisma.deletionRequest).toBeDefined();
  });

  // Live PostgreSQL query test across all 9 bounded contexts (runs when RUN_DB_TESTS=true)
  it.skipIf(process.env.RUN_DB_TESTS !== 'true')(
    'executes live Prisma count queries across all 9 bounded-context schemas',
    async () => {
      const prisma = new PrismaClient();
      try {
        const [
          roles,
          divisions,
          districts,
          upazilas,
          services,
          hotlines,
          providers,
          stops,
          templates,
          programs,
          scholarships,
          rules,
          guides,
          flags,
          outbox,
          kbDocs,
        ] = await Promise.all([
          prisma.role.count(),
          prisma.division.count(),
          prisma.district.count(),
          prisma.upazila.count(),
          prisma.service.count(),
          prisma.hotline.count(),
          prisma.transportProvider.count(),
          prisma.stationStop.count(),
          prisma.notificationTemplate.count(),
          prisma.program.count(),
          prisma.scholarship.count(),
          prisma.eligibilityRule.count(),
          prisma.complaintGuide.count(),
          prisma.featureFlag.count(),
          prisma.outboxEvent.count(),
          prisma.kbDocument.count(),
        ]);

        expect(roles).toBeGreaterThanOrEqual(9);
        expect(divisions).toBe(8);
        expect(districts).toBe(64);
        expect(upazilas).toBe(495);
        expect(services).toBeGreaterThanOrEqual(60);
        expect(hotlines).toBe(9);
        expect(providers).toBeGreaterThanOrEqual(4);
        expect(stops).toBeGreaterThanOrEqual(150);
        expect(templates).toBeGreaterThanOrEqual(2);
        expect(programs + scholarships).toBe(20);
        expect(rules).toBe(20);
        expect(guides).toBeGreaterThanOrEqual(4);
        expect(flags).toBeGreaterThanOrEqual(3);
        expect(outbox).toBeGreaterThanOrEqual(0);
        expect(kbDocs).toBeGreaterThanOrEqual(0);
      } finally {
        await prisma.$disconnect();
      }
    },
  );
});
