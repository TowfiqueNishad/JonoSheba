import type {
  AvailabilityState,
  IntegrationType,
  TrustAttribution,
  TrustLabel,
  WatchStatus,
} from '@jonoshheba/shared';

export type TransportMode = 'train' | 'bus' | 'launch' | 'flight' | 'metro';

export interface ProviderCapabilities {
  search: boolean;
  availability: boolean;
  fares: boolean;
  schedules: boolean;
}

export interface StopRecord {
  code: string;
  mode: TransportMode;
  nameBn: string;
  nameEn: string;
  districtEn: string;
  lat: number;
  lng: number;
  aliases: string[];
}

export interface TransportSearchQuery {
  mode: TransportMode;
  originCode: string;
  destinationCode: string;
  journeyDate: string; // YYYY-MM-DD in Asia/Dhaka
  passengers: number;
  seatClass?: string;
  operator?: string;
  departWindow?: { startHour: number; endHour: number };
}

export interface AvailabilityCheckKey {
  providerId: string;
  mode: TransportMode;
  routeKey: string;
  originCode: string;
  destinationCode: string;
  journeyDate: string; // YYYY-MM-DD in Asia/Dhaka
  seatClass: string;
}

export interface AvailabilityObservation {
  providerId: string;
  integrationType: IntegrationType;
  isLive: boolean;
  routeKey: string;
  journeyDate: string;
  seatClass: string;
  checkedAt: Date;
  observedAt: Date; // upstream timestamp (may be older than checkedAt -> staleness check!)
  state: AvailabilityState;
  seatsAvailable: number | null;
  fareBdt: number | null;
  sourceRef: string;
  responseStatus: number;
  rawHash: string;
  errorMessage?: string;
}

export interface JourneyOption {
  optionId: string;
  providerId: string;
  providerName: string;
  mode: TransportMode;
  tripCode: string;
  tripNameBn: string;
  tripNameEn: string;
  originCode: string;
  destinationCode: string;
  journeyDate: string;
  departTimeLocal: string;
  arriveTimeLocal: string;
  seatClass: string;
  state: AvailabilityState;
  seatsAvailable: number | null;
  fareBdt: number | null;
  fareVerified: boolean;
  integrationType: IntegrationType;
  isLive: boolean;
  monitored: boolean;
  checkedAt: string;
  bookingUrl: string;
  trustLabel: TrustLabel;
  attribution: TrustAttribution;
  notReservedNoticeBn: string;
  notReservedNoticeEn: string;
  mockLabel?: string;
}

export interface ProviderHealthStatus {
  providerId: string;
  providerName: string;
  mode: TransportMode;
  integrationType: IntegrationType;
  isLive: boolean;
  capabilities: ProviderCapabilities;
  rateLimitPerMin: number;
  status: 'healthy' | 'degraded' | 'down';
  circuitState: 'closed' | 'open' | 'half_open';
  latencyMs: number;
  checkedAt: string;
}

export interface TicketWatchRecord {
  id: string;
  userId: string;
  providerId: string;
  mode: TransportMode;
  originCode: string;
  destinationCode: string;
  routeKey: string;
  journeyDate: string; // YYYY-MM-DD (Asia/Dhaka)
  passengers: number;
  preferences: {
    trainName?: string;
    seatClass?: string;
    operator?: string;
    seatType?: string;
    departWindow?: { startHour: number; endHour: number };
  };
  flexibility: {
    altDatesDays?: number; // +/- n days
    nearbyStops?: boolean;
    maxFareBdt?: number;
  };
  channels: string[];
  status: WatchStatus;
  priority: number;
  expiresAt: Date;
  lastCheckedAt: Date | null;
  consecutiveErrors: number;
  completedByUser: boolean;
  idempotencyKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventorySnapshotRecord {
  id: string;
  providerId: string;
  routeKey: string;
  journeyDate: string;
  seatClass: string;
  checkedAt: Date;
  state: AvailabilityState;
  seatsAvailable: number | null;
  fareBdt: number | null;
  sourceRef: string;
  responseStatus: number;
  rawHash: string;
}

export interface WatchMatchRecord {
  id: string;
  watchId: string;
  snapshotId: string;
  matchQuality: 'exact' | 'partial';
  explanationBn: string;
  explanationEn: string;
  dedupeKey: string;
  notifiedAt: Date;
  createdAt: Date;
}

export interface WatchMatchedEvent {
  eventType: 'watch.matched';
  eventId: string;
  dedupeKey: string;
  watchId: string;
  userId: string;
  providerId: string;
  integrationType: IntegrationType;
  routeKey: string;
  journeyDate: string;
  seatClass: string;
  state: AvailabilityState;
  matchQuality: 'exact' | 'partial';
  bookingUrl: string;
  alertCopyBn: string;
  alertCopyEn: string;
  emittedAt: string;
}
