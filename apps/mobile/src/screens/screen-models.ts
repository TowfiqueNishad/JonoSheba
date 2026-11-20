import { nostosThemes, type NostosThemeMode } from '@jonoshheba/config';
import { AvailabilityState, TrustLabel, getDictionary, type Locale } from '@jonoshheba/shared';
import { BUNDLED_EMERGENCY_HOTLINES } from '../emergency-bundle';
import { MOBILE_NOSTOS_BOTTOM_TABS, buildDialUrl, buildOfficialHandoffIntent } from '../navigation/routes';

/** Resolves initial mobile theme from device appearance or local time (defaults to NIGHT "Steel & Gold") */
export function resolveMobileInitialTheme(deviceColorScheme?: 'dark' | 'light' | null): NostosThemeMode {
  if (deviceColorScheme === 'light') return 'day';
  return 'night';
}

export function buildMobileNostosThemeModel(mode: NostosThemeMode = 'night') {
  const tokens = nostosThemes[mode];
  return {
    mode,
    nextMode: mode === 'night' ? ('day' as const) : ('night' as const),
    tokens,
    dayNightToggleLabel: 'DAY · NIGHT',
    bottomTabs: MOBILE_NOSTOS_BOTTOM_TABS,
    activeTabIndicator: 'gliding-gold-hairline' as const,
    gentleHapticsOnPrimaryAction: true,
    emergencyButton: {
      number: '999',
      backgroundColor: '#B3261E',
      textColor: '#FFFFFF',
    },
  };
}

/** Resolves initial mobile locale from device locale string (defaults to Bangla 'bn') */
export function resolveMobileInitialLocale(deviceLocale?: string | null): Locale {
  if (!deviceLocale) return 'bn';
  return deviceLocale.toLowerCase().startsWith('en') ? 'en' : 'bn';
}

export function buildMobileLanguageToggleModel(currentLocale: Locale) {
  const dict = getDictionary(currentLocale);
  const nextLocale: Locale = currentLocale === 'bn' ? 'en' : 'bn';
  return {
    currentLocale,
    nextLocale,
    label: dict.locale.switchLabel,
    options: [
      { locale: 'bn' as const, label: dict.locale.bn, active: currentLocale === 'bn' },
      { locale: 'en' as const, label: dict.locale.en, active: currentLocale === 'en' },
    ],
  };
}

export function buildMobileHomeModel(locale: Locale = 'bn') {
  const dict = getDictionary(locale);
  return {
    locale,
    appTitle: dict.app.name,
    disclaimer: dict.app.disclaimer,
    languageToggle: buildMobileLanguageToggleModel(locale),
    primaryEmergencyCall: {
      number: '999',
      dialUrl: buildDialUrl('999'),
      label: dict.emergency.call999,
      requiresAuth: false,
    },
    hotlinesOfflineCount: BUNDLED_EMERGENCY_HOTLINES.length,
  };
}

export function buildMobileTransportCard(locale: Locale = 'bn') {
  const dict = getDictionary(locale);
  return {
    id: 'br-702',
    title: locale === 'bn' ? 'সুবর্ণ এক্সপ্রেস (৭০২)' : 'Suborno Express (702)',
    route: 'DA → CTG',
    availabilityState: AvailabilityState.UNKNOWN_STALE,
    availabilityText: dict.transport.seatInfoUnknown,
    liveSeatsNotice: dict.transport.liveSeatsNotice,
    integrationType: 'LINK_ONLY' as const,
    labelledLive: false as const,
    trustLabel: TrustLabel.OFFICIAL_SOURCE,
    handoff: buildOfficialHandoffIntent('https://eticket.railway.gov.bd'),
  };
}

/** Section 10 — Mobile Jono chat model with automatic session recovery and suggestion chips */
export function buildMobileJonoChatModel(locale: Locale = 'bn') {
  return {
    locale,
    endpoint: '/api/v1/assistant/message',
    autoRecoverSessionOn404OrRenewal: true,
    starterChips:
      locale === 'bn'
        ? [
            'ই-পাসপোর্ট করতে কী কী কাগজ লাগে?',
            'ঢাকা থেকে চট্টগ্রাম ট্রেনের সময়সূচি',
            'বয়স্ক ভাতার যোগ্যতা কীভাবে দেখব?',
            'জরুরি হটলাইন নম্বরগুলো কী কী?',
          ]
        : [
            'What documents are required for an e-Passport?',
            'Dhaka to Chattogram train schedule',
            'How to check Old Age Allowance eligibility?',
            'What are the national emergency hotlines?',
          ],
  };
}

/** Section 10 — Mobile autocomplete & directory models (Search, Ministries, Education EIIN/UGC, Near Me, Push) */
export function buildMobileParityModels(locale: Locale = 'bn') {
  return {
    searchSuggest: {
      endpoint: '/api/v1/search/suggest',
      debounceMs: 120,
      minCharsBn: 1,
      minCharsEn: 2,
    },
    ministriesDirectory: {
      endpoint: '/api/v1/orgs',
      hotlinesEndpoint: '/api/v1/hotlines',
      ruleC4Enforced: true,
    },
    educationHub: {
      institutionsEndpoint: '/api/v1/education/institutions',
      universitiesEndpoint: '/api/v1/education/universities',
      boardsEndpoint: '/api/v1/education/boards',
      separateCodeTypes: ['eiin', 'ugcId', 'nuCollegeCode', 'btebCode', 'boardCode'] as const,
    },
    nearMeOfflinePack: {
      placesEndpoint: '/api/v1/places',
      offlinePackEndpointTemplate: '/api/v1/offline-packs/{district}',
      attribution: '© OpenStreetMap contributors (ODbL)',
    },
    pushNotifications: {
      channels: ['ticket_watch_alert', 'scholarship_deadline_reminder', 'disaster_alert'] as const,
      requiresExplicitOptIn: true,
      locale,
    },
  };
}
