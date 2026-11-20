import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { AvailabilityState, WatchStatus } from '@jonoshheba/shared';
import { uuidv7 } from '../../../common/uuidv7';
import { getBangladeshDemandHint, shiftDhakaDate } from '../domain/dhaka-time';
import { TokenBucketRateLimiter } from '../domain/resilience';
import type {
  AvailabilityCheckKey,
  AvailabilityObservation,
  TicketWatchRecord,
  WatchMatchedEvent,
} from '../domain/transport.types';
import { isWatchPollable, transitionWatchStatus } from '../domain/watch-state-machine';
import {
  TRANSPORT_PROVIDERS_PORT,
  type TransportProviderAdapter,
} from '../ports/provider.port';
import {
  TRANSPORT_REPOSITORY_PORT,
  type TransportRepositoryPort,
} from '../ports/transport.repository.port';

const MAX_FRESHNESS_MS = 5 * 60 * 1000;
const CONSECUTIVE_ERROR_THRESHOLD = 3;

export interface PollCycleSummary {
  expiredWatches: number;
  groupsEvaluated: number;
  groupsDeferredByRateLimit: number;
  providerChecksExecuted: number;
  snapshotsRecorded: number;
  alertsEmitted: number;
}

interface FanInGroup {
  groupKey: string;
  checkKey: AvailabilityCheckKey;
  watches: TicketWatchRecord[];
}

interface RouteTransitionTracker {
  lastState: AvailabilityState | null;
  transitionCounter: number;
}

/**
 * Computes adaptive poll interval in ms respecting departure proximity, demand, and provider limit.
 */
export function computeAdaptivePollIntervalMs(params: {
  hoursToDeparture: number;
  journeyDate: string;
  providerRateLimitPerMin: number;
  jitterRatio?: number; // [0, 0.2]
}): number {
  let baseMs = 900_000; // >72h -> 15 min
  if (params.hoursToDeparture <= 6) {
    baseMs = 60_000; // <6h -> 1 min
  } else if (params.hoursToDeparture <= 24) {
    baseMs = 180_000; // <24h -> 3 min
  } else if (params.hoursToDeparture <= 72) {
    baseMs = 300_000; // <72h -> 5 min
  }

  const demand = getBangladeshDemandHint(params.journeyDate);
  if (demand.level === 'high') {
    baseMs = Math.round(baseMs * 0.75);
  }

  const minAllowedMs = Math.ceil(60_000 / Math.max(1, params.providerRateLimitPerMin));
  const clamped = Math.max(baseMs, minAllowedMs);
  const jitter = Math.min(Math.max(params.jitterRatio ?? 0.1, 0), 0.25);
  return Math.round(clamped * (1 + jitter));
}

@Injectable()
export class WatchEngineService {
  private readonly providerBuckets = new Map<string, TokenBucketRateLimiter>();
  private readonly transitionState = new Map<string, RouteTransitionTracker>();

  constructor(
    @Inject(TRANSPORT_REPOSITORY_PORT)
    private readonly repo: TransportRepositoryPort,
    @Inject(TRANSPORT_PROVIDERS_PORT)
    private readonly providers: TransportProviderAdapter[],
  ) {}

  private getProvider(providerId: string): TransportProviderAdapter | undefined {
    return this.providers.find((p) => p.id === providerId);
  }

  private getBucket(provider: TransportProviderAdapter, nowMs: number): TokenBucketRateLimiter {
    let bucket = this.providerBuckets.get(provider.id);
    if (!bucket) {
      bucket = new TokenBucketRateLimiter(provider.rateLimitPerMin, nowMs);
      this.providerBuckets.set(provider.id, bucket);
    }
    return bucket;
  }

  /** Resets in-memory rate-limit buckets & transition trackers (useful between isolated tests) */
  resetEngineState(): void {
    this.providerBuckets.clear();
    this.transitionState.clear();
  }

  /**
   * Tracks state transitions per (provider, routeKey, date, seatClass).
   * Repeated AVAILABLE observations in the same release keep the exact same transitionId,
   * guaranteeing dedupeKey suppresses duplicate alerts.
   */
  private resolveTransitionId(groupKey: string, currentState: AvailabilityState): number {
    const tracker = this.transitionState.get(groupKey) ?? {
      lastState: null,
      transitionCounter: 0,
    };
    const isMatchable =
      currentState === AvailabilityState.AVAILABLE || currentState === AvailabilityState.LIMITED;
    const wasMatchable =
      tracker.lastState === AvailabilityState.AVAILABLE ||
      tracker.lastState === AvailabilityState.LIMITED;

    if (isMatchable && !wasMatchable) {
      tracker.transitionCounter += 1;
    }
    tracker.lastState = currentState;
    this.transitionState.set(groupKey, tracker);
    return tracker.transitionCounter;
  }

