import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { argon2id, argon2Verify } from 'hash-wasm';
import {
  SignJWT,
  exportJWK,
  generateKeyPair,
  jwtVerify,
  type JWK,
  type KeyLike,
} from 'jose';
import type { AccessTokenClaims } from './identity.types';

interface SigningKeyEntry {
  kid: string;
  privateKey: KeyLike;
  publicKey: KeyLike;
  publicJwk: JWK;
  createdAt: Date;
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function toBase32(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function fromBase32(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

@Injectable()
export class IdentityCryptoService {
  private readonly keys: SigningKeyEntry[] = [];
  private initPromise: Promise<void> | null = null;
  private readonly issuer = process.env.JWT_ISSUER ?? 'jonoshheba-api';
  private readonly audience = process.env.JWT_AUDIENCE ?? 'jonoshheba-clients';
  private readonly accessTtlSec = Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 600);
  private readonly hmacSecret =
    process.env.JWT_REFRESH_SECRET ?? 'dev_only_replace_with_32_byte_random_refresh_secret_key';

  private async ensureInitialized(): Promise<void> {
    if (this.keys.length > 0) return;
    if (!this.initPromise) {
      this.initPromise = this.rotateSigningKey().then(() => undefined);
    }
    await this.initPromise;
  }

  /** Generates a new EdDSA (Ed25519) keypair with a fresh kid while retaining prior public keys for rotation grace */
  async rotateSigningKey(): Promise<string> {
    const { privateKey, publicKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
    const kid = `jono-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;
    const publicJwk = await exportJWK(publicKey);
    publicJwk.kid = kid;
    publicJwk.alg = 'EdDSA';
    publicJwk.use = 'sig';

    this.keys.unshift({
      kid,
      privateKey,
      publicKey,
      publicJwk,
      createdAt: new Date(),
    });
    // Retain up to 3 active/grace keys for seamless JWKS verification
    if (this.keys.length > 3) {
      this.keys.pop();
    }
    return kid;
  }

  async getJwks(): Promise<{ keys: JWK[] }> {
    await this.ensureInitialized();
    return { keys: this.keys.map((k) => k.publicJwk) };
  }

  async signAccessToken(claims: AccessTokenClaims): Promise<{ token: string; expiresIn: number }> {
    await this.ensureInitialized();
    const active = this.keys[0]!;
    const token = await new SignJWT({
      sid: claims.sid,
      roles: claims.roles,
      orgScopes: claims.orgScopes,
      isGuest: claims.isGuest,
      mfaVerified: claims.mfaVerified,
      locale: claims.locale,
    })
      .setProtectedHeader({ alg: 'EdDSA', kid: active.kid, typ: 'JWT' })
      .setSubject(claims.sub)
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setIssuedAt()
      .setExpirationTime(`${this.accessTtlSec}s`)
      .sign(active.privateKey);

    return { token, expiresIn: this.accessTtlSec };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    await this.ensureInitialized();
    const headerPart = token.split('.')[0];
    if (!headerPart) {
      throw new Error('Malformed JWT');
    }
    const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8')) as {
      kid?: string;
    };
    const keyEntry =
      (header.kid ? this.keys.find((k) => k.kid === header.kid) : undefined) ?? this.keys[0];
    if (!keyEntry) {
      throw new Error('Unknown JWT signing key');
    }

    const { payload } = await jwtVerify(token, keyEntry.publicKey, {
      issuer: this.issuer,
      audience: this.audience,
      algorithms: ['EdDSA'],
    });

    if (!payload.sub || typeof payload.sid !== 'string') {
      throw new Error('Missing required JWT claims');
    }

    return {
      sub: payload.sub,
      sid: payload.sid,
      roles: Array.isArray(payload.roles) ? (payload.roles as AccessTokenClaims['roles']) : [],
      orgScopes: Array.isArray(payload.orgScopes)
        ? (payload.orgScopes as AccessTokenClaims['orgScopes'])
        : [],
      isGuest: Boolean(payload.isGuest),
      mfaVerified: Boolean(payload.mfaVerified),
      locale: payload.locale === 'en' ? 'en' : 'bn',
    };
  }

  /** Argon2id (RFC 9106) password hashing */
  async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
    return argon2id({
      password,
      salt,
      parallelism: 1,
      iterations: isTest ? 2 : 3,
      memorySize: isTest ? 4096 : 65536, // 4 MiB in unit tests, 64 MiB in prod
      hashLength: 32,
      outputType: 'encoded',
    });
  }

  async verifyPassword(password: string, encodedHash: string): Promise<boolean> {
    try {
      return await argon2Verify({ password, hash: encodedHash });
    } catch {
      return false;
    }
  }

  /** Cryptographically random 6-digit OTP */
  generateOtpCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  /** Keyed HMAC-SHA256 hash for OTPs, refresh tokens, reset tokens, and backup codes */
  hashSecret(secret: string, namespace: string): string {
    return createHmac('sha256', this.hmacSecret).update(`${namespace}:${secret}`).digest('hex');
  }

  verifyHashedSecret(secret: string, expectedHash: string, namespace: string): boolean {
    const computed = Buffer.from(this.hashSecret(secret, namespace), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    if (computed.length !== expected.length) return false;
    return timingSafeEqual(computed, expected);
  }

  generateOpaqueToken(bytes = 32): string {
    return randomBytes(bytes).toString('base64url');
  }

  hashIp(ip?: string): string | null {
    if (!ip) return null;
    return createHash('sha256').update(`jonoshheba-ip:${ip}`).digest('hex');
  }

  // --- RFC 6238 TOTP & Backup Codes ---

  generateTotpSecret(): string {
    return toBase32(randomBytes(20));
  }

  buildTotpUri(secret: string, accountLabel: string): string {
    const issuer = encodeURIComponent('Jonoshheba AI');
    const label = encodeURIComponent(accountLabel);
    return `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
  }

  computeTotpCode(secret: string, timestampMs: number = Date.now()): string {
    const counter = Math.floor(timestampMs / 1000 / 30);
    const counterBuf = Buffer.alloc(8);
    counterBuf.writeBigUInt64BE(BigInt(counter));
    const key = fromBase32(secret);
    const hmac = createHmac('sha1', key).update(counterBuf).digest();
    const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f;
    const binary =
      (((hmac[offset] ?? 0) & 0x7f) << 24) |
      (((hmac[offset + 1] ?? 0) & 0xff) << 16) |
      (((hmac[offset + 2] ?? 0) & 0xff) << 8) |
      ((hmac[offset + 3] ?? 0) & 0xff);
    return String(binary % 1_000_000).padStart(6, '0');
  }

  verifyTotpCode(secret: string, code: string, nowMs: number = Date.now()): boolean {
    const clean = code.trim();
    if (!/^\d{6}$/.test(clean)) return false;
    for (const drift of [-1, 0, 1]) {
      const expected = this.computeTotpCode(secret, nowMs + drift * 30_000);
      if (timingSafeEqual(Buffer.from(clean), Buffer.from(expected))) {
        return true;
      }
    }
    return false;
  }

  generateBackupCodes(count = 8): { plain: string[]; hashes: string[] } {
    const plain: string[] = [];
    const hashes: string[] = [];
    for (let i = 0; i < count; i++) {
      const raw = randomBytes(4).toString('hex').toUpperCase();
      const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
      plain.push(formatted);
      hashes.push(this.hashSecret(formatted, 'mfa-backup'));
    }
    return { plain, hashes };
  }
}
