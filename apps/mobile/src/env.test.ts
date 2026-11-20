import { describe, expect, it } from 'vitest';
import { loadMobileEnv } from './config/env';
import { BUNDLED_EMERGENCY_HOTLINES } from './emergency-bundle';

describe('apps/mobile foundation', () => {
  it('validates mobile env config with bn default', () => {
    const env = loadMobileEnv({});
    expect(env.EXPO_PUBLIC_DEFAULT_LOCALE).toBe('bn');
  });

  it('bundles offline 999 emergency tap-to-call fallback (R8)', () => {
    const nineNineNine = BUNDLED_EMERGENCY_HOTLINES.find((h) => h.number === '999');
    expect(nineNineNine?.telUri).toBe('tel:999');
  });
});
