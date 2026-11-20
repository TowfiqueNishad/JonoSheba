import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { InMemoryTransportRepository } from './adapters/in-memory-transport.repository';
import { LinkOnlyAdapter } from './adapters/link-only.adapter';
import { MockBusAdapter, MockRailAdapter } from './adapters/mock.adapters';
import { TransportService } from './application/transport.service';
import { WatchEngineService } from './application/watch-engine.service';
import { TicketWatchesController } from './controllers/ticket-watches.controller';
import { TransportController } from './controllers/transport.controller';
import { TRANSPORT_PROVIDERS_PORT } from './ports/provider.port';
import { TRANSPORT_REPOSITORY_PORT } from './ports/transport.repository.port';

@Module({
  imports: [IdentityModule],
  controllers: [TransportController, TicketWatchesController],
  providers: [
    TransportService,
    WatchEngineService,
    InMemoryTransportRepository,
    MockRailAdapter,
    MockBusAdapter,
    { provide: TRANSPORT_REPOSITORY_PORT, useExisting: InMemoryTransportRepository },
    {
      provide: TRANSPORT_PROVIDERS_PORT,
      useFactory: (mockRail: MockRailAdapter, mockBus: MockBusAdapter) => [
        mockRail,
        mockBus,
        new LinkOnlyAdapter({
          id: 'bd-railway-link',
          name: 'Bangladesh Railway e-Ticketing (Official Portal)',
          mode: 'train',
          officialUrl: 'https://eticket.railway.gov.bd',
        }),
        new LinkOnlyAdapter({
          id: 'brtc-link',
          name: 'BRTC Official Bus Directory',
          mode: 'bus',
          officialUrl: 'https://brtc.gov.bd',
        }),
      ],
      inject: [MockRailAdapter, MockBusAdapter],
    },
  ],
  exports: [
    TransportService,
    WatchEngineService,
    TRANSPORT_REPOSITORY_PORT,
    TRANSPORT_PROVIDERS_PORT,
  ],
})
export class TransportModule {}
