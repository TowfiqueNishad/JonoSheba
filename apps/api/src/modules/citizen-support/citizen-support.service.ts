/**
 * citizen-support.service.ts — Barrel re-export used by acceptance tests
 * and direct instantiation without the full NestJS DI container.
 *
 * Production code uses the full NestJS module (citizen-support.module.ts)
 * which wires CasesService and EmergencyHealthUtilityService via DI.
 * This barrel exists so test files can import a simple `CitizenSupportService`
 * façade that wraps both services with zero-arg construction.
 */
import { Injectable } from '@nestjs/common';
import { CasesService } from './application/cases.service';
import { EmergencyHealthUtilityService } from './application/emergency-health-utility.service';
import type { CitizenCaseRecord } from './domain/support.types';

export { CasesService } from './application/cases.service';
export { EmergencyHealthUtilityService } from './application/emergency-health-utility.service';

/**
 * CitizenSupportService — unified façade for tests (zero-arg constructor).
 * Delegates to CasesService and EmergencyHealthUtilityService.
 */
@Injectable()
export class CitizenSupportService {
  private readonly cases: CasesService;

  constructor() {
    this.cases = new CasesService();
  }

  async createDraft(citizenId: string, params: { description: string; location: string }) {
    return this.cases.createDraft(citizenId, params);
  }

  async getCaseForUser(citizenId: string, caseId: string): Promise<CitizenCaseRecord> {
    return this.cases.getCaseForUser(citizenId, caseId);
  }

  async editCaseFinalText(
    citizenId: string,
    caseId: string,
    params: { userFinalText: string },
  ) {
    return this.cases.editCaseFinalText(citizenId, caseId, params);
  }

  async prepareHandoff(citizenId: string, caseId: string) {
    return this.cases.prepareHandoff(citizenId, caseId);
  }

  async saveExternalReference(
    citizenId: string,
    caseId: string,
    params: { reference: string; channel: string },
  ) {
    return this.cases.saveExternalReference(citizenId, caseId, params);
  }

  async addUserUpdate(citizenId: string, caseId: string, params: { note: string }) {
    return this.cases.addUserUpdate(citizenId, caseId, params);
  }
}
