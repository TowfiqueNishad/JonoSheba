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

export interface CatalogueRepositoryPort {
  // Public catalogue reads
  listCategories(): Promise<CategoryRecord[]>;
  listLifeEvents(): Promise<LifeEventRecord[]>;
  findLifeEventBySlug(slug: string): Promise<LifeEventRecord | null>;
  listAgencies(): Promise<AgencyRecord[]>;
  findAgencyBySlug(slug: string): Promise<AgencyRecord | null>;
  listServices(filters?: {
    category?: string;
    agency?: string;
    channel?: string;
    includeNonPublished?: boolean;
  }): Promise<ServiceRecord[]>;
  findServiceBySlug(slug: string): Promise<ServiceRecord | null>;
  listServiceVersions(serviceId: string): Promise<ServiceVersionRecord[]>;
  findSourceById(sourceId: string): Promise<SourceRecord | null>;
  listSources(): Promise<SourceRecord[]>;
  listNotices(filters?: { kind?: string; region?: string; activeOnly?: boolean }): Promise<NoticeRecord[]>;
  listFacilities(filters?: { type?: string }): Promise<FacilityRecord[]>;
  listUtilityOutages(filters?: { district?: string }): Promise<UtilityOutageRecord[]>;
  listFaqs(serviceSlug?: string): Promise<FaqRecord[]>;
  getAllSearchDocuments(): Promise<SearchDocument[]>;

  // Content lifecycle & freshness writes
  saveService(service: ServiceRecord): Promise<ServiceRecord>;
  addServiceVersion(version: ServiceVersionRecord): Promise<ServiceVersionRecord>;
  saveSource(source: SourceRecord): Promise<SourceRecord>;
  addContentReport(report: ContentReportRecord): Promise<ContentReportRecord>;
  addReviewTask(task: ReviewTaskRecord): Promise<ReviewTaskRecord>;
  listReviewTasks(): Promise<ReviewTaskRecord[]>;

  // Citizen saved items & reminders (owner-scoped)
  listSavedItems(userId: string): Promise<SavedItemRecord[]>;
  addSavedItem(item: SavedItemRecord): Promise<SavedItemRecord>;
  findSavedItemById(id: string): Promise<SavedItemRecord | null>;
  deleteSavedItem(id: string): Promise<void>;

  listReminders(userId: string): Promise<ReminderRecord[]>;
  findReminderById(id: string): Promise<ReminderRecord | null>;
  saveReminder(reminder: ReminderRecord): Promise<ReminderRecord>;
  deleteReminder(id: string): Promise<void>;
}

export const CATALOGUE_REPOSITORY_PORT = Symbol('CATALOGUE_REPOSITORY_PORT');
