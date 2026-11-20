import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface BanbeisImportRow {
  eiin: string;
  nameBn: string;
  nameEn: string;
  type: 'school' | 'college' | 'madrasa' | 'technical';
  level: string;
  management: 'public' | 'private';
  districtEn: string;
  upazilaEn?: string;
  lat?: number;
  lng?: number;
  sourceUrl: string;
}

export function validateEducationImportRows(rows: BanbeisImportRow[]): {
  validRows: BanbeisImportRow[];
  duplicateEiins: string[];
  missingDistricts: string[];
  outOfBoundsCoordinates: string[];
} {
  const seen = new Set<string>();
  const duplicateEiins: string[] = [];
  const missingDistricts: string[] = [];
  const outOfBoundsCoordinates: string[] = [];
  const validRows: BanbeisImportRow[] = [];

  for (const r of rows) {
    if (!/^\d{6}$/.test(r.eiin)) continue;
    if (seen.has(r.eiin)) {
      duplicateEiins.push(r.eiin);
      continue;
    }
    seen.add(r.eiin);

    if (!r.districtEn || !r.districtEn.trim()) {
      missingDistricts.push(r.eiin);
      continue;
    }
    if (
      r.lat !== undefined &&
      r.lng !== undefined &&
      (r.lat < 20.5 || r.lat > 26.7 || r.lng < 88.0 || r.lng > 92.7)
    ) {
      outOfBoundsCoordinates.push(r.eiin);
      continue;
    }
    validRows.push(r);
  }

  return { validRows, duplicateEiins, missingDistricts, outOfBoundsCoordinates };
}

export function scanEducationImports(
  baseDir = resolve(process.cwd(), 'data/imports/education'),
): {
  status: 'READY_FOR_REVIEW' | 'PENDING_SOURCE_FILES';
  filesFound: string[];
} {
  if (!existsSync(baseDir)) {
    return { status: 'PENDING_SOURCE_FILES', filesFound: [] };
  }
  const files = readdirSync(baseDir).filter((f) => f.endsWith('.csv') || f.endsWith('.json'));
  if (files.length === 0) {
    return { status: 'PENDING_SOURCE_FILES', filesFound: [] };
  }
  for (const f of files) {
    readFileSync(join(baseDir, f), 'utf8');
  }
  return { status: 'READY_FOR_REVIEW', filesFound: files };
}
