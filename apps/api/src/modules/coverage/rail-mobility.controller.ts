import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { applyEtagAndCheckNotModified } from '../catalogue/domain/http-helpers';
import { RailMobilityService } from './rail-mobility.service';

const BusReportSchema = z.object({
  operator: z.string().min(2).max(120),
  route: z.string().min(2).max(120),
  issue: z.enum(['overcharging', 'unsafe_driving', 'cancellation', 'other']),
  details: z.string().min(5).max(1000),
});

@ApiTags('Bangladesh Railway, Metro, Bus, Water & Air (C02–C05)')
@Controller('api/v1')
export class RailMobilityController {
  constructor(private readonly mobility: RailMobilityService) {}

  // --- C02: Rail ---
  @Get('rail/stations')
  @ApiOperation({ summary: 'Search source-backed Bangladesh Railway stations (bn/en/Banglish/aliases)' })
  railStations(
    @Query('q') q: string | undefined,
    @Query('district') district: string | undefined,
    @Query('status') status: string | undefined,
    @Query('eticket') eticket: string | undefined,
    @Query('includeDemo') includeDemo: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = this.mobility.listStations({
      q,
      district,
      status,
      eticket: eticket === 'true' ? true : eticket === 'false' ? false : undefined,
      includeDemo: includeDemo === 'true',
    });
    if (applyEtagAndCheckNotModified(req, res, data, 300, 3600)) return;
    return data;
  }

  @Get('rail/stations/:code')
  @ApiOperation({ summary: 'Station details, calling trains, facilities & official channels' })
  railStationByCode(@Param('code') code: string) {
    return this.mobility.getStation(code);
  }

  @Get('rail/trains')
  @ApiOperation({ summary: 'Find all trains between ANY two stops (off-day aware in Asia/Dhaka)' })
  railTrains(@Query('from') from = 'DA', @Query('to') to = 'CTG', @Query('date') date?: string) {
    return this.mobility.findTrainsBetween({ from, to, date });
  }

  @Get('rail/trains/:number')
  @ApiOperation({ summary: 'Full stop sequence & timetable metadata for a train number' })
  railTrainByNumber(@Param('number') num: string) {
    return this.mobility.getTrainByNumber(num);
  }

  @Get('rail/routes/plan')
  @ApiOperation({ summary: 'Direct + 1-change Bangladesh Railway route planner' })
  railRoutePlan(@Query('from') from = 'DA', @Query('to') to = 'CTG', @Query('date') date?: string) {
    return this.mobility.planRailRoute(from, to, date);
  }

  @Get('rail/eid-schedule')
  @ApiOperation({ summary: 'Official Eid advance-ticket sale schedule & reminders' })
  railEidSchedule() {
    return this.mobility.getRailEidSchedule();
  }

  @Get('rail/refund-rules')
  @ApiOperation({ summary: 'Official Bangladesh Railway ticket refund rules' })
  railRefundRules() {
    return this.mobility.getRailRefundRules();
  }

  @Get('rail/channels')
  @ApiOperation({ summary: 'Verified official railway ticketing channels + fraud warning (Rule C6)' })
  railChannels() {
    return this.mobility.getRailChannels();
  }

  @Get('rail/notices')
  @ApiOperation({ summary: 'Official Bangladesh Railway notices (fraud warnings, closures, Eid specials)' })
  railNotices() {
    return this.mobility.getRailNotices();
  }

  // --- C03: Metro, BRT & Tolls ---
  @Get('metro/lines')
  @ApiOperation({ summary: 'Dhaka Metro (DMTCL) lines & BRT statuses (counts strictly data-driven)' })
  metroLines() {
    return this.mobility.getMetroLines();
  }

  @Get('metro/stations')
  @ApiOperation({ summary: 'Dhaka Metro stations with operational/construction status' })
  metroStations(@Query('line') line?: string, @Query('status') status?: string) {
    return this.mobility.getMetroStations(line, status);
  }

