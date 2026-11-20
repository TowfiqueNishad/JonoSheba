import { describe, expect, it } from 'vitest';
import { loadAdminEnv } from './config/env';

describe('apps/admin env validation', () => {
  it('loads default admin API URL', () => {
    const env = loadAdminEnv({});
    expect(env.NEXT_PUBLIC_ADMIN_API_BASE_URL).toBe('http://localhost:4000');
  });
});
