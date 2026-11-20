import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CaseStatus, IntegrationType } from '@jonoshheba/shared';
import { uuidv7 } from '../../../common/uuidv7';
import { COMPLAINT_GUIDES_SEED } from '../../../seed-data/catalogue';
import { classifyAndDraftComplaint } from '../domain/complaint-drafter';
import type {
  CitizenCaseRecord,
  ComplaintGuideRecord,
  SupportTicketRecord,
} from '../domain/support.types';

/** R2: Authorized official status lookup adapter interface (never scrapes GRS/portals) */
export interface OfficialCaseStatusPort {
  readonly integrationType: IntegrationType;
  lookupStatus(
    channel: string,
    externalReference: string,
  ): Promise<{
    supported: boolean;
    integrationType: IntegrationType;
    officialStatus: string | null;
    message: string;
  }>;
}

class LinkOnlyOfficialCaseStatusStub implements OfficialCaseStatusPort {
  readonly integrationType = IntegrationType.LINK_ONLY;

  async lookupStatus(channel: string, externalReference: string) {
    return {
      supported: false,
      integrationType: IntegrationType.LINK_ONLY,
      officialStatus: null,
      message: `Live status sync for '${channel}' (${externalReference}) is not enabled without an authorized official API agreement. Check directly on the official portal.`,
    };
  }
}

@Injectable()
export class CasesService {
  private readonly guides: ComplaintGuideRecord[] = COMPLAINT_GUIDES_SEED.map((g) => ({
    ...g,
    evidenceChecklist: [...g.evidenceChecklist],
  }));
  private readonly cases = new Map<string, CitizenCaseRecord>();
  private readonly supportTickets = new Map<string, SupportTicketRecord>();
  private readonly officialStatusAdapter: OfficialCaseStatusPort =
    new LinkOnlyOfficialCaseStatusStub();

  listGuides(): readonly ComplaintGuideRecord[] {
    return this.guides;
  }

  /**
   * Journey C Step 1: Creates an AI-assisted DRAFT complaint.
   * Rule R1: Nothing is sent to any external authority; user review & manual hand-off are mandatory.
   */
  async createDraft(
    userId: string,
    dto: {
      description: string;
      category?: string;
      location?: string;
      title?: string;
    },
  ): Promise<CitizenCaseRecord> {
    const { guide, result } = classifyAndDraftComplaint({
      description: dto.description,
      explicitCategory: dto.category,
      location: dto.location,
      guides: this.guides,
    });

    // Platform-level privacy-safe duplicate cluster count (never exposes other users' text — R10)
    const possibleDuplicateCount = [...this.cases.values()].filter(
      (c) =>
        c.userId !== userId &&
        c.category === result.category &&
        dto.location &&
        c.location?.toLowerCase() === dto.location.toLowerCase(),
    ).length;

    const now = new Date();
    const record: CitizenCaseRecord = {
      id: uuidv7(),
      userId,
      caseType: 'external_complaint',
      category: result.category,
      categoryConfidence: result.confidence,
      title: dto.title?.trim() || `${guide.authorityEn} — Draft`,
      location: dto.location?.trim() || null,
      summaryBn: `${guide.authorityBn}-এ জমা দেওয়ার জন্য খসড়া প্রস্তুত (এখনো কোথাও পাঠানো হয়নি)।`,
      summaryEn: `Draft prepared for ${guide.authorityEn} (nothing has been submitted externally).`,
      structuredSummary: result.structuredSummary,
      suggestedAuthorityBn: guide.authorityBn,
      suggestedAuthorityEn: guide.authorityEn,
      officialChannelUrl: guide.officialChannelUrl,
      supportsAnonymity: guide.supportsAnonymity,
      anonymityNotesBn: guide.anonymityNotesBn,
      anonymityNotesEn: guide.anonymityNotesEn,
      missingEvidenceChecklist: [...guide.evidenceChecklist],
      possibleDuplicateCount,
      aiDraft: result.formalBanglaDraft,
      userFinalText: null,
      userReviewedAt: null,
      externalChannel: null,
      externalReference: null,
      status: CaseStatus.DRAFT,
      userReportedUpdates: [],
      createdAt: now,
      updatedAt: now,
    };

    this.cases.set(record.id, record);
    return record;
  }

