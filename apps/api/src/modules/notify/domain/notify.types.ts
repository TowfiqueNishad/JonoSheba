import type { Channel } from '@jonoshheba/shared';

export type NotificationPriority = 'P0' | 'P1' | 'P2' | 'P3';

export type NotificationJobStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'dlq'
  | 'suppressed';

export interface NotificationTemplateRecord {
  key: string;
  channel: Channel;
  locale: 'bn' | 'en';
  subject?: string;
  body: string;
  version: number;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  titleBn: string;
  titleEn: string;
  bodyBn: string;
  bodyEn: string;
  category: string;
  priority: NotificationPriority;
  actionUrl: string | null;
  payload: Record<string, unknown>;
  readAt: Date | null;
  createdAt: Date;
}

export interface NotificationJobRecord {
  id: string;
  userId: string;
  sourceType: string;
  sourceId: string;
  channel: Channel;
  dedupeKey: string;
  priority: NotificationPriority;
  status: NotificationJobStatus;
  attempts: number;
  maxAttempts: number;
  providerMessageId: string | null;
  segmentsUsed: number;
  estimatedCostBdt: number;
  sentAt: Date | null;
  deliveredAt: Date | null;
  openedAt: Date | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationFeedbackRecord {
  id: string;
  notificationId: string;
  userId: string;
  isUseful: boolean;
  reason: string | null;
  createdAt: Date;
}

export interface NotificationPreferencesRecord {
  userId: string;
  locale: 'bn' | 'en';
  channels: {
    in_app: boolean;
    web_push: boolean;
    mobile_push: boolean;
    email: boolean;
    sms: boolean;
  };
  quietHours: {
    enabled: boolean;
    start: string; // HH:MM in Asia/Dhaka
    end: string; // HH:MM in Asia/Dhaka
    timezone: 'Asia/Dhaka';
  };
  digestFrequency: 'daily' | 'weekly' | 'off';
  emailAddress?: string | null;
  phoneE164?: string | null;
}

export interface RegisteredDeviceRecord {
  id: string;
  userId: string;
  platform: 'web' | 'ios' | 'android';
  pushToken: string;
  deviceLabel: string | null;
  createdAt: Date;
}

export interface DispatchNotificationEvent {
  userId: string;
  sourceType: string;
  sourceId: string;
  templateKey: string;
  priority: NotificationPriority;
  category: string;
  dedupeBaseKey: string;
  variables: Record<string, string | number>;
  actionUrl?: string;
  requestedChannels?: Channel[];
  now?: Date;
}
