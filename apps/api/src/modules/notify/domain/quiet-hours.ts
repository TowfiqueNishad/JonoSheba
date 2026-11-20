/**
 * Evaluates quiet-hours windows in Asia/Dhaka (UTC+06:00).
 * Supports overnight intervals like 23:00 -> 06:00 accurately.
 */

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

function parseHhMmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return ((h ?? 0) % 24) * 60 + ((m ?? 0) % 60);
}

export function getDhakaMinutesOfDay(utcNow: Date): number {
  const shifted = new Date(utcNow.getTime() + DHAKA_OFFSET_MS);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

export function isWithinDhakaQuietHours(
  utcNow: Date,
  quietHours: { enabled: boolean; start: string; end: string },
): boolean {
  if (!quietHours.enabled) return false;
  const current = getDhakaMinutesOfDay(utcNow);
  const start = parseHhMmToMinutes(quietHours.start);
  const end = parseHhMmToMinutes(quietHours.end);

  if (start === end) return false;
  if (start < end) {
    // Same-day window (e.g. 13:00 -> 15:00)
    return current >= start && current < end;
  }
  // Overnight window (e.g. 23:00 -> 06:00)
  return current >= start || current < end;
}
