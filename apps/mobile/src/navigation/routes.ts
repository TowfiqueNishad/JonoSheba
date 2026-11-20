export const MOBILE_TABS = [
  { name: 'index', path: '/(tabs)', labelBn: 'হোম', labelEn: 'Home' },
  { name: 'search', path: '/(tabs)/search', labelBn: 'খুঁজুন', labelEn: 'Search' },
  { name: 'jono', path: '/(tabs)/jono', labelBn: 'জনো', labelEn: 'Jono' },
  { name: 'alerts', path: '/(tabs)/alerts', labelBn: 'সতর্কতা', labelEn: 'Alerts' },
  { name: 'me', path: '/(tabs)/me', labelBn: 'আমি', labelEn: 'Me' },
  { name: 'emergency', path: '/(tabs)/emergency', labelBn: 'জরুরি ৯৯৯', labelEn: 'Emergency' },
] as const;

export const MOBILE_NOSTOS_BOTTOM_TABS = [
  { name: 'index', path: '/(tabs)', labelBn: 'হোম', labelEn: 'Home' },
  { name: 'search', path: '/(tabs)/search', labelBn: 'খুঁজুন', labelEn: 'Search' },
  { name: 'jono', path: '/(tabs)/jono', labelBn: 'জনো', labelEn: 'Jono' },
  { name: 'alerts', path: '/(tabs)/alerts', labelBn: 'সতর্কতা', labelEn: 'Alerts' },
  { name: 'me', path: '/(tabs)/me', labelBn: 'আমি', labelEn: 'Me' },
] as const;

export function buildDialUrl(phoneNumber: string): string {
  const digits = phoneNumber.replace(/[^0-9+]/g, '');
  return `tel:${digits}`;
}

export interface OfficialHandoffIntent {
  url: string;
  notReserved: true;
  disclaimerBn: string;
  disclaimerEn: string;
}

export function buildOfficialHandoffIntent(url: string): OfficialHandoffIntent {
  return {
    url,
    notReserved: true,
    disclaimerBn: 'আসন সংরক্ষিত নয় — অফিশিয়াল চ্যানেলে এগিয়ে যান।',
    disclaimerEn: 'Not reserved — continue to official channel.',
  };
}
