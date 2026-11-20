import { Module } from '@nestjs/common';
import { CoverageOpsController } from './coverage-ops.controller';
import { CoverageOpsService } from './coverage-ops.service';
import { GeoController } from './geo.controller';
import { GeoGazetteerService } from './geo.service';
import { OrgsCatalogHotlinesController } from './orgs-catalog-hotlines.controller';
import { OrgsCatalogHotlinesService } from './orgs-catalog-hotlines.service';
import { RailMobilityController } from './rail-mobility.controller';
import { RailMobilityService } from './rail-mobility.service';

@Module({
  controllers: [
    GeoController,
    RailMobilityController,
    OrgsCatalogHotlinesController,
    CoverageOpsController,
  ],
  providers: [
    GeoGazetteerService,
    RailMobilityService,
    OrgsCatalogHotlinesService,
    CoverageOpsService,
  ],
  exports: [
    GeoGazetteerService,
    RailMobilityService,
    OrgsCatalogHotlinesService,
    CoverageOpsService,
  ],
})
export class CoverageModule {}
