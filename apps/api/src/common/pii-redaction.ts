const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'password_hash',
  'otp',
  'code',
  'codehash',
  'code_hash',
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'refreshtokenhash',
  'refresh_token_hash',
  'secret',
  'mfasecret',
  'mfa_secret_enc',
  'backupcodes',
  'pin',
  'cardnumber',
  'cvv',
  'authorization',
  'cookie',
  'nid',
  'birthregno',
]);

/** Masks a Bangladesh phone number or email while keeping minimal debugging suffix */
export function maskIdentifier(value: string): string {
  if (value.includes('@')) {
    const [local, domain] = value.split('@');
    const safeLocal = (local ?? '').slice(0, 2);
    return `${safeLocal}***@${domain ?? '***'}`;
  }
  if (value.length > 4) {
    return `${'*'.repeat(value.length - 4)}${value.slice(-4)}`;
  }
  return '***';
}

/** Redacts embedded Bangladesh phone numbers, emails, and NID/BRN/card numbers from free text (Rule R9) */
export function redactFreeTextPii(text: string): string {
  return text
    .replace(/(?:\+?88)?01[3-9]\d{8}/g, '[REDACTED_PHONE]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[REDACTED_EMAIL]')
    .replace(/\b\d{10,17}\b/g, '[REDACTED_ID]');
}

/** Recursively redacts sensitive keys and secret-like values for safe audit & operational logging */
export function redactPii(input: unknown, depth = 0): unknown {
  if (depth > 8 || input === null || input === undefined) {
    return input;
  }
  if (typeof input === 'string') {
    if (input.startsWith('Bearer ')) {
      return 'Bearer [REDACTED]';
    }
    if (/^\+8801[3-9]\d{8}$/.test(input)) {
      return maskIdentifier(input);
    }
    return input;
  }
  if (Array.isArray(input)) {
    return input.map((item) => redactPii(item, depth + 1));
  }
  if (typeof input === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
      const normalized = key.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (SENSITIVE_KEYS.has(normalized)) {
        output[key] = '[REDACTED]';
      } else {
        output[key] = redactPii(val, depth + 1);
      }
    }
    return output;
  }
  return input;
}
