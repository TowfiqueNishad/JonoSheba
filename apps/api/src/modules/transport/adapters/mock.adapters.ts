import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  AvailabilityState,
  IntegrationType,
  TrustLabel,
  isLiveIntegrationType,
  resolveHonestAvailabilityState,
} from '@jonoshheba/shared';
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

export type MockScenario =
  | { kind: 'available'; seatsAvailable: number; fareBdt: number }
  | { kind: 'limited'; seatsAvailable: number; fareBdt: number }
  | { kind: 'sold_out'; fareBdt?: number }
  | { kind: 'stale'; ageMinutes: number; seatsAvailable: number | null; fareBdt?: number }
  | { kind: 'outage'; statusCode?: number; message?: string };

const MAX_FRESHNESS_MS = 5 * 60 * 1000;

abstract class BaseMockAdapter implements TransportProviderAdapter {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly mode: TransportMode;
  abstract readonly officialUrl: string;
  readonly integrationType = IntegrationType.MOCK;
  readonly capabilities: ProviderCapabilities = {
    search: true,
    availability: true,
    fares: true,
    schedules: true,
  };
  rateLimitPerMin = 60;

  private readonly scenarios = new Map<string, MockScenario>();
  checkCalls = 0;

  private scenarioKey(routeKey: string, journeyDate: string, seatClass: string): string {
    return `${routeKey}|${journeyDate}|${seatClass.toUpperCase()}`;
  }

  /** Deterministically configure a scenario for tests or demos */
  setScenario(routeKey: string, journeyDate: string, seatClass: string, scenario: MockScenario): void {
    this.scenarios.set(this.scenarioKey(routeKey, journeyDate, seatClass), scenario);
  }

  clearScenarios(): void {
    this.scenarios.clear();
    this.checkCalls = 0;
  }

  /** Deterministic seeded fallback scenario based on route + date hash */
  protected getScenario(routeKey: string, journeyDate: string, seatClass: string): MockScenario {
    const explicit = this.scenarios.get(this.scenarioKey(routeKey, journeyDate, seatClass));
    if (explicit) return explicit;
    const digest = createHash('sha256')
      .update(`${this.id}:${routeKey}:${journeyDate}:${seatClass}`)
      .digest();
    const bucket = (digest[0] ?? 0) % 10;
    if (bucket <= 2) return { kind: 'sold_out', fareBdt: this.defaultFare(seatClass) };
    if (bucket <= 5) return { kind: 'limited', seatsAvailable: 3, fareBdt: this.defaultFare(seatClass) };
    return { kind: 'available', seatsAvailable: 18, fareBdt: this.defaultFare(seatClass) };
  }

