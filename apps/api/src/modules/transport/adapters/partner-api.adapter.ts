import { createHash } from 'node:crypto';
import {
  AvailabilityState,
  IntegrationType,
  TrustLabel,
  isLiveIntegrationType,
  resolveHonestAvailabilityState,
} from '@jonoshheba/shared';
import { z } from 'zod';
import { ProviderCircuitBreaker, TokenBucketRateLimiter } from '../domain/resilience';
import type {
  AvailabilityCheckKey,
  AvailabilityObservation,
  JourneyOption,
  ProviderCapabilities,
  ProviderHealthStatus,
  TransportMode,
  TransportSearchQuery,
} from '../domain/transport.types';
import type { TransportProviderAdapter } from '../ports/provider.port';

export const PartnerAvailabilityResponseSchema = z.object({
  seatsAvailable: z.number().int().nonnegative().nullable(),
  fareBdt: z.number().nonnegative().nullable().optional(),
  observedAt: z.string().datetime(),
  sourceRef: z.string().min(1).optional(),
});

export interface PartnerApiAdapterConfig {
  id: string;
  name: string;
  mode: TransportMode;
  integrationType:
    | typeof IntegrationType.OFFICIAL_API
    | typeof IntegrationType.PARTNER_FEED
    | typeof IntegrationType.PERMITTED_FEED;
  baseUrl: string;
  officialUrl: string;
  apiKey: string;
  rateLimitPerMin: number;
  timeoutMs?: number;
  maxRetries?: number;
  maxFreshnessMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Production Partner/Official API Adapter Template (Prompt 05):
 * - Authorized API key / bearer authentication
 * - Per-provider TokenBucket rate limiter (Rule R2)
 * - Circuit breaker (closed -> open -> half_open)
 * - Timeout & bounded retries
 * - Strict Zod schema validation (invalid data -> PROVIDER_ERROR, NEVER SOLD_OUT!)
 * - Staleness check (stale observedAt -> UNKNOWN_STALE, NEVER SOLD_OUT!)
 */
export class PartnerApiAdapter implements TransportProviderAdapter {
  readonly id: string;
  readonly name: string;
  readonly mode: TransportMode;
  readonly integrationType: IntegrationType;
  readonly officialUrl: string;
  readonly rateLimitPerMin: number;
  readonly capabilities: ProviderCapabilities = {
    search: true,
    availability: true,
    fares: true,
    schedules: true,
  };

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly maxFreshnessMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly rateLimiter: TokenBucketRateLimiter;
  readonly circuitBreaker: ProviderCircuitBreaker;

  constructor(config: PartnerApiAdapterConfig) {
    this.id = config.id;
    this.name = config.name;
    this.mode = config.mode;
    this.integrationType = config.integrationType;
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.officialUrl = config.officialUrl;
    this.apiKey = config.apiKey;
    this.rateLimitPerMin = config.rateLimitPerMin;
    this.timeoutMs = config.timeoutMs ?? 4000;
    this.maxRetries = config.maxRetries ?? 1;
    this.maxFreshnessMs = config.maxFreshnessMs ?? 5 * 60 * 1000;
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch;
    this.rateLimiter = new TokenBucketRateLimiter(config.rateLimitPerMin);
    this.circuitBreaker = new ProviderCircuitBreaker(3, 30_000);
  }

  bookingDeepLink(option: {
    originCode: string;
    destinationCode: string;
    journeyDate: string;
    tripCode?: string;
  }): URL {
    const url = new URL(this.officialUrl);
    url.searchParams.set('from', option.originCode);
    url.searchParams.set('to', option.destinationCode);
    url.searchParams.set('date', option.journeyDate);
    if (option.tripCode) url.searchParams.set('trip', option.tripCode);
    return url;
  }

  private errorObservation(
    key: AvailabilityCheckKey,
    responseStatus: number,
    errorMessage: string,
  ): AvailabilityObservation {
    const now = new Date();
    return {
      providerId: this.id,
      integrationType: this.integrationType,
      isLive: isLiveIntegrationType(this.integrationType),
      routeKey: key.routeKey,
      journeyDate: key.journeyDate,
      seatClass: key.seatClass,
      checkedAt: now,
      observedAt: now,
      state: AvailabilityState.PROVIDER_ERROR,
      seatsAvailable: null,
      fareBdt: null,
      sourceRef: this.baseUrl,
      responseStatus,
      rawHash: createHash('sha256').update(`${responseStatus}:${errorMessage}`).digest('hex'),
      errorMessage,
    };
  }