  @Get('metro/fare')
  @ApiOperation({ summary: 'DMTCL official MRT-6 single journey & Rapid/MRT Pass fare' })
  metroFare(@Query('from') from = 'Uttara North', @Query('to') to = 'Motijheel') {
    return this.mobility.getMetroFare(from, to);
  }

  @Get('metro/timetable')
  @ApiOperation({ summary: 'Dhaka Metro first/last train & peak/off-peak headways' })
  metroTimetable() {
    return this.mobility.getMetroTimetable();
  }

  @Get('tolls')
  @ApiOperation({ summary: 'Bridge, tunnel & expressway tolls (matches old & new names via name_history)' })
  tolls(@Query('asset') asset?: string, @Query('vehicle_class') vehicleClass?: string) {
    return this.mobility.getTolls(asset, vehicleClass);
  }

  // --- C04: Bus ---
  @Get('bus/operators')
  @ApiOperation({ summary: 'Verified bus operator directory & BRTC e-ticket pilot routes' })
  busOperators() {
    return this.mobility.listBusOperators();
  }

  @Get('bus/routes')
  @ApiOperation({ summary: 'Intercity bus routes with BRTA official per-km fare reference' })
  busRoutes(@Query('from') from?: string, @Query('to') to?: string) {
    return this.mobility.listBusRoutes(from, to);
  }

  @Get('bus/terminals')
  @ApiOperation({ summary: 'Inter-district bus terminals (OSM ODbL attributed)' })
  busTerminals() {
    return this.mobility.listBusTerminals();
  }

  @Get('bus/fare-estimate')
  @ApiOperation({ summary: 'BRTA official per-km bus fare estimator (anti-overcharging protection)' })
  busFareEstimate(
    @Query('from') from = 'Dhaka',
    @Query('to') to = 'Chattogram',
    @Query('type') type: 'intercity' | 'city' = 'intercity',
  ) {
    return this.mobility.estimateBrtaBusFare(from, to, type);
  }

  @Get('bus/city-routes')
  @ApiOperation({ summary: 'Dhaka & Chattogram city bus routes' })
  busCityRoutes(@Query('city') city?: string, @Query('q') q?: string) {
    return this.mobility.listCityBusRoutes(city, q);
  }

  @Post('bus/reports')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit moderated COMMUNITY_REPORT for bus overcharging/safety + 999 hand-off' })
  busReport(@Body(new ZodValidationPipe(BusReportSchema)) body: z.infer<typeof BusReportSchema>) {
    return this.mobility.submitBusCrowdReport(body);
  }

  @Get('bus/coverage')
  @ApiOperation({ summary: 'Data-driven district transport coverage summary (rail stations, bus terminals & BRTA fare estimates)' })
  busDistrictCoverage() {
    return this.mobility.getTransportDistrictCoverage();
  }

  // --- C05: Water, Air & Multimodal Planner ---
  @Get('water/routes')
  @ApiOperation({ summary: 'BIWTA / BIWTC launch & ferry routes with BMD weather warning links' })
  waterRoutes() {
    return this.mobility.getWaterRoutes();
  }

  @Get('water/ghats')
  @ApiOperation({ summary: 'River ports, launch terminals & ferry ghats' })
  waterGhats() {
    return this.mobility.getWaterGhats();
  }

  @Get('air/routes')
  @ApiOperation({ summary: 'Domestic Bangladesh air routes with official airline links' })
  airRoutes() {
    return this.mobility.getAirRoutes();
  }

  @Get('journeys/plan')
  @ApiOperation({ summary: 'Unified multimodal planner (rail + metro + bus + launch + air)' })
  planJourney(
    @Query('from') from = 'Dhaka',
    @Query('to') to = 'Chattogram',
    @Query('date') date?: string,
    @Query('preference')
    preference?: 'cheapest' | 'fastest' | 'fewest_changes' | 'women_friendly' | 'accessible',
  ) {
    return this.mobility.planMultimodalJourney({ from, to, date, preference });
  }
}
