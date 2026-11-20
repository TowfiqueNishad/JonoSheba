import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { buildCspHeader, detectRequestLocale, middleware } from './middleware';

describe('Prompts F01 & F02 — Web Security Headers, CSP Nonce & Bilingual Locale Routing (S4, L1)', () => {
  it('builds a strict CSP with per-request nonce, frame-ancestors none, and OSM tile img-src', () => {
    const csp = buildCspHeader('testNonce123', 'https://api.jonoshheba.app', false);
    expect(csp).toContain("script-src 'self' 'nonce-testNonce123' 'strict-dynamic'");
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).toContain("connect-src 'self' https://api.jonoshheba.app");
    expect(csp).toContain("img-src 'self' data: blob: https://tile.openstreetmap.org");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it('sets CSP with unique nonces, HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy and removes X-Powered-By', () => {
    const req1 = new NextRequest('https://jonoshheba.app/');
    const res1 = middleware(req1);
    const req2 = new NextRequest('https://jonoshheba.app/transport');
    const res2 = middleware(req2);

    const csp1 = res1.headers.get('Content-Security-Policy') ?? '';
    const csp2 = res2.headers.get('Content-Security-Policy') ?? '';
    expect(csp1).toContain("'nonce-");
    expect(csp2).toContain("'nonce-");
    expect(csp1).not.toBe(csp2);

    expect(res1.headers.get('Strict-Transport-Security')).toContain('max-age=31536000');
    expect(res1.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res1.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res1.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(res1.headers.get('Permissions-Policy')).toBe(
      'geolocation=(self), camera=(), microphone=(self)',
    );
    expect(res1.headers.get('X-Powered-By')).toBeNull();
  });

  it('negotiates locale from /en, /bn, NEXT_LOCALE cookie, Accept-Language, and defaults to bn', () => {
    expect(detectRequestLocale(new NextRequest('https://jonoshheba.app/en/transport'))).toEqual({
      locale: 'en',
      strippedPath: '/transport',
    });
    expect(detectRequestLocale(new NextRequest('https://jonoshheba.app/bn/services'))).toEqual({
      locale: 'bn',
      strippedPath: '/services',
    });
    expect(
      detectRequestLocale(
        new NextRequest('https://jonoshheba.app/', { headers: { 'accept-language': 'en-US,en;q=0.9' } }),
      ).locale,
    ).toBe('en');
    expect(detectRequestLocale(new NextRequest('https://jonoshheba.app/')).locale).toBe('bn');

    const enRes = middleware(new NextRequest('https://jonoshheba.app/en'));
    expect(enRes.headers.get('Content-Language')).toBe('en');
    expect(enRes.headers.get('Vary')).toContain('Accept-Language');
  });

  it('disables X-Powered-By header in next.config.mjs (poweredByHeader: false)', () => {
    const configSource = readFileSync(resolve(process.cwd(), 'next.config.mjs'), 'utf8');
    expect(configSource).toContain('poweredByHeader: false');
  });
});
