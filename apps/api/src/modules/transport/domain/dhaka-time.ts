/**
 * Asia/Dhaka (UTC+06:00, no DST) date & calendar helpers for Transport & Watch Engine.
 * All timestamps are stored as UTC Date objects; calendar journey dates (YYYY-MM-DD)
 * are interpreted strictly in Asia/Dhaka local time so midnight boundaries never drift.
 */

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

/** Formats a UTC Date as YYYY-MM-DD in Asia/Dhaka */
export function toDhakaDateString(utcDate: Date): string {
  const shifted = new Date(utcDate.getTime() + DHAKA_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Returns UTC Date corresponding to 00:00:00.000 Asia/Dhaka for YYYY-MM-DD */
export function dhakaStartOfDayUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) {
    throw new Error(`Invalid YYYY-MM-DD date: ${dateStr}`);
  }
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - DHAKA_OFFSET_MS);
}

/** Returns UTC Date corresponding to 23:59:59.999 Asia/Dhaka for YYYY-MM-DD */
export function dhakaEndOfDayUtc(dateStr: string): Date {
  const start = dhakaStartOfDayUtc(dateStr);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

/** Adds deltaDays to a YYYY-MM-DD calendar date in Asia/Dhaka */
export function shiftDhakaDate(dateStr: string, deltaDays: number): string {
  const start = dhakaStartOfDayUtc(dateStr);
  const shifted = new Date(start.getTime() + deltaDays * 24 * 60 * 60 * 1000);
  return toDhakaDateString(shifted);
}

/** Returns +/- range of nearby dates (excluding the target date itself) */
export function getNearbyDhakaDates(dateStr: string, range = 3): string[] {
  const dates: string[] = [];
  for (let d = -range; d <= range; d++) {
    if (d === 0) continue;
    dates.push(shiftDhakaDate(dateStr, d));
  }
  return dates;
}

/** Day of week in Asia/Dhaka (0=Sun, 5=Fri, 6=Sat) */
export function getDhakaDayOfWeek(dateStr: string): number {
  const start = dhakaStartOfDayUtc(dateStr);
  const shifted = new Date(start.getTime() + DHAKA_OFFSET_MS);
  return shifted.getUTCDay();
}

/** Deterministic demand hint incorporating Bangladesh Fri/Sat weekends & peak festival windows */
export function getBangladeshDemandHint(dateStr: string): {
  level: 'normal' | 'elevated' | 'high';
  labelBn: string;
  labelEn: string;
} {
  const dow = getDhakaDayOfWeek(dateStr);
  const mmdd = dateStr.slice(5); // MM-DD

  // Major peak windows (Pohela Boishakh, Dec winter holidays, Thu evening / Fri-Sat weekend rush)
  if (mmdd >= '04-12' && mmdd <= '04-16') {
    return {
      level: 'high',
      labelBn: 'উচ্চ চাহিদা প্রত্যাশিত — পহেলা বৈশাখ ছুটি',
      labelEn: 'High demand expected — Pohela Boishakh holiday period',
    };
  }
  if (mmdd >= '12-15' && mmdd <= '12-31') {
    return {
      level: 'high',
      labelBn: 'উচ্চ চাহিদা প্রত্যাশিত — শীতকালীন ও বিজয় দিবস ছুটি',
      labelEn: 'High demand expected — Victory Day & winter holiday season',
    };
  }
  // Bangladesh weekend rush: Thursday (4), Friday (5), Saturday (6)
  if (dow === 4 || dow === 5 || dow === 6) {
    return {
      level: 'elevated',
      labelBn: 'সাপ্তাহিক ছুটির (শুক্র-শনি) কারণে টিকিটের চাহিদা বেশি থাকতে পারে',
      labelEn: 'Elevated demand expected — Bangladesh weekend (Fri–Sat) travel rush',
    };
  }

  return {
    level: 'normal',
    labelBn: 'স্বাভাবিক চাহিদা প্রত্যাশিত',
    labelEn: 'Normal demand expected',
  };
}
