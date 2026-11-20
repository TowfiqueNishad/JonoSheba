import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Channel } from '@jonoshheba/shared';
import { type Observable, Subject, filter, map } from 'rxjs';
import { uuidv7 } from '../../../common/uuidv7';
import { paginateWithCursor } from '../../catalogue/domain/http-helpers';
import type {
  DispatchNotificationEvent,
  NotificationFeedbackRecord,
  NotificationJobRecord,
  NotificationPreferencesRecord,
  NotificationRecord,
  RegisteredDeviceRecord,
} from '../domain/notify.types';
import { isWithinDhakaQuietHours } from '../domain/quiet-hours';
import { analyzeSmsSegments, renderTemplate } from '../domain/sms-segments';
import { NOTIFICATION_CHANNELS_PORT, type ChannelPort } from '../ports/channel.port';
import { NOTIFY_REPOSITORY_PORT, type NotifyRepositoryPort } from '../ports/notify.repository.port';

export interface SmsBudgetConfig {
  perUserMonthlySegmentCap: number;
  globalMonthlySegmentCap: number;
}

@Injectable()
export class NotifyService {
  private readonly stream$ = new Subject<{ userId: string; notification: NotificationRecord }>();
  smsBudget: SmsBudgetConfig = {
    perUserMonthlySegmentCap: 20,
    globalMonthlySegmentCap: 10_000,
  };
  private readonly webhookSecret =
    process.env.SMS_WEBHOOK_SECRET ?? 'dev_only_sms_dlr_webhook_hmac_secret';

  constructor(
    @Inject(NOTIFY_REPOSITORY_PORT)
    private readonly repo: NotifyRepositoryPort,
    @Inject(NOTIFICATION_CHANNELS_PORT)
    private readonly channels: ChannelPort[],
  ) {}

  private getChannelAdapter(channel: Channel): ChannelPort | undefined {
    return this.channels.find((c) => c.channel === channel);
  }

  private buildJobDedupeKey(baseKey: string, userId: string, channel: Channel): string {
    return createHash('sha256').update(`${baseKey}|${userId}|${channel}`).digest('hex');
  }

