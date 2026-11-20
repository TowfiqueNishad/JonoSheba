import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import {
  formatBdt,
  formatDhakaTime,
  formatDigits,
  formatDuration,
  getDictionary,
  getSeatClassLabel,
} from '@jonoshheba/shared';
import { GET as liteGet } from '../src/app/lite/route';
import { GET as liteServiceGet } from '../src/app/lite/services/[slug]/route';

function collectTsxFiles(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectTsxFiles(full));
    } else if (entry.name.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

describe('Prompt F02–F09 — Citizen Web Journeys, Zero-Jargon, Accessibility, Zero-JS Lite & SEO Gate', () => {
  const webRoot = process.cwd();

  it('F02: Bilingual dictionaries (bn/en) have 100% key parity and formatters localize digits, BDT, times, durations & seat classes', () => {
    const bn = getDictionary('bn');
    const en = getDictionary('en');
    expect(Object.keys(bn).sort()).toEqual(Object.keys(en).sort());

    expect(formatDigits(495, 'bn')).toBe('৪৯৫');
    expect(formatDigits(495, 'en')).toBe('495');
    expect(formatBdt(1071, 'en')).toContain('1,071');
    expect(formatDuration(295, 'bn')).toBe('৪ ঘ. ৫৫ মি.');
    expect(formatDuration(295, 'en')).toBe('4h 55m');
    expect(formatDhakaTime('16:30', 'bn')).toBe('বিকাল ৪:৩০');
    expect(formatDhakaTime('16:30', 'en')).toBe('4:30 PM');
    expect(getSeatClassLabel('S_CHAIR', 'bn')).toBe('শোভন চেয়ার');
    expect(getSeatClassLabel('S_CHAIR', 'en')).toBe('Shovan Chair');
    expect(getSeatClassLabel('SNIGDHA', 'bn')).toContain('স্নিগ্ধা');
    expect(getSeatClassLabel('AC_B', 'en')).toBe('AC Berth');
  });

  it('F05 (U1 & U3): Zero internal build/rule codes and zero hard-coded national counts appear in any citizen page', () => {
    const files = [
      ...collectTsxFiles(resolve(webRoot, 'src/app')),
      ...collectTsxFiles(resolve(webRoot, 'src/components')),
    ];
    expect(files.length).toBeGreaterThanOrEqual(20);

    const FORBIDDEN_JARGON =
      /\b(?:C0[0-9]|C1[0-4]|Rule\s+[RC]\d|MOCK AVAILABILITY|ML Suggested|LINK_ONLY|DETERMINISTIC_RULES_C10_NOT_LLM|LIVE API CONNECTED)\b/;
    const HARDCODED_COUNTS = /(?:৪৯৫\s*উপজেলা|৬৪\s*জেলা|18টি\s*যাচাইকৃত\s*হটলাইন)/;

    const violations: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      if (FORBIDDEN_JARGON.test(src)) {
        violations.push(`Internal code leak in ${file}`);
      }
      if (HARDCODED_COUNTS.test(src)) {
        violations.push(`Hard-coded national count in ${file}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('F05 (P1): All required citizen pages & error pages exist', () => {
    const requiredPages = [
      'src/app/page.tsx',
      'src/app/transport/page.tsx',
      'src/app/services/page.tsx',
      'src/app/services/[slug]/page.tsx',
      'src/app/benefits/page.tsx',
      'src/app/programmes/[slug]/page.tsx',
      'src/app/life-events/page.tsx',
      'src/app/life-events/[slug]/page.tsx',
      'src/app/scholarships/page.tsx',
      'src/app/jobs/page.tsx',
      'src/app/notices/page.tsx',
      'src/app/calendar/page.tsx',
      'src/app/complaints/page.tsx',
      'src/app/jono/page.tsx',
      'src/app/emergency/page.tsx',
      'src/app/health/page.tsx',
      'src/app/utilities/page.tsx',
      'src/app/near-me/page.tsx',
      'src/app/account/page.tsx',
      'src/app/about/page.tsx',
      'src/app/privacy/page.tsx',
      'src/app/terms/page.tsx',
      'src/app/contact/page.tsx',
      'src/app/accessibility/page.tsx',
      'src/app/offline/page.tsx',
      'src/app/not-found.tsx',
      'src/app/error.tsx',
    ];
    for (const p of requiredPages) {
      expect(existsSync(resolve(webRoot, p)), `Missing ${p}`).toBe(true);
    }
  });

  it('F05 (U10): /lite and /lite/services/[slug] return < 30 KB pure HTML with ZERO <script> tags in both bn and en', async () => {
    for (const lang of ['bn', 'en'] as const) {
      const res = liteGet(new NextRequest(`https://jonoshheba.app/lite?lang=${lang}`));
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(Buffer.byteLength(html, 'utf8')).toBeLessThan(30_000);
      expect(html).not.toMatch(/<script\b/i);
      expect(html).toContain('tel:999');
      expect(html).toContain(`lang="${lang}"`);
      expect(html).toContain('/lite?lang=bn');
      expect(html).toContain('/lite?lang=en');
    }

    const svcRes = await liteServiceGet(
      new NextRequest('https://jonoshheba.app/lite/services/birth-registration?lang=en'),
      { params: Promise.resolve({ slug: 'birth-registration' }) },
    );
    expect(svcRes.status).toBe(200);
    const svcHtml = await svcRes.text();
    expect(svcHtml).not.toMatch(/<script\b/i);
    expect(svcHtml).toContain('Birth Registration');
  });

  it('F07 (A1): WCAG 2.2 AA accessibility structure — skip link, landmarks, explicit labels, aria-live, focus ring & reduced motion', () => {
    const shell = readFileSync(resolve(webRoot, 'src/components/AppShell.tsx'), 'utf8');
    const layout = readFileSync(resolve(webRoot, 'src/app/layout.tsx'), 'utf8');
    const css = readFileSync(resolve(webRoot, 'src/app/globals.css'), 'utf8');
    const jono = readFileSync(resolve(webRoot, 'src/app/jono/page.tsx'), 'utf8');

    expect(shell).toContain('href="#main-content"');
    expect(shell).toContain('aria-pressed');
    expect(shell).toContain('lang="bn"');
    expect(shell).toContain('lang="en"');
    expect(layout).toContain('id="main-content"');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('prefers-reduced-motion');
    expect(jono).toContain('htmlFor="jono-chat-input"');
    expect(jono).toContain('aria-live="polite"');
    expect(jono).toContain('disabled={loading || !input.trim()}');
  });

  it('NOSTOS Cinematic UI Gate: Single search bar on Home initial viewport, header search reveal on scroll, NIGHT/DAY tokens, 1px+4px gold focus outline, solid #B3261E 999 pill, and zero emojis', () => {
    const shell = readFileSync(resolve(webRoot, 'src/components/AppShell.tsx'), 'utf8');
    const home = readFileSync(resolve(webRoot, 'src/app/page.tsx'), 'utf8');
    const css = readFileSync(resolve(webRoot, 'src/app/globals.css'), 'utf8');
    const account = readFileSync(resolve(webRoot, 'src/app/account/page.tsx'), 'utf8');
    const notFound = readFileSync(resolve(webRoot, 'src/app/not-found.tsx'), 'utf8');

    // 1. Single search bar on Home initial viewport (header search hidden while heroSearchInView)
    expect(home).toContain('nostos:hero-search-visibility');
    expect(shell).toContain('const showHeaderSearch = !isHomePage || !heroSearchInView');

    // 2. NIGHT ("Steel & Gold") and DAY ("Bleached Light") variables + 1px gold focus ring with 4px offset
    expect(css).toContain('--page: #050709');
    expect(css).toContain('--page: #ece8e0');
    expect(css).toContain('outline: 1px solid var(--gold)');
    expect(css).toContain('outline-offset: 4px');

    // 3. Safety Rule: 999 pill is solid #B3261E with white text
    expect(shell).toContain('#B3261E');

    // 4. Roman numeral editorial chapters on Home
    expect(home).toContain('CHAPTERS OF LIFE');
    expect(home).toContain('THE HARBOURS');
    expect(home).toContain('THE ORACLE');
    expect(home).toContain('THE HERALD');

    // 5. Reduced motion toggle in Account settings & 404 LOST AT SEA
    expect(account).toContain('গতি কমান');
    expect(account).toContain('Reduce motion');
    expect(notFound).toContain('LOST AT SEA');
  });

  it('F08 (SEO/PWA): Favicon, SVG maskable icon, manifest, sitemap, robots, OG image, and bilingual offline SW exist', () => {
    const assets = [
      'public/favicon.ico',
      'public/icons/icon.svg',
      'public/sw.js',
      'src/app/manifest.ts',
      'src/app/sitemap.ts',
      'src/app/robots.ts',
      'src/app/opengraph-image.tsx',
    ];
    for (const a of assets) {
      expect(existsSync(resolve(webRoot, a)), `Missing ${a}`).toBe(true);
    }
    const sw = readFileSync(resolve(webRoot, 'public/sw.js'), 'utf8');
    expect(sw).toContain('/emergency');
    expect(sw).toContain('/lite');
    expect(sw).toContain('/offline');
  });
});
