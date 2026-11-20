'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { getDictionary, type Locale, type Messages } from '@jonoshheba/shared';
import { apiPatch } from './api';

interface LocaleContextValue {
  locale: Locale;
  dict: Messages;
  switchLocale: (next: Locale) => void;
  localePath: (path: string) => string;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: 'bn',
  dict: getDictionary('bn'),
  switchLocale: () => undefined,
  localePath: (p) => p,
});

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale);

  const value = useMemo<LocaleContextValue>(() => {
    const dict = getDictionary(locale);

    const localePath = (path: string) => {
      const normalized = path.startsWith('/') ? path : `/${path}`;
      if (normalized.startsWith('/bn/') || normalized === '/bn' || normalized.startsWith('/en/') || normalized === '/en') {
        return normalized;
      }
      if (normalized === '/') return `/${locale}`;
      return `/${locale}${normalized}`;
    };

    const switchLocale = (next: Locale) => {
      if (next === locale) return;
      setLocale(next);
      if (typeof document !== 'undefined') {
        document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`;
        document.documentElement.lang = next;
      }
      if (typeof window !== 'undefined') {
        // Persist preference if signed in
        const hasToken = Boolean(window.sessionStorage.getItem('jonoshheba_access_token'));
        if (hasToken) {
          void apiPatch('/api/v1/me/preferences', { language: next }, { locale: next }).catch(
            () => undefined,
          );
        }
        const rawPath = window.location.pathname;
        const stripped =
          rawPath === '/en' || rawPath === '/bn'
            ? ''
            : rawPath.startsWith('/en/') || rawPath.startsWith('/bn/')
              ? rawPath.slice(3)
              : rawPath === '/'
                ? ''
                : rawPath;
        const nextUrl = `/${next}${stripped}${window.location.search}${window.location.hash}`;
        window.location.assign(nextUrl);
      }
    };

    return { locale, dict, switchLocale, localePath };
  }, [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