  /**
   * Core Notification Pipeline:
   * event -> preference/consent -> quiet hours (Asia/Dhaka; P0 bypasses!) ->
   * SMS budget guard -> dedupe -> channel send w/ retries -> DLQ -> live SSE push.
   */
  async dispatch(event: DispatchNotificationEvent): Promise<{
    notification: NotificationRecord | null;
    jobs: NotificationJobRecord[];
  }> {
    const now = event.now ?? new Date();
    const prefs = await this.repo.getPreferences(event.userId);
    const quietActive = isWithinDhakaQuietHours(now, prefs.quietHours);
    const isEmergencyP0 = event.priority === 'P0';

    // Render bilingual inbox copy
    const tplBn = await this.repo.findTemplate(event.templateKey, Channel.IN_APP, 'bn');
    const tplEn = await this.repo.findTemplate(event.templateKey, Channel.IN_APP, 'en');
    const titleBn = renderTemplate(tplBn?.subject ?? event.templateKey, event.variables);
    const titleEn = renderTemplate(tplEn?.subject ?? event.templateKey, event.variables);
    const bodyBn = renderTemplate(tplBn?.body ?? '', event.variables);
    const bodyEn = renderTemplate(tplEn?.body ?? '', event.variables);

    const requested: Channel[] = event.requestedChannels?.length
      ? event.requestedChannels
      : [Channel.IN_APP, Channel.WEB_PUSH, Channel.MOBILE_PUSH, Channel.EMAIL, Channel.SMS];

    // Ensure IN_APP is always considered first
    const orderedChannels = [...new Set<Channel>([Channel.IN_APP, ...requested])];
    const jobs: NotificationJobRecord[] = [];
    let createdInbox: NotificationRecord | null = null;

    for (const channel of orderedChannels) {
      const dedupeKey = this.buildJobDedupeKey(event.dedupeBaseKey, event.userId, channel);
      const existing = await this.repo.findJobByDedupeKey(dedupeKey);
      if (existing) {
        // Dedupe hit -> never send duplicate!
        continue;
      }

      const job: NotificationJobRecord = {
        id: uuidv7(),
        userId: event.userId,
        sourceType: event.sourceType,
        sourceId: event.sourceId,
        channel,
        dedupeKey,
        priority: event.priority,
        status: 'queued',
        attempts: 0,
        maxAttempts: 3,
        providerMessageId: null,
        segmentsUsed: 0,
        estimatedCostBdt: 0,
        sentAt: null,
        deliveredAt: null,
        openedAt: null,
        error: null,
        createdAt: now,
        updatedAt: now,
      };

      // 1. Channel opt-out preference check (IN_APP always on; P0 emergency bypasses opt-out)
      const channelEnabled =
        channel === Channel.IN_APP ||
        isEmergencyP0 ||
        Boolean((prefs.channels as Record<string, boolean>)[channel]);

      if (!channelEnabled) {
        job.status = 'suppressed';
        job.error = `Channel '${channel}' opted out by user preferences`;
        await this.repo.saveJob(job);
        jobs.push(job);
        continue;
      }

      // 2. Quiet hours in Asia/Dhaka (P0 emergency ALWAYS bypasses quiet hours!)
      if (quietActive && !isEmergencyP0 && channel !== Channel.IN_APP) {
        job.status = 'suppressed';
        job.error = 'Suppressed during user Asia/Dhaka quiet hours';
        await this.repo.saveJob(job);
        jobs.push(job);
        continue;
      }

      // 3. Render channel-specific body
      const chTpl = await this.repo.findTemplate(event.templateKey, channel, prefs.locale);
      const renderedSubject = renderTemplate(
        chTpl?.subject ?? (prefs.locale === 'en' ? titleEn : titleBn),
        event.variables,
      );
      const renderedBody = renderTemplate(
        chTpl?.body ?? (prefs.locale === 'en' ? bodyEn : bodyBn),
        event.variables,
      );

      // 4. SMS segment calculation & monthly per-user + global budget guard
      if (channel === Channel.SMS) {
        const analysis = analyzeSmsSegments(renderedBody);
        const [userUsed, globalUsed] = await Promise.all([
          this.repo.getUserSmsSegmentsThisMonth(event.userId, now),
          this.repo.getGlobalSmsSegmentsThisMonth(now),
        ]);

        if (
          !isEmergencyP0 &&
          (userUsed + analysis.segmentCount > this.smsBudget.perUserMonthlySegmentCap ||
            globalUsed + analysis.segmentCount > this.smsBudget.globalMonthlySegmentCap)
        ) {
          job.status = 'suppressed';
          job.error = 'SMS monthly budget cap exceeded';
          await this.repo.saveJob(job);
          jobs.push(job);
          continue;
        }
        job.segmentsUsed = analysis.segmentCount;
        job.estimatedCostBdt = analysis.estimatedCostBdt;
      }

      // 5. Send via ChannelPort with bounded retry -> DLQ
      const adapter = this.getChannelAdapter(channel);
      if (!adapter) {
        job.status = 'dlq';
        job.error = `No adapter registered for channel '${channel}'`;
        await this.repo.saveJob(job);
        jobs.push(job);
        continue;
      }

      let succeeded = false;
      for (let attempt = 1; attempt <= job.maxAttempts; attempt++) {
        job.attempts = attempt;
        job.status = 'sending';
        try {
          const result = await adapter.send({
            userId: event.userId,
            subject: renderedSubject,
            body: renderedBody,
            locale: prefs.locale,
            actionUrl: event.actionUrl,
            recipientAddress:
              channel === Channel.SMS
                ? (prefs.phoneE164 ?? undefined)
                : channel === Channel.EMAIL
                  ? (prefs.emailAddress ?? undefined)
                  : undefined,
          });
          job.providerMessageId = result.providerMessageId;
          job.sentAt = now;
          job.status = channel === Channel.IN_APP ? 'delivered' : 'sent';
          if (channel === Channel.IN_APP) {
            job.deliveredAt = now;
          }
          job.error = null;
          succeeded = true;
          break;
        } catch (err) {
          job.error = err instanceof Error ? err.message : 'Channel send failed';
        }
      }

      if (!succeeded) {
        job.status = 'dlq';
      }

      await this.repo.saveJob(job);
      jobs.push(job);

      if (channel === Channel.IN_APP && succeeded) {
        createdInbox = await this.repo.saveNotification({
          id: uuidv7(),
          userId: event.userId,
          titleBn,
          titleEn,
          bodyBn,
          bodyEn,
          category: event.category,
          priority: event.priority,
          actionUrl: event.actionUrl ?? null,
          payload: event.variables,
          readAt: null,
          createdAt: now,
        });
        this.stream$.next({ userId: event.userId, notification: createdInbox });
      }
    }

    return { notification: createdInbox, jobs };
  }

