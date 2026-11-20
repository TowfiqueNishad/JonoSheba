import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { HybridRrfSearchAdapter } from './adapters/hybrid-rrf-search.adapter';
import { SeededCatalogueRepository } from './adapters/seeded-catalogue.repository';
import { CatalogueService } from './application/catalogue.service';
import { AdminCatalogueController } from './controllers/admin-catalogue.controller';
import { CatalogueController } from './controllers/catalogue.controller';
import { CitizenCatalogueController } from './controllers/citizen-catalogue.controller';
import { CATALOGUE_REPOSITORY_PORT } from './ports/catalogue.repository.port';
import { SEARCH_PORT } from './ports/search.port';

@Module({
  imports: [IdentityModule],
  controllers: [CatalogueController, CitizenCatalogueController, AdminCatalogueController],
  providers: [
    CatalogueService,
    SeededCatalogueRepository,
    HybridRrfSearchAdapter,
    { provide: CATALOGUE_REPOSITORY_PORT, useExisting: SeededCatalogueRepository },
    { provide: SEARCH_PORT, useExisting: HybridRrfSearchAdapter },
  ],
  exports: [CatalogueService, CATALOGUE_REPOSITORY_PORT, SEARCH_PORT],
})
export class CatalogueModule {}
