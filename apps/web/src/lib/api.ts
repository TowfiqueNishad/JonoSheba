import type { Locale } from '@jonoshheba/shared';

/** Same-origin Next.js /api/* proxy so localhost, staging, and tunnels work seamlessly */
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, '') || '';

export interface ApiError extends Error {
  status?: number;
  problem?: {
    title?: string;
    detail?: string;
    code?: string;
    suggestions?: string[];
  };
}

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem('jonoshheba_access_token');
  } catch {
    return null;
  }
}

function buildHeaders(
  locale: Locale,
  extraHeaders?: Record<string, string>,
  hasBody = false,
): Record<string, string> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Language': locale,
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  };
  return headers;
}

async function handleResponse<T>(res: Response, path: string): Promise<T> {
  if (!res.ok) {
    const err: ApiError = new Error(`API ${path} failed (${res.status})`);
    err.status = res.status;
    try {
      err.problem = (await res.json()) as ApiError['problem'];
      if (err.problem?.detail) err.message = err.problem.detail;
    } catch {
      // keep default message
    }
    throw err;
  }
  return (await res.json()) as T;
}

export async function apiGet<T>(
  path: string,
  opts?: { locale?: Locale; headers?: Record<string, string> },
): Promise<T> {
  const locale = opts?.locale ?? 'bn';
  const res = await fetch(`${API_BASE}${path}`, {
    headers: buildHeaders(locale, opts?.headers, false),
    cache: 'no-store',
  });
  return handleResponse<T>(res, path);
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  opts?: { locale?: Locale; headers?: Record<string, string> } | Record<string, string>,
): Promise<T> {
  const isOptsObj = opts && ('locale' in opts || 'headers' in opts);
  const locale: Locale = isOptsObj ? ((opts as { locale?: Locale }).locale ?? 'bn') : 'bn';
  const extraHeaders = isOptsObj
    ? (opts as { headers?: Record<string, string> }).headers
    : (opts as Record<string, string> | undefined);
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: buildHeaders(locale, extraHeaders, true),
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res, path);
}

export async function apiPatch<T>(
  path: string,
  body: unknown,
  opts?: { locale?: Locale; headers?: Record<string, string> },
): Promise<T> {
  const locale = opts?.locale ?? 'bn';
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: buildHeaders(locale, opts?.headers, true),
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res, path);
}

export async function apiDelete<T>(
  path: string,
  opts?: { locale?: Locale; headers?: Record<string, string> } | Record<string, string>,
): Promise<T> {
  const isOptsObj = opts && ('locale' in opts || 'headers' in opts);
  const locale: Locale = isOptsObj ? ((opts as { locale?: Locale }).locale ?? 'bn') : 'bn';
  const extraHeaders = isOptsObj
    ? (opts as { headers?: Record<string, string> }).headers
    : (opts as Record<string, string> | undefined);
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: buildHeaders(locale, extraHeaders, false),
  });
  return handleResponse<T>(res, path);
}
