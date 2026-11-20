import { describe, expect, it } from 'vitest';
import { loadWorkerEnv } from './config/env';

describe('apps/workers config validation', () => {
  it('loads default dev configuration', () => {
    const env = loadWorkerEnv({});
    expect(env.WORKER_CONCURRENCY).toBe(5);
    expect(env.APP_TIMEZONE).toBe('Asia/Dhaka');
  });

  it('rejects invalid concurrency bounds', () => {
    expect(() => loadWorkerEnv({ WORKER_CONCURRENCY: '0' })).toThrow();
    expect(() => loadWorkerEnv({ REDIS_URL: 'not-a-url' })).toThrow();
  });
});
