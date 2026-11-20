import type { Channel } from '@jonoshheba/shared';
import type {
  NotificationFeedbackRecord,
  NotificationJobRecord,
  NotificationPreferencesRecord,
  NotificationRecord,
  NotificationTemplateRecord,
  RegisteredDeviceRecord,
} from '../domain/notify.types';

export interface NotifyRepositoryPort {
  // Templates
  findTemplate(key: string, channel: Channel, locale: 'bn' | 'en'): Promise<NotificationTemplateRecord | null>;

  // In-app inbox
  saveNotification(notification: NotificationRecord): Promise<NotificationRecord>;
  findNotificationById(id: string): Promise<NotificationRecord | null>;
  listNotificationsForUser(userId: string): Promise<NotificationRecord[]>;
  markAllRead(userId: string): Promise<number>;

  // Jobs & dedupe & DLQ
  findJobByDedupeKey(dedupeKey: string): Promise<NotificationJobRecord | null>;
  findJobByProviderMessageId(providerMessageId: string): Promise<NotificationJobRecord | null>;
  saveJob(job: NotificationJobRecord): Promise<NotificationJobRecord>;
  listJobs(filter?: { userId?: string; status?: string }): Promise<NotificationJobRecord[]>;

  // SMS monthly budget counters
  getUserSmsSegmentsThisMonth(userId: string, now: Date): Promise<number>;
  getGlobalSmsSegmentsThisMonth(now: Date): Promise<number>;

  // Preferences & devices
  getPreferences(userId: string): Promise<NotificationPreferencesRecord>;
  savePreferences(pref: NotificationPreferencesRecord): Promise<NotificationPreferencesRecord>;

  listDevices(userId: string): Promise<RegisteredDeviceRecord[]>;
  findDeviceById(id: string): Promise<RegisteredDeviceRecord | null>;
  saveDevice(device: RegisteredDeviceRecord): Promise<RegisteredDeviceRecord>;
  deleteDevice(id: string): Promise<void>;

  // Feedback (ML training signal)
  saveFeedback(feedback: NotificationFeedbackRecord): Promise<NotificationFeedbackRecord>;
  listFeedback(userId?: string): Promise<NotificationFeedbackRecord[]>;
}

export const NOTIFY_REPOSITORY_PORT = Symbol('NOTIFY_REPOSITORY_PORT');
