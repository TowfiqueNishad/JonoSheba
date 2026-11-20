import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { applyEtagAndCheckNotModified } from '../catalogue/domain/http-helpers';
import { OrgsCatalogHotlinesService } from './orgs-catalog-hotlines.service';

const EligibilityPayloadSchema = z.object({
  answers: z.record(z.string(), z.unknown()).default({}),
});

const PlaceReportSchema = z.object({
  issue: z.enum(['closed', 'wrong_phone', 'moved', 'wrong_hours', 'other']),
  details: z.string().min(4).max(1000),
});

@ApiTags('Organisations, Taxonomy, Programmes, Places, Calendar & Hotlines (C06–C10)')
@Controller('api/v1')
export class OrgsCatalogHotlinesController {
  constructor(private readonly service: OrgsCatalogHotlinesService) {}

  // --- C06 & Section 3: Orgs, Ministries, Leadership & Office Resolver ---
  @Get('orgs')
  @ApiOperation({
    summary:
      'Search government organisations & ministries (filter by ?type=, ?group=, ?q=, ?geo=)',
  })
  listOrgs(
    @Query('q') q?: string,
    @Query('type') type?: string,
    @Query('group') group?: string,
    @Query('geo') geo?: string,
  ) {
    return this.service.listOrgs({ q, type, group, geo });
  }

  @Get('orgs/:id')
  @ApiOperation({
    summary: 'Get organisation profile with Leadership (প্রধানগণ), contacts, GRS/RTI, Citizen Charter & children',
  })
  getOrg(@Param('id') id: string) {
    return this.service.getOrg(id);
  }

  @Get('orgs/:id/children')
  @ApiOperation({ summary: 'List departments, directorates & agencies under a ministry/division' })
  getOrgChildren(@Param('id') id: string) {
    return this.service.getOrgChildren(id);
  }

  @Get('orgs/:id/services')
  @ApiOperation({ summary: 'List services offered by an organisation' })
  getOrgServices(@Param('id') id: string) {
    return this.service.getOrgServices(id);
  }

  @Get('offices/resolve')
  @ApiOperation({ summary: '"Who handles this here?" resolver given service + lat/lng' })
  resolveOffice(
    @Query('service') service = 'birth-registration',
    @Query('lat') latStr = '23.4607',
    @Query('lng') lngStr = '91.1809',
  ) {
    return this.service.resolveResponsibleOffice(
      service,
      Number.parseFloat(latStr) || 23.8103,
      Number.parseFloat(lngStr) || 90.4125,
    );
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Public live data-driven platform counts (divisions, districts, upazilas, stations, services, verified hotlines)',
  })
  stats(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const data = this.service.getPublicStats();
    if (applyEtagAndCheckNotModified(req, res, data, 300, 600)) return;
    return data;
  }

  // --- C07: 18-Category Taxonomy, Life-Event Bundles & Programmes ---
  @Get('services/taxonomy')
  @ApiOperation({ summary: 'Complete 18-category Bangladesh public service taxonomy' })
  taxonomy(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const data = this.service.getTaxonomy();
    if (applyEtagAndCheckNotModified(req, res, data, 300, 600)) return;
    return data;
  }

  @Get('services/life-event-bundles')
  @ApiOperation({ summary: '40+ Bangladesh citizen life-event service bundles' })
  lifeEventBundles(@Query('category') category?: string) {
    return this.service.getLifeEventBundles(category);
  }

  @Get('programmes')
  @ApiOperation({ summary: 'Social protection programmes (incl. Family Card 2026) with freshness SLA check' })
  listProgrammes(@Query('q') q?: string) {
    return this.service.listProgrammes(q);
  }

  @Get('programmes/:slug')
  @ApiOperation({ summary: 'Get social protection programme details & eligibility criteria' })
  getProgramme(@Param('slug') slug: string) {
    return this.service.getProgramme(slug);
  }

  @Post('programmes/:slug/eligibility')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deterministic social protection eligibility check (Family Card negative list & DSS rules)' })
  evaluateProgramme(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(EligibilityPayloadSchema)) body: z.infer<typeof EligibilityPayloadSchema>,
  ) {
    return this.service.evaluateProgrammeEligibility(slug, body.answers);
  }

  // --- C08: Places & District Offline Packs ---
  @Get('places')
  @ApiOperation({ summary: 'Nationwide facilities & POI directory (DGHS, DDM, OSM ODbL)' })
  listPlaces(
    @Query('type') type?: string,
    @Query('district') district?: string,
    @Query('accessible') accessible?: string,
    @Query('open_now') openNow?: string,
  ) {
    return this.service.listPlaces({
      type,
      district,
      accessible: accessible === 'true' ? true : accessible === 'false' ? false : undefined,
      openNow: openNow === 'true',
    });
  }

  @Get('places/:id')
  @ApiOperation({ summary: 'Get facility/place details with source & ODbL attribution' })
  getPlace(@Param('id') id: string) {
    return this.service.getPlace(id);
  }

  @Post('places/:id/report')
  @ApiOperation({ summary: 'Report closed/wrong/moved facility (queued for review)' })
  reportPlace(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(PlaceReportSchema)) body: z.infer<typeof PlaceReportSchema>,
  ) {
    return this.service.reportPlaceIssue(id, body);
  }

  @Get('offline-packs/:district')
  @ApiOperation({ summary: 'Downloadable per-district GeoJSON offline pack with emergency hotlines & ODbL attribution' })
  offlinePack(@Param('district') district: string) {
    return this.service.getDistrictOfflinePack(district);
  }

  // --- C09: National Calendar ---
  @Get('calendar')
  @ApiOperation({ summary: 'Bangladesh national calendar (holidays, tax deadlines, Eid sale windows)' })
  calendar(@Query('year') year?: string, @Query('type') type?: string) {
    return this.service.getCalendar(year, type);
  }

  @Get('calendar.ics')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @ApiOperation({ summary: 'RFC 5545 iCalendar export of national citizen deadlines' })
  calendarIcs(@Query('year') year?: string) {
    return this.service.buildCalendarIcs(year);
  }

  // --- C10 & Section 3: Hotlines & Deterministic Decision Helper ---
  @Get('hotlines')
  @ApiOperation({ summary: 'Complete Bangladesh national & utility hotline directory (?category=&org=&q=)' })
  hotlines(
    @Query('category') category: string | undefined,
    @Query('org') org: string | undefined,
    @Query('q') q: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = this.service.listHotlines(category, org, q);
    if (applyEtagAndCheckNotModified(req, res, data, 3600, 86400)) return;
    return data;
  }

  @Get('hotlines/decide')
  @ApiOperation({ summary: 'Deterministic "Which number do I call?" decision helper citing official sources (C10)' })
  decideHotline(@Query('situation') situation = 'emergency') {
    return this.service.decideHotline(situation);
  }
}
