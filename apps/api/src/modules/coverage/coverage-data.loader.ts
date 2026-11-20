import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function findDataFile(relativePath: string): string {
  const candidates = [
    resolve(process.cwd(), relativePath),
    resolve(process.cwd(), '../../', relativePath),
  ];
  const hit = candidates.find((p) => existsSync(p));
  if (!hit) {
    throw new Error(`Required coverage data file not found: ${relativePath}`);
  }
  return hit;
}

export function loadJsonData<T>(relativePath: string): T {
  const full = findDataFile(relativePath);
  return JSON.parse(readFileSync(full, 'utf8')) as T;
}

export interface CoverageSourceRegistry {
  schemaVersion: string;
  updatedAt: string;
  sources: Array<{
    id: string;
    name: string;
    agency: string;
    url: string;
    kind: string;
    licence: string;
    attribution: string;
    freshnessSlaDays: number;
    lastCheckedAt: string;
    status: string;
  }>;
}

export interface ReferenceCountsData {
  asOf: string;
  sourceId: string;
  counts: Record<string, number>;
}

export interface Taxonomy18Data {
  sourceId: string;
  lastVerifiedAt: string;
  categories: Array<{
    code: string;
    nameBn: string;
    nameEn: string;
    officialPortal: string;
    hotline: string;
    sampleServices: string[];
  }>;
  lifeEventBundles: Array<{
    slug: string;
    titleBn: string;
    titleEn: string;
    categories: string[];
  }>;
  socialProtectionProgrammes: Array<{
    slug: string;
    nameBn: string;
    nameEn: string;
    aliases: string[];
    nameHistory: Array<{ oldNameBn: string; oldNameEn: string; validFrom: string; validTo: string }>;
    agency: string;
    monthlyAmountBdt: number;
    effectiveFrom: string;
    sourceId: string;
    sourceUrl: string;
    lastVerifiedAt: string;
    paymentChannel: string;
    maxMembersPerCard?: number;
    revisionCycleYears?: number;
    negativeListCategories: string[];
  }>;
}

export interface RailMetroBusWaterData {
  rail: {
    sourceId: string;
    osmFallbackSourceId: string;
    lastVerifiedAt: string;
    timetableVersion: { version: string; effectiveFrom: string; sourceId: string; sourceUrl: string };
    channels: Record<string, unknown>;
    refundRules: Array<Record<string, unknown>>;
    stations: Array<{
      code: string;
      nameBn: string;
      nameEn: string;
      aliases: string[];
      nameHistory: Array<{ oldNameBn: string; oldNameEn: string; validFrom: string; validTo: string }>;
      zone: string;
      division: string;
      districtEn: string;
      lat: number;
      lng: number;
      gauge: string;
      status: string;
      eTicketingEnabled: boolean;
      facilities: string[];
      sourceId: string;
      lastVerifiedAt: string;
      isDemo?: boolean;
    }>;
    trains: Array<{
      number: string;
      nameBn: string;
      nameEn: string;
      type: string;
      zone: string;
      offDays: string[];
      classes: string[];
      sourceId: string;
      lastVerifiedAt: string;
      stops: Array<{
        stationCode: string;
        sequence: number;
        arrival: string | null;
        departure: string | null;
        dayOffset: number;
        km: number;
      }>;
    }>;
    internationalServices: Array<Record<string, unknown>>;
    eidSchedule: Record<string, unknown>;
  };
  metro: {
    sourceId: string;
    lastVerifiedAt: string;
    lines: Array<Record<string, unknown>>;
    stations: Array<{
      code: string;
      line: string;
      seq: number;
      nameBn: string;
      nameEn: string;
      status: string;
      lat: number;
      lng: number;
    }>;
  };
  tolls: Array<{
    code: string;
    nameBn: string;
    nameEn: string;
    aliases: string[];
    nameHistory: Array<{ oldNameBn: string; oldNameEn: string; validFrom: string; validTo: string }>;
    paymentMethods: string[];
    sourceId: string;
    sourceUrl: string;
    lastVerifiedAt: string;
    ratesBdt: Record<string, number>;
  }>;
  bus: {
    brtaFareRates: {
      sourceId: string;
      sourceUrl: string;
      lastVerifiedAt: string;
      intercityNonAcPerKmBdt: number;
      dhakaCityPerKmBdt: number;
      minCityFareBdt: number;
    };
    operators: Array<Record<string, unknown>>;
    terminals: Array<{
      code: string;
      nameBn: string;
      nameEn: string;
      districtEn: string;
      lat: number;
      lng: number;
      sourceId: string;
      attribution: string;
    }>;
    routes: Array<{
      id: string;
      originDistrict: string;
      destinationDistrict: string;
      distanceKm: number;
      typicalDurationMin: number;
      via: string[];
      operators: string[];
      brtcETicketPilot?: boolean;
      sourceId: string;
    }>;
    cityRoutes: Array<{
      city: string;
      routeNo: string;
      nameBn: string;
      nameEn: string;
      stops: string[];
      sourceId: string;
    }>;
  };
  water: {
    sourceId: string;
    lastVerifiedAt: string;
    ghats: Array<Record<string, unknown>>;
    routes: Array<Record<string, unknown>>;
  };
  air: {
    sourceId: string;
    lastVerifiedAt: string;
    routes: Array<Record<string, unknown>>;
  };
}

export interface OrgsHotlinesCalendarData {
  organisations: Array<{
    id: string;
    type: string;
    nameBn: string;
    nameEn: string;
    aliases: string[];
    nameHistory: Array<{ oldNameBn: string; oldNameEn: string; validFrom: string; validTo: string }>;
    districtEn: string;
    lat: number;
    lng: number;
    website: string;
    citizenCharterUrl: string;
    phone: string;
    servicesOffered: string[];
    sourceId: string;
    lastVerifiedAt: string;
  }>;
  places: Array<{
    id: string;
    type: string;
    nameBn: string;
    nameEn: string;
    districtEn: string;
    lat: number;
    lng: number;
    accessible: boolean;
    open24x7: boolean;
    sourceId: string;
    attribution: string;
    lastVerifiedAt: string;
  }>;
  hotlines: Array<{
    number: string;
    category: string;
    nameBn: string;
    nameEn: string;
    agency: string;
    tollFree: boolean;
    hours: string;
    sourceId: string;
    sourceUrl: string;
    lastVerifiedAt: string;
    verifyBeforeRelease: boolean;
  }>;
  calendar: Array<{
    id: string;
    type: string;
    titleBn: string;
    titleEn: string;
    date: string;
    provisional: boolean;
    agency: string;
    officialUrl: string;
    sourceId: string;
  }>;
}