  /**
   * Fallback chain: if a P0/P1 push job was sent > fallbackAfterMinutes ago and never opened,
   * trigger an SMS fallback (subject to dedupe & budget guard).
   */
  async processUnopenedPushFallbacks(
    fallbackAfterMinutes = 5,
    now: Date = new Date(),
  ): Promise<number> {
    const sentJobs = await this.repo.listJobs({ status: 'sent' });
    let triggered = 0;

    for (const job of sentJobs) {
      const isPush = job.channel === Channel.WEB_PUSH || job.channel === Channel.MOBILE_PUSH;
      const isHighPriority = job.priority === 'P0' || job.priority === 'P1';
      if (!isPush || !isHighPriority || job.openedAt || !job.sentAt) continue;

      const elapsedMin = (now.getTime() - job.sentAt.getTime()) / 60_000;
      if (elapsedMin < fallbackAfterMinutes) continue;

      const res = await this.dispatch({
        userId: job.userId,
        sourceType: job.sourceType,
        sourceId: job.sourceId,
        templateKey: 'watch.matched',
        priority: job.priority,
        category: 'fallback',
        dedupeBaseKey: `fallback:${job.sourceType}:${job.sourceId}`,
        variables: { route: job.sourceType, date: now.toISOString().slice(0, 10), url: 'https://jonoshheba.app' },
        requestedChannels: [Channel.SMS],
        now,
      });
      if (res.jobs.some((j) => j.channel === Channel.SMS && j.status === 'sent')) {
        triggered += 1;
      }
    }
    return triggered;
  }

  /** Live SSE observable filtered strictly to the authenticated user */
  streamForUser(userId: string): Observable<{ data: NotificationRecord }> {
    return this.stream$.pipe(
      filter((evt) => evt.userId === userId),
      map((evt) => ({ data: evt.notification })),
    );
  }

  // --- Inbox, Preferences, Devices, Feedback, Test & Webhooks ---

  async listInbox(userId: string, cursor?: string, limit?: number) {
    const all = await this.repo.listNotificationsForUser(userId);
    const unreadCount = all.filter((n) => !n.readAt).length;
    const paged = paginateWithCursor(all, cursor, limit);
    return {
      ...paged,
      unreadCount,
    };
  }

  async markRead(userId: string, notificationId: string): Promise<NotificationRecord> {
    const item = await this.repo.findNotificationById(notificationId);
    if (!item) throw new NotFoundException('Notification not found');
    if (item.userId !== userId) {
      throw new ForbiddenException('Cannot access another citizen’s notification');
    }
    if (!item.readAt) {
      item.readAt = new Date();
      await this.repo.saveNotification(item);
    }
    return item;
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    return { updated: await this.repo.markAllRead(userId) };
  }

  async getPreferences(userId: string): Promise<NotificationPreferencesRecord> {
    return this.repo.getPreferences(userId);
  }

