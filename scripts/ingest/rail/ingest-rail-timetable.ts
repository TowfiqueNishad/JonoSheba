/**
 * C02 Bangladesh Railway Ingestion Helper:
 * - Converts legacy Bijoy/SutonnyMJ Bangla PDF text fragments to Unicode Bangla
 * - Reconciles OSM railway=station|halt coordinates with official BR station lists
 * - Parses timetable CSV rows into structured train_stops and generates a review diff (never auto-publishes).
 */

const SUTONNY_TO_UNICODE: Array<[string, string]> = [
  ['XvKv', 'ঢাকা'],
  ['PÆMÖvg', 'চট্টগ্রাম'],
  ['wm‡jU', 'সিলেট'],
  ['ivRkvnx', 'রাজশাহী'],
  ['Lyjbv', 'খুলনা'],
  ['K·evRvi', 'কক্সবাজার'],
  ['Kzwgjøv', 'কুমিল্লা'],
  ['h‡kvi', 'যশোর'],
  ['e¸ov', 'বগুড়া'],
];

export function convertSutonnyMjToUnicode(raw: string): string {
  let out = raw;
  for (const [legacy, unicode] of SUTONNY_TO_UNICODE) {
    out = out.split(legacy).join(unicode);
  }
  return out;
}

export interface RawStationCandidate {
  code?: string;
  nameBn: string;
  nameEn: string;
  lat?: number;
  lng?: number;
  source: 'OFFICIAL_BR' | 'OSM';
}

export function reconcileOfficialAndOsmStations(
  officialList: RawStationCandidate[],
  osmList: RawStationCandidate[],
) {
  const osmByName = new Map(osmList.map((s) => [s.nameEn.trim().toLowerCase(), s]));
  const merged = [];
  const conflicts = [];

  for (const off of officialList) {
    const osmMatch = osmByName.get(off.nameEn.trim().toLowerCase());
    const usedOsmCoords = (off.lat === undefined || off.lng === undefined) && osmMatch?.lat !== undefined;
    if (osmMatch && off.lat !== undefined && osmMatch.lat !== undefined) {
      const distApproxDeg = Math.abs(off.lat - osmMatch.lat) + Math.abs((off.lng ?? 0) - (osmMatch.lng ?? 0));
      if (distApproxDeg > 0.15) {
        conflicts.push({ station: off.nameEn, reason: 'Coordinate mismatch > ~15km between Official BR and OSM' });
      }
    }
    merged.push({
      code: off.code ?? off.nameEn.slice(0, 4).toUpperCase(),
      nameBn: convertSutonnyMjToUnicode(off.nameBn),
      nameEn: off.nameEn,
      lat: off.lat ?? osmMatch?.lat ?? null,
      lng: off.lng ?? osmMatch?.lng ?? null,
      sourceId: 'SRC_BR_OFFICIAL',
      coordinateSource: usedOsmCoords ? 'SRC_OSM_BD' : 'SRC_BR_OFFICIAL',
      attribution: usedOsmCoords ? 'Source: Bangladesh Railway; Coordinates © OpenStreetMap contributors (ODbL)' : 'Source: Bangladesh Railway',
    });
  }

  return { mergedCount: merged.length, conflictCount: conflicts.length, merged, conflicts };
}
