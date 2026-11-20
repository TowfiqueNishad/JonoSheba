'use client';

import { useEffect, useState } from 'react';
import { LanguageSwitcher, ThemeToggle } from '../../components/AppShell';
import { FilmPlateBanner } from '../../components/NostosPrimitive';
import { apiGet, apiPost } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useLocale } from '../../lib/i18n';
import { useTheme } from '../../lib/theme';

export default function AccountPage() {
  const { locale, dict } = useLocale();
  const { user, openSignIn, signOut } = useAuth();
  const { reducedMotion, setReducedMotion } = useTheme();
  const [watches, setWatches] = useState<
    Array<{ id: string; originCode: string; destinationCode: string; journeyDate: string; status: string }>
  >([]);
  const [checklists, setChecklists] = useState<
    Array<{ id: string; titleBn: string; titleEn: string; applicationUrl: string }>
  >([]);
  const [notifications, setNotifications] = useState<
    Array<{ id: string; titleBn?: string; titleEn?: string; readAt?: string | null }>
  >([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.allSettled([
      apiGet<{
        items: Array<{
          id: string;
          originCode: string;
          destinationCode: string;
          journeyDate: string;
          status: string;
        }>;
      }>('/api/v1/ticket-watches', { locale }),
      apiGet<{
        items: Array<{ id: string; titleBn: string; titleEn: string; applicationUrl: string }>;
      }>('/api/v1/me/checklists', { locale }),
      apiGet<{
        items: Array<{ id: string; titleBn?: string; titleEn?: string; readAt?: string | null }>;
      }>('/api/v1/notifications', { locale }),
    ]).then(([wR, cR, nR]) => {
      if (wR.status === 'fulfilled') setWatches(wR.value.items ?? []);
      if (cR.status === 'fulfilled') setChecklists(cR.value.items ?? []);
      if (nR.status === 'fulfilled') setNotifications(nR.value.items ?? []);
    });
  }, [user, locale]);

  async function requestExport() {
    await apiPost('/api/v1/me/data-export', {}, { locale });
    setStatusMsg(
      locale === 'bn'
        ? 'আপনার ব্যক্তিগত ডেটা এক্সপোর্ট অনুরোধ গৃহীত হয়েছে।'
        : 'Your personal data export request has been queued.',
    );
  }

  return (
    <div>
      <FilmPlateBanner
        overline="CITIZEN VAULT · PREFERENCES & WATCHES"
        title={dict.account.title}
        subtitle={
          locale === 'bn'
            ? 'ভাষা, দিন/রাত থিম, গতি নিয়ন্ত্রণ, টিকিট ওয়াচ ও সংরক্ষিত চেকলিস্ট'
            : 'Language, Day/Night grade, motion controls, ticket watches, and saved checklists'
        }
        breadcrumb={[{ label: dict.nav.home, href: '/' }, { label: dict.nav.account }]}
        actions={
          user ? (
            <button
              type="button"
              onClick={signOut}
              className="min-h-[44px] border border-[#B3261E] px-4 text-xs font-semibold text-[#E57368]"
            >
              {dict.account.signOut}
            </button>
          ) : (
            <button type="button" onClick={() => openSignIn()} className="nostos-btn-gold">
              {dict.account.signInTitle}
            </button>
          )
        }
      />

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
        {/* Language, Theme & Reduced Motion Preferences */}
        <section className="border border-[var(--hair)] bg-[var(--surface)] p-6">
          <h2 className="text-base font-semibold text-[var(--text)]">{dict.account.preferences}</h2>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--hair)] pt-4">
            <div className="flex flex-wrap items-center gap-4">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>

            {/* Section 5 Required Switch: "গতি কমান / Reduce motion" */}
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3 border border-[var(--hair)] px-4 text-xs text-[var(--text)]">
              <input
                type="checkbox"
                checked={reducedMotion}
                onChange={(e) => setReducedMotion(e.target.checked)}
                className="h-4 w-4 accent-[var(--gold)]"
              />
              <span>{locale === 'bn' ? 'গতি কমান' : 'Reduce motion'}</span>
            </label>
          </div>
        </section>

        {!user ? (
          <section className="border border-[var(--gold-line)] bg-[var(--surface)] p-6 text-sm text-[var(--text)]">
            <p>
              {locale === 'bn'
                ? 'ব্রাউজ করার জন্য কোনো লগইন বা এনআইডি লাগে না। টিকিট ওয়াচ, চেকলিস্ট ও রিমাইন্ডার সংরক্ষণ করতে মোবাইল ওটিপি দিয়ে সাইন ইন করুন।'
                : 'No login or NID is needed to browse. Sign in with mobile OTP to save ticket watches, checklists, and reminders.'}
            </p>
            <button
              type="button"
              onClick={() => openSignIn()}
              className="nostos-btn-gold mt-4"
            >
              {dict.account.signInTitle}
            </button>
          </section>
        ) : (
          <div className="space-y-4">
            {statusMsg && (
              <p
                role="status"
                className="border border-[var(--gold-line)] bg-[var(--surface)] p-3 text-sm text-[var(--gold)]"
              >
                {statusMsg}
              </p>
            )}

            <section className="border border-[var(--hair)] bg-[var(--surface)] p-5">
              <h2 className="text-base font-semibold text-[var(--text)]">
                {dict.account.ticketWatches}
              </h2>
              {watches.length === 0 ? (
                <p className="mt-2 text-xs text-[var(--text-muted)]">{dict.states.empty}</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {watches.map((w) => (
                    <li key={w.id} className="border border-[var(--hair)] bg-[var(--surface-2)] p-3">
                      {w.originCode} → {w.destinationCode} ({w.journeyDate}) ·{' '}
                      <strong>{w.status}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="border border-[var(--hair)] bg-[var(--surface)] p-5">
              <h2 className="text-base font-semibold text-[var(--text)]">
                {dict.account.checklists}
              </h2>
              {checklists.length === 0 ? (
                <p className="mt-2 text-xs text-[var(--text-muted)]">{dict.states.empty}</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {checklists.map((c) => (
                    <li key={c.id} className="border border-[var(--hair)] bg-[var(--surface-2)] p-3">
                      <a
                        href={c.applicationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="nostos-link text-[var(--gold)]"
                      >
                        {locale === 'bn' ? c.titleBn : c.titleEn}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="border border-[var(--hair)] bg-[var(--surface)] p-5">
              <h2 className="text-base font-semibold text-[var(--text)]">
                {dict.account.notifications}
              </h2>
              {notifications.length === 0 ? (
                <p className="mt-2 text-xs text-[var(--text-muted)]">{dict.states.empty}</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {notifications.map((n) => (
                    <li key={n.id} className="border border-[var(--hair)] bg-[var(--surface-2)] p-3">
                      {locale === 'bn' ? n.titleBn : n.titleEn}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="flex flex-wrap gap-3 border border-[var(--hair)] bg-[var(--surface)] p-5">
              <button
                type="button"
                onClick={() => void requestExport()}
                className="nostos-btn-gold"
              >
                {dict.account.exportData}
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
