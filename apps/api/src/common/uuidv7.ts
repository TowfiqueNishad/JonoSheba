import { randomBytes } from 'node:crypto';

/**
 * Generates an RFC 9562 UUIDv7 (time-ordered, 48-bit Unix ms timestamp + 74 bits randomness).
 * Used as primary key across all Jonoshheba bounded contexts.
 */
export function uuidv7(nowMs: number = Date.now()): string {
  const bytes = randomBytes(16);

  // 48-bit big-endian Unix timestamp in milliseconds
  bytes[0] = (nowMs / 2 ** 40) & 0xff;
  bytes[1] = (nowMs / 2 ** 32) & 0xff;
  bytes[2] = (nowMs / 2 ** 24) & 0xff;
  bytes[3] = (nowMs / 2 ** 16) & 0xff;
  bytes[4] = (nowMs / 2 ** 8) & 0xff;
  bytes[5] = nowMs & 0xff;

  // Version 7 (0111)
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  // Variant 10xx
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
