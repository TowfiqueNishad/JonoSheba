import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import type { Request, Response } from 'express';

/** Computes a weak ETag including locale for cacheable GET responses */
export function computeEtag(payload: unknown, locale: 'bn' | 'en' = 'bn'): string {
  const hash = createHash('sha256')
    .update(`${locale}:${JSON.stringify(payload)}`)
    .digest('base64url')
    .slice(0, 22);
  return `W/"${locale}-${hash}"`;
}

/** Applies ETag + Cache-Control headers (locale-aware) and returns true if 304 Not Modified was sent */
export function applyEtagAndCheckNotModified(
  req: Request & { locale?: 'bn' | 'en' },
  res: Response,
  payload: unknown,
  maxAgeSeconds = 60,
  staleWhileRevalidateSeconds = 300,
): boolean {
  const locale = req.locale ?? resolveLocale(req.headers['accept-language']);
  const etag = computeEtag(payload, locale);
  res.setHeader('ETag', etag);
  res.setHeader(
    'Cache-Control',
    `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`,
  );
  const ifNoneMatch = req.headers['if-none-match'];
  if (typeof ifNoneMatch === 'string' && ifNoneMatch.trim() === etag) {
    res.status(304);
    return true;
  }
  return false;
}

/** Projects only requested top-level fields (`?fields=slug,title,trustLabel`) for low-bandwidth clients */
export function projectFields<T extends Record<string, unknown>>(
  item: T,
  fieldsParam?: string,
): Partial<T> {
  if (!fieldsParam || !fieldsParam.trim()) return item;
  const requested = fieldsParam
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);
  if (requested.length === 0) return item;
  const out: Record<string, unknown> = {};
  for (const field of requested) {
    if (field in item) {
      out[field] = item[field];
    }
  }
  return out as Partial<T>;
}

/** Resolves Accept-Language header or query lang to bn (default) or en */
export function resolveLocale(acceptLanguage?: string, queryLang?: string): 'bn' | 'en' {
  if (queryLang) {
    const q = queryLang.trim().toLowerCase();
    if (q === 'en' || q.startsWith('en-')) return 'en';
    if (q === 'bn' || q.startsWith('bn-')) return 'bn';
  }
  if (!acceptLanguage) return 'bn';
  return acceptLanguage.toLowerCase().startsWith('en') ? 'en' : 'bn';
}

/** Strict pagination limit parser (Finding V1: integer 1..100, else 400 — never silently clamps bad strings) */
export function parseStrictLimit(
  raw: string | undefined,
  defaultLimit = 20,
  maxLimit = 100,
): number {
  if (raw === undefined || raw === '') return defaultLimit;
  if (!/^\d+$/.test(raw.trim())) {
    throw new BadRequestException({
      code: 'INVALID_LIMIT',
      messageBn: `limit অবশ্যই ১ থেকে ${maxLimit}-এর মধ্যে পূর্ণসংখ্যা হতে হবে।`,
      messageEn: `Query parameter 'limit' must be an integer between 1 and ${maxLimit}.`,
      errors: [{ field: 'limit', message: `Expected integer 1-${maxLimit}, got '${raw}'` }],
    });
  }
  const n = Number.parseInt(raw.trim(), 10);
  if (n < 1 || n > maxLimit) {
    throw new BadRequestException({
      code: 'LIMIT_OUT_OF_RANGE',
      messageBn: `limit অবশ্যই ১ থেকে ${maxLimit}-এর মধ্যে হতে হবে।`,
      messageEn: `Query parameter 'limit' must be between 1 and ${maxLimit} (received ${n}).`,
      errors: [{ field: 'limit', message: `Must be between 1 and ${maxLimit}` }],
    });
  }
  return n;
}

/** Cursor pagination helper (base64url offset cursor) */
export function paginateWithCursor<T>(
  items: readonly T[],
  cursor?: string,
  limitRaw?: number,
): {
  items: T[];
  page: { nextCursor: string | null; hasMore: boolean; limit: number; total: number };
} {
  const limit = Math.min(Math.max(Number(limitRaw) || 20, 1), 100);
  let offset = 0;
  if (cursor) {
    try {
      const decoded = Number(Buffer.from(cursor, 'base64url').toString('utf8'));
      if (Number.isInteger(decoded) && decoded >= 0) offset = decoded;
    } catch {
      offset = 0;
    }
  }

  const slice = items.slice(offset, offset + limit);
  const nextOffset = offset + slice.length;
  const hasMore = nextOffset < items.length;
  return {
    items: slice,
    page: {
      nextCursor: hasMore ? Buffer.from(String(nextOffset), 'utf8').toString('base64url') : null,
      hasMore,
      limit,
      total: items.length,
    },
  };
}

/** Great-circle Haversine distance in kilometers */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
