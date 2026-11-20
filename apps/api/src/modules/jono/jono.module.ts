import { Module } from '@nestjs/common';
import { CatalogueModule } from '../catalogue/catalogue.module';
import { CitizenSupportModule } from '../citizen-support/citizen-support.module';
import { CoverageModule } from '../coverage/coverage.module';
import { OpportunitiesModule } from '../opportunities/opportunities.module';
import { JonoController } from './jono.controller';
import { JonoService } from './jono.service';

@Module({
  imports: [CatalogueModule, CoverageModule, OpportunitiesModule, CitizenSupportModule],
  controllers: [JonoController],
  providers: [JonoService],
  exports: [JonoService],
})
export class JonoModule {}
