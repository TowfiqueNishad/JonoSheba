import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { type Observable, map } from 'rxjs';
import type { LocalizedRequest } from './locale.middleware';

const BILINGUAL_PAIRS: ReadonlyArray<{ base: string; bn: string; en: string }> = [
  { base: 'title', bn: 'titleBn', en: 'titleEn' },
  { base: 'name', bn: 'nameBn', en: 'nameEn' },
  { base: 'summary', bn: 'summaryBn', en: 'summaryEn' },
  { base: 'reason', bn: 'reasonBn', en: 'reasonEn' },
  { base: 'note', bn: 'noteBn', en: 'noteEn' },
];

const SUNSET_HTTP_DATE = 'Sat, 20 Nov 2027 00:00:00 GMT';

function projectLocalizedValue(
  value: unknown,
  locale: 'bn' | 'en',
  includeI18n: boolean,
  depth = 0,
): unknown {
  if (depth > 6 || value === null || value === undefined || typeof value !== 'object') {
    return value;
  }
  if (value instanceof Date) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => projectLocalizedValue(item, locale, includeI18n, depth + 1));
  }

  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    out[k] = projectLocalizedValue(v, locale, includeI18n, depth + 1);
  }

  let translationMissing = false;
  const i18nBn: Record<string, unknown> = {};
  const i18nEn: Record<string, unknown> = {};
  let hasBilingualField = false;

  for (const pair of BILINGUAL_PAIRS) {
    const hasBn = pair.bn in out && typeof out[pair.bn] === 'string' && String(out[pair.bn]).trim().length > 0;
    const hasEn = pair.en in out && typeof out[pair.en] === 'string' && String(out[pair.en]).trim().length > 0;
    if (!hasBn && !hasEn) continue;

    hasBilingualField = true;
    if (hasBn) i18nBn[pair.base] = out[pair.bn];
    if (hasEn) i18nEn[pair.base] = out[pair.en];

    if (locale === 'en') {
      if (hasEn) {
        out[pair.base] = out[pair.en];
      } else {
        out[pair.base] = out[pair.bn];
        translationMissing = true;
      }
    } else {
      if (hasBn) {
        out[pair.base] = out[pair.bn];
      } else {
        out[pair.base] = out[pair.en];
        translationMissing = true;
      }
    }
  }

  if (hasBilingualField && includeI18n) {
    out.i18n = { bn: i18nBn, en: i18nEn };
  }
  if (translationMissing) {
    out.translationMissing = true;
  }

  return out;
}

/**
 * Projects consistent localized display fields (title/name/summary/reason/note)
 * across every JSON response according to negotiated locale (Finding L2),
 * and emits Deprecation + Sunset headers on legacy aliased routes (Finding O1).
 */
@Injectable()
export class LocaleProjectionInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest<LocalizedRequest>();
    const res = http.getResponse<Response>();
    const locale = req.locale ?? 'bn';
    const path = (req.originalUrl ?? req.url ?? '').split('?')[0] ?? '';

    // Route hygiene deprecation headers (Finding O1)
    if (/^\/api\/v1\/programs(\/|$)/.test(path)) {
      res.setHeader('Deprecation', 'true');
      res.setHeader('Sunset', SUNSET_HTTP_DATE);
      res.setHeader('Link', '</api/v1/programmes>; rel="successor-version"');
    } else if (/^\/api\/v1\/chat(\/|$)/.test(path)) {
      res.setHeader('Deprecation', 'true');
      res.setHeader('Sunset', SUNSET_HTTP_DATE);
      res.setHeader('Link', '</api/v1/assistant>; rel="successor-version"');
    }

    const includeParam = typeof req.query?.include === 'string' ? req.query.include : '';
    const includeI18n = includeParam
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .includes('i18n');

    return next.handle().pipe(
      map((data) => {
        // Skip binary/text/SSE/OpenAPI payloads
        if (
          typeof data !== 'object' ||
          data === null ||
          path === '/api/v1/openapi.json' ||
          path.endsWith('/stream')
        ) {
          return data;
        }
        return projectLocalizedValue(data, locale, includeI18n);
      }),
    );
  }
}
