/**
 * C08 Nationwide OSM POI Normalizer & Deduplicator (Geofabrik Bangladesh .pbf / Overpass).
 * - Enforces Rule C7 ODbL attribution ("© OpenStreetMap contributors (ODbL)")
 * - Deduplicates nearby facilities within ~150m with matching normalized names
 * - Outputs review-queue items (never auto-publishes unverified crowd POIs as OFFICIAL_SOURCE).
 */

export interface OsmPoiFeature {
  osmId: string;
  amenity: string;
  nameBn?: string;
  nameEn?: string;
  lat: number;
  lng: number;
  districtEn: string;
}

export function normalizeAndDedupeOsmPois(features: OsmPoiFeature[]) {
  const accepted: Array<Record<string, unknown>> = [];
  let duplicatesSkipped = 0;
  let missingBanglaGaps = 0;

  for (const f of features) {
    const nameKey = (f.nameEn ?? f.nameBn ?? '').trim().toLowerCase();
    const isDup = accepted.some(
      (a) =>
        String(a.nameEn ?? '').toLowerCase() === nameKey &&
        Math.abs(Number(a.lat) - f.lat) < 0.0015 &&
        Math.abs(Number(a.lng) - f.lng) < 0.0015,
    );
    if (isDup) {
      duplicatesSkipped += 1;
      continue;
    }
    if (!f.nameBn?.trim()) missingBanglaGaps += 1;
    accepted.push({
      id: `osm-${f.osmId}`,
      type: f.amenity,
      nameBn: f.nameBn?.trim() || '',
      nameEn: f.nameEn?.trim() || f.nameBn?.trim() || 'Unnamed Facility',
      lat: f.lat,
      lng: f.lng,
      districtEn: f.districtEn,
      sourceId: 'SRC_OSM_BD',
      trustLabel: 'PARTNER_PROVIDED',
      attribution: '© OpenStreetMap contributors (ODbL)',
      reviewStatus: 'PENDING_REVIEW',
    });
  }

  return {
    ingested: accepted.length,
    duplicatesSkipped,
    missingBanglaGaps,
    records: accepted,
  };
}
