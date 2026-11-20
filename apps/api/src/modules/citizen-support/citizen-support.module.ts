import { Module } from '@nestjs/common';
import { CatalogueModule } from '../catalogue/catalogue.module';
import { IdentityModule } from '../identity/identity.module';
import { CasesService } from './application/cases.service';
import { EmergencyHealthUtilityService } from './application/emergency-health-utility.service';
import { CasesController } from './controllers/cases.controller';
import { EmergencyHealthUtilityController } from './controllers/emergency-health-utility.controller';

@Module({
  imports: [IdentityModule, CatalogueModule],
  controllers: [CasesController, EmergencyHealthUtilityController],
  providers: [CasesService, EmergencyHealthUtilityService],
  exports: [CasesService, EmergencyHealthUtilityService],
})
export class CitizenSupportModule {}