  async listCasesForUser(userId: string): Promise<CitizenCaseRecord[]> {
    return [...this.cases.values()]
      .filter((c) => c.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getCaseForUser(userId: string, caseId: string): Promise<CitizenCaseRecord> {
    const c = this.cases.get(caseId);
    if (!c) throw new NotFoundException('Case not found');
    if (c.userId !== userId) {
      throw new ForbiddenException('You cannot access another citizen’s case');
    }
    return c;
  }

  /** Journey C Step 2: Mandatory user review & edit before hand-off */
  async editCaseFinalText(
    userId: string,
    caseId: string,
    dto: { userFinalText: string; title?: string },
  ): Promise<CitizenCaseRecord> {
    const c = await this.getCaseForUser(userId, caseId);
    c.userFinalText = dto.userFinalText.trim();
    if (dto.title) c.title = dto.title.trim();
    c.userReviewedAt = new Date();
    c.updatedAt = new Date();
    return c;
  }

  /**
   * Journey C Step 3: Hand-off to official channel (GRS, DNCRP, etc.).
   * Requires user to have reviewed/edited `userFinalText`. Returns copy-ready text + printable document.
   */
  async prepareHandoff(userId: string, caseId: string) {
    const c = await this.getCaseForUser(userId, caseId);
    if (!c.userFinalText || !c.userReviewedAt) {
      throw new BadRequestException(
        'Mandatory user review required: edit and confirm your final text via PATCH /cases/:id before hand-off.',
      );
    }

    c.status = CaseStatus.READY;
    c.updatedAt = new Date();

    const printableHtml = `<!doctype html><html lang="bn"><head><meta charset="utf-8"><title>${c.title}</title></head><body><h1>${c.suggestedAuthorityBn}</h1><pre>${c.userFinalText.replace(/</g, '&lt;')}</pre><p>Official channel: ${c.officialChannelUrl}</p></body></html>`;

    return {
      caseId: c.id,
      status: c.status,
      officialChannelUrl: c.officialChannelUrl,
      authorityBn: c.suggestedAuthorityBn,
      authorityEn: c.suggestedAuthorityEn,
      supportsAnonymity: c.supportsAnonymity,
      anonymityNotesBn: c.anonymityNotesBn,
      anonymityNotesEn: c.anonymityNotesEn,
      copyReadyText: c.userFinalText,
      printableHtml,
      noticeBn:
        'জনসেবা আপনার পক্ষ থেকে অভিযোগ জমা দেয় না — নিচের লিংকে গিয়ে অফিশিয়াল চ্যানেলে জমা দিন এবং রেফারেন্স নম্বর সংরক্ষণ করুন।',
      noticeEn:
        'Jonoshheba does not submit complaints on your behalf — continue to the official channel and save your tracking reference.',
    };
  }

  /** Journey C Step 4: Save external tracking reference obtained from official portal */
  async saveExternalReference(
    userId: string,
    caseId: string,
    dto: { reference: string; channel: string },
  ): Promise<{
    citizenCase: CitizenCaseRecord;
    officialSyncStatus: Awaited<ReturnType<OfficialCaseStatusPort['lookupStatus']>>;
  }> {
    const c = await this.getCaseForUser(userId, caseId);
    c.externalReference = dto.reference.trim();
    c.externalChannel = dto.channel.trim();
    c.status = CaseStatus.REF_SAVED;
    c.updatedAt = new Date();

    const officialSyncStatus = await this.officialStatusAdapter.lookupStatus(
      c.externalChannel,
      c.externalReference,
    );
    return { citizenCase: c, officialSyncStatus };
  }

  async addUserUpdate(
    userId: string,
    caseId: string,
    dto: { note: string },
  ): Promise<CitizenCaseRecord> {
    const c = await this.getCaseForUser(userId, caseId);
    c.userReportedUpdates.push({
      note: dto.note.trim(),
      recordedAt: new Date().toISOString(),
    });
    c.updatedAt = new Date();
    return c;
  }

  // --- Platform Support Tickets & Agent Console ---

  async createSupportTicket(
    userId: string,
    dto: { subject: string; description: string },
  ): Promise<SupportTicketRecord> {
    const now = new Date();
    const ticket: SupportTicketRecord = {
      id: uuidv7(),
      userId,
      subject: dto.subject.trim(),
      description: dto.description.trim(),
      status: 'open',
      agentResponse: null,
      respondedBy: null,
      createdAt: now,
      updatedAt: now,
    };
    this.supportTickets.set(ticket.id, ticket);
    return ticket;
  }

  async listAllSupportTickets(): Promise<SupportTicketRecord[]> {
    return [...this.supportTickets.values()].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async respondSupportTicket(
    agentId: string,
    ticketId: string,
    dto: { status: SupportTicketRecord['status']; agentResponse: string },
  ): Promise<SupportTicketRecord> {
    const ticket = this.supportTickets.get(ticketId);
    if (!ticket) throw new NotFoundException('Support ticket not found');
    ticket.status = dto.status;
    ticket.agentResponse = dto.agentResponse.trim();
    ticket.respondedBy = agentId;
    ticket.updatedAt = new Date();
    return ticket;
  }
}