  protected abstract defaultFare(seatClass: string): number;
  protected abstract sampleTrips(query: TransportSearchQuery): Array<{
    tripCode: string;
    nameBn: string;
    nameEn: string;
    departTimeLocal: string;
    arriveTimeLocal: string;
    seatClass: string;
  }>;

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
    url.searchParams.set('utm_source', 'jonoshheba_mock');
    return url;
  }

  async checkAvailability(key: AvailabilityCheckKey): Promise<AvailabilityObservation> {
    this.checkCalls += 1;
    const now = new Date();
    const scenario = this.getScenario(key.routeKey, key.journeyDate, key.seatClass);
    const rawHash = createHash('sha256')
      .update(JSON.stringify({ key, scenario }))
      .digest('hex');

    if (scenario.kind === 'outage') {
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
        sourceRef: `${this.id}:${key.routeKey}`,
        responseStatus: scenario.statusCode ?? 503,
        rawHash,
        errorMessage: scenario.message ?? 'Simulated provider outage',
      };
    }

    if (scenario.kind === 'stale') {
      const observedAt = new Date(now.getTime() - scenario.ageMinutes * 60_000);
      const isStale = now.getTime() - observedAt.getTime() > MAX_FRESHNESS_MS;
      return {
        providerId: this.id,
        integrationType: this.integrationType,
        isLive: isLiveIntegrationType(this.integrationType),
        routeKey: key.routeKey,
        journeyDate: key.journeyDate,
        seatClass: key.seatClass,
        checkedAt: now,
        observedAt,
        state: resolveHonestAvailabilityState({
          providerErrored: false,
          isStale,
          seatsAvailable: scenario.seatsAvailable,
        }),
        seatsAvailable: isStale ? null : scenario.seatsAvailable,
        fareBdt: scenario.fareBdt ?? null,
        sourceRef: `${this.id}:${key.routeKey}`,
        responseStatus: 200,
        rawHash,
      };
    }

    const seats = scenario.kind === 'sold_out' ? 0 : scenario.seatsAvailable;
    return {
      providerId: this.id,
      integrationType: this.integrationType,
      isLive: isLiveIntegrationType(this.integrationType),
      routeKey: key.routeKey,
      journeyDate: key.journeyDate,
      seatClass: key.seatClass,
      checkedAt: now,
      observedAt: now,
      state: resolveHonestAvailabilityState({
        providerErrored: false,
        isStale: false,
        seatsAvailable: seats,
      }),
      seatsAvailable: seats,
      fareBdt: scenario.fareBdt ?? this.defaultFare(key.seatClass),
      sourceRef: `${this.id}:${key.routeKey}`,
      responseStatus: 200,
      rawHash,
    };
  }

  async search(query: TransportSearchQuery): Promise<JourneyOption[]> {
    const trips = this.sampleTrips(query);
    const options: JourneyOption[] = [];

    for (const trip of trips) {
      if (query.departWindow) {
        const hour = Number(trip.departTimeLocal.split(':')[0] ?? 0);
        if (hour < query.departWindow.startHour || hour > query.departWindow.endHour) {
          continue;
        }
      }
      const routeKey = `${this.id}:${query.originCode}:${query.destinationCode}`;
      const obs = await this.checkAvailability({
        providerId: this.id,
        mode: this.mode,
        routeKey,
        originCode: query.originCode,
        destinationCode: query.destinationCode,
        journeyDate: query.journeyDate,
        seatClass: query.seatClass ?? trip.seatClass,
      });

      options.push({
        optionId: `${this.id}:${trip.tripCode}:${query.journeyDate}:${obs.seatClass}`,
        providerId: this.id,
        providerName: this.name,
        mode: this.mode,
        tripCode: trip.tripCode,
        tripNameBn: trip.nameBn,
        tripNameEn: trip.nameEn,
        originCode: query.originCode,
        destinationCode: query.destinationCode,
        journeyDate: query.journeyDate,
        departTimeLocal: trip.departTimeLocal,
        arriveTimeLocal: trip.arriveTimeLocal,
        seatClass: obs.seatClass,
        state: obs.state,
        seatsAvailable: obs.seatsAvailable,
        fareBdt: obs.fareBdt,
        fareVerified: false, // MOCK fares are never claimed verified live
        integrationType: this.integrationType,
        isLive: false,
        monitored: true,
        checkedAt: obs.checkedAt.toISOString(),
        bookingUrl: this.bookingDeepLink({
          originCode: query.originCode,
          destinationCode: query.destinationCode,
          journeyDate: query.journeyDate,
          tripCode: trip.tripCode,
        }).toString(),
        trustLabel: TrustLabel.PARTNER_PROVIDED,
        attribution: {
          trustLabel: TrustLabel.PARTNER_PROVIDED,
          sourceUrl: this.officialUrl,
          agency: this.name,
          lastVerifiedAt: obs.checkedAt.toISOString(),
        },
        notReservedNoticeBn:
          'ডেমো ডেটা (MOCK) — সম্ভাব্য প্রাপ্যতা, আসন সংরক্ষিত নয়। অফিশিয়াল চ্যানেলে এগিয়ে যান।',
        notReservedNoticeEn:
          'MOCK demo data — possible match, seat not reserved. Continue to official channel.',
        mockLabel: 'MOCK',
      });
    }

    return options;
  }

  async healthCheck(): Promise<ProviderHealthStatus> {
    return {
      providerId: this.id,
      providerName: this.name,
      mode: this.mode,
      integrationType: this.integrationType,
      isLive: false,
      capabilities: this.capabilities,
      rateLimitPerMin: this.rateLimitPerMin,
      status: 'healthy',
      circuitState: 'closed',
      latencyMs: 2,
      checkedAt: new Date().toISOString(),
    };
  }
}

@Injectable()
export class MockRailAdapter extends BaseMockAdapter {
  readonly id = 'mock-rail';
  readonly name = 'Mock Intercity Rail (DEV MOCK)';
  readonly mode: TransportMode = 'train';
  readonly officialUrl = 'https://eticket.railway.gov.bd';

  protected defaultFare(seatClass: string): number {
    switch (seatClass.toUpperCase()) {
      case 'SNIGDHA':
        return 777;
      case 'AC_S':
        return 932;
      case 'AC_B':
        return 1398;
      default:
        return 405;
    }
  }

  protected sampleTrips(query: TransportSearchQuery) {
    const cls = query.seatClass ?? 'S_CHAIR';
    return [
      {
        tripCode: 'MOCK-702',
        nameBn: 'সুবর্ণ এক্সপ্রেস (MOCK)',
        nameEn: 'Suborna Express (MOCK)',
        departTimeLocal: '07:00',
        arriveTimeLocal: '12:15',
        seatClass: cls,
      },
      {
        tripCode: 'MOCK-788',
        nameBn: 'সোনার বাংলা এক্সপ্রেস (MOCK)',
        nameEn: 'Sonar Bangla Express (MOCK)',
        departTimeLocal: '16:30',
        arriveTimeLocal: '21:45',
        seatClass: cls,
      },
    ];
  }
}

@Injectable()
export class MockBusAdapter extends BaseMockAdapter {
  readonly id = 'mock-bus';
  readonly name = 'Mock Intercity Coach (DEV MOCK)';
  readonly mode: TransportMode = 'bus';
  readonly officialUrl = 'https://brtc.gov.bd';

  protected defaultFare(seatClass: string): number {
    return seatClass.toUpperCase().includes('AC') ? 1200 : 680;
  }

  protected sampleTrips(query: TransportSearchQuery) {
    const cls = query.seatClass ?? 'NON_AC';
    return [
      {
        tripCode: 'MOCK-BUS-01',
        nameBn: 'ডেমো এক্সপ্রেস কোচ সকাল (MOCK)',
        nameEn: 'Demo Express Coach Morning (MOCK)',
        departTimeLocal: '08:00',
        arriveTimeLocal: '14:00',
        seatClass: cls,
      },
      {
        tripCode: 'MOCK-BUS-02',
        nameBn: 'ডেমো এক্সপ্রেস কোচ রাত (MOCK)',
        nameEn: 'Demo Express Coach Night (MOCK)',
        departTimeLocal: '22:30',
        arriveTimeLocal: '04:30',
        seatClass: cls,
      },
    ];
  }
}
