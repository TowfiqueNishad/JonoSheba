import { Injectable } from '@nestjs/common';
import { Channel } from '@jonoshheba/shared';
import type {
  NotificationFeedbackRecord,
  NotificationJobRecord,
  NotificationPreferencesRecord,
  NotificationRecord,
  NotificationTemplateRecord,
  RegisteredDeviceRecord,
} from '../domain/notify.types';
import type { NotifyRepositoryPort } from '../ports/notify.repository.port';

@Injectable()
export class InMemoryNotifyRepository implements NotifyRepositoryPort {
  private readonly templates: NotificationTemplateRecord[] = [
    // Ticket watch matched (R1 compliant copy)
    {
      key: 'watch.matched',
      channel: Channel.IN_APP,
      locale: 'bn',
      subject: 'সম্ভাব্য টিকিট পাওয়া যেতে পারে',
      body: '{{route}} ({{date}}) রুটে সম্ভাব্য আসন দেখা গেছে — আসন সংরক্ষিত নয়। অফিশিয়াল চ্যানেলে এগিয়ে যান: {{url}}',
      version: 1,
    },
    {
      key: 'watch.matched',
      channel: Channel.IN_APP,
      locale: 'en',
      subject: 'Possible ticket availability detected',
      body: 'Possible availability on {{route}} ({{date}}) — not reserved. Continue to official provider: {{url}}',
      version: 1,
    },
    {
      key: 'watch.matched',
      channel: Channel.SMS,
      locale: 'bn',
      body: 'জনসেবা: {{route}} ({{date}}) সম্ভাব্য আসন। সংরক্ষিত নয়: {{url}}',
      version: 1,
    },
    {
      key: 'watch.matched',
      channel: Channel.SMS,
      locale: 'en',
      body: 'Jonoshheba: Possible seats {{route}} ({{date}}). Not reserved: {{url}}',
      version: 1,
    },
    // P0 Emergency / Disaster alert
    {
      key: 'emergency.disaster',
      channel: Channel.IN_APP,
      locale: 'bn',
      subject: 'জরুরি দুর্যোগ সতর্কতা',
      body: '{{headline}}। জরুরি সাহায্যের জন্য সরাসরি ৯৯৯ বা ১০৯০-এ কল করুন।',
      version: 1,
    },
    {
      key: 'emergency.disaster',
      channel: Channel.IN_APP,
      locale: 'en',
      subject: 'Urgent Disaster Advisory',
      body: '{{headline}}. For immediate danger, call 999 or 1090 directly.',
      version: 1,
    },
    // Deadline reminder (P2)
    {
      key: 'deadline.reminder',
      channel: Channel.IN_APP,
      locale: 'bn',
      subject: 'আবেদনের শেষ তারিখ নিকটে',
      body: '{{title}} এর সময়সীমা {{deadline}}। অফিশিয়াল পোর্টালে আবেদন করুন।',
      version: 1,
    },
    {
      key: 'deadline.reminder',
      channel: Channel.IN_APP,
      locale: 'en',
      subject: 'Upcoming Application Deadline',
      body: '{{title}} closes on {{deadline}}. Apply via the official portal.',
      version: 1,
    },
    // User-triggered test notification
    {
      key: 'notification.test',
      channel: Channel.IN_APP,
      locale: 'bn',
      subject: 'জনসেবা টেস্ট নোটিফিকেশন',
      body: 'আপনার জনসেবা নোটিফিকেশন চ্যানেল সঠিকভাবে কাজ করছে।',
      version: 1,
    },
    {
      key: 'notification.test',
      channel: Channel.IN_APP,
      locale: 'en',
      subject: 'Jonoshheba Test Notification',
      body: 'Your Jonoshheba notification channels are working properly.',
      version: 1,
    },
  ];

  private readonly notifications = new Map<string, NotificationRecord>();
  private readonly jobs = new Map<string, NotificationJobRecord>();
  private readonly preferences = new Map<string, NotificationPreferencesRecord>();
  private readonly devices = new Map<string, RegisteredDeviceRecord>();
  private readonly feedback: NotificationFeedbackRecord[] = [];

  async findTemplate(
    key: string,
    channel: Channel,
    locale: 'bn' | 'en',
  ): Promise<NotificationTemplateRecord | null> {
    const exact = this.templates.find(
      (t) => t.key === key && t.channel === channel && t.locale === locale,
    );
    if (exact) return exact;
    // Fallback to IN_APP template for same key & locale
    return (
      this.templates.find(
        (t) => t.key === key && t.channel === Channel.IN_APP && t.locale === locale,
      ) ?? null
    );
  }

