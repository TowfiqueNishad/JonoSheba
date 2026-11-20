import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Controller, Get, Injectable, Module, NotFoundException, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { type CountryPack, CountryPackSchema } from '@jonoshheba/shared';

const FALLBACK_BD_PACK: CountryPack = {
  iso2: 'BD',
  name: { bn: 'বাংলাদেশ', en: 'Bangladesh' },
  defaultLocale: 'bn',
  supportedLocales: ['bn', 'en'],
  timezone: 'Asia/Dhaka',
  currency: 'BDT',
  phoneCountryCode: '+880',
  adminLevels: ['division', 'district', 'upazila', 'union_or_ward'],
  primaryEmergencyNumber: '999',
  hotlines: [
    {
      number: '999',
      label: { bn: 'জাতীয় জরুরি সেবা', en: 'National Emergency Service' },
      agency: 'Bangladesh Police',
      sourceUrl: 'https://nhd.gov.bd',
    },
  ],
  officialPortals: {
    citizenPortal: 'https://www.mygov.bd',
    grievancePortal: 'https://www.grs.gov.bd',
    railTicketingPortal: 'https://eticket.railway.gov.bd',
  },
  independentDisclaimer: {
    bn: 'স্বাধীন প্ল্যাটফর্ম — এটি কোনো সরকারি সেবা নয়',
    en: 'Independent platform — not an official government service',
  },
};

@Injectable()
export class CountryPacksService {
  private readonly packs = new Map<string, CountryPack>();

  constructor() {
    this.loadFromDisk();
    if (!this.packs.has('BD')) {
      this.packs.set('BD', FALLBACK_BD_PACK);
    }
  }

  private loadFromDisk(): void {
    const candidates = [
      resolve(process.cwd(), 'data/country-packs'),
      resolve(process.cwd(), '../../data/country-packs'),
    ];
    const dir = candidates.find((d) => existsSync(d));
    if (!dir) return;

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const file = join(dir, entry.name, 'pack.json');
      if (!existsSync(file)) continue;
      const parsed = CountryPackSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
      this.packs.set(parsed.iso2.toUpperCase(), parsed);
    }
  }

  list(): CountryPack[] {
    return Array.from(this.packs.values());
  }

  getByCode(code: string): CountryPack {
    const pack = this.packs.get(code.toUpperCase());
    if (!pack) {
      throw new NotFoundException(`Country pack '${code}' not found`);
    }
    return pack;
  }
}

@ApiTags('Country Packs & Internationalization')
@Controller('api/v1/country-packs')
export class CountryPacksController {
  constructor(private readonly service: CountryPacksService) {}

  @Get()
  @ApiOperation({ summary: 'List all loaded & schema-validated country packs' })
  listPacks() {
    return { packs: this.service.list() };
  }

  @Get(':code')
  @ApiOperation({ summary: 'Get a country pack by ISO2 code (e.g. BD, NP)' })
  getPack(@Param('code') code: string) {
    return this.service.getByCode(code);
  }
}

@Module({
  controllers: [CountryPacksController],
  providers: [CountryPacksService],
  exports: [CountryPacksService],
})
export class CountryPacksModule {}
