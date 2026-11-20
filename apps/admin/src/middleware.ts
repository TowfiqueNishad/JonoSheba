import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/favicon.ico'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Generate CSP nonce
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const nonce = btoa(binary);

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self' ${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'}`,
    "img-src 'self' data:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // Security headers
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  response.headers.delete('X-Powered-By');

  // ✦ Admin-specific: noindex, nofollow on every response
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');

  // ✦ Auth guard: redirect to /login if no admin session cookie
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '?'));
  if (!isPublic) {
    const sessionCookie = request.cookies.get('jono_admin_session');
    if (!sessionCookie?.value) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

