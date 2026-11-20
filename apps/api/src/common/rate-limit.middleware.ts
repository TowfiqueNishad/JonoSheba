import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import {
  buildBilingualRateLimitDetail,
  RATE_LIMITER_PORT,
  type RateLimiterPort,
} from './rate-limiter';

export interface RateLimitPolicy {
  bucket: string;
  limit: number;
  windowSeconds: number;
}

export function resolveRateLimitPolicy(path: string, method: string): RateLimitPolicy {
  const clean = path.split('?')[0] ?? path;
  if (clean.startsWith('/api/v1/auth/otp/')) {
    return { bucket: 'auth-otp', limit: 5, windowSeconds: 60 };
  }
  if (clean.startsWith('/api/v1/auth/')) {
    return { bucket: 'auth-general', limit: 20, windowSeconds: 60 };
  }
  if (clean.startsWith('/api/v1/chat/') || clean.startsWith('/api/v1/assistant/')) {
    return { bucket: 'chat', limit: 20, windowSeconds: 60 };
  }
  if (
    clean.startsWith('/api/v1/eligibility/') ||
    /^\/api\/v1\/programmes\/[^/]+\/eligibility$/.test(clean)
  ) {
    return { bucket: 'eligibility', limit: 30, windowSeconds: 60 };
  }
  if (clean.startsWith('/api/v1/search') || clean.startsWith('/api/v1/geo/search')) {
    return { bucket: 'search', limit: 60, windowSeconds: 60 };
  }
  if (method !== 'GET' && method !== 'HEAD') {
    return { bucket: 'public-write', limit: 40, windowSeconds: 60 };
  }
  return { bucket: 'public-read', limit: 120, windowSeconds: 60 };
}

/**
 * Global sliding-window rate limiter emitting IETF draft RateLimit-* headers
 * and RFC 9457 bilingual 429 problem+json responses on all /api/v1/* routes (Finding S5).
 */
@Injectable()
export class GlobalRateLimitMiddleware implements NestMiddleware {
  constructor(
    @Inject(RATE_LIMITER_PORT)
    private readonly limiter: RateLimiterPort,
  ) {}

  async use(
    req: Request & { requestId?: string },
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const path = req.originalUrl || req.url;
    if (!path.startsWith('/api/v1/')) {
      next();
      return;
    }

    const policy = resolveRateLimitPolicy(path, req.method);
    const multiplierRaw = Number(process.env.RATE_LIMIT_TEST_MULTIPLIER ?? 1);
    const multiplier = Number.isFinite(multiplierRaw) && multiplierRaw > 0 ? multiplierRaw : 1;
    const effectiveLimit = Math.max(1, Math.floor(policy.limit * multiplier));

    const ip =
      (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
        : undefined) ??
      req.ip ??
      '127.0.0.1';
    const sessionToken =
      typeof req.headers['x-session-token'] === 'string' && req.headers['x-session-token'].trim()
        ? req.headers['x-session-token'].trim().slice(0, 48)
        : undefined;
    const deviceId =
      typeof req.headers['x-device-id'] === 'string' && req.headers['x-device-id'].trim()
        ? req.headers['x-device-id'].trim().slice(0, 64)
        : 'anon';

    const actorKey =
      policy.bucket === 'chat' && sessionToken ? `sess:${sessionToken}` : `${ip}:${deviceId}`;
    const key = `rl:${policy.bucket}:${actorKey}`;
    const result = await this.limiter.consume(key, effectiveLimit, policy.windowSeconds);

    res.setHeader('RateLimit-Limit', String(result.limit));
    res.setHeader('RateLimit-Remaining', String(result.remaining));
    res.setHeader('RateLimit-Reset', String(result.resetSeconds));
    res.setHeader('RateLimit-Policy', `${result.limit};w=${result.windowSeconds}`);

    if (!result.allowed) {
      res.setHeader('Retry-After', String(result.retryAfterSeconds));
      const acceptLang =
        typeof req.headers['accept-language'] === 'string' ? req.headers['accept-language'] : 'bn';
      const detail = buildBilingualRateLimitDetail(result.retryAfterSeconds, acceptLang);
      res
        .status(429)
        .type('application/problem+json')
        .json({
          type: 'https://jonoshheba.app/errors/http-429',
          title: 'Too Many Requests',
          status: 429,
          detail,
          instance: path,
          requestId: req.requestId,
        });
      return;
    }

    next();
  }
}
