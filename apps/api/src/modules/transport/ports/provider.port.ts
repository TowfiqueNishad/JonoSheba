import type { IntegrationType } from '@jonoshheba/shared';
import type {
  AvailabilityCheckKey,
  AvailabilityObservation,
  JourneyOption,
  ProviderCapabilities,
  ProviderHealthStatus,
  TransportMode,
  TransportSearchQuery,
} from '../domain/transport.types';

/**
 * Provider Adapter Contract (Prompt 05 & Rule R2).
 * NO scraping adapters may ever implement this interface.
 */
export interface TransportProviderAdapter {
  readonly id: string;
  readonly name: string;
  readonly mode: TransportMode;
  readonly integrationType: IntegrationType;
  readonly capabilities: ProviderCapabilities;
  readonly rateLimitPerMin: number;
  readonly officialUrl: string;

  search(query: TransportSearchQuery): Promise<JourneyOption[]>;
  checkAvailability(key: AvailabilityCheckKey): Promise<AvailabilityObservation>;
  healthCheck(): Promise<ProviderHealthStatus>;
  bookingDeepLink(option: {
    originCode: string;
    destinationCode: string;
    journeyDate: string;
    tripCode?: string;
  }): URL;
}

export const TRANSPORT_PROVIDERS_PORT = Symbol('TRANSPORT_PROVIDERS_PORT');
