import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IntegrationType, WatchStatus } from '@jonoshheba/shared';
import { uuidv7 } from '../../../common/uuidv7';
import { normalizeBanglaText, trigramSimilarity } from '../../catalogue/domain/bangla-nlp';
import {
  dhakaEndOfDayUtc,
  getBangladeshDemandHint,
  getNearbyDhakaDates,
} from '../domain/dhaka-time';
import type {
  JourneyOption,
  ProviderHealthStatus,
  TicketWatchRecord,
  TransportMode,
  TransportSearchQuery,
} from '../domain/transport.types';
import { transitionWatchStatus } from '../domain/watch-state-machine';
import {
  TRANSPORT_PROVIDERS_PORT,
  type TransportProviderAdapter,
} from '../ports/provider.port';
import {
  TRANSPORT_REPOSITORY_PORT,
  type TransportRepositoryPort,
} from '../ports/transport.repository.port';

const MAX_ACTIVE_WATCHES_PER_USER = 10;

@Injectable()
export class TransportService {
  constructor(
    @Inject(TRANSPORT_REPOSITORY_PORT)
    private readonly repo: TransportRepositoryPort,
    @Inject(TRANSPORT_PROVIDERS_PORT)
    private readonly providers: TransportProviderAdapter[],
  ) {}

  async searchStops(query: string, mode?: string, limit = 15) {
    const stops = await this.repo.listStops(mode);
    const norm = normalizeBanglaText(query);
    if (!norm) {
      return stops.slice(0, limit);
    }

    return stops
      .map((s) => {
        const bn = normalizeBanglaText(s.nameBn);
        const en = normalizeBanglaText(s.nameEn);
        const code = s.code.toLowerCase();
        const aliases = s.aliases.map(normalizeBanglaText);
        let score = 0;
        if (code === norm || bn === norm || en === norm || aliases.includes(norm)) score += 20;
        if (bn.startsWith(norm) || en.startsWith(norm) || aliases.some((a) => a.startsWith(norm))) {
          score += 12;
        }
        if (bn.includes(norm) || en.includes(norm) || aliases.some((a) => a.includes(norm))) {
          score += 6;
        }
        score += Math.max(
          trigramSimilarity(norm, bn),
          trigramSimilarity(norm, en),
          ...aliases.map((a) => trigramSimilarity(norm, a)),
        ) * 8;
        return { stop: s, score };
      })
      .filter((x) => x.score >= 1.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => x.stop);
  }

  async searchJourneys(query: TransportSearchQuery) {
    const origin = await this.repo.findStopByCode(query.originCode);
    const destination = await this.repo.findStopByCode(query.destinationCode);
    if (!origin) throw new BadRequestException(`Unknown origin stop '${query.originCode}'`);
    if (!destination) {
      throw new BadRequestException(`Unknown destination stop '${query.destinationCode}'`);
    }
    if (origin.code === destination.code) {
      throw new BadRequestException('Origin and destination stops must be different');
    }

    const matchingProviders = this.providers.filter((p) => p.mode === query.mode);
    const optionsNested = await Promise.all(matchingProviders.map((p) => p.search(query)));
    const options: JourneyOption[] = optionsNested.flat();

    // Alternatives: nearby dates (+/-3 days), nearby stops in same district, and alternate mode
    const allStops = await this.repo.listStops();
    const nearbyOriginStops = allStops
      .filter((s) => s.districtEn === origin.districtEn && s.code !== origin.code)
      .slice(0, 4)
      .map((s) => ({ code: s.code, mode: s.mode, nameBn: s.nameBn, nameEn: s.nameEn }));

    const alternateMode: TransportMode = query.mode === 'train' ? 'bus' : 'train';
    const altOrigin = allStops.find(
      (s) => s.mode === alternateMode && s.districtEn === origin.districtEn,
    );
    const altDest = allStops.find(
      (s) => s.mode === alternateMode && s.districtEn === destination.districtEn,
    );

    return {
      query,
      origin,
      destination,
      demandHint: getBangladeshDemandHint(query.journeyDate),
      options,
      alternatives: {
        nearbyDates: getNearbyDhakaDates(query.journeyDate, 3),
        nearbyOriginStops,
        alternateMode:
          altOrigin && altDest
            ? {
                mode: alternateMode,
                originCode: altOrigin.code,
                destinationCode: altDest.code,
              }
            : null,
      },
      disclaimerBn:
        'জনসেবা নিজে টিকিট বিক্রি বা আসন সংরক্ষণ করে না — বুকিংয়ের জন্য অফিশিয়াল চ্যানেলে এগিয়ে যান।',
      disclaimerEn:
        'Jonoshheba does not sell tickets or reserve seats — continue to the official channel to book.',
    };
  }