  async updatePreferences(
    userId: string,
    patch: Partial<NotificationPreferencesRecord>,
  ): Promise<NotificationPreferencesRecord> {
    const current = await this.repo.getPreferences(userId);
    const next: NotificationPreferencesRecord = {
      ...current,
      locale: patch.locale ?? current.locale,
      digestFrequency: patch.digestFrequency ?? current.digestFrequency,
      emailAddress: patch.emailAddress !== undefined ? patch.emailAddress : current.emailAddress,
      phoneE164: patch.phoneE164 !== undefined ? patch.phoneE164 : current.phoneE164,
      channels: patch.channels
        ? { ...current.channels, ...patch.channels, in_app: true } // in-app inbox always on
        : current.channels,
      quietHours: patch.quietHours ? { ...current.quietHours, ...patch.quietHours } : current.quietHours,
    };
    return this.repo.savePreferences(next);
  }

  async registerDevice(
    userId: string,
    dto: { platform: 'web' | 'ios' | 'android'; pushToken: string; deviceLabel?: string },
  ): Promise<RegisteredDeviceRecord> {
    const device: RegisteredDeviceRecord = {
      id: uuidv7(),
      userId,
      platform: dto.platform,
      pushToken: dto.pushToken,
      deviceLabel: dto.deviceLabel ?? null,
      createdAt: new Date(),
    };
    return this.repo.saveDevice(device);
  }

  async deleteDevice(userId: string, deviceId: string): Promise<{ deleted: true }> {
    const device = await this.repo.findDeviceById(deviceId);
    if (!device) throw new NotFoundException('Device not found');
    if (device.userId !== userId) {
      throw new ForbiddenException('Cannot remove another citizen’s device');
    }
    await this.repo.deleteDevice(deviceId);
    return { deleted: true };
  }

  async sendTestNotification(userId: string) {
    return this.dispatch({
      userId,
      sourceType: 'user_test',
      sourceId: uuidv7(),
      templateKey: 'notification.test',
      priority: 'P2',
      category: 'system_test',
      dedupeBaseKey: `test:${uuidv7()}`,
      variables: {},
      requestedChannels: [Channel.IN_APP, Channel.WEB_PUSH, Channel.MOBILE_PUSH],
    });
  }

  async submitFeedback(
    userId: string,
    notificationId: string,
    dto: { isUseful: boolean; reason?: string },
  ): Promise<NotificationFeedbackRecord> {
    const notif = await this.repo.findNotificationById(notificationId);
    if (!notif) throw new NotFoundException('Notification not found');
    if (notif.userId !== userId) {
      throw new ForbiddenException('Cannot submit feedback on another citizen’s notification');
    }
    return this.repo.saveFeedback({
      id: uuidv7(),
      notificationId,
      userId,
      isUseful: dto.isUseful,
      reason: dto.reason ?? null,
      createdAt: new Date(),
    });
  }

  /** Computes HMAC-SHA256 webhook signature for SMS DLR verification */
  signWebhookPayload(rawBody: string): string {
    return createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
  }

  /** Signature-verified SMS delivery receipt (DLR) webhook handler */
  async handleSmsDlrWebhook(params: {
    provider: string;
    signatureHeader: string | undefined;
    rawPayload: string;
    providerMessageId: string;
    status: 'delivered' | 'failed';
    error?: string;
    signatureAlreadyVerified?: boolean;
  }): Promise<{ updated: boolean; jobStatus?: string }> {
    if (!params.signatureAlreadyVerified) {
      if (!params.signatureHeader) {
        throw new UnauthorizedException('Missing webhook signature');
      }
      const expected = Buffer.from(this.signWebhookPayload(params.rawPayload), 'hex');
      const provided = Buffer.from(params.signatureHeader.trim(), 'hex');
      if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }

    const job = await this.repo.findJobByProviderMessageId(params.providerMessageId);
    if (!job) {
      return { updated: false };
    }
    if (params.status === 'delivered') {
      job.status = 'delivered';
      job.deliveredAt = new Date();
    } else {
      job.status = 'failed';
      job.error = params.error ?? `${params.provider} delivery failed`;
    }
    await this.repo.saveJob(job);
    return { updated: true, jobStatus: job.status };
  }

  async getDlqJobs(): Promise<NotificationJobRecord[]> {
    return this.repo.listJobs({ status: 'dlq' });
  }
}
