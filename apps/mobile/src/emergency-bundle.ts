import { TrustLabel, type TrustAttribution } from '@jonoshheba/shared';

export interface OfflineHotline {
  number: string;
  telUri: string;
  nameBn: string;
  nameEn: string;
  category: 'emergency' | 'citizen_info' | 'health' | 'women_children';
  attribution: TrustAttribution;
  verifyBeforeRelease: true;
}

/**
 * R8: Bundled offline emergency hotlines fallback so citizens can tap-to-call
 * even when offline or if the backend is unavailable.
 */
export const BUNDLED_EMERGENCY_HOTLINES: readonly OfflineHotline[] = [
  {
    number: '999',
    telUri: 'tel:999',
    nameBn: 'জাতীয় জরুরি সেবা (পুলিশ, ফায়ার সার্ভিস, অ্যাম্বুলেন্স)',
    nameEn: 'National Emergency Service (Police, Fire, Ambulance)',
    category: 'emergency',
    attribution: {
      trustLabel: TrustLabel.OFFICIAL_SOURCE,
      sourceUrl: 'https://nhd.gov.bd',
      agency: 'Bangladesh Police / National Emergency Service',
      lastVerifiedAt: null,
    },
    verifyBeforeRelease: true,
  },
  {
    number: '333',
    telUri: 'tel:333',
    nameBn: 'জাতীয় তথ্য ও সেবা হেল্পলাইন',
    nameEn: 'National Information & Citizen Service Helpline',
    category: 'citizen_info',
    attribution: {
      trustLabel: TrustLabel.OFFICIAL_SOURCE,
      sourceUrl: 'https://a2i.gov.bd',
      agency: 'a2i / ICT Division',
      lastVerifiedAt: null,
    },
    verifyBeforeRelease: true,
  },
];