  async checkAvailability(key: AvailabilityCheckKey): Promise<AvailabilityObservation> {
    if (!this.circuitBreaker.canExecute()) {
      return this.errorObservation(key, 503, 'Circuit breaker open');
    }
    if (!this.rateLimiter.tryAcquire(1)) {
      return this.errorObservation(key, 429, 'Per-provider rate limit exhausted');
    }

    const endpoint = `${this.baseUrl}/availability?origin=${encodeURIComponent(key.originCode)}&destination=${encodeURIComponent(key.destinationCode)}&date=${encodeURIComponent(key.journeyDate)}&seatClass=${encodeURIComponent(key.seatClass)}`;

    let lastStatus = 500;
    let lastError = 'Unknown partner error';

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const res = await this.fetchImpl(endpoint, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        lastStatus = res.status;
        if (!res.ok) {
          lastError = `Upstream HTTP ${res.status}`;
          if (res.status >= 500 && attempt < this.maxRetries) continue;
          this.circuitBreaker.recordFailure();
          return this.errorObservation(key, res.status, lastError);
        }

        const rawJson: unknown = await res.json();
        const parsed = PartnerAvailabilityResponseSchema.safeParse(rawJson);
        if (!parsed.success) {
          this.circuitBreaker.recordFailure();
          return this.errorObservation(key, 502, 'Invalid partner availability response schema');
        }

        this.circuitBreaker.recordSuccess();
        const checkedAt = new Date();
        const observedAt = new Date(parsed.data.observedAt);
        const isStale = checkedAt.getTime() - observedAt.getTime() > this.maxFreshnessMs;
        const state = resolveHonestAvailabilityState({
          providerErrored: false,
          isStale,
          seatsAvailable: parsed.data.seatsAvailable,
        });

        return {
          providerId: this.id,
          integrationType: this.integrationType,
          isLive: isLiveIntegrationType(this.integrationType),
          routeKey: key.routeKey,
          journeyDate: key.journeyDate,
          seatClass: key.seatClass,
          checkedAt,
          observedAt,
          state,
          seatsAvailable: isStale ? null : parsed.data.seatsAvailable,
          fareBdt: parsed.data.fareBdt ?? null,
          sourceRef: parsed.data.sourceRef ?? endpoint,
          responseStatus: res.status,
          rawHash: createHash('sha256').update(JSON.stringify(rawJson)).digest('hex'),
        };
      } catch (err) {
        lastStatus = 504;
        lastError = err instanceof Error ? err.message : 'Network error';
      }
    }

    this.circuitBreaker.recordFailure();
    return this.errorObservation(key, lastStatus, lastError);
  }

  async search(query: TransportSearchQuery): Promise<JourneyOption[]> {
    const routeKey = `${this.id}:${query.originCode}:${query.destinationCode}`;
    const obs = await this.checkAvailability({
      providerId: this.id,
      mode: this.mode,
      routeKey,
      originCode: query.originCode,
      destinationCode: query.destinationCode,
      journeyDate: query.journeyDate,
      seatClass: query.seatClass ?? 'STANDARD',
    });

    return [
      {
        optionId: `${this.id}:${routeKey}:${query.journeyDate}:${obs.seatClass}`,
        providerId: this.id,
        providerName: this.name,
        mode: this.mode,
        tripCode: `${this.id.toUpperCase()}-1`,
        tripNameBn: this.name,
        tripNameEn: this.name,
        originCode: query.originCode,
        destinationCode: query.destinationCode,
        journeyDate: query.journeyDate,
        departTimeLocal: '09:00',
        arriveTimeLocal: '14:30',
        seatClass: obs.seatClass,
        state: obs.state,
        seatsAvailable: obs.seatsAvailable,
        fareBdt: obs.fareBdt,
        fareVerified: obs.fareBdt !== null,
        integrationType: this.integrationType,
        isLive: isLiveIntegrationType(this.integrationType),
        monitored: true,
        checkedAt: obs.checkedAt.toISOString(),
        bookingUrl: this.bookingDeepLink({
          originCode: query.originCode,
          destinationCode: query.destinationCode,
          journeyDate: query.journeyDate,
        }).toString(),
        trustLabel: TrustLabel.PARTNER_PROVIDED,
        attribution: {
          trustLabel: TrustLabel.PARTNER_PROVIDED,
          sourceUrl: this.officialUrl,
          agency: this.name,
          lastVerifiedAt: obs.checkedAt.toISOString(),
        },
        notReservedNoticeBn:
          'সম্ভাব্য প্রাপ্যতা — আসন সংরক্ষিত নয়। বুকিং সম্পন্ন করতে অফিশিয়াল চ্যানেলে যান।',
        notReservedNoticeEn:
          'Possible match — seat not reserved. Continue to official channel to complete booking.',
      },
    ];
  }

  async healthCheck(): Promise<ProviderHealthStatus> {
    const circuit = this.circuitBreaker.getState();
    return {
      providerId: this.id,
      providerName: this.name,
      mode: this.mode,
      integrationType: this.integrationType,
      isLive: isLiveIntegrationType(this.integrationType),
      capabilities: this.capabilities,
      rateLimitPerMin: this.rateLimitPerMin,
      status: circuit === 'open' ? 'down' : circuit === 'half_open' ? 'degraded' : 'healthy',
      circuitState: circuit,
      latencyMs: 0,
      checkedAt: new Date().toISOString(),
    };
  }
}
