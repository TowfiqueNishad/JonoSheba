/**
 * C01 Idempotent National Gazetteer Loader (HDX COD-AB Bangladesh / BBS).
 * - Maps HDX P-codes <-> BBS geocodes
 * - Applies 2018 official Bangladesh spelling updates while keeping old spellings as aliases (Rule C3)
 * - Never hard-codes admin counts (Rule C4); logs exact ingested counts.
 */

export interface GazetteerInputRow {
  pcode: string;
  bbsGeocode: string;
  level: 'division' | 'district' | 'upazila' | 'union' | 'ward' | 'thana' | 'city_corporation' | 'pourashava';
  parentCode: string | null;
  nameBn: string;
  nameEn: string;
  lat?: number;
  lng?: number;
}

const SPELLING_2018_MAP: Record<string, { canonicalEn: string; oldEn: string; validTo: string }> = {
  chittagong: { canonicalEn: 'Chattogram', oldEn: 'Chittagong', validTo: '2018-04-02' },
  barisal: { canonicalEn: 'Barishal', oldEn: 'Barisal', validTo: '2018-04-02' },
  comilla: { canonicalEn: 'Cumilla', oldEn: 'Comilla', validTo: '2018-04-02' },
  jessore: { canonicalEn: 'Jashore', oldEn: 'Jessore', validTo: '2018-04-02' },
  bogra: { canonicalEn: 'Bogura', oldEn: 'Bogra', validTo: '2018-04-02' },
};

export function normalizeHdxGazetteerRows(rows: GazetteerInputRow[], sourceId = 'SRC_HDX_COD_AB_BGD') {
  const seen = new Set<string>();
  const normalized = [];
  let missingBanglaCount = 0;

  for (const row of rows) {
    const key = `${row.level}:${row.pcode}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const lower = row.nameEn.trim().toLowerCase();
    const spelling = SPELLING_2018_MAP[lower];
    const canonicalEn = spelling ? spelling.canonicalEn : row.nameEn.trim();
    const aliases = spelling ? [spelling.oldEn] : [];
    const nameHistory = spelling
      ? [{ oldNameBn: row.nameBn || spelling.oldEn, oldNameEn: spelling.oldEn, validFrom: '1971-12-16', validTo: spelling.validTo }]
      : [];

    if (!row.nameBn || !row.nameBn.trim()) {
      missingBanglaCount += 1;
    }

    normalized.push({
      ...row,
      nameEn: canonicalEn,
      aliases,
      nameHistory,
      status: 'active' as const,
      sourceId,
      missingBanglaGap: !row.nameBn?.trim(),
    });
  }

  return {
    sourceId,
    totalIngested: normalized.length,
    missingBanglaGaps: missingBanglaCount,
    records: normalized,
  };
}
