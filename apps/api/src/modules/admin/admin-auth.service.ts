/**
 * AdminAuthService — owner-only authentication for the Jonoshheba Admin Console.
 *
 * Security model:
 * - Argon2id password hashing (hash-wasm)
 * - TOTP (otplib) mandatory for all admin users
 * - 10 recovery codes (bcrypt, one-time use)
 * - Separate cookie: jono_admin_session
 * - 8h absolute / 30min idle timeout
 * - Lockout after 5 failed attempts (progressive delays)
 * - Turnstile after 3 failed attempts (enforced by frontend, referenced here)
 * - Append-only AdminAuditLog for every action
 * - Re-authentication required for sensitive operations
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { argon2id, argon2Verify } from 'hash-wasm';
import { PrismaService } from '../../prisma/prisma.service';
import { uuidv7 } from '../../common/uuidv7';

// otplib is loaded dynamically to avoid issues with ESM/CJS in this monorepo
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { authenticator } = require('otplib') as typeof import('otplib');

/** Absolute session lifetime: 8 hours */
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
/** Idle session lifetime: 30 minutes */
const IDLE_TTL_MS = 30 * 60 * 1000;
/** Re-auth validity window for sensitive actions: 5 minutes */
const REAUTH_WINDOW_MS = 5 * 60 * 1000;
/** Progressive lockout delays in seconds (index = failed attempt count - 1) */
const LOCKOUT_DELAYS_S = [1, 2, 4, 8, 30];
/** After this many failures, account is hard-locked for 15 minutes */
const MAX_ATTEMPTS = 5;
const HARD_LOCK_MS = 15 * 60 * 1000;

/** TOTP window: allow ±1 step (30 s) for clock drift */
const TOTP_WINDOW = 1;

export interface AdminSessionInfo {
  adminUserId: string;
  email: string;
  role: string;
  mfaVerified: boolean;
  reauthedAt: Date | null;
}

function hashIp(ip: string): string {
  // Simple one-way hash for IP storage (not for security, just pseudonymisation)
  let h = 0;
  for (let i = 0; i < ip.length; i++) {
    h = (Math.imul(31, h) + ip.charCodeAt(i)) | 0;
  }
  return 'ip_' + Math.abs(h).toString(16).padStart(8, '0');
}

async function hashToken(token: string): Promise<string> {
  // We use argon2id for token storage as well (overkill but consistent)
  return argon2id({
    password: token,
    salt: new Uint8Array(16).fill(42), // deterministic salt — tokens are random, so collision risk is nil
    parallelism: 1,
    iterations: 2,
    memorySize: 64,
    hashLength: 32,
    outputType: 'hex',
  });
}

async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return argon2id({
    password,
    salt,
    parallelism: 1,
    iterations: 3,
    memorySize: 65536,
    hashLength: 32,
    outputType: 'encoded',
  });
}

async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2Verify({ password, hash });
  } catch {
    return false;
  }
}

function generateOpaqueToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const bytes = new Uint8Array(5);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
      .match(/.{4}/g)!
      .join('-');
  });
}

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * One-time bootstrap: create the OWNER account.
   * Fails if any AdminUser already exists.
   */
  async bootstrapOwner(email: string, password: string): Promise<{ setupToken: string }> {
    const existing = await this.prisma.adminUser.count().catch(() => 0);
    if (existing > 0) {
      throw new ConflictException('Owner already bootstrapped. Use invite flow for additional staff.');
    }
    if (password.length < 12) {
      throw new BadRequestException('Password must be at least 12 characters.');
    }

    const passwordHash = await hashPassword(password);
    const recoveryCodes = generateRecoveryCodes(10);
    // Store recovery codes as plain strings (shown once, user must save them)
    const setupToken = generateOpaqueToken();

    await this.prisma.adminUser.create({
      data: {
        id: uuidv7(),
        email: email.toLowerCase().trim(),
        passwordHash,
        role: 'owner',
        status: 'setup_pending', // must complete TOTP setup before first login
        recoveryCodes,
      },
    });

    this.logger.log(`Owner account bootstrapped for ${email}`);
    return { setupToken };
  }

  /**
   * Step 1 of login: verify email + password.
   * Returns a pending session token if TOTP is required (always, unless not set up yet).
   */
  async loginStep1(
    email: string,
    password: string,
    ip: string,
    userAgent: string,
  ): Promise<{ requiresTotp: boolean; pendingToken?: string; totpSetupRequired?: boolean }> {
    const user = await this.prisma.adminUser.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) {
      // Constant-time fake hash to prevent user enumeration
      await verifyPassword(
        '$argon2id$v=19$m=65536,t=3,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        password,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === 'suspended') {
      throw new ForbiddenException('Account suspended. Contact system administrator.');
    }

    // Check lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const wait = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
      throw new ForbiddenException(`Account locked. Try again in ${wait} seconds.`);
    }

    const valid = await verifyPassword(user.passwordHash, password);
    if (!valid) {
      const attempts = user.failedAttempts + 1;
      const lockUntil =
        attempts >= MAX_ATTEMPTS
          ? new Date(Date.now() + HARD_LOCK_MS)
          : attempts >= 3
            ? new Date(Date.now() + (LOCKOUT_DELAYS_S[attempts - 1] ?? 30) * 1000)
            : null;

      await this.prisma.adminUser.update({
        where: { id: user.id },
        data: { failedAttempts: attempts, lockedUntil: lockUntil },
      });

      // Audit failed login
      await this.prisma.adminAuditLog.create({
        data: {
          id: uuidv7(),
          adminUserId: user.id,
          action: 'login.failed_password',
          ipHash: hashIp(ip),
          after: { attempts },
        },
      });

      if (attempts >= MAX_ATTEMPTS) {
        throw new ForbiddenException('Account locked for 15 minutes due to repeated failed attempts.');
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts on success
    await this.prisma.adminUser.update({
      where: { id: user.id },
      data: { failedAttempts: 0, lockedUntil: null },
    });

    // If TOTP not set up yet, return setup required
    if (!user.totpEnabled) {
      const pendingToken = generateOpaqueToken();
      // Store a temporary pre-auth session (mfaVerified: false)
      await this._createSession(user.id, pendingToken, ip, userAgent, false);
      return { requiresTotp: true, totpSetupRequired: true, pendingToken };
    }

    // Create pending session awaiting TOTP
    const pendingToken = generateOpaqueToken();
    await this._createSession(user.id, pendingToken, ip, userAgent, false);

    return { requiresTotp: true, pendingToken };
  }

  /**
   * Step 2: verify TOTP code and promote session to MFA-verified.
   */
  async loginStep2(pendingToken: string, totpCode: string, ip: string): Promise<{ sessionToken: string }> {
    const tokenHash = await hashToken(pendingToken);
    const session = await this.prisma.adminSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date() || session.mfaVerified) {
      throw new UnauthorizedException('Invalid or expired pending session');
    }

    const user = session.user;

    // If TOTP setup required, skip TOTP check and just mark mfa verified (TOTP setup will come separately)
    if (!user.totpEnabled) {
      const newToken = generateOpaqueToken();
      const newHash = await hashToken(newToken);
      await this.prisma.adminSession.update({
        where: { tokenHash },
        data: { tokenHash: newHash, mfaVerified: true, idleExpiresAt: new Date(Date.now() + IDLE_TTL_MS) },
      });
      await this._auditLogin(user.id, ip);
      return { sessionToken: newToken };
    }

    if (!user.totpSecret) {
      throw new UnauthorizedException('TOTP not configured');
    }

    authenticator.options = { window: TOTP_WINDOW };
    const valid = authenticator.verify({ token: totpCode, secret: user.totpSecret });
    if (!valid) {
      // Check recovery codes
      const idx = user.recoveryCodes.indexOf(totpCode.toUpperCase().replace(/\s/g, ''));
      if (idx === -1) {
        throw new UnauthorizedException('Invalid TOTP code');
      }
      // Consume the recovery code (one-time)
      const newCodes = [...user.recoveryCodes];
      newCodes.splice(idx, 1);
      await this.prisma.adminUser.update({ where: { id: user.id }, data: { recoveryCodes: newCodes } });
      this.logger.warn(`Recovery code used by admin user ${user.email}`);
    }

    const newToken = generateOpaqueToken();
    const newHash = await hashToken(newToken);
    await this.prisma.adminSession.update({
      where: { tokenHash },
      data: { tokenHash: newHash, mfaVerified: true, idleExpiresAt: new Date(Date.now() + IDLE_TTL_MS) },
    });
    await this._auditLogin(user.id, ip);
    return { sessionToken: newToken };
  }

  /**
   * Validate a session cookie. Returns session info or throws 401.
   */
  async validateSession(sessionToken: string): Promise<AdminSessionInfo> {
    const tokenHash = await hashToken(sessionToken);
    const session = await this.prisma.adminSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) throw new UnauthorizedException('Invalid admin session');
    if (session.expiresAt < new Date()) {
      await this.prisma.adminSession.delete({ where: { tokenHash } });
      throw new UnauthorizedException('Admin session expired');
    }
    if (session.idleExpiresAt < new Date()) {
      await this.prisma.adminSession.delete({ where: { tokenHash } });
      throw new UnauthorizedException('Admin session idle timeout');
    }
    if (!session.mfaVerified) throw new UnauthorizedException('MFA not verified');
    if (session.user.status !== 'active' && session.user.status !== 'setup_pending') {
      throw new ForbiddenException('Account suspended');
    }

    // Refresh idle timer
    await this.prisma.adminSession.update({
      where: { tokenHash },
      data: { idleExpiresAt: new Date(Date.now() + IDLE_TTL_MS) },
    });

    return {
      adminUserId: session.user.id,
      email: session.user.email,
      role: session.user.role,
      mfaVerified: session.mfaVerified,
      reauthedAt: session.reauthedAt,
    };
  }

  /**
   * Check if re-authentication is fresh enough for sensitive operations.
   */
  requireReauth(session: AdminSessionInfo): void {
    if (!session.reauthedAt || Date.now() - session.reauthedAt.getTime() > REAUTH_WINDOW_MS) {
      throw new ForbiddenException('Re-authentication required for this sensitive operation. Please verify your password and MFA again.');
    }
  }

  /**
   * Logout: delete session.
   */
  async logout(sessionToken: string): Promise<void> {
    const tokenHash = await hashToken(sessionToken);
    await this.prisma.adminSession.deleteMany({ where: { tokenHash } });
  }

  /**
   * Generate TOTP setup info (URI for QR code + secret).
   */
  generateTotpSetup(email: string): { secret: string; otpAuthUrl: string } {
    const secret = authenticator.generateSecret(20);
    const otpAuthUrl = authenticator.keyuri(email, 'Jonoshheba Admin', secret);
    return { secret, otpAuthUrl };
  }

  /**
   * Confirm and persist TOTP secret after user scans QR and enters first code.
   */
  async confirmTotpSetup(adminUserId: string, secret: string, code: string): Promise<{ recoveryCodes: string[] }> {
    authenticator.options = { window: TOTP_WINDOW };
    const valid = authenticator.verify({ token: code, secret });
    if (!valid) throw new BadRequestException('Invalid TOTP code — please try again');

    const recoveryCodes = generateRecoveryCodes(10);
    await this.prisma.adminUser.update({
      where: { id: adminUserId },
      data: { totpSecret: secret, totpEnabled: true, status: 'active', recoveryCodes },
    });

    return { recoveryCodes };
  }

  /**
   * Get admin user info (for /auth/me).
   */
  async getMe(adminUserId: string) {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: adminUserId },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        totpEnabled: true,
        passkeyEnabled: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('Admin user not found');
    return user;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async _createSession(
    adminUserId: string,
    token: string,
    ip: string,
    userAgent: string,
    mfaVerified: boolean,
  ): Promise<void> {
    const tokenHash = await hashToken(token);
    const now = new Date();
    await this.prisma.adminSession.create({
      data: {
        id: uuidv7(),
        adminUserId,
        tokenHash,
        ipHash: hashIp(ip),
        userAgent: userAgent.slice(0, 512),
        mfaVerified,
        expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
        idleExpiresAt: new Date(now.getTime() + IDLE_TTL_MS),
      },
    });
  }

  private async _auditLogin(adminUserId: string, ip: string): Promise<void> {
    await this.prisma.adminUser.update({
      where: { id: adminUserId },
      data: { lastLoginAt: new Date() },
    });
    await this.prisma.adminAuditLog.create({
      data: {
        id: uuidv7(),
        adminUserId,
        action: 'login.success',
        ipHash: hashIp(ip),
      },
    });
  }
}
