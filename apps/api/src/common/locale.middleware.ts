import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export interface LocalizedRequest extends Request {
  locale?: 'bn' | 'en';
}

export function negotiateLocale(req: Pick<Request, 'query' | 'headers'>): 'bn' | 'en' {
  const queryLang = typeof req.query?.lang === 'string' ? req.query.lang.trim().toLowerCase() : '';
  if (queryLang === 'en' || queryLang.startsWith('en-')) return 'en';
  if (queryLang === 'bn' || queryLang.startsWith('bn-')) return 'bn';

  const accept = typeof req.headers['accept-language'] === 'string' ? req.headers['accept-language'] : '';
  if (accept) {
    const primary = accept.split(',')[0]?.trim().toLowerCase() ?? '';
    if (primary.startsWith('en')) return 'en';
    if (primary.startsWith('bn')) return 'bn';
  }
  return 'bn';
}

/**
 * Global locale negotiation middleware (Finding L2, Prompt F02):
 * Priority: ?lang=bn|en > Accept-Language > default bn.
 * Always emits Content-Language and Vary: Accept-Language headers.
 */
@Injectable()
export class LocaleMiddleware implements NestMiddleware {
  use(req: LocalizedRequest, res: Response, next: NextFunction): void {
    const locale = negotiateLocale(req);
    req.locale = locale;
    res.setHeader('Content-Language', locale);
    const existingVary = res.getHeader('Vary');
    if (typeof existingVary === 'string' && existingVary.length > 0) {
      if (!existingVary.toLowerCase().includes('accept-language')) {
        res.setHeader('Vary', `${existingVary}, Accept-Language`);
      }
    } else {
      res.setHeader('Vary', 'Accept-Language');
    }
    next();
  }
}
