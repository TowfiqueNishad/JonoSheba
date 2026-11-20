import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface ImportedOfficerRow {
  orgId: string;
  designationBn: string;
  designationEn: string;
  incumbentNameBn: string;
  incumbentNameEn: string;
  officePhone: string;
  officialEmail?: string | null;
  asOf: string;
  sourceUrl: string;
}

const PERSONAL_MOBILE_RE = /^(?:\+?88)?01[3-9]\d{8}$/;

/** Rule C4: Rejects or redacts personal mobile numbers from officer records */
export function sanitizeOfficialOfficePhone(rawPhone: string): {
  officePhone: string | null;
  redactedPersonalMobile: boolean;
} {
  const cleaned = rawPhone.replace(/[\s()-]/g, '');
  if (PERSONAL_MOBILE_RE.test(cleaned)) {
    return { officePhone: null, redactedPersonalMobile: true };
  }
  return { officePhone: rawPhone.trim(), redactedPersonalMobile: false };
}

export function scanMinistryImports(
  importDir = resolve(process.cwd(), 'data/imports/ministries'),
): {
  filesFound: string[];
  rowsValid: number;
  personalMobilesStripped: number;
  status: 'READY_FOR_REVIEW' | 'PENDING_SOURCE_FILES';
} {
  if (!existsSync(importDir)) {
    return { filesFound: [], rowsValid: 0, personalMobilesStripped: 0, status: 'PENDING_SOURCE_FILES' };
  }
  const files = readdirSync(importDir).filter((f) => f.endsWith('.json') || f.endsWith('.csv'));
  if (files.length === 0) {
    return { filesFound: [], rowsValid: 0, personalMobilesStripped: 0, status: 'PENDING_SOURCE_FILES' };
  }

  let rowsValid = 0;
  let personalMobilesStripped = 0;
  for (const file of files) {
    const raw = readFileSync(join(importDir, file), 'utf8');
    if (file.endsWith('.json')) {
      const parsed = JSON.parse(raw) as ImportedOfficerRow[];
      for (const row of parsed) {
        const check = sanitizeOfficialOfficePhone(row.officePhone ?? '');
        if (check.redactedPersonalMobile) personalMobilesStripped += 1;
        if (row.sourceUrl?.includes('.gov.bd')) rowsValid += 1;
      }
    }
  }

  return {
    filesFound: files,
    rowsValid,
    personalMobilesStripped,
    status: rowsValid > 0 ? 'READY_FOR_REVIEW' : 'PENDING_SOURCE_FILES',
  };
}
