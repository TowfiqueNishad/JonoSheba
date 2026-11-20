import {
  AvailabilityState,
  IntegrationType,
  TrustLabel,
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

/**
 * R2 Compliant LinkOnlyAdapter:
 * Never scrapes or polls unauthorized systems. Returns curated official hand-off links
 * with availability = UNKNOWN_STALE and monitored = false ("not monitored").
 */
export class LinkOnlyAdapter implements TransportProviderAdapter {
  readonly id: string;
  readonly name: string;
  readonly mode: TransportMode;
  readonly officialUrl: string;
  readonly integrationType = IntegrationType.LINK_ONLY;
  readonly capabilities: ProviderCapabilities = {
    search: true,
    availability: false,
    fares: false,
    schedules: true,
  };
  readonly rateLimitPerMin = 1;

  constructor(config: {
    id: string;
    name: string;
    mode: TransportMode;
    officialUrl: string;
  }) {
    this.id = config.id;
    this.name = config.name;
    this.mode = config.mode;
    this.officialUrl = config.officialUrl;
  }

  bookingDeepLink(option: {
    originCode: string;
    destinationCode: string;
    journeyDate: string;
  }): URL {
    const url = new URL(this.officialUrl);
    url.searchParams.set('from', option.originCode);
    url.searchParams.set('to', option.destinationCode);
    url.searchParams.set('date', option.journeyDate);
    return url;
  }

  async checkAvailability(key: AvailabilityCheckKey): Promise<AvailabilityObservation> {
    const now = new Date();
    return {
      providerId: this.id,
      integrationType: IntegrationType.LINK_ONLY,
      isLive: false,
      routeKey: key.routeKey,
      journeyDate: key.journeyDate,
      seatClass: key.seatClass,
      checkedAt: now,
      observedAt: now,
      state: AvailabilityState.UNKNOWN_STALE,
      seatsAvailable: null,
      fareBdt: null,
      sourceRef: this.officialUrl,
      responseStatus: 200,
      rawHash: 'link-only-not-monitored',
    };
  }

  async search(query: TransportSearchQuery): Promise<JourneyOption[]> {
    const now = new Date();
    return [
      {
        optionId: `${this.id}:${query.originCode}:${query.destinationCode}:${query.journeyDate}`,
        providerId: this.id,
        providerName: this.name,
        mode: this.mode,
        tripCode: 'OFFICIAL-PORTAL',
        tripNameBn: `${this.name} — সরাসরি অফিশিয়াল পোর্টালে দেখুন`,
        tripNameEn: `${this.name} — Check directly on official portal`,
        originCode: query.originCode,
        destinationCode: query.destinationCode,
        journeyDate: query.journeyDate,
        departTimeLocal: '00:00',
        arriveTimeLocal: '00:00',
        seatClass: query.seatClass ?? 'ANY',
        state: AvailabilityState.UNKNOWN_STALE,
        seatsAvailable: null,
        fareBdt: null,
        fareVerified: false,
        integrationType: IntegrationType.LINK_ONLY,
        isLive: false,
        monitored: false,
        checkedAt: now.toISOString(),
        bookingUrl: this.bookingDeepLink({
          originCode: query.originCode,
          destinationCode: query.destinationCode,
          journeyDate: query.journeyDate,
        }).toString(),
        trustLabel: TrustLabel.OFFICIAL_SOURCE,
        attribution: {
          trustLabel: TrustLabel.OFFICIAL_SOURCE,
          sourceUrl: this.officialUrl,
          agency: this.name,
          lastVerifiedAt: now.toISOString(),
        },
        notReservedNoticeBn:
          'লাইভ আসন মনিটর করা হয় না — টিকিট ও আসন যাচাই করতে সরাসরি অফিশিয়াল চ্যানেলে যান।',
        notReservedNoticeEn:
          'Availability not monitored — continue to the official provider channel to check and book.',
      },
    ];
  }

  async healthCheck(): Promise<ProviderHealthStatus> {
    return {
      providerId: this.id,
      providerName: this.name,
      mode: this.mode,
      integrationType: IntegrationType.LINK_ONLY,
      isLive: false,
      capabilities: this.capabilities,
      rateLimitPerMin: this.rateLimitPerMin,
      status: 'healthy',
      circuitState: 'closed',
      latencyMs: 0,
      checkedAt: new Date().toISOString(),
    };
  }
}
