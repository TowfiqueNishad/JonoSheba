import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CaseStatus, IntegrationType, Role } from '@jonoshheba/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { HybridRrfSearchAdapter } from '../catalogue/adapters/hybrid-rrf-search.adapter';
import { SeededCatalogueRepository } from '../catalogue/adapters/seeded-catalogue.repository';
import { CatalogueService } from '../catalogue/application/catalogue.service';
import { PolicyService } from '../identity/domain/policy.service';
import { CasesService } from './application/cases.service';
import { EmergencyHealthUtilityService } from './application/emergency-health-utility.service';

describe('Phase 08: Complaints/Cases (Journey C), Emergency Center, Health & Utilities', () => {
  let cases: CasesService;
  let support: EmergencyHealthUtilityService;

  beforeEach(() => {
    const catRepo = new SeededCatalogueRepository();
    const catalogue = new CatalogueService(catRepo, new HybridRrfSearchAdapter());
    const policy = new PolicyService();
    cases = new CasesService();
    support = new EmergencyHealthUtilityService(catalogue, policy);
  });

  it('completes Journey C complaint lifecycle with mandatory user review, official GRS hand-off, ref tracking & IDOR isolation', async () => {
    const draft = await cases.createDraft('citizen-1', {
      description: 'জন্ম নিবন্ধন অফিসে ২০ দিন ধরে বিলম্ব হচ্ছে, tracking: BDRIS-9921, কোনো উত্তর দিচ্ছে না।',
      location: 'Dhaka',
    });

    expect(draft.status).toBe(CaseStatus.DRAFT);
    expect(draft.category).toBe('public_service_delay');
    expect(draft.officialChannelUrl).toBe('https://www.grs.gov.bd');
    expect(draft.structuredSummary.reference).toBe('BDRIS-9921');
    expect(draft.aiDraft).toContain('বরাবর,');
    expect(draft.missingEvidenceChecklist.length).toBeGreaterThan(0);

    // Mandatory user review: hand-off BEFORE user edits/confirms final text MUST fail!
    await expect(cases.prepareHandoff('citizen-1', draft.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    // IDOR: another user cannot view or edit citizen-1's draft
    await expect(cases.getCaseForUser('citizen-2', draft.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      cases.editCaseFinalText('citizen-2', draft.id, { userFinalText: 'Tampered text here' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Citizen reviews & edits final text
    await cases.editCaseFinalText('citizen-1', draft.id, {
      userFinalText: `${draft.aiDraft}\nনাম: করিম আহমেদ`,
    });

    // Hand-off succeeds -> returns official URL, anonymity notes, copy-ready text & printable HTML
    const handoff = await cases.prepareHandoff('citizen-1', draft.id);
    expect(handoff.status).toBe(CaseStatus.READY);
    expect(handoff.officialChannelUrl).toBe('https://www.grs.gov.bd');
    expect(handoff.supportsAnonymity).toBe(true);
    expect(handoff.printableHtml).toContain('<!doctype html>');
    expect(handoff.noticeEn).toContain('does not submit complaints on your behalf');

    // Citizen submits externally & saves tracking reference
    const refSaved = await cases.saveExternalReference('citizen-1', draft.id, {
      reference: 'GRS-2026-88412',
      channel: 'GRS',
    });
    expect(refSaved.citizenCase.status).toBe(CaseStatus.REF_SAVED);
    expect(refSaved.officialSyncStatus.integrationType).toBe(IntegrationType.LINK_ONLY);
    expect(refSaved.officialSyncStatus.supported).toBe(false);

    // Citizen adds progress update
    const updated = await cases.addUserUpdate('citizen-1', draft.id, {
      note: 'দপ্তর থেকে শুনানির তারিখ জানানো হয়েছে।',
    });
    expect(updated.userReportedUpdates).toHaveLength(1);
  });

  it('serves < 5 KB DB-down resilient emergency payload with tap-to-call 999 & enforces two-person hotline review', async () => {
    const normal = await support.getEmergencyPayload();
    const byteSize = Buffer.byteLength(JSON.stringify(normal), 'utf8');
    expect(byteSize).toBeLessThan(5120); // Strictly < 5 KB!
    expect(normal.hotlines.some((h) => h.n === '999' && h.tel === 'tel:999')).toBe(true);
    expect(normal.noDispatchNoticeEn).toContain('does not dispatch');

    // Simulate complete DB outage -> still returns verified static fallback hotlines!
    support.simulateDbDown = true;
    const resilient = await support.getEmergencyPayload();
    expect(resilient.sourceMode).toBe('static_fallback');
    expect(resilient.hotlines).toHaveLength(9);
    support.simulateDbDown = false;

    // Nearby emergency facilities & disaster alerts
    const nearby = await support.getNearbyEmergencyFacilities(23.73, 90.4, 15, 'bn');
    expect(nearby.items.length).toBeGreaterThanOrEqual(2);
    const alerts = await support.getEmergencyAlerts("Cox's Bazar", 'en');
    expect(alerts.items.length).toBeGreaterThanOrEqual(1);

    // Two-person hotline edit review (Rule R8)
    const proposal = support.proposeHotlineEdit('editor-1', '1090', {
      proposedNameBn: 'দুর্যোগের আগাম বার্তা (যাচাইকৃত)',
      proposedNameEn: 'Disaster Early Warning IVR (Verified)',
      sourceUrl: 'https://ddm.gov.bd',
    });

    // Author CANNOT self-approve!
    expect(() =>
      support.approveHotlineEdit(proposal.id, {
        sub: 'editor-1',
        roles: [Role.REVIEWER],
        orgScopes: [{ role: Role.REVIEWER, orgId: null }],
        mfaVerified: true,
      }),
    ).toThrow(ForbiddenException);

    // Distinct MFA-verified reviewer succeeds!
    const approved = support.approveHotlineEdit(proposal.id, {
      sub: 'reviewer-2',
      roles: [Role.REVIEWER],
      orgScopes: [{ role: Role.REVIEWER, orgId: null }],
      mfaVerified: true,
    });
    expect(approved.proposal.status).toBe('approved');
    expect(approved.hotline.verifyBeforeRelease).toBe(false);
  });

  it('detects Bangla/English medical red-flag symptoms (shows 999 FIRST) and refuses medical diagnosis (Rule R7 & R8)', async () => {
    const urgent = await support.getHealthGuidance({
      query: 'আমার বাবার হঠাৎ বুকে ব্যথা ও তীব্র শ্বাসকষ্ট হচ্ছে',
      lat: 23.73,
      lng: 90.4,
      locale: 'bn',
    });
    expect(urgent.urgentRedFlag).toBe(true);
    expect(urgent.matchedSignals).toContain('chest_pain');
    expect(urgent.matchedSignals).toContain('breathing_difficulty');
    expect(urgent.call999).toEqual({ number: '999', telUri: 'tel:999' });
    expect(urgent.noDiagnosisNoticeEn).toContain('does not provide medical diagnosis');
    expect(urgent.nearbyHospitals.length).toBeGreaterThan(0);

    const routine = await support.getHealthGuidance({
      query: 'শিশুদের ইপিআই টিকা ও ডেঙ্গু পরীক্ষা তথ্য',
      locale: 'bn',
    });
    expect(routine.urgentRedFlag).toBe(false);
    expect(routine.call999).toBeNull();
    expect(routine.healthHelpline.number).toBe('16263');
    expect(routine.noDiagnosisNoticeBn).toContain('রোগ নির্ণয়');
  });

  it('provides verified utility payment links (Rule R3) and owner-isolated outage subscriptions', async () => {
    const providers = support.listVerifiedUtilityProviders();
    expect(providers.items.length).toBeGreaterThanOrEqual(5);
    expect(providers.disclaimerEn).toContain('never stores card numbers');

    const sub = support.subscribeUtilityOutages('citizen-1', {
      districtEn: 'Dhaka',
      utilityType: 'electricity',
      providerName: 'DESCO',
    });
    expect(support.listUtilitySubscriptions('citizen-1')).toHaveLength(1);
    expect(() => support.deleteUtilitySubscription('citizen-2', sub.id)).toThrow(
      ForbiddenException,
    );
    expect(support.deleteUtilitySubscription('citizen-1', sub.id)).toEqual({ deleted: true });
  });
});
