import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { RATE_LIMITER_PORT, type RateLimiterPort, throwRateLimitExceeded } from './rate-limiter';

const DEFAULT_REPLAY_WINDOW_SECONDS = 300; // 5 minutes
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export function signWebhookRequest(
  timestampSec: number | string,
  rawPayload: string,
  secret: string,
): string {
  return createHmac('sha256', secret).update(`${timestampSec}.${rawPayload}`).digest('hex');
}

function normalizeIp(raw?: string): string {
  if (!raw) return '';
  const first = raw.split(',')[0]?.trim() ?? '';
  return first.startsWith('::ffff:') ? first.slice(7) : first;
}

/**
 * Inbound channel & provider webhook security guard (Finding S3):
 * 1. Optional IP allowlist (WEBHOOK_IP_ALLOWLIST)
 * 2. Timestamp + 5-minute replay window (X-Webhook-Timestamp / X-Provider-Timestamp)
 * 3. Per-provider HMAC-SHA256 signature verification (timingSafeEqual)
 * 4. Message-ID idempotency tracking (X-Webhook-Message-Id / Idempotency-Key / body.messageId)
 * 5. Per-number / per-sender rate limiting
 */
@Injectable()
export class WebhookSecurityGuard implements CanActivate {
  private readonly seenMessageIds = new Map<string, number>();

  constructor(
    @Inject(RATE_LIMITER_PORT)
    private readonly limiter: RateLimiterPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & {
        webhookDuplicate?: boolean;
        webhookMessageId?: string;
        params?: Record<string, string>;
      }
    >();

    // 1. IP allowlist check when configured
    const allowlistRaw = process.env.WEBHOOK_IP_ALLOWLIST ?? '';
    const allowlist = allowlistRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (allowlist.length > 0) {
      const forwarded =
        typeof req.headers['x-forwarded-for'] === 'string'
          ? req.headers['x-forwarded-for']
          : undefined;
      const clientIp = normalizeIp(forwarded ?? req.ip ?? req.socket?.remoteAddress);
      if (!allowlist.includes(clientIp)) {
        throw new ForbiddenException('Webhook caller IP is not in allowlist');
      }
    }

    // 2. Timestamp + replay window (5 min default)
    const tsHeader =
      (typeof req.headers['x-webhook-timestamp'] === 'string'
        ? req.headers['x-webhook-timestamp']
        : undefined) ??
      (typeof req.headers['x-provider-timestamp'] === 'string'
        ? req.headers['x-provider-timestamp']
        : undefined);

    if (!tsHeader) {
      throw new UnauthorizedException('Missing webhook timestamp header');
    }

    const parsedTs = Number(tsHeader.trim());
    const tsSeconds = Number.isFinite(parsedTs)
      ? parsedTs > 1e12
        ? Math.floor(parsedTs / 1000)
        : Math.floor(parsedTs)
      : Math.floor(Date.parse(tsHeader) / 1000);

    if (!Number.isFinite(tsSeconds)) {
      throw new UnauthorizedException('Invalid webhook timestamp');
    }

    const replayWindow = Number(
      process.env.WEBHOOK_REPLAY_WINDOW_SECONDS ?? DEFAULT_REPLAY_WINDOW_SECONDS,
    );
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - tsSeconds) > replayWindow) {
      throw new UnauthorizedException('Webhook timestamp outside 5-minute replay window');
    }

    // 3. Per-provider HMAC-SHA256 signature verification
    const sigHeader =
      (typeof req.headers['x-webhook-signature'] === 'string'
        ? req.headers['x-webhook-signature']
        : undefined) ??
      (typeof req.headers['x-provider-signature'] === 'string'
        ? req.headers['x-provider-signature']
        : undefined);

    if (!sigHeader) {
      throw new UnauthorizedException('Missing webhook HMAC signature');
    }

    const providerKey = (req.params?.provider ?? 'default').toUpperCase().replace(/[^A-Z0-9_]/g, '');
    const secret =
      process.env[`WEBHOOK_SECRET_${providerKey}`] ??
      process.env.WEBHOOK_HMAC_SECRET ??
      process.env.SMS_WEBHOOK_SECRET ??
      'dev_only_sms_dlr_webhook_hmac_secret';

    const rawBody =
      typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
    const cleanSig = sigHeader.trim().replace(/^sha256=/i, '');
    const expectedHex = signWebhookRequest(tsHeader.trim(), rawBody, secret);

    const expectedBuf = Buffer.from(expectedHex, 'hex');
    const providedBuf = Buffer.from(cleanSig, 'hex');
    if (
      expectedBuf.length === 0 ||
      expectedBuf.length !== providedBuf.length ||
      !timingSafeEqual(expectedBuf, providedBuf)
    ) {
      throw new UnauthorizedException('Invalid webhook HMAC signature');
    }

    // 4. Per-number / per-sender rate limit
    const bodyObj = (typeof req.body === 'object' && req.body !== null
      ? req.body
      : {}) as Record<string, unknown>;
    const senderKey =
      (typeof bodyObj.from === 'string' && bodyObj.from) ||
      (typeof bodyObj.From === 'string' && bodyObj.From) ||
      (typeof bodyObj.sessionId === 'string' && bodyObj.sessionId) ||
      (typeof bodyObj.providerMessageId === 'string' && `dlr:${req.params?.provider ?? 'sms'}`) ||
      normalizeIp(req.ip) ||
      'unknown';

    const rl = await this.limiter.consume(`webhook:${senderKey}`, 20, 60);
    if (!rl.allowed) {
      throwRateLimitExceeded(rl.retryAfterSeconds);
    }

    // 5. Idempotency on message ID
    const messageId =
      (typeof req.headers['x-webhook-message-id'] === 'string' &&
        req.headers['x-webhook-message-id'].trim()) ||
      (typeof req.headers['idempotency-key'] === 'string' &&
        req.headers['idempotency-key'].trim()) ||
      (typeof bodyObj.messageId === 'string' && bodyObj.messageId.trim()) ||
      (typeof bodyObj.providerMessageId === 'string' && bodyObj.providerMessageId.trim()) ||
      undefined;

    if (messageId) {
      this.pruneSeenIds();
      const dedupeKey = `${req.originalUrl.split('?')[0]}:${messageId}`;
      req.webhookMessageId = messageId;
      if (this.seenMessageIds.has(dedupeKey)) {
        req.webhookDuplicate = true;
      } else {
        this.seenMessageIds.set(dedupeKey, Date.now());
      }
    }

    return true;
  }

  private pruneSeenIds(): void {
    const cutoff = Date.now() - IDEMPOTENCY_TTL_MS;
    for (const [key, ts] of this.seenMessageIds) {
      if (ts < cutoff) {
        this.seenMessageIds.delete(key);
      }
    }
  }
}
