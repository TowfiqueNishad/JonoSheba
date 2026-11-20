import { describe, expect, it } from 'vitest';
import { AvailabilityState, TrustLabel } from '@jonoshheba/shared';
import { BUNDLED_EMERGENCY_HOTLINES } from './emergency-bundle';
import { MOBILE_TABS, buildDialUrl, buildOfficialHandoffIntent } from './navigation/routes';
import { OfflineMobileStore } from './offline/store';
import {
  buildMobileHomeModel,
  buildMobileJonoChatModel,
  buildMobileLanguageToggleModel,
  buildMobileNostosThemeModel,
  buildMobileParityModels,
  buildMobileTransportCard,
  resolveMobileInitialLocale,
  resolveMobileInitialTheme,
} from './screens/screen-models';

describe('Phase 15 & F02/F04 — Mobile App (Expo Router models, bilingual toggle & offline-first guarantees)', () => {
  it('provides zero-auth offline 999 emergency tap-to-call bundle (Rule R8)', () => {
    const home = buildMobileHomeModel('bn');
    expect(home.primaryEmergencyCall.requiresAuth).toBe(false);
    expect(home.primaryEmergencyCall.dialUrl).toBe('tel:999');
    expect(home.hotlinesOfflineCount).toBe(BUNDLED_EMERGENCY_HOTLINES.length);
    expect(MOBILE_TABS.some((t) => t.name === 'emergency')).toBe(true);
    expect(buildDialUrl('16263')).toBe('tel:16263');
  });

  it('defaults to Bangla and exposes bilingual toggle model (F02)', () => {
    expect(resolveMobileInitialLocale(undefined)).toBe('bn');
    expect(resolveMobileInitialLocale('bn-BD')).toBe('bn');
    expect(resolveMobileInitialLocale('en-US')).toBe('en');

    const toggleBn = buildMobileLanguageToggleModel('bn');
    expect(toggleBn.nextLocale).toBe('en');
    expect(toggleBn.options.find((o) => o.locale === 'bn')?.active).toBe(true);

    const toggleEn = buildMobileLanguageToggleModel('en');
    expect(toggleEn.nextLocale).toBe('bn');
    expect(toggleEn.options.find((o) => o.locale === 'en')?.active).toBe(true);
  });

  it('enforces honest LINK_ONLY transport provenance & Not Reserved hand-off (Rules R1/R2/R4 & F04)', () => {
    const card = buildMobileTransportCard('en');
    expect(card.integrationType).toBe('LINK_ONLY');
    expect(card.labelledLive).toBe(false);
    expect(card.availabilityState).toBe(AvailabilityState.UNKNOWN_STALE);
    expect(card.handoff.notReserved).toBe(true);

    const intent = buildOfficialHandoffIntent('https://eticket.railway.gov.bd');
    expect(intent.disclaimerEn).toContain('Not reserved');
  });

  it('caches service checklists offline and flushes pending sync queue on reconnect', async () => {
    const store = new OfflineMobileStore();
    store.saveChecklist({
      serviceId: 'svc-bdris',
      titleBn: 'জন্ম নিবন্ধন',
      titleEn: 'Birth Registration',
      documents: ['Hospital discharge slip', 'Parents NID'],
      officialUrl: 'https://bdris.gov.bd',
      trustLabel: TrustLabel.OFFICIAL_SOURCE,
      savedAt: '2026-11-20T00:00:00Z',
    });
    expect(store.listChecklists()).toHaveLength(1);

    store.enqueueSync({
      id: 'sync-1',
      kind: 'WATCH_CREATE',
      payload: { route: 'DA-CTG', date: '2026-11-27' },
      createdAt: '2026-11-20T00:00:00Z',
    });
    expect(store.pendingCount()).toBe(1);

    const flushed = await store.flushSync(async () => Promise.resolve());
    expect(flushed).toBe(1);
    expect(store.pendingCount()).toBe(0);
  });

  it('exposes Section 10 mobile parity models for Jono recovery, search suggest, ministries, education EIIN/UGC, near-me, and push notifications', () => {
    const jonoBn = buildMobileJonoChatModel('bn');
    expect(jonoBn.autoRecoverSessionOn404OrRenewal).toBe(true);
    expect(jonoBn.starterChips).toHaveLength(4);

    const parity = buildMobileParityModels('bn');
    expect(parity.searchSuggest.endpoint).toBe('/api/v1/search/suggest');
    expect(parity.ministriesDirectory.ruleC4Enforced).toBe(true);
    expect(parity.educationHub.separateCodeTypes).toContain('eiin');
    expect(parity.educationHub.separateCodeTypes).toContain('ugcId');
    expect(parity.pushNotifications.requiresExplicitOptIn).toBe(true);
  });

  it('exposes NOSTOS mobile theme model (NIGHT Steel & Gold / DAY Bleached Light, text bottom tabs হোম · খুঁজুন · জনো · সতর্কতা · আমি, #B3261E 999 pill)', () => {
    expect(resolveMobileInitialTheme('dark')).toBe('night');
    expect(resolveMobileInitialTheme('light')).toBe('day');

    const nightModel = buildMobileNostosThemeModel('night');
    expect(nightModel.tokens.page).toBe('#050709');
    expect(nightModel.tokens.gold).toBe('#D9B46C');
    expect(nightModel.emergencyButton.backgroundColor).toBe('#B3261E');
    expect(nightModel.bottomTabs.map((t) => t.labelBn)).toEqual([
      'হোম',
      'খুঁজুন',
      'জনো',
      'সতর্কতা',
      'আমি',
    ]);
  });
});