  async saveNotification(notification: NotificationRecord): Promise<NotificationRecord> {
    this.notifications.set(notification.id, notification);
    return notification;
  }

  async findNotificationById(id: string): Promise<NotificationRecord | null> {
    return this.notifications.get(id) ?? null;
  }

  async listNotificationsForUser(userId: string): Promise<NotificationRecord[]> {
    return [...this.notifications.values()]
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async markAllRead(userId: string): Promise<number> {
    let count = 0;
    const now = new Date();
    for (const n of this.notifications.values()) {
      if (n.userId === userId && !n.readAt) {
        n.readAt = now;
        count++;
      }
    }
    return count;
  }

  async findJobByDedupeKey(dedupeKey: string): Promise<NotificationJobRecord | null> {
    for (const job of this.jobs.values()) {
      if (job.dedupeKey === dedupeKey) return job;
    }
    return null;
  }

  async findJobByProviderMessageId(
    providerMessageId: string,
  ): Promise<NotificationJobRecord | null> {
    for (const job of this.jobs.values()) {
      if (job.providerMessageId === providerMessageId) return job;
    }
    return null;
  }

  async saveJob(job: NotificationJobRecord): Promise<NotificationJobRecord> {
    job.updatedAt = new Date();
    this.jobs.set(job.id, job);
    return job;
  }

  async listJobs(filter?: { userId?: string; status?: string }): Promise<NotificationJobRecord[]> {
    return [...this.jobs.values()].filter((j) => {
      if (filter?.userId && j.userId !== filter.userId) return false;
      if (filter?.status && j.status !== filter.status) return false;
      return true;
    });
  }

  private sameUtcMonth(a: Date, b: Date): boolean {
    return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
  }

  async getUserSmsSegmentsThisMonth(userId: string, now: Date): Promise<number> {
    let total = 0;
    for (const j of this.jobs.values()) {
      if (
        j.userId === userId &&
        j.channel === Channel.SMS &&
        (j.status === 'sent' || j.status === 'delivered') &&
        j.sentAt &&
        this.sameUtcMonth(j.sentAt, now)
      ) {
        total += j.segmentsUsed;
      }
    }
    return total;
  }

  async getGlobalSmsSegmentsThisMonth(now: Date): Promise<number> {
    let total = 0;
    for (const j of this.jobs.values()) {
      if (
        j.channel === Channel.SMS &&
        (j.status === 'sent' || j.status === 'delivered') &&
        j.sentAt &&
        this.sameUtcMonth(j.sentAt, now)
      ) {
        total += j.segmentsUsed;
      }
    }
    return total;
  }

  async getPreferences(userId: string): Promise<NotificationPreferencesRecord> {
    const existing = this.preferences.get(userId);
    if (existing) return existing;
    const def: NotificationPreferencesRecord = {
      userId,
      locale: 'bn',
      channels: {
        in_app: true,
        web_push: true,
        mobile_push: true,
        email: false,
        sms: false,
      },
      quietHours: {
        enabled: false,
        start: '23:00',
        end: '06:00',
        timezone: 'Asia/Dhaka',
      },
      digestFrequency: 'daily',
      emailAddress: null,
      phoneE164: null,
    };
    this.preferences.set(userId, def);
    return def;
  }

  async savePreferences(pref: NotificationPreferencesRecord): Promise<NotificationPreferencesRecord> {
    this.preferences.set(pref.userId, pref);
    return pref;
  }

  async listDevices(userId: string): Promise<RegisteredDeviceRecord[]> {
    return [...this.devices.values()].filter((d) => d.userId === userId);
  }

  async findDeviceById(id: string): Promise<RegisteredDeviceRecord | null> {
    return this.devices.get(id) ?? null;
  }

  async saveDevice(device: RegisteredDeviceRecord): Promise<RegisteredDeviceRecord> {
    this.devices.set(device.id, device);
    return device;
  }

  async deleteDevice(id: string): Promise<void> {
    this.devices.delete(id);
  }

  async saveFeedback(feedback: NotificationFeedbackRecord): Promise<NotificationFeedbackRecord> {
    this.feedback.push(feedback);
    return feedback;
  }

  async listFeedback(userId?: string): Promise<NotificationFeedbackRecord[]> {
    return userId ? this.feedback.filter((f) => f.userId === userId) : [...this.feedback];
  }
}
