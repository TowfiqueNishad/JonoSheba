import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { SeededOpportunitiesRepository } from './adapters/seeded-opportunities.repository';
import { OpportunitiesService } from './application/opportunities.service';
import { OpportunitiesController } from './controllers/opportunities.controller';
import { OPPORTUNITIES_REPOSITORY_PORT } from './ports/opportunities.repository.port';

@Module({
  imports: [IdentityModule],
  controllers: [OpportunitiesController],
  providers: [
    OpportunitiesService,
    SeededOpportunitiesRepository,
    { provide: OPPORTUNITIES_REPOSITORY_PORT, useExisting: SeededOpportunitiesRepository },
  ],
  exports: [OpportunitiesService, OPPORTUNITIES_REPOSITORY_PORT],
})
export class OpportunitiesModule {}
