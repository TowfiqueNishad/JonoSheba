import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TrustLabel } from '@jonoshheba/shared';
import { uuidv7 } from '../../../common/uuidv7';
import {
  type CategoryRecord,
  type ContentReportRecord,
  type ReminderRecord,
  type ReviewTaskRecord,
  type SavedItemRecord,
  type SearchItemType,
  type ServiceRecord,
} from '../domain/catalogue.types';
import { haversineKm, paginateWithCursor } from '../domain/http-helpers';
import {
  CATALOGUE_REPOSITORY_PORT,
  type CatalogueRepositoryPort,
} from '../ports/catalogue.repository.port';
import { SEARCH_PORT, type SearchPort } from '../ports/search.port';

@Injectable()
export class CatalogueService {
  private readonly zeroResultGaps = new Map<
    string,
    { query: string; locale: 'bn' | 'en'; count: number; lastSeenAt: string }
  >();

  constructor(
    @Inject(CATALOGUE_REPOSITORY_PORT)
    private readonly repo: CatalogueRepositoryPort,
    @Inject(SEARCH_PORT)
    private readonly searchEngine: SearchPort,
  ) {}

  async getCategoriesTree(locale: 'bn' | 'en') {
    const flat = await this.repo.listCategories();
    const map = new Map<string, CategoryRecord & { name: string; children: CategoryRecord[] }>();
    const roots: Array<CategoryRecord & { name: string; children: CategoryRecord[] }> = [];

    for (const c of flat) {
      map.set(c.id, { ...c, name: locale === 'en' ? c.nameEn : c.nameBn, children: [] });
    }
    for (const node of map.values()) {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  async listLifeEvents(locale: 'bn' | 'en') {
    const events = await this.repo.listLifeEvents();
    return events.map((ev) => ({
      id: ev.id,
      slug: ev.slug,
      title: locale === 'en' ? ev.titleEn : ev.titleBn,
      titleBn: ev.titleBn,
      titleEn: ev.titleEn,
      summary: locale === 'en' ? ev.summaryEn : ev.summaryBn,
      icon: ev.icon,
      stepCount: ev.steps.length,
    }));
  }

  async getLifeEventDetail(slug: string, locale: 'bn' | 'en') {
    const ev = await this.repo.findLifeEventBySlug(slug);
    if (!ev) throw new NotFoundException(`Life event '${slug}' not found`);

    const steps = await Promise.all(
      ev.steps.map(async (step) => {
        const svc = step.serviceSlug ? await this.repo.findServiceBySlug(step.serviceSlug) : null;
        return {
          stepOrder: step.stepOrder,
          title: locale === 'en' ? step.titleEn : step.titleBn,
          titleBn: step.titleBn,
          titleEn: step.titleEn,
          notes: locale === 'en' ? step.notesEn : step.notesBn,
          service: svc
            ? {
                slug: svc.slug,
                title: locale === 'en' ? svc.titleEn : svc.titleBn,
                officialUrl: svc.officialUrl,
                trustLabel: svc.trustLabel,
                lastVerifiedAt: svc.lastVerifiedAt,
              }
            : null,
        };
      }),
    );

    return {
      id: ev.id,
      slug: ev.slug,
      title: locale === 'en' ? ev.titleEn : ev.titleBn,
      titleBn: ev.titleBn,
      titleEn: ev.titleEn,
      summary: locale === 'en' ? ev.summaryEn : ev.summaryBn,
      icon: ev.icon,
      steps,
    };
  }

  async listServices(params: {
    query?: string;
    category?: string;
    agency?: string;
    channel?: string;
    cursor?: string;
    limit?: number;
    locale: 'bn' | 'en';
  }) {
    let services = await this.repo.listServices({
      category: params.category,
      agency: params.agency,
      channel: params.channel,
    });

    if (params.query && params.query.trim()) {
      const docs = await this.repo.getAllSearchDocuments();
      const serviceDocs = docs.filter((d) => d.type === 'service');
      const searchRes = await this.searchEngine.search(serviceDocs, {
        query: params.query,
        locale: params.locale,
        types: ['service'],
        limit: 50,
      });
      const rankMap = new Map(searchRes.hits.map((h, i) => [h.slugOrCode, i]));
      services = services
        .filter((s) => rankMap.has(s.slug))
        .sort((a, b) => (rankMap.get(a.slug) ?? 999) - (rankMap.get(b.slug) ?? 999));
    }

    const mapped = await Promise.all(
      services.map(async (svc) => {
        const src = await this.repo.findSourceById(svc.sourceId);
        return {
          id: svc.id,
          slug: svc.slug,
          title: params.locale === 'en' ? svc.titleEn : svc.titleBn,
          titleBn: svc.titleBn,
          titleEn: svc.titleEn,
          summary: params.locale === 'en' ? svc.summaryEn : svc.summaryBn,
          categorySlug: svc.categorySlug,
          agencySlug: svc.agencySlug,
          deliveryChannels: svc.deliveryChannels,
          officialUrl: svc.officialUrl,
          processingTime: svc.processingTime,
          version: svc.version,
          trustLabel: svc.trustLabel,
          lastVerifiedAt: svc.lastVerifiedAt,
          importedAt: src?.fetchedAt ?? svc.createdAt,
          sources: [
            {
              id: src?.id ?? svc.sourceId,
              url: src?.url ?? svc.officialUrl,
              agency: src?.agency ?? svc.agencySlug,
              trustLabel: src?.trustLabel ?? svc.trustLabel,
              lastVerifiedAt: svc.lastVerifiedAt?.toISOString() ?? null,
            },
          ],
          attribution: {
            trustLabel: svc.trustLabel,
            sourceUrl: src?.url ?? svc.officialUrl,
            agency: src?.agency ?? svc.agencySlug,
            lastVerifiedAt: svc.lastVerifiedAt?.toISOString() ?? null,
          },
        };
      }),
    );

    return paginateWithCursor(mapped, params.cursor, params.limit);
  }

  async getServiceDetail(slug: string, locale: 'bn' | 'en') {
    const svc = await this.repo.findServiceBySlug(slug);
    if (!svc || svc.status === 'draft') {
      throw new NotFoundException(`Service '${slug}' not found`);
    }

    const [agency, source, faqs, sameCategory] = await Promise.all([
      this.repo.findAgencyBySlug(svc.agencySlug),
      this.repo.findSourceById(svc.sourceId),
      this.repo.listFaqs(svc.slug),
      this.repo.listServices({ category: svc.categorySlug }),
    ]);

    const relatedServices = sameCategory
      .filter((s) => s.slug !== svc.slug)
      .slice(0, 4)
      .map((s) => ({
        slug: s.slug,
        title: locale === 'en' ? s.titleEn : s.titleBn,
        trustLabel: s.trustLabel,
      }));

    return {
      id: svc.id,
      slug: svc.slug,
      title: locale === 'en' ? svc.titleEn : svc.titleBn,
      titleBn: svc.titleBn,
      titleEn: svc.titleEn,
      // 5 citizen questions layout (Prompt 04 & 14)
      what: {
        summary: locale === 'en' ? svc.summaryEn : svc.summaryBn,
        descriptionMd: locale === 'en' ? svc.descriptionMdEn : svc.descriptionMdBn,
      },
      whoProvides: agency
        ? {
            slug: agency.slug,
            name: locale === 'en' ? agency.nameEn : agency.nameBn,
            officialUrl: agency.officialUrl,
            contactPhone: agency.contactPhone,
          }
        : null,
      whoCanApply: locale === 'en' ? svc.whoCanApplyEn : svc.whoCanApplyBn,
      documents: svc.requirements.map((r) => ({
        name: locale === 'en' ? r.documentNameEn : r.documentNameBn,
        nameBn: r.documentNameBn,
        nameEn: r.documentNameEn,
        isMandatory: r.isMandatory,
      })),
      howAndWhere: {
        officialUrl: svc.officialUrl,
        deliveryChannels: svc.deliveryChannels,
        handoffNotice:
          locale === 'en'
            ? 'Continue to the official government channel to submit your application.'
            : 'আবেদন জমা দিতে অফিশিয়াল সরকারি চ্যানেলে এগিয়ে যান।',
        steps: svc.steps.map((st) => ({
          stepOrder: st.stepOrder,
          title: locale === 'en' ? st.titleEn : st.titleBn,
          instruction: locale === 'en' ? st.instructionEn : st.instructionBn,
          channel: st.channel,
        })),
      },
      feeInfo: locale === 'en' ? svc.feeInfo.en : svc.feeInfo.bn,
      feeInfoBilingual: svc.feeInfo,
      processingTime: svc.processingTime,
      version: svc.version,
      trustLabel: svc.trustLabel,
      lastVerifiedAt: svc.lastVerifiedAt,
      sources: [
        {
          id: source?.id ?? svc.sourceId,
          url: source?.url ?? svc.officialUrl,
          agency: source?.agency ?? agency?.nameEn ?? svc.agencySlug,
          trustLabel: source?.trustLabel ?? svc.trustLabel,
          lastVerifiedAt: svc.lastVerifiedAt?.toISOString() ?? null,
          validTo: source?.validTo?.toISOString() ?? null,
        },
      ],
      relatedServices,
      faqs: faqs.map((f) => ({
        id: f.id,
        question: locale === 'en' ? f.questionEn : f.questionBn,
        answer: locale === 'en' ? f.answerEn : f.answerBn,
        trustLabel: f.trustLabel,
      })),
    };
  }

  async getServiceVersions(slug: string) {
    const svc = await this.repo.findServiceBySlug(slug);
    if (!svc) throw new NotFoundException(`Service '${slug}' not found`);
    return this.repo.listServiceVersions(svc.id);
  }

  async listNotices(params: { kind?: string; region?: string; activeOnly?: boolean; locale: 'bn' | 'en' }) {
    const items = await this.repo.listNotices({
      kind: params.kind,
      region: params.region,
      activeOnly: params.activeOnly ?? true,
    });
    return items.map((n) => ({
      ...n,
      title: params.locale === 'en' ? n.titleEn : n.titleBn,
      body: params.locale === 'en' ? n.bodyEn : n.bodyBn,
    }));
  }

  async listAgencies(locale: 'bn' | 'en') {
    const agencies = await this.repo.listAgencies();
    return agencies.map((a) => ({
      ...a,
      name: locale === 'en' ? a.nameEn : a.nameBn,
    }));
  }

  async listFacilities(params: {
    type?: string;
    nearLat?: number;
    nearLng?: number;
    radiusKm?: number;
    locale: 'bn' | 'en';
  }) {
    const all = await this.repo.listFacilities({ type: params.type });
    const withDist = all.map((f) => {
      const distanceKm =
        params.nearLat !== undefined && params.nearLng !== undefined
          ? Number(haversineKm(params.nearLat, params.nearLng, f.lat, f.lng).toFixed(2))
          : null;
      return {
        ...f,
        name: params.locale === 'en' ? f.nameEn : f.nameBn,
        address: params.locale === 'en' ? f.addressEn : f.addressBn,
        distanceKm,
      };
    });

    const filtered =
      params.radiusKm !== undefined && params.nearLat !== undefined && params.nearLng !== undefined
        ? withDist.filter((f) => f.distanceKm !== null && f.distanceKm <= params.radiusKm!)
        : withDist;

    if (params.nearLat !== undefined && params.nearLng !== undefined) {
      filtered.sort((a, b) => (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999));
    }
    return filtered;
  }

  async listUtilityOutages(district: string | undefined, locale: 'bn' | 'en') {
    const outages = await this.repo.listUtilityOutages({ district });
    return outages.map((o) => ({
      ...o,
      areaDescription: locale === 'en' ? o.areaDescriptionEn : o.areaDescriptionBn,
    }));
  }

  async listFaqs(serviceSlug: string | undefined, locale: 'bn' | 'en') {
    const faqs = await this.repo.listFaqs(serviceSlug);
    return faqs.map((f) => ({
      ...f,
      question: locale === 'en' ? f.questionEn : f.questionBn,
      answer: locale === 'en' ? f.answerEn : f.answerBn,
    }));
  }

  async universalSearch(params: {
    query: string;
    locale: 'bn' | 'en';
    types?: SearchItemType[];
    limit?: number;
  }) {
    const docs = await this.repo.getAllSearchDocuments();
    const res = await this.searchEngine.search(docs, params);
    if (res.total === 0 && params.query.trim().length >= 2) {
      const key = params.query.trim().toLowerCase();
      const prev = this.zeroResultGaps.get(key);
      this.zeroResultGaps.set(key, {
        query: params.query.trim(),
        locale: params.locale,
        count: (prev?.count ?? 0) + 1,
        lastSeenAt: new Date().toISOString(),
      });
    }
    return res;
  }

  listZeroResultSearchGaps() {
    const items = [...this.zeroResultGaps.values()].sort((a, b) => b.count - a.count);
    return { count: items.length, items };
  }

  async suggestSearch(query: string, locale: 'bn' | 'en', limit = 8) {
    const docs = await this.repo.getAllSearchDocuments();
    return this.searchEngine.suggest(docs, query, locale, limit);
  }

  // --- Citizen Saved Items, Reminders & Content Reports ---

  async listSavedItems(userId: string) {
    return this.repo.listSavedItems(userId);
  }

  async saveItem(userId: string, dto: { resourceType: string; resourceId: string; notes?: string }) {
    const item: SavedItemRecord = {
      id: uuidv7(),
      userId,
      resourceType: dto.resourceType,
      resourceId: dto.resourceId,
      notes: dto.notes ?? null,
      createdAt: new Date(),
    };
    return this.repo.addSavedItem(item);
  }

  async deleteSavedItem(userId: string, id: string): Promise<{ deleted: true }> {
    const existing = await this.repo.findSavedItemById(id);
    if (!existing) throw new NotFoundException('Saved item not found');
    if (existing.userId !== userId) {
      throw new ForbiddenException('Cannot delete another citizen’s saved item');
    }
    await this.repo.deleteSavedItem(id);
    return { deleted: true };
  }

  async listReminders(userId: string) {
    return this.repo.listReminders(userId);
  }

  async createReminder(
    userId: string,
    dto: {
      resourceType: string;
      resourceId?: string;
      titleBn: string;
      titleEn: string;
      remindAt: Date;
    },
  ) {
    const reminder: ReminderRecord = {
      id: uuidv7(),
      userId,
      resourceType: dto.resourceType,
      resourceId: dto.resourceId ?? null,
      titleBn: dto.titleBn,
      titleEn: dto.titleEn,
      remindAt: dto.remindAt,
      status: 'scheduled',
      createdAt: new Date(),
    };
    return this.repo.saveReminder(reminder);
  }

  async updateReminder(
    userId: string,
    id: string,
    patch: { remindAt?: Date; status?: 'scheduled' | 'cancelled' },
  ) {
    const existing = await this.repo.findReminderById(id);
    if (!existing) throw new NotFoundException('Reminder not found');
    if (existing.userId !== userId) {
      throw new ForbiddenException('Cannot modify another citizen’s reminder');
    }
    if (patch.remindAt) existing.remindAt = patch.remindAt;
    if (patch.status) existing.status = patch.status;
    return this.repo.saveReminder(existing);
  }

  async deleteReminder(userId: string, id: string): Promise<{ deleted: true }> {
    const existing = await this.repo.findReminderById(id);
    if (!existing) throw new NotFoundException('Reminder not found');
    if (existing.userId !== userId) {
      throw new ForbiddenException('Cannot delete another citizen’s reminder');
    }
    await this.repo.deleteReminder(id);
    return { deleted: true };
  }

  async submitContentReport(
    reporterId: string | null,
    dto: { resourceType: string; resourceId: string; reason: string; details: string },
  ): Promise<{ report: ContentReportRecord; reviewTask: ReviewTaskRecord }> {
    const report: ContentReportRecord = {
      id: uuidv7(),
      reporterId,
      resourceType: dto.resourceType,
      resourceId: dto.resourceId,
      reason: dto.reason,
      details: dto.details,
      status: 'open',
      createdAt: new Date(),
    };
    await this.repo.addContentReport(report);

    const reviewTask: ReviewTaskRecord = {
      id: uuidv7(),
      reason: 'content_report',
      resourceType: dto.resourceType,
      resourceId: dto.resourceId,
      details: `Citizen report (${dto.reason}): ${dto.details}`,
      status: 'open',
      createdAt: new Date(),
    };
    await this.repo.addReviewTask(reviewTask);
    return { report, reviewTask };
  }

  // --- Editorial Content Lifecycle & Source Freshness (Prompt 04) ---

  async createDraftService(
    authorId: string,
    dto: {
      slug: string;
      titleBn: string;
      titleEn: string;
      summaryBn: string;
      summaryEn: string;
      agencySlug: string;
      categorySlug: string;
      officialUrl: string;
      feeInfo: { bn: string; en: string };
      processingTime: string;
      sourceUrl: string;
      sourceAgency: string;
      aliases?: string[];
    },
  ): Promise<ServiceRecord> {
    const existing = await this.repo.findServiceBySlug(dto.slug);
    if (existing) throw new ConflictException(`Service slug '${dto.slug}' already exists`);

    const agency = await this.repo.findAgencyBySlug(dto.agencySlug);
    if (!agency) throw new BadRequestException(`Unknown agency '${dto.agencySlug}'`);

    const cats = await this.repo.listCategories();
    const cat = cats.find((c) => c.slug === dto.categorySlug);
    if (!cat) throw new BadRequestException(`Unknown category '${dto.categorySlug}'`);

    const now = new Date();
    const source = await this.repo.saveSource({
      id: uuidv7(),
      url: dto.sourceUrl,
      agency: dto.sourceAgency,
      sourceType: 'official_portal',
      contentHash: null,
      fetchedAt: now,
      verifiedAt: null,
      validFrom: now,
      validTo: new Date(now.getTime() + 180 * 86_400_000),
      reviewerId: null,
      trustLabel: TrustLabel.OFFICIAL_SOURCE,
    });

    const draft: ServiceRecord = {
      id: uuidv7(),
      slug: dto.slug,
      titleBn: dto.titleBn,
      titleEn: dto.titleEn,
      summaryBn: dto.summaryBn,
      summaryEn: dto.summaryEn,
      descriptionMdBn: dto.summaryBn,
      descriptionMdEn: dto.summaryEn,
      whoCanApplyBn: 'সরকারি নীতিমালা অনুযায়ী যোগ্য নাগরিক।',
      whoCanApplyEn: 'Eligible citizens per official agency guidelines.',
      agencyId: agency.id,
      agencySlug: agency.slug,
      categoryId: cat.id,
      categorySlug: cat.slug,
      sourceId: source.id,
      deliveryChannels: ['online'],
      officialUrl: dto.officialUrl,
      feeInfo: dto.feeInfo,
      processingTime: dto.processingTime,
      status: 'draft',
      trustLabel: TrustLabel.OFFICIAL_SOURCE,
      version: 0,
      authorId,
      verifiedBy: null,
      lastVerifiedAt: null,
      aliases: dto.aliases ?? [],
      requirements: [],
      steps: [],
      createdAt: now,
      updatedAt: now,
    };

    return this.repo.saveService(draft);
  }

  async submitServiceForReview(slug: string, authorId: string): Promise<ServiceRecord> {
    const svc = await this.repo.findServiceBySlug(slug);
    if (!svc) throw new NotFoundException(`Service '${slug}' not found`);
    if (svc.status !== 'draft') {
      throw new BadRequestException(`Only draft services can be submitted for review (current: ${svc.status})`);
    }
    const source = await this.repo.findSourceById(svc.sourceId);
    if (!source) {
      throw new BadRequestException('Cannot submit service for review without at least 1 source');
    }
    svc.status = 'in_review';
    svc.authorId = authorId;
    await this.repo.saveService(svc);
    await this.repo.addReviewTask({
      id: uuidv7(),
      reason: 'submission',
      resourceType: 'service',
      resourceId: svc.id,
      details: `Service '${svc.slug}' submitted for review`,
      status: 'open',
      createdAt: new Date(),
    });
    return svc;
  }

  /** Enforces reviewer !== author, requires >= 1 source, creates immutable service_versions row */
  async publishService(
    slug: string,
    reviewerId: string,
    changeSummary = 'Reviewed and published',
  ): Promise<ServiceRecord> {
    const svc = await this.repo.findServiceBySlug(slug);
    if (!svc) throw new NotFoundException(`Service '${slug}' not found`);
    if (svc.status !== 'in_review') {
      throw new BadRequestException(`Service must be in_review before publishing (current: ${svc.status})`);
    }
    if (svc.authorId && svc.authorId === reviewerId) {
      throw new ForbiddenException('Reviewer cannot be the same person as the author');
    }
    const source = await this.repo.findSourceById(svc.sourceId);
    if (!source) {
      throw new BadRequestException('Service requires at least 1 verified source to publish');
    }

    const now = new Date();
    svc.status = 'published';
    svc.version += 1;
    svc.verifiedBy = reviewerId;
    svc.lastVerifiedAt = now;
    source.verifiedAt = now;
    source.reviewerId = reviewerId;
    await this.repo.saveSource(source);
    await this.repo.saveService(svc);

    await this.repo.addServiceVersion({
      id: uuidv7(),
      serviceId: svc.id,
      version: svc.version,
      changeSummary,
      authorId: svc.authorId,
      reviewerId,
      publishedAt: now,
      snapshot: {
        titleBn: svc.titleBn,
        titleEn: svc.titleEn,
        summaryBn: svc.summaryBn,
        summaryEn: svc.summaryEn,
        feeInfo: svc.feeInfo,
        processingTime: svc.processingTime,
        officialUrl: svc.officialUrl,
      },
    });

    return svc;
  }

  async archiveService(slug: string): Promise<ServiceRecord> {
    const svc = await this.repo.findServiceBySlug(slug);
    if (!svc) throw new NotFoundException(`Service '${slug}' not found`);
    svc.status = 'archived';
    return this.repo.saveService(svc);
  }

  /** Nightly freshness sweep: expired sources auto-flag services UNAVAILABLE_STALE & create review tasks */
  async flagExpiredSources(now: Date = new Date()): Promise<{
    staleServicesFlagged: string[];
    tasksCreated: number;
  }> {
    const [sources, services] = await Promise.all([
      this.repo.listSources(),
      this.repo.listServices({ includeNonPublished: true }),
    ]);

    const expiredSourceIds = new Set(
      sources.filter((s) => s.validTo && s.validTo.getTime() < now.getTime()).map((s) => s.id),
    );

    const staleServicesFlagged: string[] = [];
    for (const svc of services) {
      if (expiredSourceIds.has(svc.sourceId) && svc.trustLabel !== TrustLabel.UNAVAILABLE_STALE) {
        svc.trustLabel = TrustLabel.UNAVAILABLE_STALE;
        await this.repo.saveService(svc);
        await this.repo.addReviewTask({
          id: uuidv7(),
          reason: 'source_expired',
          resourceType: 'service',
          resourceId: svc.id,
          details: `Source ${svc.sourceId} expired; service '${svc.slug}' marked UNAVAILABLE_STALE.`,
          status: 'open',
          createdAt: now,
        });
        staleServicesFlagged.push(svc.slug);
      }
    }

    return {
      staleServicesFlagged,
      tasksCreated: staleServicesFlagged.length,
    };
  }

  /** Nightly permitted source hash check: opens a review task if source content changed */
  async recordSourceHashCheck(
    sourceId: string,
    newContentHash: string,
  ): Promise<{ changed: boolean; reviewTask?: ReviewTaskRecord }> {
    const source = await this.repo.findSourceById(sourceId);
    if (!source) throw new NotFoundException(`Source '${sourceId}' not found`);

    const changed = source.contentHash !== null && source.contentHash !== newContentHash;
    source.contentHash = newContentHash;
    source.fetchedAt = new Date();
    await this.repo.saveSource(source);

    if (changed) {
      const reviewTask = await this.repo.addReviewTask({
        id: uuidv7(),
        reason: 'source_changed',
        resourceType: 'source',
        resourceId: source.id,
        details: `Permitted source URL ${source.url} content hash changed; editor review required.`,
        status: 'open',
        createdAt: new Date(),
      });
      return { changed: true, reviewTask };
    }
    return { changed: false };
  }

  async listReviewTasks() {
    return this.repo.listReviewTasks();
  }
}
