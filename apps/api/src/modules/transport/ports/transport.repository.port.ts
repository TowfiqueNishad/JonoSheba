import type {
  InventorySnapshotRecord,
  StopRecord,
  TicketWatchRecord,
  WatchMatchedEvent,
  WatchMatchRecord,
} from '../domain/transport.types';

export interface TransportRepositoryPort {
  listStops(mode?: string): Promise<StopRecord[]>;
  findStopByCode(code: string): Promise<StopRecord | null>;

  // Ticket watches
  createWatch(watch: TicketWatchRecord): Promise<TicketWatchRecord>;
  findWatchById(id: string): Promise<TicketWatchRecord | null>;
  findWatchByIdempotencyKey(userId: string, key: string): Promise<TicketWatchRecord | null>;
  listWatchesForUser(userId: string): Promise<TicketWatchRecord[]>;
  listActiveWatches(): Promise<TicketWatchRecord[]>;
  updateWatch(watch: TicketWatchRecord): Promise<TicketWatchRecord>;

  // Snapshots, matches & dedupe
  saveSnapshot(snapshot: InventorySnapshotRecord): Promise<InventorySnapshotRecord>;
  listSnapshotsForRoute(
    providerId: string,
    routeKey: string,
    journeyDate: string,
    limit?: number,
  ): Promise<InventorySnapshotRecord[]>;

  findMatchByDedupeKey(dedupeKey: string): Promise<WatchMatchRecord | null>;
  saveMatch(match: WatchMatchRecord): Promise<WatchMatchRecord>;
  listMatchesForWatch(watchId: string): Promise<WatchMatchRecord[]>;

  // Outbox events emitted on watch.matched
  appendOutboxEvent(event: WatchMatchedEvent): Promise<void>;
  listOutboxEvents(): Promise<WatchMatchedEvent[]>;
}

export const TRANSPORT_REPOSITORY_PORT = Symbol('TRANSPORT_REPOSITORY_PORT');
