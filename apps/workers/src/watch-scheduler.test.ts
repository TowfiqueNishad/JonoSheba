import { describe, expect, it } from 'vitest';
import { buildRateLimitedFanInPlan } from './watch-scheduler';

describe('apps/workers Watch Fan-In Scheduler', () => {
  it('collapses many watches on the same route/date/class into ONE provider check and caps at rateLimitPerMin', () => {
    const now = Date.UTC(2026, 11, 19, 12, 0, 0);
    const future = now + 12 * 3_600_000;

    const plan = buildRateLimitedFanInPlan({
      nowMs: now,
      providerRateLimitsPerMin: { 'mock-rail': 2 },
      watches: [
        // 3 watches on identical key -> 1 check
        { id: 'w1', providerId: 'mock-rail', routeKey: 'DHK-CTG', journeyDate: '2026-12-20', seatClass: 'SNIGDHA', expiresAtMs: future },
        { id: 'w2', providerId: 'mock-rail', routeKey: 'DHK-CTG', journeyDate: '2026-12-20', seatClass: 'SNIGDHA', expiresAtMs: future },
        { id: 'w3', providerId: 'mock-rail', routeKey: 'DHK-CTG', journeyDate: '2026-12-20', seatClass: 'SNIGDHA', expiresAtMs: future },
        // 2 distinct keys -> 1 scheduled, 1 deferred due to rateLimit=2
        { id: 'w4', providerId: 'mock-rail', routeKey: 'DHK-RAJ', journeyDate: '2026-12-20', seatClass: 'S_CHAIR', expiresAtMs: future },
        { id: 'w5', providerId: 'mock-rail', routeKey: 'DHK-SYL', journeyDate: '2026-12-20', seatClass: 'S_CHAIR', expiresAtMs: future },
        // Expired watch
        { id: 'w6', providerId: 'mock-rail', routeKey: 'DHK-KHL', journeyDate: '2026-12-18', seatClass: 'S_CHAIR', expiresAtMs: now - 1000 },
      ],
    });

    expect(plan.expiredWatchIds).toEqual(['w6']);
    expect(plan.scheduled).toHaveLength(2);
    expect(plan.deferred).toHaveLength(1);
    expect(plan.scheduled[0]?.watchIds).toEqual(['w1', 'w2', 'w3']);
  });
});
