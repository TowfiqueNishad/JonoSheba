import { TrustLabel } from '@jonoshheba/shared';
import { HOTLINES_SEED } from '../../../seed-data/catalogue';
import type { HotlineItem } from './support.types';

/**
 * R8: Compact (< 5 KB) static emergency payload bundled in memory so
 * GET /api/v1/emergency continues working even if the database is completely down.
 */
export function buildStaticEmergencyHotlines(): HotlineItem[] {
  return HOTLINES_SEED.map((h) => ({
    number: h.number,
    telUri: `tel:${h.number}`,
    nameBn: h.nameBn,
    nameEn: h.nameEn,
    category: h.category,
    agency: h.agency,
    sourceUrl: h.sourceUrl,
    trustLabel: TrustLabel.OFFICIAL_SOURCE,
    lastVerifiedAt: null,
    verifyBeforeRelease: true,
  }));
}