  async createTicketWatch(
    userId: string,
    dto: {
      mode: TransportMode;
      providerId?: string;
      originCode: string;
      destinationCode: string;
      journeyDate: string;
      passengers: number;
      preferences?: TicketWatchRecord['preferences'];
      flexibility?: TicketWatchRecord['flexibility'];
      channels?: string[];
    },
    idempotencyKey?: string,
  ): Promise<TicketWatchRecord> {
    // Idempotency-Key deduplication on resource-creating POST
    if (idempotencyKey) {
      const existing = await this.repo.findWatchByIdempotencyKey(userId, idempotencyKey);
      if (existing) return existing;
    }

    const origin = await this.repo.findStopByCode(dto.originCode);
    const destination = await this.repo.findStopByCode(dto.destinationCode);
    if (!origin || !destination) {
      throw new BadRequestException('Invalid origin or destination stop code');
    }

    // Select a watchable provider (reject LINK_ONLY providers that forbid monitoring per Rule R2)
    const provider = dto.providerId
      ? this.providers.find((p) => p.id === dto.providerId)
      : this.providers.find((p) => p.mode === dto.mode && p.capabilities.availability);

    if (!provider) {
      throw new BadRequestException(`No watchable provider available for mode '${dto.mode}'`);
    }
    if (provider.integrationType === IntegrationType.LINK_ONLY || !provider.capabilities.availability) {
      throw new BadRequestException(
        `Provider '${provider.id}' is LINK_ONLY (not monitored) and cannot back automated watches (Rule R2).`,
      );
    }

    // Enforce max active watches per citizen
    const userWatches = await this.repo.listWatchesForUser(userId);
    const activeCount = userWatches.filter(
      (w) =>
        w.status === WatchStatus.ACTIVE ||
        w.status === WatchStatus.MATCHED ||
        w.status === WatchStatus.NOTIFIED ||
        w.status === WatchStatus.PAUSED,
    ).length;
    if (activeCount >= MAX_ACTIVE_WATCHES_PER_USER) {
      throw new BadRequestException(
        `Maximum of ${MAX_ACTIVE_WATCHES_PER_USER} active ticket watches reached. Cancel or pause an existing watch first.`,
      );
    }

    const expiresAt = dhakaEndOfDayUtc(dto.journeyDate);
    if (expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Journey date is already in the past (Asia/Dhaka)');
    }

    const now = new Date();
    const watch: TicketWatchRecord = {
      id: uuidv7(),
      userId,
      providerId: provider.id,
      mode: dto.mode,
      originCode: origin.code,
      destinationCode: destination.code,
      routeKey: `${provider.id}:${origin.code}:${destination.code}`,
      journeyDate: dto.journeyDate,
      passengers: dto.passengers,
      preferences: dto.preferences ?? {},
      flexibility: dto.flexibility ?? {},
      channels: dto.channels ?? ['in_app', 'web_push'],
      status: WatchStatus.ACTIVE,
      priority: 1,
      expiresAt,
      lastCheckedAt: null,
      consecutiveErrors: 0,
      completedByUser: false,
      idempotencyKey: idempotencyKey ?? null,
      createdAt: now,
      updatedAt: now,
    };

    return this.repo.createWatch(watch);
  }

  async listWatches(userId: string): Promise<TicketWatchRecord[]> {
    return this.repo.listWatchesForUser(userId);
  }

  async getWatchDetail(userId: string, watchId: string) {
    const watch = await this.repo.findWatchById(watchId);
    if (!watch) throw new NotFoundException('Ticket watch not found');
    if (watch.userId !== userId) {
      throw new ForbiddenException('You cannot view another citizen’s ticket watch');
    }
    const [snapshots, matches] = await Promise.all([
      this.repo.listSnapshotsForRoute(watch.providerId, watch.routeKey, watch.journeyDate, 20),
      this.repo.listMatchesForWatch(watch.id),
    ]);
    return {
      watch,
      timeline: {
        snapshots,
        matches,
      },
    };
  }

  async mutateWatch(
    userId: string,
    watchId: string,
    dto: {
      action: 'pause' | 'resume' | 'cancel' | 'update';
      preferences?: TicketWatchRecord['preferences'];
      flexibility?: TicketWatchRecord['flexibility'];
      channels?: string[];
    },
  ): Promise<TicketWatchRecord> {
    const watch = await this.repo.findWatchById(watchId);
    if (!watch) throw new NotFoundException('Ticket watch not found');
    if (watch.userId !== userId) {
      throw new ForbiddenException('You cannot modify another citizen’s ticket watch');
    }

    if (dto.action === 'update') {
      if (dto.preferences) watch.preferences = { ...watch.preferences, ...dto.preferences };
      if (dto.flexibility) watch.flexibility = { ...watch.flexibility, ...dto.flexibility };
      if (dto.channels) watch.channels = dto.channels;
    } else {
      watch.status = transitionWatchStatus(watch.status, dto.action);
      if (dto.action === 'resume') {
        watch.consecutiveErrors = 0;
      }
    }

    return this.repo.updateWatch(watch);
  }

  async completeWatch(userId: string, watchId: string): Promise<TicketWatchRecord> {
    const watch = await this.repo.findWatchById(watchId);
    if (!watch) throw new NotFoundException('Ticket watch not found');
    if (watch.userId !== userId) {
      throw new ForbiddenException('You cannot complete another citizen’s ticket watch');
    }
    watch.status = transitionWatchStatus(watch.status, 'complete');
    watch.completedByUser = true;
    return this.repo.updateWatch(watch);
  }

  async getProvidersHealth(): Promise<ProviderHealthStatus[]> {
    return Promise.all(this.providers.map((p) => p.healthCheck()));
  }
}