  private buildDedupeKey(
    watchId: string,
    obs: AvailabilityObservation,
    transitionId: number,
  ): string {
    return createHash('sha256')
      .update(
        `${watchId}|${obs.providerId}|${obs.routeKey}|${obs.journeyDate}|${obs.seatClass}|${transitionId}`,
      )
      .digest('hex');
  }

  /** Groups active watches by (provider, routeKey, journeyDate, seatClass) for fan-in polling */
  buildFanInGroups(watches: readonly TicketWatchRecord[]): FanInGroup[] {
    const groups = new Map<string, FanInGroup>();

    for (const watch of watches) {
      if (!isWatchPollable(watch.status)) continue;
      const seatClass = (watch.preferences.seatClass ?? 'S_CHAIR').toUpperCase();
      const altRange = Math.min(Math.max(watch.flexibility.altDatesDays ?? 0, 0), 3);

      const candidateDates = [watch.journeyDate];
      for (let d = 1; d <= altRange; d++) {
        candidateDates.push(shiftDhakaDate(watch.journeyDate, -d));
        candidateDates.push(shiftDhakaDate(watch.journeyDate, d));
      }

      for (const dateStr of candidateDates) {
        const groupKey = `${watch.providerId}|${watch.routeKey}|${dateStr}|${seatClass}`;
        let group = groups.get(groupKey);
        if (!group) {
          group = {
            groupKey,
            checkKey: {
              providerId: watch.providerId,
              mode: watch.mode,
              routeKey: watch.routeKey,
              originCode: watch.originCode,
              destinationCode: watch.destinationCode,
              journeyDate: dateStr,
              seatClass,
            },
            watches: [],
          };
          groups.set(groupKey, group);
        }
        group.watches.push(watch);
      }
    }

    return [...groups.values()];
  }

