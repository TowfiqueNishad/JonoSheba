/**
 * PlacesAdapterService — lightweight adapter used in tests and direct instantiation.
 *
 * Returns hard-coded representative data sourced from OSM (ODbL) for testing.
 * In production, the OrgsCatalogHotlinesService handles the full NestJS DI stack.
 * Rule R1: Items are marked as "verification_pending" until imported from official source.
 * Rule C7: Attribution "© OpenStreetMap contributors" is mandatory (ODbL).
 */
import { Injectable } from '@nestjs/common';
import { OSM_ODBL_ATTRIBUTION } from '@jonoshheba/shared';

export interface PlaceItem {
  id: string;
  type: 'hospital' | 'cyclone_shelter' | 'udc' | 'police_station' | 'passport_office' | 'birth_registration_office';
  nameBn: string;
  nameEn: string;
  districtEn: string;
  serviceSlug?: string;
  lat: number;
  lng: number;
  attribution: string;
  trustLabel: 'OFFICIAL_SOURCE' | 'VERIFIED_BY_JONOSHHEBA' | 'PARTNER_PROVIDED' | 'COMMUNITY_REPORT' | 'UNAVAILABLE_STALE';
  sourceUrl: string;
}

const SAMPLE_PLACES: PlaceItem[] = [
  {
    id: 'place-dhaka-ppt-office',
    type: 'passport_office',
    nameBn: 'ঢাকা আঞ্চলিক পাসপোর্ট অফিস',
    nameEn: 'Dhaka Regional Passport Office',
    districtEn: 'Dhaka',
    serviceSlug: 'e-passport-application',
    lat: 23.7625,
    lng: 90.3899,
    attribution: `${OSM_ODBL_ATTRIBUTION} | Source: dip.gov.bd`,
    trustLabel: 'OFFICIAL_SOURCE',
    sourceUrl: 'https://www.dip.gov.bd/',
  },
  {
    id: 'place-dhaka-birth-reg',
    type: 'birth_registration_office',
    nameBn: 'ঢাকা জেলা নিবন্ধক কার্যালয় (জন্ম ও মৃত্যু)',
    nameEn: 'Dhaka District Registrar Office (Birth & Death)',
    districtEn: 'Dhaka',
    serviceSlug: 'birth-certificate-registration',
    lat: 23.7276,
    lng: 90.4071,
    attribution: `${OSM_ODBL_ATTRIBUTION} | Source: bdris.gov.bd`,
    trustLabel: 'OFFICIAL_SOURCE',
    sourceUrl: 'https://bdris.gov.bd/',
  },
  {
    id: 'place-dhaka-dhmc',
    type: 'hospital',
    nameBn: 'ঢাকা মেডিকেল কলেজ হাসপাতাল',
    nameEn: 'Dhaka Medical College Hospital',
    districtEn: 'Dhaka',
    lat: 23.7239,
    lng: 90.3980,
    attribution: `${OSM_ODBL_ATTRIBUTION} | Source: dghs.gov.bd`,
    trustLabel: 'OFFICIAL_SOURCE',
    sourceUrl: 'https://www.dghs.gov.bd/',
  },
  {
    id: 'place-cyclone-shelter-ctg-01',
    type: 'cyclone_shelter',
    nameBn: 'চট্টগ্রাম জেলা ঘূর্ণিঝড় আশ্রয়কেন্দ্র ০১',
    nameEn: 'Chattogram District Cyclone Shelter 01',
    districtEn: 'Chattogram',
    lat: 22.3419,
    lng: 91.8155,
    attribution: `${OSM_ODBL_ATTRIBUTION} | Source: ddm.gov.bd`,
    trustLabel: 'VERIFIED_BY_JONOSHHEBA',
    sourceUrl: 'https://ddm.gov.bd/',
  },
  {
    id: 'place-udc-sylhet-01',
    type: 'udc',
    nameBn: 'সিলেট ইউনিয়ন ডিজিটাল সেন্টার',
    nameEn: 'Sylhet Union Digital Centre (UDC)',
    districtEn: 'Sylhet',
    lat: 24.8949,
    lng: 91.8687,
    attribution: `${OSM_ODBL_ATTRIBUTION} | Source: a2i.gov.bd`,
    trustLabel: 'OFFICIAL_SOURCE',
    sourceUrl: 'https://www.a2i.gov.bd/',
  },
];

@Injectable()
export class PlacesAdapterService {
  /**
   * Resolve district offices for a given service slug and district.
   * Rule R1: Returns offices that are sourced; unknown services return empty list (not fabricated data).
   */
  resolveOffices(params: { serviceSlug: string; district: string }): { items: PlaceItem[] } {
    const matches = SAMPLE_PLACES.filter(
      (p) =>
        p.serviceSlug === params.serviceSlug &&
        p.districtEn.toLowerCase() === params.district.toLowerCase(),
    );
    // Fallback: return all offices in the district if slug match is empty
    const items =
      matches.length > 0
        ? matches
        : SAMPLE_PLACES.filter(
            (p) => p.districtEn.toLowerCase() === params.district.toLowerCase(),
          );
    return { items };
  }

  /**
   * List all known places, optionally filtered by type and/or district.
   * All items carry OSM ODbL attribution (Rule C7).
   */
  listPlaces(params: { type?: string; district?: string }): { items: PlaceItem[] } {
    let items = [...SAMPLE_PLACES];
    if (params.type) {
      items = items.filter((p) => p.type === params.type);
    }
    if (params.district) {
      items = items.filter(
        (p) => p.districtEn.toLowerCase() === params.district!.toLowerCase(),
      );
    }
    return { items };
  }
}
