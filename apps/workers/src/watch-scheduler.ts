/**
 * Watch Fan-In Scheduler (apps/workers)
 * Groups active watches by (providerId, routeKey, journeyDate, seatClass) so ONE check
 * serves MANY watches while strictly respecting per-provider rate limits and adaptive cadence.
 */

export interface SchedulableWatch {
  id: string;
  providerId: string;
  routeKey: string;
  journeyDate: string;
  seatClass: string;
  expiresAtMs: number;
}

export interface FanInCheckBatch {
  groupKey: string;
  providerId: string;
  routeKey: string;
  journeyDate: string;
  seatClass: string;
  watchIds: string[];
  recommendedIntervalMs: number;
}

export function buildRateLimitedFanInPlan(params: {
  watches: readonly SchedulableWatch[];
  providerRateLimitsPerMin: Readonly<Record<string, number>>;
  nowMs: number;
}): {
  scheduled: FanInCheckBatch[];
  deferred: FanInCheckBatch[];
  expiredWatchIds: string[];
} {
  const expiredWatchIds: string[] = [];
  const grouped = new Map<string, FanInCheckBatch>();

  for (const w of params.watches) {
    if (w.expiresAtMs <= params.nowMs) {
      expiredWatchIds.push(w.id);
      continue;
    }

    const cls = w.seatClass.toUpperCase();
    const groupKey = `${w.providerId}|${w.routeKey}|${w.journeyDate}|${cls}`;
    const hoursLeft = Math.max(0, (w.expiresAtMs - params.nowMs) / 3_600_000);
    const rateLimit = Math.max(1, params.providerRateLimitsPerMin[w.providerId] ?? 10);
    const baseMs = hoursLeft <= 6 ? 60_000 : hoursLeft <= 24 ? 180_000 : 300_000;
    const minIntervalMs = Math.ceil(60_000 / rateLimit);

    let batch = grouped.get(groupKey);
    if (!batch) {
      batch = {
        groupKey,
        providerId: w.providerId,
        routeKey: w.routeKey,
        journeyDate: w.journeyDate,
        seatClass: cls,
        watchIds: [],
        recommendedIntervalMs: Math.max(baseMs, minIntervalMs),
      };
      grouped.set(groupKey, batch);
    }
    batch.watchIds.push(w.id);
  }

  // Enforce per-provider rate limit budget for this 1-minute tick
  const usedPerProvider = new Map<string, number>();
  const scheduled: FanInCheckBatch[] = [];
  const deferred: FanInCheckBatch[] = [];

  for (const batch of grouped.values()) {
    const limit = Math.max(1, params.providerRateLimitsPerMin[batch.providerId] ?? 10);
    const used = usedPerProvider.get(batch.providerId) ?? 0;
    if (used < limit) {
      usedPerProvider.set(batch.providerId, used + 1);
      scheduled.push(batch);
    } else {
      deferred.push(batch);
    }
  }

  return { scheduled, deferred, expiredWatchIds };
}
