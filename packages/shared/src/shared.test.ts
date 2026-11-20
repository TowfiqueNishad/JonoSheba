import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CountryPackSchema } from './country-pack';
import { getDictionary } from './i18n';

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v as Record<string, unknown>, path));
    } else {
      keys.push(path);
    }
  }
  return keys.sort();
}

describe('Phase 18 — i18n parity & Country Pack schema validation', () => {
  it('ensures bn.json and en.json have identical keys (100% i18n parity)', () => {
    const bnKeys = flattenKeys(getDictionary('bn') as unknown as Record<string, unknown>);
    const enKeys = flattenKeys(getDictionary('en') as unknown as Record<string, unknown>);
    expect(bnKeys).toEqual(enKeys);
    expect(bnKeys.length).toBeGreaterThan(10);
  });

  it('validates Bangladesh (BD) and Nepal (NP) country pack files against CountryPackSchema', () => {
    const root = resolve(process.cwd(), '../..');
    for (const code of ['bd', 'np']) {
      const packPath = resolve(root, `data/country-packs/${code}/pack.json`);
      expect(existsSync(packPath)).toBe(true);
      const raw = JSON.parse(readFileSync(packPath, 'utf8'));
      const parsed = CountryPackSchema.parse(raw);
      expect(parsed.iso2.toLowerCase()).toBe(code);
      expect(parsed.hotlines.length).toBeGreaterThanOrEqual(1);
    }
  });
});
