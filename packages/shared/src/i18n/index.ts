import bn from './bn.json';
import en from './en.json';
import type { AvailabilityState, Locale, TrustLabel } from '../enums';

export type Messages = typeof en;

export const dictionaries: Record<Locale, Messages> = {
  bn,
  en,
};

export function getDictionary(locale: Locale): Messages {
  return dictionaries[locale] ?? dictionaries.bn;
}

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'] as const;

/** Converts ASCII digits 0-9 to Bangla digits ০-৯ when locale is 'bn' (or forceBanglaDigits=true) */
export function formatDigits(
  value: string | number,
  locale: Locale,
  forceBanglaDigits = false,
): string {
  const str = String(value);
  if (locale !== 'bn' && !forceBanglaDigits) return str;
  return str.replace(/\d/g, (d) => BN_DIGITS[Number(d)] ?? d);
}

/** Formats BDT currency amount cleanly per locale (e.g. ৳১,০৭১ in bn, ৳1,071 in en) */
export function formatBdt(amount: number, locale: Locale, forceBanglaDigits = false): string {
  const formatted = new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-BD', {
    maximumFractionDigits: 0,
  }).format(amount);
  const digits = forceBanglaDigits ? formatDigits(formatted, 'bn', true) : formatted;
  return `৳${digits}`;
}

/** Formats duration in minutes to localized Bangla or English string ("৪ ঘ. ৫৫ মি." / "4h 55m") */
export function formatDuration(minutes: number, locale: Locale): string {
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (locale === 'bn') {
    if (h === 0) return `${formatDigits(m, 'bn')} মি.`;
    if (m === 0) return `${formatDigits(h, 'bn')} ঘ.`;
    return `${formatDigits(h, 'bn')} ঘ. ${formatDigits(m, 'bn')} মি.`;
  }
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Formats HH:mm (Asia/Dhaka) into localized 12h time ("বিকাল ৪:৩০" / "4:30 PM") */
export function formatDhakaTime(hhmm: string | null | undefined, locale: Locale): string {
  if (!hhmm || !/^\d{1,2}:\d{2}/.test(hhmm)) return hhmm ?? '—';
  const [hRaw, mRaw] = hhmm.split(':').map(Number);
  const h = hRaw ?? 0;
  const m = mRaw ?? 0;
  const mm = String(m).padStart(2, '0');
  const h12 = h % 12 === 0 ? 12 : h % 12;

  if (locale === 'bn') {
    const period =
      h < 5 ? 'রাত' : h < 12 ? 'সকাল' : h < 15 ? 'দুপুর' : h < 18 ? 'বিকাল' : h < 20 ? 'সন্ধ্যা' : 'রাত';
    return `${period} ${formatDigits(h12, 'bn')}:${formatDigits(mm, 'bn')}`;
  }
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h12}:${mm} ${ampm}`;
}

/** Formats ISO date string in Asia/Dhaka */
export function formatDhakaDate(iso: string | Date | null | undefined, locale: Locale): string {
  if (!iso) return locale === 'bn' ? 'যাচাই চলছে' : 'Verification pending';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat(locale === 'bn' ? 'bn-BD' : 'en-GB', {
    timeZone: 'Asia/Dhaka',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/** Localized human-readable seat class name (never exposes raw S_CHAIR / SNIGDHA codes) */
export function getSeatClassLabel(code: string, locale: Locale): string {
  const dict = getDictionary(locale).seatClasses as Record<string, string>;
  return dict[code.toUpperCase()] ?? code.replace(/_/g, ' ');
}

export function getTrustLabelText(label: TrustLabel | string, locale: Locale): string {
  const dict = getDictionary(locale).trust as Record<string, string>;
  return dict[label] ?? label;
}

export function getAvailabilityLabelText(state: AvailabilityState | string, locale: Locale): string {
  const dict = getDictionary(locale).availability as Record<string, string>;
  return dict[state] ?? state;
}

export function getChannelLabel(channel: string, locale: Locale): string {
  const dict = getDictionary(locale).channels as Record<string, string>;
  return dict[channel.toLowerCase()] ?? channel;
}

/** Interpolates `{var}` placeholders in message templates */
export function interpolate(
  template: string,
  vars: Record<string, string | number>,
  locale: Locale = 'bn',
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const val = vars[key];
    if (val === undefined) return `{${key}}`;
    return typeof val === 'number' ? formatDigits(val, locale) : String(val);
  });
}

export { bn, en };
