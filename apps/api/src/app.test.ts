import { describe, expect, it } from 'vitest';
import { loadApiEnv } from './config/env';
import { HealthController } from './health/health.controller';

describe('apps/api boot config & health', () => {
  it('loads valid default development configuration', () => {
    const env = loadApiEnv({ NODE_ENV: 'development' });
    expect(env.API_PORT).toBe(4000);
    expect(env.APP_TIMEZONE).toBe('Asia/Dhaka');
  });

  it('fails fast when secrets are too short or production uses dev defaults', () => {
    expect(() => loadApiEnv({ JWT_ACCESS_SECRET: 'too_short' })).toThrow();
    expect(() => loadApiEnv({ NODE_ENV: 'production' })).toThrow(/Production boot refused/);
  });

  it('returns status ok on health endpoints', () => {
    const controller = new HealthController();
    const res = controller.getRootHealth();
    expect(res.status).toBe('ok');
    expect(res.service).toBe('jonoshheba-api');
    expect(res.timezone).toBe('Asia/Dhaka');
  });
});
