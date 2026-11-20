import { describe, expect, it } from 'vitest';
import { loadWebEnv } from './config/env';

describe('apps/web env validation', () => {
  it('defaults to Bangla locale and localhost API', () => {
    const env = loadWebEnv({});
    expect(env.NEXT_PUBLIC_DEFAULT_LOCALE).toBe('bn');
    expect(env.NEXT_PUBLIC_API_BASE_URL).toBe('http://localhost:4000');
  });

  it('rejects invalid API URL', () => {
    expect(() => loadWebEnv({ NEXT_PUBLIC_API_BASE_URL: 'invalid-url' })).toThrow();
  });
});
