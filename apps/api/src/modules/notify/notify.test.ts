import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Channel } from '@jonoshheba/shared';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { ConsoleSmsAdapter } from '../identity/adapters/sms.adapters';
import {
  EmailChannelAdapter,
  InAppChannelAdapter,
  MobilePushChannelAdapter,
  SmsChannelAdapter,
  WebPushChannelAdapter,
} from './adapters/channel.adapters';
import { InMemoryNotifyRepository } from './adapters/in-memory-notify.repository';
import { NotifyService } from './application/notify.service';
import { isWithinDhakaQuietHours } from './domain/quiet-hours';
import { analyzeSmsSegments } from './domain/sms-segments';
import type { ChannelPort } from './ports/channel.port';

describe('Phase 06: Notification Platform (Channels, Quiet Hours, P0 Override, Dedupe, DLQ, SMS Budget, DLR)', () => {
  let repo: InMemoryNotifyRepository;
  let smsConsole: ConsoleSmsAdapter;
  let webPush: WebPushChannelAdapter;
  let mobilePush: MobilePushChannelAdapter;
  let email: EmailChannelAdapter;
  let notify: NotifyService;

  beforeEach(() => {
    repo = new InMemoryNotifyRepository();
    smsConsole = new ConsoleSmsAdapter();
    webPush = new WebPushChannelAdapter();
    mobilePush = new MobilePushChannelAdapter();
    email = new EmailChannelAdapter();
    notify = new NotifyService(repo, [
      new InAppChannelAdapter(),
      webPush,
      mobilePush,
      email,
      new SmsChannelAdapter(smsConsole),
    ]);
  });

  it('calculates Bangla UCS-2 (70/67 chars) vs English GSM-7 (160/153 chars) SMS segments accurately', () => {
    const english = analyzeSmsSegments('Jonoshheba: Possible seats DHK-CTG. Not reserved.');
    expect(english.encoding).toBe('GSM-7');
    expect(english.segmentCount).toBe(1);

    const shortBangla = analyzeSmsSegments('জনসেবা: ঢাকা-চট্টগ্রাম সম্ভাব্য আসন।');
    expect(shortBangla.encoding).toBe('UCS-2');
    expect(shortBangla.maxCharsSingleSegment).toBe(70);
    expect(shortBangla.segmentCount).toBe(1);

    const longBangla = analyzeSmsSegments('ক'.repeat(140));
    expect(longBangla.encoding).toBe('UCS-2');
    expect(longBangla.segmentCount).toBe(3); // ceil(140 / 67) = 3
    expect(longBangla.estimatedCostBdt).toBeGreaterThan(0);
  });

  it('respects channel opt-outs per user while always delivering in_app', async () => {
    await notify.updatePreferences('u1', {
      channels: { in_app: true, web_push: true, mobile_push: false, email: false, sms: false },
    });

    const res = await notify.dispatch({
      userId: 'u1',
      sourceType: 'watch',
      sourceId: 'w-1',
      templateKey: 'watch.matched',
      priority: 'P1',
      category: 'transport',
      dedupeBaseKey: 'watch:w-1:rel-1',
      variables: { route: 'Dhaka-CTG', date: '2026-12-20', url: 'https://eticket.railway.gov.bd' },
      requestedChannels: [Channel.IN_APP, Channel.WEB_PUSH, Channel.EMAIL, Channel.SMS],
    });

    expect(res.notification).not.toBeNull();
    expect(res.jobs.find((j) => j.channel === Channel.IN_APP)?.status).toBe('delivered');
    expect(res.jobs.find((j) => j.channel === Channel.WEB_PUSH)?.status).toBe('sent');
    expect(res.jobs.find((j) => j.channel === Channel.EMAIL)?.status).toBe('suppressed');
    expect(res.jobs.find((j) => j.channel === Channel.SMS)?.status).toBe('suppressed');
    expect(smsConsole.sentMessages).toHaveLength(0);
  });

  it('enforces Asia/Dhaka quiet hours for P1/P2 while P0 emergency ALWAYS bypasses quiet hours', async () => {
    // 18:30 UTC == 00:30 Asia/Dhaka (inside 23:00 -> 06:00 quiet hours)
    const dhakaMidnightThirty = new Date('2026-12-20T18:30:00Z');
    expect(
      isWithinDhakaQuietHours(dhakaMidnightThirty, { enabled: true, start: '23:00', end: '06:00' }),
    ).toBe(true);

    // 06:30 UTC == 12:30 Asia/Dhaka (outside quiet hours)
    expect(
      isWithinDhakaQuietHours(new Date('2026-12-20T06:30:00Z'), {
        enabled: true,
        start: '23:00',
        end: '06:00',
      }),
    ).toBe(false);

    await notify.updatePreferences('u-quiet', {
      channels: { in_app: true, web_push: true, mobile_push: true, email: false, sms: true },
      quietHours: { enabled: true, start: '23:00', end: '06:00', timezone: 'Asia/Dhaka' },
      phoneE164: '+8801712345678',
    });

    // P1 ticket alert during quiet hours -> external channels suppressed
    const p1 = await notify.dispatch({
      userId: 'u-quiet',
      sourceType: 'watch',
      sourceId: 'w-q1',
      templateKey: 'watch.matched',
      priority: 'P1',
      category: 'transport',
      dedupeBaseKey: 'quiet-p1',
      variables: { route: 'DHK-RAJ', date: '2026-12-21', url: 'https://eticket.railway.gov.bd' },
      requestedChannels: [Channel.WEB_PUSH, Channel.SMS],
      now: dhakaMidnightThirty,
    });
    expect(p1.jobs.find((j) => j.channel === Channel.WEB_PUSH)?.status).toBe('suppressed');
    expect(p1.jobs.find((j) => j.channel === Channel.SMS)?.status).toBe('suppressed');

    // P0 disaster alert during the EXACT same quiet-hour minute -> BYPASSES quiet hours!
    const p0 = await notify.dispatch({
      userId: 'u-quiet',
      sourceType: 'disaster',
      sourceId: 'alert-999',
      templateKey: 'emergency.disaster',
      priority: 'P0',
      category: 'emergency',
      dedupeBaseKey: 'quiet-p0',
      variables: { headline: 'উপকূলে মহাবিপদ সংকেত' },
      requestedChannels: [Channel.WEB_PUSH, Channel.SMS],
      now: dhakaMidnightThirty,
    });
    expect(p0.jobs.find((j) => j.channel === Channel.WEB_PUSH)?.status).toBe('sent');
    expect(p0.jobs.find((j) => j.channel === Channel.SMS)?.status).toBe('sent');
    expect(smsConsole.sentMessages).toHaveLength(1);
  });

  it('deduplicates identical dispatch keys so the citizen never gets duplicate alerts', async () => {
    const event = {
      userId: 'u-dedupe',
      sourceType: 'watch',
      sourceId: 'w-dup',
      templateKey: 'watch.matched',
      priority: 'P1' as const,
      category: 'transport',
      dedupeBaseKey: 'same-release-key',
      variables: { route: 'DHK-SYL', date: '2026-12-20', url: 'https://eticket.railway.gov.bd' },
      requestedChannels: [Channel.IN_APP, Channel.WEB_PUSH],
    };

    const first = await notify.dispatch(event);
    const second = await notify.dispatch(event);

    expect(first.jobs).toHaveLength(2);
    expect(second.jobs).toHaveLength(0);
    expect(webPush.delivered).toHaveLength(1);
  });

  it('retries failing channel adapter up to 3 attempts and routes exhausted jobs to DLQ', async () => {
    let attempts = 0;
    const failingEmailAdapter: ChannelPort = {
      channel: Channel.EMAIL,
      async send() {
        attempts += 1;
        throw new Error('SMTP connection refused');
      },
    };
    const svc = new NotifyService(repo, [new InAppChannelAdapter(), failingEmailAdapter]);
    await svc.updatePreferences('u-dlq', {
      channels: { in_app: true, web_push: false, mobile_push: false, email: true, sms: false },
      emailAddress: 'citizen@example.com',
    });

    const res = await svc.dispatch({
      userId: 'u-dlq',
      sourceType: 'deadline',
      sourceId: 'd-1',
      templateKey: 'deadline.reminder',
      priority: 'P2',
      category: 'scholarship',
      dedupeBaseKey: 'dlq-test-1',
      variables: { title: 'PMEAT Stipend', deadline: '2026-12-30' },
      requestedChannels: [Channel.EMAIL],
    });

    const emailJob = res.jobs.find((j) => j.channel === Channel.EMAIL);
    expect(attempts).toBe(3);
    expect(emailJob?.status).toBe('dlq');
    expect(emailJob?.attempts).toBe(3);
    expect(emailJob?.error).toContain('SMTP connection refused');
    expect(await svc.getDlqJobs()).toHaveLength(1);
  });

  it('enforces per-user and global monthly SMS budget caps', async () => {
    notify.smsBudget = { perUserMonthlySegmentCap: 2, globalMonthlySegmentCap: 3 };

    await notify.updatePreferences('u-cap', {
      channels: { in_app: true, web_push: false, mobile_push: false, email: false, sms: true },
      phoneE164: '+8801711111111',
      locale: 'en', // GSM-7 1 segment each
    });

    for (let i = 1; i <= 3; i++) {
      const res = await notify.dispatch({
        userId: 'u-cap',
        sourceType: 'watch',
        sourceId: `w-${i}`,
        templateKey: 'watch.matched',
        priority: 'P1',
        category: 'transport',
        dedupeBaseKey: `cap-key-${i}`,
        variables: { route: 'DHK-CTG', date: '2026-12-20', url: 'https://br.bd' },
        requestedChannels: [Channel.SMS],
      });
      const smsJob = res.jobs.find((j) => j.channel === Channel.SMS);
      if (i <= 2) {
        expect(smsJob?.status).toBe('sent');
      } else {
        // 3rd SMS exceeds perUserMonthlySegmentCap = 2
        expect(smsJob?.status).toBe('suppressed');
        expect(smsJob?.error).toContain('SMS monthly budget cap');
      }
    }
  });

  it('supports Push -> SMS fallback for unopened P1 alerts, live SSE stream, signed DLR webhooks & IDOR checks', async () => {
    await notify.updatePreferences('u-live', {
      channels: { in_app: true, web_push: true, mobile_push: false, email: false, sms: true },
      phoneE164: '+8801811111111',
      locale: 'en',
    });

    // Subscribe to live SSE stream before dispatching
    const ssePromise = firstValueFrom(notify.streamForUser('u-live'));

    const sentAt = new Date('2026-12-20T06:00:00Z');
    const dispatched = await notify.dispatch({
      userId: 'u-live',
      sourceType: 'watch',
      sourceId: 'w-fallback',
      templateKey: 'watch.matched',
      priority: 'P1',
      category: 'transport',
      dedupeBaseKey: 'fallback-initial',
      variables: { route: 'DHK-CTG', date: '2026-12-20', url: 'https://br.bd' },
      requestedChannels: [Channel.IN_APP, Channel.WEB_PUSH],
      now: sentAt,
    });

    const sseEvent = await ssePromise;
    expect(sseEvent.data.id).toBe(dispatched.notification?.id);

    // 10 minutes later, push still unopened -> fallback chain sends SMS!
    const fallbacks = await notify.processUnopenedPushFallbacks(
      5,
      new Date(sentAt.getTime() + 10 * 60_000),
    );
    expect(fallbacks).toBe(1);
    const smsMsgId = smsConsole.sentMessages[0]!.messageId;

    // Signed SMS DLR webhook: invalid signature rejected, valid signature updates job to delivered
    const rawBody = JSON.stringify({ providerMessageId: smsMsgId, status: 'delivered' });
    await expect(
      notify.handleSmsDlrWebhook({
        provider: 'sslwireless',
        signatureHeader: 'deadbeef',
        rawPayload: rawBody,
        providerMessageId: smsMsgId,
        status: 'delivered',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const validSig = notify.signWebhookPayload(rawBody);
    const dlrRes = await notify.handleSmsDlrWebhook({
      provider: 'sslwireless',
      signatureHeader: validSig,
      rawPayload: rawBody,
      providerMessageId: smsMsgId,
      status: 'delivered',
    });
    expect(dlrRes).toEqual({ updated: true, jobStatus: 'delivered' });

    // IDOR: another user cannot read, give feedback on, or delete u-live's resources
    const dev = await notify.registerDevice('u-live', {
      platform: 'android',
      pushToken: 'ExponentPushToken[abc123456]',
    });
    await expect(notify.markRead('u-attacker', dispatched.notification!.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      notify.submitFeedback('u-attacker', dispatched.notification!.id, { isUseful: false }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(notify.deleteDevice('u-attacker', dev.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
