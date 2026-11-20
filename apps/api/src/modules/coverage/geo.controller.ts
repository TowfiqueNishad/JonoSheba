import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { parseStrictLimit } from '../catalogue/domain/http-helpers';
import { GeoGazetteerService, type GeoUnit } from './geo.service';

const BD_BBOX = { minLat: 20.5, maxLat: 26.7, minLng: 88.0, maxLng: 92.8 };

function parseBangladeshCoordinates(latStr?: string, lngStr?: string): { lat: number; lng: number } {
  if (!latStr || !lngStr || !/^-?\d+(?:\.\d+)?$/.test(latStr.trim()) || !/^-?\d+(?:\.\d+)?$/.test(lngStr.trim())) {
    throw new BadRequestException({
      code: 'INVALID_COORDINATES',
      messageBn: 'সঠিক অক্ষাংশ (lat) এবং দ্রাঘিমাংশ (lng) সংখ্যা প্রদান করুন।',
      messageEn: 'Valid numeric lat (-90..90) and lng (-180..180) query parameters are required.',
      errors: [
        { field: 'lat', message: `Invalid latitude '${latStr ?? ''}'` },
        { field: 'lng', message: `Invalid longitude '${lngStr ?? ''}'` },
      ],
    });
  }
  const lat = Number(latStr.trim());
  const lng = Number(lngStr.trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new BadRequestException({
      code: 'COORDINATES_OUT_OF_RANGE',
      messageBn: 'lat অবশ্যই -90 থেকে 90 এবং lng অবশ্যই -180 থেকে 180 এর মধ্যে হতে হবে।',
      messageEn: 'Coordinates out of range: lat must be in [-90, 90] and lng in [-180, 180].',
    });
  }
  if (lat < BD_BBOX.minLat || lat > BD_BBOX.maxLat || lng < BD_BBOX.minLng || lng > BD_BBOX.maxLng) {
    throw new UnprocessableEntityException({
      code: 'OUTSIDE_COVERAGE',
      messageBn: 'এই অবস্থানটি বাংলাদেশের সীমানার বাইরে অবস্থিত।',
      messageEn: 'Coordinates are outside Bangladesh coverage area (lat 20.5..26.7, lng 88.0..92.8).',
    });
  }
  return { lat, lng };
}

@ApiTags('National Gazetteer')
@Controller('api/v1/geo')
export class GeoController {
  constructor(private readonly geo: GeoGazetteerService) {}

  @Get('divisions')
  @ApiOperation({ summary: 'List divisions with 2018 spelling aliases & name history (bn: বিভাগ তালিকা)' })
  divisions(@Query('q') q?: string) {
    const items = this.geo.listLevel('division', undefined, q);
    return {
      count: items.length,
      page: { limit: items.length, nextCursor: null, hasMore: false, total: items.length },
      sourceId: 'SRC_HDX_COD_AB_BGD',
      items,
    };
  }

  @Get('districts')
  @ApiOperation({ summary: 'List districts (filterable by parent division or bn/en/old spelling q)' })
  districts(@Query('parent') parent?: string, @Query('q') q?: string) {
    const items = this.geo.listLevel('district', parent, q);
    return {
      count: items.length,
      page: { limit: items.length, nextCursor: null, hasMore: false, total: items.length },
      sourceId: 'SRC_HDX_COD_AB_BGD',
      items,
    };
  }

  @Get('upazilas')
  @ApiOperation({ summary: 'List upazilas (data-driven counts)' })
  upazilas(@Query('parent') parent?: string, @Query('q') q?: string) {
    const items = this.geo.listLevel('upazila', parent, q);
    return {
      count: items.length,
      page: { limit: items.length, nextCursor: null, hasMore: false, total: items.length },
      sourceId: 'SRC_HDX_COD_AB_BGD',
      items,
    };
  }

  @Get('unions')
  @ApiOperation({ summary: 'List union parishads' })
  unions(@Query('parent') parent?: string, @Query('q') q?: string) {
    const items = this.geo.listLevel('union', parent, q);
    return {
      count: items.length,
      page: { limit: items.length, nextCursor: null, hasMore: false, total: items.length },
      sourceId: 'SRC_HDX_COD_AB_BGD',
      items,
    };
  }

  @Get('wards')
  @ApiOperation({ summary: 'List UP / municipal / city corporation wards' })
  wards(@Query('parent') parent?: string, @Query('q') q?: string) {
    const items = this.geo.listLevel('ward', parent, q);
    return {
      count: items.length,
      page: { limit: items.length, nextCursor: null, hasMore: false, total: items.length },
      sourceId: 'SRC_HDX_COD_AB_BGD',
      items,
    };
  }

  @Get('thanas')
  @ApiOperation({ summary: 'List police stations (thanas)' })
  thanas(@Query('parent') parent?: string, @Query('q') q?: string) {
    const items = this.geo.listLevel('thana', parent, q);
    return {
      count: items.length,
      page: { limit: items.length, nextCursor: null, hasMore: false, total: items.length },
      sourceId: 'SRC_OSM_BD',
      items,
    };
  }

  @Get('postcodes')
  @ApiOperation({ summary: 'List Bangladesh Post Office postcodes' })
  postcodes(@Query('parent') parent?: string, @Query('q') q?: string) {
    const items = this.geo.listLevel('postcode', parent, q);
    return {
      count: items.length,
      page: { limit: items.length, nextCursor: null, hasMore: false, total: items.length },
      sourceId: 'SRC_HDX_COD_AB_BGD',
      items,
    };
  }

  @Get('resolve')
  @ApiOperation({ summary: 'Resolve lat/lng coordinates inside Bangladesh to admin hierarchy ("My Area")' })
  resolve(@Query('lat') latStr?: string, @Query('lng') lngStr?: string) {
    const { lat, lng } = parseBangladeshCoordinates(latStr, lngStr);
    return this.geo.resolvePoint(lat, lng);
  }

  @Get('search')
  @ApiOperation({ summary: 'Disambiguated autocomplete across all geo levels (matches old & new spellings)' })
  search(@Query('q') q = '', @Query('limit') limitStr?: string) {
    const limit = parseStrictLimit(limitStr, 15, 50);
    const items = this.geo.searchAll(q, limit);
    return {
      query: q,
      count: items.length,
      page: { limit, nextCursor: null, hasMore: false, total: items.length },
      items,
    };
  }

  @Get('changelog')
  @ApiOperation({ summary: 'Official gazette administrative change log (2018 spellings, May 2026 Bogura CC)' })
  changelog() {
    return { items: this.geo.gazetteChangelog, referenceCounts: this.geo.referenceCounts };
  }

  @Get(':level/:id/boundary')
  @ApiOperation({ summary: 'Simplified GeoJSON boundary polygon for mobile/offline maps' })
  boundary(
    @Param('level') level: GeoUnit['level'],
    @Param('id') id: string,
    @Query('simplify') simplifyStr?: string,
  ) {
    const simplify = simplifyStr ? Number.parseInt(simplifyStr, 10) : 5;
    if (!Number.isFinite(simplify) || simplify < 1 || simplify > 25) {
      throw new BadRequestException('simplify must be an integer between 1 and 25');
    }
    return this.geo.getSimplifiedBoundary(level, id, simplify);
  }
}