  /** Executes one fan-in watch polling & matching cycle */
  async runPollCycle(now: Date = new Date()): Promise<PollCycleSummary> {
    const summary: PollCycleSummary = {
      expiredWatches: 0,
      groupsEvaluated: 0,
      groupsDeferredByRateLimit: 0,
      providerChecksExecuted: 0,
      snapshotsRecorded: 0,
      alertsEmitted: 0,
    };

    const allActive = await this.repo.listActiveWatches();
    const stillPollable: TicketWatchRecord[] = [];

    // 1. Auto-expire watches past departure time (Asia/Dhaka UTC boundary)
    for (const w of allActive) {
      if (w.expiresAt.getTime() <= now.getTime()) {
        w.status = transitionWatchStatus(w.status, 'expire');
        await this.repo.updateWatch(w);
        summary.expiredWatches += 1;
      } else {
        stillPollable.push(w);
      }
    }

    // 2. Fan-in grouping
    const groups = this.buildFanInGroups(stillPollable);
    summary.groupsEvaluated = groups.length;

    for (const group of groups) {
      const provider = this.getProvider(group.checkKey.providerId);
      if (!provider || !provider.capabilities.availability) continue;

      // Enforce per-provider token bucket strictly (Rule R2)
      const bucket = this.getBucket(provider, now.getTime());
      if (!bucket.tryAcquire(1, now.getTime())) {
        summary.groupsDeferredByRateLimit += 1;
        continue;
      }

      // ONE provider call serves ALL watches in this group
      const obs = await provider.checkAvailability(group.checkKey);
      summary.providerChecksExecuted += 1;

      // Always record inventory snapshot (including errors & stale data)
      const snapshot = await this.repo.saveSnapshot({
        id: uuidv7(),
        providerId: obs.providerId,
        routeKey: obs.routeKey,
        journeyDate: obs.journeyDate,
        seatClass: obs.seatClass,
        checkedAt: obs.checkedAt,
        state: obs.state,
        seatsAvailable: obs.seatsAvailable,
        fareBdt: obs.fareBdt,
        sourceRef: obs.sourceRef,
        responseStatus: obs.responseStatus,
        rawHash: obs.rawHash,
      });
      summary.snapshotsRecorded += 1;

      const transitionId = this.resolveTransitionId(group.groupKey, obs.state);
      const isFresh = obs.checkedAt.getTime() - obs.observedAt.getTime() <= MAX_FRESHNESS_MS;

      for (const watch of group.watches) {
        watch.lastCheckedAt = obs.checkedAt;

        // Provider error -> never alert, increment consecutive errors, transition after K errors
        if (obs.state === AvailabilityState.PROVIDER_ERROR) {
          watch.consecutiveErrors += 1;
          if (
            watch.consecutiveErrors >= CONSECUTIVE_ERROR_THRESHOLD &&
            watch.status === WatchStatus.ACTIVE
          ) {
            watch.status = transitionWatchStatus(watch.status, 'error_threshold');
          }
          await this.repo.updateWatch(watch);
          continue;
        }

        // Healthy or non-error observation resets error counter
        watch.consecutiveErrors = 0;

        // Stale, unknown, or sold out -> never alert!
        if (
          !isFresh ||
          obs.state === AvailabilityState.UNKNOWN_STALE ||
          obs.state === AvailabilityState.SOLD_OUT ||
          obs.seatsAvailable === null ||
          obs.seatsAvailable <= 0
        ) {
          await this.repo.updateWatch(watch);
          continue;
        }

        // Fare ceiling filter
        if (
          watch.flexibility.maxFareBdt !== undefined &&
          obs.fareBdt !== null &&
          obs.fareBdt > watch.flexibility.maxFareBdt
        ) {
          await this.repo.updateWatch(watch);
          continue;
        }

        // Exact vs Partial match evaluation
        const exactDate = obs.journeyDate === watch.journeyDate;
        const exactSeats = obs.seatsAvailable >= watch.passengers;
        const matchQuality: 'exact' | 'partial' = exactDate && exactSeats ? 'exact' : 'partial';
        const effectiveState: AvailabilityState =
          matchQuality === 'partial' ? AvailabilityState.LIMITED : obs.state;

        const dedupeKey = this.buildDedupeKey(watch.id, obs, transitionId);
        const existingMatch = await this.repo.findMatchByDedupeKey(dedupeKey);
        if (existingMatch) {
          // Repeated observation of the same release -> suppress duplicate alert!
          await this.repo.updateWatch(watch);
          continue;
        }

        const explanationBn =
          matchQuality === 'exact'
            ? `${obs.journeyDate} তারিখে ${obs.seatClass} শ্রেণিতে সম্ভাব্য ${obs.seatsAvailable}টি আসন দেখা গেছে।`
            : `আংশিক মিল (${obs.journeyDate}, সম্ভাব্য ${obs.seatsAvailable}টি আসন — আপনার চাহিদা ${watch.passengers} জন)।`;
        const explanationEn =
          matchQuality === 'exact'
            ? `Possible availability (${obs.seatsAvailable} seats) detected for ${obs.journeyDate} (${obs.seatClass}).`
            : `Partial match (${obs.journeyDate}, ${obs.seatsAvailable} possible seats vs ${watch.passengers} requested).`;

        const bookingUrl = provider
          .bookingDeepLink({
            originCode: watch.originCode,
            destinationCode: watch.destinationCode,
            journeyDate: obs.journeyDate,
          })
          .toString();

        await this.repo.saveMatch({
          id: uuidv7(),
          watchId: watch.id,
          snapshotId: snapshot.id,
          matchQuality,
          explanationBn,
          explanationEn,
          dedupeKey,
          notifiedAt: now,
          createdAt: now,
        });

        if (watch.status === WatchStatus.ACTIVE) {
          watch.status = transitionWatchStatus(watch.status, 'match');
          watch.status = transitionWatchStatus(watch.status, 'notify');
        }
        await this.repo.updateWatch(watch);

        // Rule R1 compliant alert copy ("possible availability ... not reserved ... continue to official provider")
        const event: WatchMatchedEvent = {
          eventType: 'watch.matched',
          eventId: uuidv7(),
          dedupeKey,
          watchId: watch.id,
          userId: watch.userId,
          providerId: obs.providerId,
          integrationType: obs.integrationType,
          routeKey: obs.routeKey,
          journeyDate: obs.journeyDate,
          seatClass: obs.seatClass,
          state: effectiveState,
          matchQuality,
          bookingUrl,
          alertCopyBn: `সম্ভাব্য প্রাপ্যতা পাওয়া গেছে (${watch.originCode} → ${watch.destinationCode}, ${obs.journeyDate}) — আসন সংরক্ষিত নয়। বুকিং সম্পন্ন করতে অফিশিয়াল প্রোভাইডারে এগিয়ে যান: ${bookingUrl}`,
          alertCopyEn: `Possible availability detected (${watch.originCode} → ${watch.destinationCode}, ${obs.journeyDate}) — not reserved. Continue to official provider: ${bookingUrl}`,
          emittedAt: now.toISOString(),
        };

        await this.repo.appendOutboxEvent(event);
        summary.alertsEmitted += 1;
      }
    }

    return summary;
  }
}
