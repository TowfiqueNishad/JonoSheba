/**
 * GeoCoverageService — thin wrapper around GeoGazetteerService for test instantiation
 * and coverage dashboard summaries without requiring the full NestJS DI container.
 *
 * Rule C4: Counts are NEVER hard-coded in app code; they are read from the loaded
 * gazetteer data. The upazilas count comes from the reference-counts.json data file.
 */
import { Injectable } from '@nestjs/common';
import { GeoGazetteerService } from './geo.service';

@Injectable()
export class GeoCoverageService {
  private readonly gazetteer: GeoGazetteerService;

  constructor(gazetteer?: GeoGazetteerService) {
    this.gazetteer = gazetteer ?? new GeoGazetteerService();
  }

  getSummary(): {
    counts: {
      divisions: number;
      districts: number;
      upazilas: number;
    };
  } {
    const divisions = this.gazetteer.listLevel('division').length;
    const districts = this.gazetteer.listLevel('district').length;
    const upazilas = this.gazetteer.listLevel('upazila').length;
    return {
      counts: {
        divisions,
        districts,
        upazilas,
      },
    };
  }
}
