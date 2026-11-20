import { Injectable } from '@nestjs/common';
import { WatchStatus } from '@jonoshheba/shared';
import { BUS_STOPS_SEED, RAIL_STATIONS_SEED } from '../../../seed-data/transport';
import type {
  InventorySnapshotRecord,
  StopRecord,
  TicketWatchRecord,
  WatchMatchedEvent,
  WatchMatchRecord,
} from '../domain/transport.types';
import type { TransportRepositoryPort } from '../ports/transport.repository.port';

@Injectable()
export class InMemoryTransportRepository implements TransportRepositoryPort {
  private readonly stops: StopRecord[] = [...RAIL_STATIONS_SEED, ...BUS_STOPS_SEED];
  private readonly watches = new Map<string, TicketWatchRecord>();
  private readonly snapshots: InventorySnapshotRecord[] = [];
  private readonly matches = new Map<string, WatchMatchRecord>(); // keyed by dedupeKey
  private readonly outbox: WatchMatchedEvent[] = [];

  async listStops(mode?: string): Promise<StopRecord[]> {
    return this.stops.filter((s) => (!mode ? true : s.mode === mode));
  }

  async findStopByCode(code: string): Promise<StopRecord | null> {
    const upper = code.toUpperCase();
    return this.stops.find((s) => s.code.toUpperCase() === upper) ?? null;
  }

  async createWatch(watch: TicketWatchRecord): Promise<TicketWatchRecord> {
    this.watches.set(watch.id, watch);
    return watch;
  }

  async findWatchById(id: string): Promise<TicketWatchRecord | null> {
    return this.watches.get(id) ?? null;
  }

  async findWatchByIdempotencyKey(userId: string, key: string): Promise<TicketWatchRecord | null> {
    for (const w of this.watches.values()) {
      if (w.userId === userId && w.idempotencyKey === key) return w;
    }
    return null;
  }

  async listWatchesForUser(userId: string): Promise<TicketWatchRecord[]> {
    return [...this.watches.values()]
      .filter((w) => w.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async listActiveWatches(): Promise<TicketWatchRecord[]> {
    return [...this.watches.values()].filter(
      (w) => w.status === WatchStatus.ACTIVE || w.status === WatchStatus.NOTIFIED,
    );
  }

  async updateWatch(watch: TicketWatchRecord): Promise<TicketWatchRecord> {
    watch.updatedAt = new Date();
    this.watches.set(watch.id, watch);
    return watch;
  }

  async saveSnapshot(snapshot: InventorySnapshotRecord): Promise<InventorySnapshotRecord> {
    this.snapshots.push(snapshot);
    return snapshot;
  }

  async listSnapshotsForRoute(
    providerId: string,
    routeKey: string,
    journeyDate: string,
    limit = 30,
  ): Promise<InventorySnapshotRecord[]> {
    return this.snapshots
      .filter(
        (s) =>
          s.providerId === providerId &&
          s.routeKey === routeKey &&
          s.journeyDate === journeyDate,
      )
      .slice(-limit)
      .reverse();
  }

  async findMatchByDedupeKey(dedupeKey: string): Promise<WatchMatchRecord | null> {
    return this.matches.get(dedupeKey) ?? null;
  }

  async saveMatch(match: WatchMatchRecord): Promise<WatchMatchRecord> {
    this.matches.set(match.dedupeKey, match);
    return match;
  }

  async listMatchesForWatch(watchId: string): Promise<WatchMatchRecord[]> {
    return [...this.matches.values()]
      .filter((m) => m.watchId === watchId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async appendOutboxEvent(event: WatchMatchedEvent): Promise<void> {
    this.outbox.push(event);
  }

  async listOutboxEvents(): Promise<WatchMatchedEvent[]> {
    return [...this.outbox];
  }
}
