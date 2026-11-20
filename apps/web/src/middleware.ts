import { NextResponse, type NextRequest } from 'next/server';

export function buildCspHeader(nonce: string, apiOrigin?: string, isDev = false): string {
  const connectSources = ["'self'"];
  if (apiOrigin) {
    try {
      const origin = new URL(apiOrigin).origin;
      if (origin && !connectSources.includes(origin)) {
        connectSources.push(origin);
      }
    } catch {
      // Ignore malformed env URL
    }
  }

  const scriptSrc = isDev
    ? `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    `connect-src ${connectSources.join(' ')}`,
    "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
    "font-src 'self' data:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
  ].join('; ');
}

export function generateCspNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

export function detectRequestLocale(request: NextRequest): {
  locale: 'bn' | 'en';
  strippedPath: string | null;
} {
  const { pathname } = request.nextUrl;

  if (pathname === '/en' || pathname.startsWith('/en/')) {
    const rest = pathname.slice(3) || '/';
    return { locale: 'en', strippedPath: rest };
  }
  if (pathname === '/bn' || pathname.startsWith('/bn/')) {
    const rest = pathname.slice(3) || '/';
    return { locale: 'bn', strippedPath: rest };
  }

  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value?.toLowerCase();
  if (cookieLocale === 'en') return { locale: 'en', strippedPath: null };
  if (cookieLocale === 'bn') return { locale: 'bn', strippedPath: null };

  const acceptLang = request.headers.get('accept-language') ?? '';
  const primary = acceptLang.split(',')[0]?.trim().toLowerCase() ?? '';
  if (primary.startsWith('en')) return { locale: 'en', strippedPath: null };

  return { locale: 'bn', strippedPath: null };
}

/**
 * Security headers, per-request CSP nonces (Finding S4), and bilingual /bn & /en locale routing (Finding L1).
 */
export function middleware(request: NextRequest) {
  const nonce = generateCspNonce();
  const isDev = process.env.NODE_ENV === 'development';
  const apiOrigin = process.env.NEXT_PUBLIC_API_BASE_URL || undefined;
  const csp = buildCspHeader(nonce, apiOrigin, isDev);

  const { locale, strippedPath } = detectRequestLocale(request);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('x-locale', locale);
  requestHeaders.set('content-security-policy', csp);

  let targetPath = strippedPath ?? request.nextUrl.pathname;
  // Friendly Bangla/English route aliases for Health page (Finding O1)
  if (targetPath === '/swasthya' || targetPath === '/health-services') {
    targetPath = '/health';
  }

  const needsRewrite = targetPath !== request.nextUrl.pathname;
  let response: NextResponse;
  if (needsRewrite) {
    const url = request.nextUrl.clone();
    url.pathname = targetPath;
    response = NextResponse.rewrite(url, {
      request: { headers: requestHeaders },
    });
  } else {
    response = NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  if (strippedPath !== null) {
    response.cookies.set('NEXT_LOCALE', locale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
  }

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(self), camera=(), microphone=(self)');
  response.headers.set('Content-Language', locale);
  response.headers.set('Vary', 'Accept-Language, Cookie');
  response.headers.delete('X-Powered-By');

  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|sw.js|icons|robots.txt|sitemap.xml).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
