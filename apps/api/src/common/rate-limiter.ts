import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  windowSeconds: number;
  resetSeconds: number;
  retryAfterSeconds: number;
}

export interface RateLimiterPort {
  consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
  reset(key?: string): Promise<void>;
}

export const RATE_LIMITER_PORT = Symbol('RATE_LIMITER_PORT');

/**
 * Sliding-window rate limiter adapter.
 * Production deployments back this port with Redis ZSET/Lua sliding window;
 * this in-memory sliding-window adapter works identically in local dev & tests.
 */
@Injectable()
export class SlidingWindowRateLimiter implements RateLimiterPort {
  private readonly buckets = new Map<string, number[]>();

  async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const windowStart = now - windowMs;
    const timestamps = (this.buckets.get(key) ?? []).filter((ts) => ts > windowStart);

    if (timestamps.length >= limit) {
      const oldest = timestamps[0] ?? now;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      this.buckets.set(key, timestamps);
      return {
        allowed: false,
        limit,
        remaining: 0,
        windowSeconds,
        resetSeconds: retryAfterSeconds,
        retryAfterSeconds,
      };
    }

    timestamps.push(now);
    this.buckets.set(key, timestamps);
    const oldest = timestamps[0] ?? now;
    const resetSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - timestamps.length),
      windowSeconds,
      resetSeconds,
      retryAfterSeconds: 0,
    };
  }

  async reset(key?: string): Promise<void> {
    if (key) {
      this.buckets.delete(key);
    } else {
      this.buckets.clear();
    }
  }
}

export function buildBilingualRateLimitDetail(retryAfterSeconds: number, locale?: string): string {
  const bn = `অনুরোধের সীমা অতিক্রম করেছে। অনুগ্রহ করে ${retryAfterSeconds} সেকেন্ড পরে আবার চেষ্টা করুন।`;
  const en = `Too many requests. Please try again in ${retryAfterSeconds} seconds.`;
  if (locale?.toLowerCase().startsWith('en')) {
    return `${en} (${bn})`;
  }
  return `${bn} (${en})`;
}

export function throwRateLimitExceeded(
  retryAfterSeconds: number,
  detail?: string,
  locale?: string,
): never {
  throw new HttpException(
    {
      message: detail ?? buildBilingualRateLimitDetail(retryAfterSeconds, locale),
      retryAfterSeconds,
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}
