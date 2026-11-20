import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { z } from 'zod';
import type { LocalizedRequest } from '../../../common/locale.middleware';
import { ZodValidationPipe } from '../../../common/zod-validation.pipe';
import { CatalogueService } from '../application/catalogue.service';
import type { SearchItemType } from '../domain/catalogue.types';
import {
  applyEtagAndCheckNotModified,
  parseStrictLimit,
  projectFields,
  resolveLocale,
} from '../domain/http-helpers';

const ContentReportSchema = z.object({
  resourceType: z.string().min(2).max(48),
  resourceId: z.string().min(2).max(128),
  reason: z.enum(['outdated_fee', 'broken_link', 'wrong_steps', 'wrong_hotline', 'other']),
  details: z.string().min(5).max(2000),
});

@ApiTags('Catalogue & Universal Search')
@Controller('api/v1')
export class CatalogueController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Get('categories')
  @ApiOperation({ summary: 'List hierarchical service categories (bn: সেবার ক্যাটাগরি)' })
  async listCategories(
    @Headers('accept-language') lang: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.catalogue.getCategoriesTree(resolveLocale(lang));
    if (applyEtagAndCheckNotModified(req, res, data, 300)) return;
    return { items: data };
  }

  @Get('life-events')
  @ApiOperation({ summary: 'List citizen life-event journeys (bn: জীবনের ধাপ অনুযায়ী সেবা)' })
  async listLifeEvents(
    @Headers('accept-language') lang: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.catalogue.listLifeEvents(resolveLocale(lang));
    if (applyEtagAndCheckNotModified(req, res, data, 300)) return;
    return { items: data };
  }

  @Get('life-events/:slug')
  @ApiOperation({ summary: 'Get ordered steps & linked services for a life event' })
  async getLifeEvent(
    @Param('slug') slug: string,
    @Headers('accept-language') lang: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.catalogue.getLifeEventDetail(slug, resolveLocale(lang));
    if (applyEtagAndCheckNotModified(req, res, data, 300)) return;
    return data;
  }

  @Get('services')
  @ApiOperation({
    summary: 'List/filter citizen services with cursor pagination, ETag & ?fields= (bn: সেবা তালিকা)',
  })
  @ApiQuery({ name: 'query', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'agency', required: false })
  @ApiQuery({ name: 'channel', required: false })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'fields', required: false })
  async listServices(
    @Query('query') query: string | undefined,
    @Query('category') category: string | undefined,
    @Query('agency') agency: string | undefined,
    @Query('channel') channel: string | undefined,
    @Query('cursor') cursor: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('fields') fields: string | undefined,
    @Headers('accept-language') lang: string | undefined,
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const parsedLimit = parseStrictLimit(limit, 20, 100);
    const locale = req.locale ?? resolveLocale(lang);
    const result = await this.catalogue.listServices({
      query,
      category,
      agency,
      channel,
      cursor,
      limit: parsedLimit,
      locale,
    });
    const projected = {
      items: result.items.map((item) => projectFields(item as Record<string, unknown>, fields)),
      page: result.page,
    };
    if (applyEtagAndCheckNotModified(req, res, projected, 300)) return;
    return projected;
  }

  @Get('services/:slug')
  @ApiOperation({
    summary: 'Full 5-question service detail with trust label & verified sources (bn: সেবার বিস্তারিত)',
  })
  async getServiceDetail(
    @Param('slug') slug: string,
    @Query('fields') fields: string | undefined,
    @Headers('accept-language') lang: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const detail = await this.catalogue.getServiceDetail(slug, resolveLocale(lang));
    const projected = projectFields(detail as unknown as Record<string, unknown>, fields);
    if (applyEtagAndCheckNotModified(req, res, projected, 120)) return;
    return projected;
  }

  @Get('services/:slug/versions')
  @ApiOperation({ summary: 'Service fee & rule change history (bn: পরিবর্তনের ইতিহাস)' })
  async getServiceVersions(@Param('slug') slug: string) {
    return { items: await this.catalogue.getServiceVersions(slug) };
  }

  @Get('notices')
  @ApiOperation({ summary: 'Official circulars, deadlines, health & disaster notices (bn: নোটিশ)' })
  async listNotices(
    @Query('kind') kind: string | undefined,
    @Query('region') region: string | undefined,
    @Query('active') active: string | undefined,
    @Headers('accept-language') lang: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.catalogue.listNotices({
      kind,
      region,
      activeOnly: active !== 'false',
      locale: resolveLocale(lang),
    });
    if (applyEtagAndCheckNotModified(req, res, data, 60)) return;
    return { items: data };
  }

  @Get('agencies')
  @ApiOperation({ summary: 'List verified public agencies (bn: সরকারি সংস্থাসমূহ)' })
  async listAgencies(
    @Headers('accept-language') lang: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.catalogue.listAgencies(resolveLocale(lang));
    if (applyEtagAndCheckNotModified(req, res, data, 300)) return;
    return { items: data };
  }

  @Get('facilities')
  @ApiOperation({
    summary: 'Locate public hospitals, police, fire stations & shelters (?near=lat,lng&radius=km)',
  })
  async listFacilities(
    @Query('type') type: string | undefined,
    @Query('near') near: string | undefined,
    @Query('radius') radius: string | undefined,
    @Headers('accept-language') lang: string | undefined,
  ) {
    let nearLat: number | undefined;
    let nearLng: number | undefined;
    if (near && near.includes(',')) {
      const [latStr, lngStr] = near.split(',');
      const lat = Number(latStr);
      const lng = Number(lngStr);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        nearLat = lat;
        nearLng = lng;
      }
    }
    const radiusKm = radius ? Number(radius) : undefined;
    const data = await this.catalogue.listFacilities({
      type,
      nearLat,
      nearLng,
      radiusKm: radiusKm && Number.isFinite(radiusKm) ? radiusKm : undefined,
      locale: resolveLocale(lang),
    });
    return { items: data };
  }

  @Get('utilities/outages')
  @ApiOperation({ summary: 'Active utility outage notices by district (bn: বিদ্যুৎ/পানি/গ্যাস বিভ্রাট)' })
  async listUtilityOutages(
    @Query('district') district: string | undefined,
    @Headers('accept-language') lang: string | undefined,
  ) {
    return { items: await this.catalogue.listUtilityOutages(district, resolveLocale(lang)) };
  }

  @Get('faqs')
  @ApiOperation({ summary: 'Verified frequently asked questions (bn: সাধারণ জিজ্ঞাসা)' })
  async listFaqs(
    @Query('serviceSlug') serviceSlug: string | undefined,
    @Headers('accept-language') lang: string | undefined,
  ) {
    return { items: await this.catalogue.listFaqs(serviceSlug, resolveLocale(lang)) };
  }

  @Get('search')
  @ApiOperation({
    summary:
      'Universal Hybrid RRF Search across Bangla, English & Banglish (services, notices, programs, scholarships, hotlines, facilities, stations)',
  })
  @ApiQuery({ name: 'q', required: true, example: 'jonmo nibondhon' })
  @ApiQuery({ name: 'types', required: false, example: 'service,program' })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  async search(
    @Query('q') q: string | undefined,
    @Query('types') typesRaw: string | undefined,
    @Query('limit') limit: string | undefined,
    @Headers('accept-language') lang: string | undefined,
    @Req() req: LocalizedRequest,
  ) {
    if (!q || !q.trim()) {
      throw new BadRequestException({
        code: 'EMPTY_SEARCH_QUERY',
        messageBn: 'অনুগ্রহ করে অনুসন্ধানের জন্য একটি শব্দ লিখুন (q)।',
        messageEn: "Query parameter 'q' is required and cannot be empty.",
        suggestions: ['জন্ম নিবন্ধন', 'e-passport', 'Dhaka Chattogram train', 'Family Card', '999'],
      });
    }
    const parsedLimit = parseStrictLimit(limit, 20, 100);
    const types = typesRaw
      ? (typesRaw
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean) as SearchItemType[])
      : undefined;
    return this.catalogue.universalSearch({
      query: q.trim(),
      locale: req.locale ?? resolveLocale(lang),
      types,
      limit: parsedLimit,
    });
  }

  @Get('search/suggest')
  @ApiOperation({
    summary: 'Low-latency Bangla/English/Banglish autocomplete & Did-You-Mean (<80ms p95)',
  })
  async suggest(
    @Query('q') q: string | undefined,
    @Query('limit') limit: string | undefined,
    @Headers('accept-language') lang: string | undefined,
    @Req() req: LocalizedRequest,
  ) {
    const parsedLimit = parseStrictLimit(limit, 8, 25);
    return this.catalogue.suggestSearch(q ?? '', req.locale ?? resolveLocale(lang), parsedLimit);
  }

  @Post('content-reports')
  @ApiOperation({
    summary: 'Report outdated or incorrect information; automatically opens an editor review task',
  })
  async reportContent(
    @Body(new ZodValidationPipe(ContentReportSchema)) body: z.infer<typeof ContentReportSchema>,
    @Req() req: Request & { user?: { sub: string } },
  ) {
    return this.catalogue.submitContentReport(req.user?.sub ?? null, body);
  }
}
