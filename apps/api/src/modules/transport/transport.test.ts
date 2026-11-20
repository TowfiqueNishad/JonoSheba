import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AvailabilityState, IntegrationType, WatchStatus } from '@jonoshheba/shared';
import fc from 'fast-check';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryTransportRepository } from './adapters/in-memory-transport.repository';
import { LinkOnlyAdapter } from './adapters/link-only.adapter';
import { MockBusAdapter, MockRailAdapter } from './adapters/mock.adapters';
import { PartnerApiAdapter } from './adapters/partner-api.adapter';
import { TransportService } from './application/transport.service';
import {
  WatchEngineService,
  computeAdaptivePollIntervalMs,
} from './application/watch-engine.service';
import {
  dhakaEndOfDayUtc,
  dhakaStartOfDayUtc,
  toDhakaDateString,
} from './domain/dhaka-time';
import { transitionWatchStatus } from './domain/watch-state-machine';

describe('Phase 05: Smart Transportation Hub & Ticket Watch Engine (Flagship)', () => {
  let repo: InMemoryTransportRepository;
  let mockRail: MockRailAdapter;
  let mockBus: MockBusAdapter;
  let railLinkOnly: LinkOnlyAdapter;
  let transport: TransportService;
  let engine: WatchEngineService;

  beforeEach(() => {
    repo = new InMemoryTransportRepository();
    mockRail = new MockRailAdapter();
    mockBus = new MockBusAdapter();
    railLinkOnly = new LinkOnlyAdapter({
      id: 'bd-railway-link',
      name: 'Bangladesh Railway e-Ticketing',
      mode: 'train',
      officialUrl: 'https://eticket.railway.gov.bd',
    });
    const providers = [mockRail, mockBus, railLinkOnly];
    transport = new TransportService(repo, providers);
    engine = new WatchEngineService(repo, providers);
  });

  // ---------------------------------------------------------------------------
  // 1. Honest Availability Table (R6) — Stale & Error NEVER become SOLD_OUT
  // ---------------------------------------------------------------------------
  it('enforces every row of the availability state table and NEVER shows stale/error as SOLD_OUT', async () => {
    const routeKey = 'mock-rail:RAIL-DA:RAIL-CTG';
    const date = '2026-12-20';

    const cases: Array<{
      label: string;
      scenario: Parameters<MockRailAdapter['setScenario']>[3];
      expected: AvailabilityState;
    }> = [
      { label: 'available', scenario: { kind: 'available', seatsAvailable: 14, fareBdt: 777 }, expected: AvailabilityState.AVAILABLE },
      { label: 'limited', scenario: { kind: 'limited', seatsAvailable: 3, fareBdt: 777 }, expected: AvailabilityState.LIMITED },
      { label: 'sold_out', scenario: { kind: 'sold_out', fareBdt: 777 }, expected: AvailabilityState.SOLD_OUT },
      { label: 'stale (15m old, 0 seats) -> UNKNOWN_STALE, NOT SOLD_OUT', scenario: { kind: 'stale', ageMinutes: 15, seatsAvailable: 0 }, expected: AvailabilityState.UNKNOWN_STALE },
      { label: 'outage (HTTP 503) -> PROVIDER_ERROR, NOT SOLD_OUT', scenario: { kind: 'outage', statusCode: 503 }, expected: AvailabilityState.PROVIDER_ERROR },
    ];

    for (const row of cases) {
      mockRail.setScenario(routeKey, date, 'SNIGDHA', row.scenario);
      const obs = await mockRail.checkAvailability({
        providerId: 'mock-rail',
        mode: 'train',
        routeKey,
        originCode: 'RAIL-DA',
        destinationCode: 'RAIL-CTG',
        journeyDate: date,
        seatClass: 'SNIGDHA',
      });
      expect(obs.state, row.label).toBe(row.expected);
      expect(obs.isLive).toBe(false); // MOCK is never labelled live (R2)
    }

    // LinkOnlyAdapter ALWAYS returns UNKNOWN_STALE & not monitored
    const linkObs = await railLinkOnly.checkAvailability({
      providerId: 'bd-railway-link',
      mode: 'train',
      routeKey: 'bd-railway-link:RAIL-DA:RAIL-CTG',
      originCode: 'RAIL-DA',
      destinationCode: 'RAIL-CTG',
      journeyDate: date,
      seatClass: 'SNIGDHA',
    });
    expect(linkObs.state).toBe(AvailabilityState.UNKNOWN_STALE);
    expect(linkObs.isLive).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // 2. Duplicate Inventory Events -> Exactly ONE Alert (Dedupe) & New Release Re-Alerts
  // ---------------------------------------------------------------------------
  it('deduplicates repeated inventory observations of the same release into ONE alert with R1 copy', async () => {
    const date = '2026-12-20';
    const routeKey = 'mock-rail:RAIL-DA:RAIL-CTG';
    mockRail.setScenario(routeKey, date, 'SNIGDHA', { kind: 'sold_out' });

    const watch = await transport.createTicketWatch(
      'citizen-1',
      {
        mode: 'train',
        originCode: 'RAIL-DA',
        destinationCode: 'RAIL-CTG',
        journeyDate: date,
        passengers: 2,
        preferences: { seatClass: 'SNIGDHA' },
      },
      'idem-watch-1',
    );

    // Poll 1: sold out -> 0 alerts
    const p1 = await engine.runPollCycle(new Date('2026-12-18T10:00:00Z'));
    expect(p1.alertsEmitted).toBe(0);

    // Seats released! Poll 2 -> 1 alert
    mockRail.setScenario(routeKey, date, 'SNIGDHA', { kind: 'available', seatsAvailable: 6, fareBdt: 777 });
    const p2 = await engine.runPollCycle(new Date('2026-12-18T10:05:00Z'));
    expect(p2.alertsEmitted).toBe(1);

    // Poll 3 & Poll 4 observe the SAME ongoing release -> 0 duplicate alerts!
    const p3 = await engine.runPollCycle(new Date('2026-12-18T10:10:00Z'));
    const p4 = await engine.runPollCycle(new Date('2026-12-18T10:15:00Z'));
    expect(p3.alertsEmitted).toBe(0);
    expect(p4.alertsEmitted).toBe(0);

    const events = await repo.listOutboxEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('watch.matched');
    expect(events[0]?.alertCopyEn).toContain('Possible availability detected');
    expect(events[0]?.alertCopyEn).toContain('not reserved');
    expect(events[0]?.alertCopyEn).toContain('Continue to official provider');
    expect(events[0]?.alertCopyBn).toContain('আসন সংরক্ষিত নয়');

    // Now it sells out again, then a NEW cancellation opens later -> emits 1 fresh alert!
    mockRail.setScenario(routeKey, date, 'SNIGDHA', { kind: 'sold_out' });
    await engine.runPollCycle(new Date('2026-12-18T10:20:00Z'));

    mockRail.setScenario(routeKey, date, 'SNIGDHA', { kind: 'limited', seatsAvailable: 2, fareBdt: 777 });
    const p6 = await engine.runPollCycle(new Date('2026-12-18T10:25:00Z'));
    expect(p6.alertsEmitted).toBe(1);

    // Watch detail includes snapshots & matches timeline
    const detail = await transport.getWatchDetail('citizen-1', watch.id);
    expect(detail.timeline.snapshots.length).toBeGreaterThanOrEqual(5);
    expect(detail.timeline.matches).toHaveLength(2);
  });

  // ---------------------------------------------------------------------------
  // 3. Provider Outage -> ZERO False Alerts + Error State after K=3 Failures
  // ---------------------------------------------------------------------------
  it('never emits false alerts on provider outage or stale data and transitions watch to error after 3 failures', async () => {
    const date = '2026-12-22';
    const routeKey = 'mock-rail:RAIL-DA:RAIL-RAJ';
    const watch = await transport.createTicketWatch('citizen-2', {
      mode: 'train',
      originCode: 'RAIL-DA',
      destinationCode: 'RAIL-RAJ',
      journeyDate: date,
      passengers: 1,
      preferences: { seatClass: 'S_CHAIR' },
    });

    // Stale data -> 0 alerts
    mockRail.setScenario(routeKey, date, 'S_CHAIR', { kind: 'stale', ageMinutes: 20, seatsAvailable: 10 });
    const stalePoll = await engine.runPollCycle(new Date('2026-12-19T06:00:00Z'));
    expect(stalePoll.alertsEmitted).toBe(0);

    // 3 consecutive outages -> 0 alerts + watch moves to ERROR
    mockRail.setScenario(routeKey, date, 'S_CHAIR', { kind: 'outage', statusCode: 503 });
    for (let i = 0; i < 3; i++) {
      const res = await engine.runPollCycle(new Date(Date.UTC(2026, 11, 19, 7, i * 2)));
      expect(res.alertsEmitted).toBe(0);
    }

    const updated = await repo.findWatchById(watch.id);
    expect(updated?.status).toBe(WatchStatus.ERROR);
    expect(updated?.consecutiveErrors).toBe(3);

    // Citizen can resume after outage resolves
    const resumed = await transport.mutateWatch('citizen-2', watch.id, { action: 'resume' });
    expect(resumed.status).toBe(WatchStatus.ACTIVE);
    expect(resumed.consecutiveErrors).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // 4. Asia/Dhaka Midnight Expiry Edge Cases
  // ---------------------------------------------------------------------------
  it('handles Asia/Dhaka (UTC+06:00) midnight expiry boundaries accurately', async () => {
    // 2026-12-20 in Asia/Dhaka runs from 2026-12-19T18:00:00.000Z to 2026-12-20T17:59:59.999Z
    expect(dhakaStartOfDayUtc('2026-12-20').toISOString()).toBe('2026-12-19T18:00:00.000Z');
    expect(dhakaEndOfDayUtc('2026-12-20').toISOString()).toBe('2026-12-20T17:59:59.999Z');
    expect(toDhakaDateString(new Date('2026-12-20T17:59:59.000Z'))).toBe('2026-12-20');
    expect(toDhakaDateString(new Date('2026-12-20T18:00:00.000Z'))).toBe('2026-12-21');

    const watch = await transport.createTicketWatch('citizen-tz', {
      mode: 'train',
      originCode: 'RAIL-DA',
      destinationCode: 'RAIL-SYL',
      journeyDate: '2026-12-20',
      passengers: 1,
    });

    // At 23:59:58 Asia/Dhaka (17:59:58Z), watch is NOT yet expired
    mockRail.setScenario('mock-rail:RAIL-DA:RAIL-SYL', '2026-12-20', 'S_CHAIR', { kind: 'sold_out' });
    const beforeMidnight = await engine.runPollCycle(new Date('2026-12-20T17:59:58.000Z'));
    expect(beforeMidnight.expiredWatches).toBe(0);

    // At 00:00:01 Asia/Dhaka next day (18:00:01Z), watch auto-expires!
    const afterMidnight = await engine.runPollCycle(new Date('2026-12-20T18:00:01.000Z'));
    expect(afterMidnight.expiredWatches).toBe(1);
    const expired = await repo.findWatchById(watch.id);
    expect(expired?.status).toBe(WatchStatus.EXPIRED);
  });

  // ---------------------------------------------------------------------------
  // 5. Property-Based Test (fast-check): Fan-In ALWAYS Respects Rate Limit
  // ---------------------------------------------------------------------------
  it('property-based (fast-check): fan-in scheduler NEVER exceeds provider rateLimitPerMin', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 6 }), // tight provider rateLimitPerMin
        fc.array(
          fc.record({
            userIdx: fc.integer({ min: 1, max: 10 }),
            dest: fc.constantFrom('RAIL-CTG', 'RAIL-RAJ', 'RAIL-SYL', 'RAIL-KHL', 'RAIL-RNP'),
            day: fc.constantFrom('2026-12-20', '2026-12-21', '2026-12-22'),
            seatClass: fc.constantFrom('S_CHAIR', 'SNIGDHA', 'AC_S'),
          }),
          { minLength: 1, maxLength: 35 },
        ),
        async (rateLimit, watchSpecs) => {
          const localRepo = new InMemoryTransportRepository();
          const localMockRail = new MockRailAdapter();
          localMockRail.rateLimitPerMin = rateLimit;
          const localTransport = new TransportService(localRepo, [localMockRail]);
          const localEngine = new WatchEngineService(localRepo, [localMockRail]);

          for (const spec of watchSpecs) {
            try {
              await localTransport.createTicketWatch(`user-${spec.userIdx}`, {
                mode: 'train',
                originCode: 'RAIL-DA',
                destinationCode: spec.dest,
                journeyDate: spec.day,
                passengers: 1,
                preferences: { seatClass: spec.seatClass },
              });
            } catch {
              // Ignore per-user max-10 cap in random batch
            }
          }

          const uniqueKeys = new Set(
            (await localRepo.listActiveWatches()).map(
              (w) => `${w.providerId}|${w.routeKey}|${w.journeyDate}|${(w.preferences.seatClass ?? 'S_CHAIR').toUpperCase()}`,
            ),
          );

          const summary = await localEngine.runPollCycle(new Date('2026-12-18T12:00:00Z'));

          // INVARIANT 1: Never exceed provider rate limit!
          expect(summary.providerChecksExecuted).toBeLessThanOrEqual(rateLimit);
          expect(localMockRail.checkCalls).toBeLessThanOrEqual(rateLimit);
          // INVARIANT 2: Fan-in never makes more checks than unique route/date/class keys!
          expect(summary.providerChecksExecuted).toBeLessThanOrEqual(uniqueKeys.size);
          expect(summary.providerChecksExecuted + summary.groupsDeferredByRateLimit).toBe(
            uniqueKeys.size,
          );
        },
      ),
      { numRuns: 40 },
    );
  });

  // ---------------------------------------------------------------------------
  // 6. PartnerApiAdapter Contract Tests (Schema Validation, Staleness, Circuit Breaker)
  // ---------------------------------------------------------------------------
  it('PartnerApiAdapter contract: validates schema, rejects stale as UNKNOWN_STALE, and trips circuit breaker on outages', async () => {
    const mockFetch = vi.fn();
    const adapter = new PartnerApiAdapter({
      id: 'partner-bus-1',
      name: 'Authorized Partner Coach API',
      mode: 'bus',
      integrationType: IntegrationType.PARTNER_FEED,
      baseUrl: 'https://partner.example.invalid/v1',
      officialUrl: 'https://partner.example.invalid/book',
      apiKey: 'test-partner-key',
      rateLimitPerMin: 20,
      maxRetries: 0,
      fetchImpl: mockFetch,
    });

    const key = {
      providerId: 'partner-bus-1',
      mode: 'bus' as const,
      routeKey: 'partner-bus-1:BUS-DHK-GAB:BUS-CTG-DMP',
      originCode: 'BUS-DHK-GAB',
      destinationCode: 'BUS-CTG-DMP',
      journeyDate: '2026-12-20',
      seatClass: 'AC',
    };

    // Valid live response -> AVAILABLE & isLive = true
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ seatsAvailable: 12, fareBdt: 1200, observedAt: new Date().toISOString() }),
        { status: 200 },
      ),
    );
    const ok = await adapter.checkAvailability(key);
    expect(ok.state).toBe(AvailabilityState.AVAILABLE);
    expect(ok.isLive).toBe(true);

    // Stale partner timestamp (15 min old, 0 seats) -> UNKNOWN_STALE (NEVER SOLD_OUT!)
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          seatsAvailable: 0,
          observedAt: new Date(Date.now() - 15 * 60_000).toISOString(),
        }),
        { status: 200 },
      ),
    );
    const stale = await adapter.checkAvailability(key);
    expect(stale.state).toBe(AvailabilityState.UNKNOWN_STALE);

    // Malformed schema -> PROVIDER_ERROR (failure 1)
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ badField: true }), { status: 200 }));
    const badSchema = await adapter.checkAvailability(key);
    expect(badSchema.state).toBe(AvailabilityState.PROVIDER_ERROR);

    // Two more HTTP 503s -> trips circuit breaker OPEN!
    mockFetch.mockResolvedValueOnce(new Response('down', { status: 503 }));
    await adapter.checkAvailability(key);
    mockFetch.mockResolvedValueOnce(new Response('down', { status: 503 }));
    await adapter.checkAvailability(key);
    expect(adapter.circuitBreaker.getState()).toBe('open');

    // Subsequent call short-circuits without calling fetch!
    const callsBefore = mockFetch.mock.calls.length;
    const shortCircuited = await adapter.checkAvailability(key);
    expect(shortCircuited.state).toBe(AvailabilityState.PROVIDER_ERROR);
    expect(mockFetch.mock.calls.length).toBe(callsBefore);
  });

  // ---------------------------------------------------------------------------
  // 7. Search, Alternatives, Idempotency, Max Watches, LINK_ONLY Rejection, State Machine & IDOR
  // ---------------------------------------------------------------------------
  it('supports fuzzy stop search, journey search with alternatives & demand hints, Idempotency-Key, max 10 cap, LINK_ONLY rejection, and IDOR protection', async () => {
    const stops = await transport.searchStops('কমলাপুর', 'train');
    expect(stops[0]?.code).toBe('RAIL-DA');

    const res = await transport.searchJourneys({
      mode: 'train',
      originCode: 'RAIL-DA',
      destinationCode: 'RAIL-CTG',
      journeyDate: '2026-12-20',
      passengers: 2,
      seatClass: 'SNIGDHA',
    });
    expect(res.options.length).toBeGreaterThanOrEqual(2);
    expect(res.alternatives.nearbyDates).toHaveLength(6); // +/- 3 days
    expect(res.alternatives.alternateMode?.mode).toBe('bus');
    expect(res.demandHint.level).toBe('high'); // Dec 20 holiday peak

    // Rejects automated watch pinned to LINK_ONLY provider (Rule R2)
    await expect(
      transport.createTicketWatch('citizen-x', {
        mode: 'train',
        providerId: 'bd-railway-link',
        originCode: 'RAIL-DA',
        destinationCode: 'RAIL-CTG',
        journeyDate: '2026-12-20',
        passengers: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Idempotency-Key returns same watch without duplicating
    const w1 = await transport.createTicketWatch(
      'citizen-x',
      {
        mode: 'train',
        originCode: 'RAIL-DA',
        destinationCode: 'RAIL-CTG',
        journeyDate: '2026-12-20',
        passengers: 1,
      },
      'same-key-123',
    );
    const w2 = await transport.createTicketWatch(
      'citizen-x',
      {
        mode: 'train',
        originCode: 'RAIL-DA',
        destinationCode: 'RAIL-CTG',
        journeyDate: '2026-12-20',
        passengers: 1,
      },
      'same-key-123',
    );
    expect(w2.id).toBe(w1.id);

    // IDOR: another user cannot view, mutate, or complete citizen-x's watch
    await expect(transport.getWatchDetail('citizen-y', w1.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      transport.mutateWatch('citizen-y', w1.id, { action: 'cancel' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(transport.completeWatch('citizen-y', w1.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    // Complete ("I booked it") transitions watch cleanly & prevents invalid subsequent pause
    const completed = await transport.completeWatch('citizen-x', w1.id);
    expect(completed.status).toBe(WatchStatus.CANCELLED);
    expect(completed.completedByUser).toBe(true);
    expect(() => transitionWatchStatus(WatchStatus.CANCELLED, 'pause')).toThrow(BadRequestException);

    // Adaptive poll interval never violates provider rate limit
    const interval = computeAdaptivePollIntervalMs({
      hoursToDeparture: 2,
      journeyDate: '2026-12-20',
      providerRateLimitPerMin: 2,
      jitterRatio: 0,
    });
    expect(interval).toBeGreaterThanOrEqual(30_000);
  });
});
