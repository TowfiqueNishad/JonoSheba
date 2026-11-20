import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { getDictionary, type Locale } from '@jonoshheba/shared';
import { AppFooter, AppHeader, MobileBottomNav } from '../components/AppShell';
import { CustomCursorRing, FilmGrainOverlay } from '../components/NostosPrimitive';
import { AuthProvider } from '../lib/auth';
import { LocaleProvider } from '../lib/i18n';
import { ThemeProvider } from '../lib/theme';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#050709',
};

export async function generateMetadata(): Promise<Metadata> {
  const hdrs = await headers();
  const locale: Locale = hdrs.get('x-locale') === 'en' ? 'en' : 'bn';
  const dict = getDictionary(locale);
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
    title: {
      default: `${dict.app.name} — ${dict.app.tagline}`,
      template: `%s | ${dict.app.name}`,
    },
    description: `${dict.app.tagline}. ${dict.app.disclaimer}.`,
    manifest: '/manifest.webmanifest',
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: 'any' },
        { url: '/icons/icon.svg', type: 'image/svg+xml' },
      ],
      apple: '/icons/icon.svg',
    },
    alternates: {
      canonical: `/${locale}`,
      languages: {
        bn: '/bn',
        en: '/en',
        'x-default': '/bn',
      },
    },
    openGraph: {
      title: dict.app.name,
      description: dict.app.tagline,
      locale: locale === 'bn' ? 'bn_BD' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: dict.app.name,
      description: dict.app.tagline,
    },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const hdrs = await headers();
  const nonce = hdrs.get('x-nonce') ?? undefined;
  const locale: Locale = hdrs.get('x-locale') === 'en' ? 'en' : 'bn';

  return (
    <html
      lang={locale}
      dir="ltr"
      data-theme="night"
      data-csp-nonce={nonce ? 'enabled' : 'none'}
    >
      <body className="nostos-body flex min-h-screen flex-col max-w-full overflow-x-hidden">
        <ThemeProvider>
          <LocaleProvider initialLocale={locale}>
            <AuthProvider>
              <FilmGrainOverlay />
              <CustomCursorRing />
              <AppHeader />
              <main id="main-content" tabIndex={-1} className="relative z-10 flex-1 max-w-full overflow-x-hidden">
                {children}
              </main>
              <AppFooter />
              <MobileBottomNav />
            </AuthProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
