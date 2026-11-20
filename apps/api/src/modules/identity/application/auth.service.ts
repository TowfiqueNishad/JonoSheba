import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from '@jonoshheba/shared';
import {
  RATE_LIMITER_PORT,
  type RateLimiterPort,
  throwRateLimitExceeded,
} from '../../../common/rate-limiter';
import { uuidv7 } from '../../../common/uuidv7';
import { IdentityCryptoService } from '../domain/crypto.service';
import type { PlatformType, SessionEntity, UserEntity } from '../domain/identity.types';
import {
  IDENTITY_REPOSITORY_PORT,
  type IdentityRepositoryPort,
} from '../ports/identity.repository.port';
import { OAUTH_PROVIDERS_PORT, type OAuthProviderPort } from '../ports/oauth.port';
import { SMS_PORT, type SmsPort } from '../ports/sms.port';
import { TURNSTILE_PORT, type TurnstilePort } from '../ports/turnstile.port';
import { EMAIL_PORT, type EmailPort } from '../ports/email.port';

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface AuthTokenBundle {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  sessionId: string;
  user: {
    id: string;
    phoneE164: string | null;
    email: string | null;
    displayName: string | null;
    locale: 'bn' | 'en';
    isGuest: boolean;
    mfaEnabled: boolean;
    roles: Role[];
  };
}

export function normalizeBangladeshPhone(raw: string): string {
  const digits = raw.replace(/[\s-]/g, '');
  if (/^\+8801[3-9]\d{8}$/.test(digits)) return digits;
  if (/^8801[3-9]\d{8}$/.test(digits)) return `+${digits}`;
  if (/^01[3-9]\d{8}$/.test(digits)) return `+88${digits}`;
  throw new BadRequestException(
    'Invalid Bangladesh phone number. Expected +8801XXXXXXXXX or 01XXXXXXXXX.',
  );
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(IDENTITY_REPOSITORY_PORT)
    private readonly repo: IdentityRepositoryPort,
    @Inject(SMS_PORT)
    private readonly sms: SmsPort,
    @Inject(TURNSTILE_PORT)
    private readonly turnstile: TurnstilePort,
    @Inject(RATE_LIMITER_PORT)
    private readonly rateLimiter: RateLimiterPort,
    @Inject(OAUTH_PROVIDERS_PORT)
    private readonly oauthProviders: OAuthProviderPort[],
    private readonly crypto: IdentityCryptoService,
    @Optional()
    @Inject(EMAIL_PORT)
    private readonly emailPort?: EmailPort,
  ) {}

  private toPublicUser(user: UserEntity): AuthTokenBundle['user'] {
    return {
      id: user.id,
      phoneE164: user.phoneE164,
      email: user.email,
      displayName: user.displayName,
      locale: user.locale,
      isGuest: user.isGuest,
      mfaEnabled: user.mfaEnabled,
      roles: user.roles.map((r) => r.role),
    };
  }

  private async issueSessionBundle(params: {
    user: UserEntity;
    deviceId: string;
    platform: PlatformType;
    ip?: string;
    userAgent?: string;
    tokenFamilyId?: string;
    mfaVerified?: boolean;
  }): Promise<AuthTokenBundle> {
    const refreshToken = this.crypto.generateOpaqueToken(48);
    const refreshTokenHash = this.crypto.hashSecret(refreshToken, 'refresh-token');
    const now = new Date();
    const session: SessionEntity = {
      id: uuidv7(),
      userId: params.user.id,
      deviceId: params.deviceId,
      platform: params.platform,
      refreshTokenHash,
      tokenFamilyId: params.tokenFamilyId ?? uuidv7(),
      ipHash: this.crypto.hashIp(params.ip),
      userAgent: params.userAgent ?? null,
      mfaVerified: params.mfaVerified ?? false,
      expiresAt: new Date(now.getTime() + REFRESH_TTL_MS),
      revokedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.repo.createSession(session);

    const { token: accessToken, expiresIn } = await this.crypto.signAccessToken({
      sub: params.user.id,
      sid: session.id,
      roles: params.user.roles.map((r) => r.role),
      orgScopes: params.user.roles,
      isGuest: params.user.isGuest,
      mfaVerified: session.mfaVerified,
      locale: params.user.locale,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn,
      tokenType: 'Bearer',
      sessionId: session.id,
      user: this.toPublicUser(params.user),
    };
  }

  // --- 1. Phone OTP Auth (Primary for Bangladesh) ---

  async requestOtp(params: {
    phone: string;
    locale?: 'bn' | 'en';
    turnstileToken?: string;
    ip?: string;
  }): Promise<{
    challengeId: string;
    expiresInSeconds: number;
    resendAfterSeconds: number;
    devOtp?: string;
  }> {
    const phoneE164 = normalizeBangladeshPhone(params.phone);

    // Bot protection check (Cloudflare Turnstile)
    const botCheck = await this.turnstile.verify(params.turnstileToken, params.ip);
    if (!botCheck.success) {
      throw new ForbiddenException(botCheck.reason ?? 'Bot protection challenge failed');
    }

    // Per-IP and per-phone sliding-window rate limits
    const ipLimit = await this.rateLimiter.consume(
      `otp:ip:${this.crypto.hashIp(params.ip) ?? 'local'}`,
      15,
      900,
    );
    if (!ipLimit.allowed) {
      throwRateLimitExceeded(
        ipLimit.retryAfterSeconds,
        'Too many OTP requests from this IP. Please try again later.',
      );
    }

    const phoneLimit = await this.rateLimiter.consume(`otp:phone:${phoneE164}`, 5, 900);
    if (!phoneLimit.allowed) {
      throwRateLimitExceeded(
        phoneLimit.retryAfterSeconds,
        'Too many OTP requests for this phone number. Please try again later.',
      );
    }

    // Resend cooldown check
    const latest = await this.repo.findLatestActiveOtp(phoneE164);
    if (latest) {
      const elapsed = Date.now() - latest.createdAt.getTime();
      if (elapsed < OTP_RESEND_COOLDOWN_MS && latest.attempts < latest.maxAttempts) {
        const waitSec = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000);
        throwRateLimitExceeded(
          waitSec,
          `Please wait ${waitSec}s before requesting another OTP.`,
        );
      }
    }

    const otpCode = this.crypto.generateOtpCode();
    const challengeId = uuidv7();
    const now = new Date();
    await this.repo.createOtpChallenge({
      id: challengeId,
      phoneE164,
      codeHash: this.crypto.hashSecret(otpCode, `otp:${challengeId}`),
      purpose: 'login',
      attempts: 0,
      maxAttempts: OTP_MAX_ATTEMPTS,
      ipHash: this.crypto.hashIp(params.ip),
      expiresAt: new Date(now.getTime() + OTP_TTL_MS),
      consumedAt: null,
      createdAt: now,
    });

    const locale = params.locale ?? 'bn';
    const body =
      locale === 'bn'
        ? `জনসেবা AI যাচাইকরণ কোড: ${otpCode}। ৫ মিনিটের মধ্যে ব্যবহার করুন। কাউকে শেয়ার করবেন না।`
        : `Jonoshheba AI verification code: ${otpCode}. Valid for 5 minutes. Never share this code.`;

    await this.sms.send({ toE164: phoneE164, body, locale });

    return {
      challengeId,
      expiresInSeconds: OTP_TTL_MS / 1000,
      resendAfterSeconds: OTP_RESEND_COOLDOWN_MS / 1000,
      ...(process.env.NODE_ENV === 'test' || process.env.VITEST === 'true'
        ? { devOtp: otpCode }
        : {}),
    };
  }

  async verifyOtp(params: {
    phone: string;
    code: string;
    deviceId: string;
    platform: PlatformType;
    guestUserId?: string;
    ip?: string;
    userAgent?: string;
  }): Promise<AuthTokenBundle> {
    const phoneE164 = normalizeBangladeshPhone(params.phone);
    const challenge = await this.repo.findLatestActiveOtp(phoneE164);

    if (!challenge || challenge.consumedAt) {
      throw new UnauthorizedException('Invalid or expired OTP challenge');
    }
    if (challenge.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('OTP has expired. Please request a new code.');
    }
    if (challenge.attempts >= challenge.maxAttempts) {
      throw new HttpException(
        'OTP challenge locked after maximum failed attempts. Request a new code.',
        423,
      );
    }

    const valid = this.crypto.verifyHashedSecret(
      params.code.trim(),
      challenge.codeHash,
      `otp:${challenge.id}`,
    );

    if (!valid) {
      challenge.attempts += 1;
      await this.repo.updateOtpChallenge(challenge);
      if (challenge.attempts >= challenge.maxAttempts) {
        throw new HttpException(
          'OTP challenge locked after maximum failed attempts. Request a new code.',
          423,
        );
      }
      throw new UnauthorizedException('Invalid OTP code');
    }

    challenge.consumedAt = new Date();
    await this.repo.updateOtpChallenge(challenge);

    let user = await this.repo.findUserByPhone(phoneE164);

    // Upgrade anonymous guest account if provided and phone isn't already bound
    if (!user && params.guestUserId) {
      const guest = await this.repo.findUserById(params.guestUserId);
      if (guest && guest.isGuest) {
        guest.phoneE164 = phoneE164;
        guest.isGuest = false;
        guest.roles = [{ role: Role.CITIZEN, orgId: null }];
        user = await this.repo.updateUser(guest);
      }
    }

    if (!user) {
      const now = new Date();
      user = await this.repo.createUser({
        id: uuidv7(),
        phoneE164,
        email: null,
        emailVerifiedAt: null,
        passwordHash: null,
        displayName: null,
        status: 'active',
        locale: 'bn',
        isGuest: false,
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodeHashes: [],
        roles: [{ role: Role.CITIZEN, orgId: null }],
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
    }

    if (user.status === 'suspended' || user.status === 'deleted') {
      throw new ForbiddenException('Account is not active');
    }

    return this.issueSessionBundle({
      user,
      deviceId: params.deviceId,
      platform: params.platform,
      ip: params.ip,
      userAgent: params.userAgent,
    });
  }

  // --- 1.2 Passwordless Email OTP Auth ---

  async requestEmailOtp(params: {
    email: string;
    locale?: 'bn' | 'en';
    turnstileToken?: string;
    ip?: string;
  }): Promise<{ sent: boolean; devOtpPreview?: string; devCode?: string }> {
    const email = params.email.trim().toLowerCase();
    const rate = await this.rateLimiter.consume(`otp:email:${email}`, 5, 900);
    if (!rate.allowed) {
      throwRateLimitExceeded(rate.retryAfterSeconds, 'Too many email verification requests');
    }

    const rawCode = this.crypto.generateOtpCode();
    const challengeId = uuidv7();
    const codeHash = this.crypto.hashSecret(rawCode, `otp:${challengeId}`);

    await this.repo.createOtpChallenge({
      id: challengeId,
      phoneE164: `email:${email}`,
      codeHash,
      purpose: 'login',
      attempts: 0,
      maxAttempts: 5,
      ipHash: this.crypto.hashIp(params.ip),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      consumedAt: null,
      createdAt: new Date(),
    });

    if (this.emailPort) {
      await this.emailPort
        .sendVerificationCode(email, rawCode, params.locale ?? 'bn')
        .catch(() => undefined);
    }

    const isDev = process.env.NODE_ENV !== 'production' || process.env.SHOW_DEV_OTP === 'true';
    return {
      sent: true,
      ...(isDev ? { devOtpPreview: rawCode, devCode: rawCode } : {}),
    };
  }

  async verifyEmailOtp(params: {
    email: string;
    code: string;
    deviceId: string;
    platform: PlatformType;
    guestUserId?: string;
    ip?: string;
    userAgent?: string;
  }): Promise<AuthTokenBundle> {
    const email = params.email.trim().toLowerCase();
    const challenge = await this.repo.findLatestActiveOtp(`email:${email}`);

    if (!challenge || challenge.consumedAt) {
      throw new UnauthorizedException('Invalid or expired verification code');
    }
    if (challenge.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Code has expired. Please request a new one.');
    }
    if (challenge.attempts >= challenge.maxAttempts) {
      throw new HttpException(
        'Code locked after maximum failed attempts. Request a new code.',
        423,
      );
    }

    const valid = this.crypto.verifyHashedSecret(
      params.code.trim(),
      challenge.codeHash,
      `otp:${challenge.id}`,
    );

    if (!valid) {
      challenge.attempts += 1;
      await this.repo.updateOtpChallenge(challenge);
      if (challenge.attempts >= challenge.maxAttempts) {
        throw new HttpException(
          'Code locked after maximum failed attempts. Request a new code.',
          423,
        );
      }
      throw new UnauthorizedException('Invalid verification code');
    }

    challenge.consumedAt = new Date();
    await this.repo.updateOtpChallenge(challenge);

    let user = await this.repo.findUserByEmail(email);

    if (!user && params.guestUserId) {
      const guest = await this.repo.findUserById(params.guestUserId);
      if (guest && guest.isGuest) {
        guest.email = email;
        guest.emailVerifiedAt = new Date();
        guest.isGuest = false;
        guest.roles = [{ role: Role.CITIZEN, orgId: null }];
        user = await this.repo.updateUser(guest);
      }
    }

    if (!user) {
      const now = new Date();
      user = await this.repo.createUser({
        id: uuidv7(),
        phoneE164: null,
        email,
        emailVerifiedAt: now,
        passwordHash: null,
        displayName: null,
        status: 'active',
        locale: 'bn',
        isGuest: false,
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodeHashes: [],
        roles: [{ role: Role.CITIZEN, orgId: null }],
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
    }

    if (user.status === 'suspended' || user.status === 'deleted') {
      throw new ForbiddenException('Account is not active');
    }

    return this.issueSessionBundle({
      user,
      deviceId: params.deviceId,
      platform: params.platform,
      ip: params.ip,
      userAgent: params.userAgent,
    });
  }

  // --- 2. Email + Password (Argon2id) ---

  async registerEmail(params: {
    email: string;
    password: string;
    displayName?: string;
    locale?: 'bn' | 'en';
    deviceId: string;
    platform: PlatformType;
    guestUserId?: string;
    ip?: string;
    userAgent?: string;
  }): Promise<AuthTokenBundle & { emailVerificationToken?: string }> {
    const email = params.email.trim().toLowerCase();
    const existing = await this.repo.findUserByEmail(email);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await this.crypto.hashPassword(params.password);
    let user: UserEntity | null = null;

    if (params.guestUserId) {
      const guest = await this.repo.findUserById(params.guestUserId);
      if (guest && guest.isGuest) {
        guest.email = email;
        guest.passwordHash = passwordHash;
        guest.displayName = params.displayName ?? guest.displayName;
        guest.locale = params.locale ?? guest.locale;
        guest.isGuest = false;
        guest.roles = [{ role: Role.CITIZEN, orgId: null }];
        user = await this.repo.updateUser(guest);
      }
    }

    if (!user) {
      const now = new Date();
      user = await this.repo.createUser({
        id: uuidv7(),
        phoneE164: null,
        email,
        emailVerifiedAt: null,
        passwordHash,
        displayName: params.displayName ?? null,
        status: 'active',
        locale: params.locale ?? 'bn',
        isGuest: false,
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodeHashes: [],
        roles: [{ role: Role.CITIZEN, orgId: null }],
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
    }

    const rawVerifyToken = this.crypto.generateOpaqueToken(32);
    await this.repo.saveEmailVerificationToken({
      id: uuidv7(),
      userId: user.id,
      tokenHash: this.crypto.hashSecret(rawVerifyToken, 'email-verify'),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      consumedAt: null,
      createdAt: new Date(),
    });

    const bundle = await this.issueSessionBundle({
      user,
      deviceId: params.deviceId,
      platform: params.platform,
      ip: params.ip,
      userAgent: params.userAgent,
    });

    return {
      ...bundle,
      ...(process.env.NODE_ENV === 'test' || process.env.VITEST === 'true'
        ? { emailVerificationToken: rawVerifyToken }
        : {}),
    };
  }

  async verifyEmail(token: string): Promise<{ verified: true }> {
    const hash = this.crypto.hashSecret(token, 'email-verify');
    const record = await this.repo.findEmailVerificationTokenByHash(hash);
    if (!record || record.consumedAt || record.expiresAt <= new Date()) {
      throw new BadRequestException('Invalid or expired email verification token');
    }
    const user = await this.repo.findUserById(record.userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    user.emailVerifiedAt = new Date();
    await this.repo.updateUser(user);
    await this.repo.markEmailVerificationConsumed(record.id);
    return { verified: true };
  }

  async loginEmail(params: {
    email: string;
    password: string;
    deviceId: string;
    platform: PlatformType;
    ip?: string;
    userAgent?: string;
  }): Promise<AuthTokenBundle> {
    const rate = await this.rateLimiter.consume(
      `login:ip:${this.crypto.hashIp(params.ip) ?? 'local'}`,
      20,
      900,
    );
    if (!rate.allowed) {
      throwRateLimitExceeded(rate.retryAfterSeconds, 'Too many login attempts');
    }

    const user = await this.repo.findUserByEmail(params.email.trim().toLowerCase());
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await this.crypto.verifyPassword(params.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.status === 'suspended' || user.status === 'deleted') {
      throw new ForbiddenException('Account is not active');
    }

    return this.issueSessionBundle({
      user,
      deviceId: params.deviceId,
      platform: params.platform,
      ip: params.ip,
      userAgent: params.userAgent,
    });
  }

  async forgotPassword(email: string): Promise<{ message: string; devResetToken?: string }> {
    const user = await this.repo.findUserByEmail(email.trim().toLowerCase());
    if (!user) {
      // Never disclose account existence
      return { message: 'If an account matches that email, a reset link has been sent.' };
    }
    const rawToken = this.crypto.generateOpaqueToken(32);
    await this.repo.savePasswordResetToken({
      id: uuidv7(),
      userId: user.id,
      tokenHash: this.crypto.hashSecret(rawToken, 'password-reset'),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      consumedAt: null,
      createdAt: new Date(),
    });

    return {
      message: 'If an account matches that email, a reset link has been sent.',
      ...(process.env.NODE_ENV === 'test' || process.env.VITEST === 'true'
        ? { devResetToken: rawToken }
        : {}),
    };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ reset: true }> {
    const hash = this.crypto.hashSecret(token, 'password-reset');
    const record = await this.repo.findPasswordResetTokenByHash(hash);
    if (!record || record.consumedAt || record.expiresAt <= new Date()) {
      throw new BadRequestException('Invalid or expired password reset token');
    }
    const user = await this.repo.findUserById(record.userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    user.passwordHash = await this.crypto.hashPassword(newPassword);
    await this.repo.updateUser(user);
    await this.repo.markPasswordResetConsumed(record.id);
    // Revoke all existing sessions on password reset
    await this.repo.revokeAllUserSessions(user.id);
    return { reset: true };
  }

  // --- 3. OAuth2 / OIDC ---

  async oauthLogin(params: {
    provider: string;
    idToken: string;
    deviceId: string;
    platform: PlatformType;
    ip?: string;
    userAgent?: string;
  }): Promise<AuthTokenBundle> {
    const adapter = this.oauthProviders.find((p) => p.providerName === params.provider);
    if (!adapter) {
      throw new BadRequestException(`Unsupported OAuth provider: ${params.provider}`);
    }
    const profile = await adapter.exchangeIdToken(params.idToken);
    let user = await this.repo.findUserByOAuth(profile.provider, profile.providerUserId);
    if (!user && profile.email) {
      user = await this.repo.findUserByEmail(profile.email);
    }
    if (!user) {
      const now = new Date();
      user = await this.repo.createUser({
        id: uuidv7(),
        phoneE164: null,
        email: profile.email,
        emailVerifiedAt: profile.email ? now : null,
        passwordHash: null,
        displayName: profile.displayName,
        status: 'active',
        locale: 'bn',
        isGuest: false,
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodeHashes: [],
        roles: [{ role: Role.CITIZEN, orgId: null }],
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
    }
    await this.repo.linkOAuthProvider(user.id, profile.provider, profile.providerUserId, profile.email);

    return this.issueSessionBundle({
      user,
      deviceId: params.deviceId,
      platform: params.platform,
      ip: params.ip,
      userAgent: params.userAgent,
    });
  }

  // --- 4. Anonymous Guest Session ---

  async createGuestSession(params: {
    deviceId: string;
    platform: PlatformType;
    locale?: 'bn' | 'en';
    ip?: string;
    userAgent?: string;
  }): Promise<AuthTokenBundle> {
    const now = new Date();
    const guest = await this.repo.createUser({
      id: uuidv7(),
      phoneE164: null,
      email: null,
      emailVerifiedAt: null,
      passwordHash: null,
      displayName: null,
      status: 'active',
      locale: params.locale ?? 'bn',
      isGuest: true,
      mfaEnabled: false,
      mfaSecret: null,
      mfaBackupCodeHashes: [],
      roles: [{ role: Role.GUEST, orgId: null }],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    return this.issueSessionBundle({
      user: guest,
      deviceId: params.deviceId,
      platform: params.platform,
      ip: params.ip,
      userAgent: params.userAgent,
    });
  }

  // --- 5. Rotating Refresh Token + Reuse Detection ---

  async refreshTokens(params: {
    refreshToken: string;
    ip?: string;
    userAgent?: string;
  }): Promise<AuthTokenBundle> {
    const hash = this.crypto.hashSecret(params.refreshToken, 'refresh-token');
    const session = await this.repo.findSessionByRefreshHash(hash);

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // CRITICAL SECURITY CHECK: Refresh token reuse detection
    if (session.revokedAt !== null) {
      await this.repo.revokeSessionFamily(session.tokenFamilyId);
      throw new UnauthorizedException(
        'Refresh token reuse detected. Entire session family has been revoked.',
      );
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      session.revokedAt = new Date();
      await this.repo.updateSession(session);
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.repo.findUserById(session.userId);
    if (!user || user.status === 'suspended' || user.status === 'deleted') {
      await this.repo.revokeSessionFamily(session.tokenFamilyId);
      throw new UnauthorizedException('Account inactive');
    }

    // Rotate: mark old token revoked, issue new token in same family
    session.revokedAt = new Date();
    await this.repo.updateSession(session);

    return this.issueSessionBundle({
      user,
      deviceId: session.deviceId,
      platform: session.platform,
      ip: params.ip,
      userAgent: params.userAgent ?? session.userAgent ?? undefined,
      tokenFamilyId: session.tokenFamilyId,
      mfaVerified: session.mfaVerified,
    });
  }

  async logout(sessionId: string): Promise<{ loggedOut: true }> {
    const session = await this.repo.findSessionById(sessionId);
    if (session && !session.revokedAt) {
      session.revokedAt = new Date();
      await this.repo.updateSession(session);
    }
    return { loggedOut: true };
  }

  // --- 6. MFA (TOTP + Single-Use Backup Codes) ---

  async setupMfa(userId: string): Promise<{
    secret: string;
    otpauthUri: string;
    backupCodes: string[];
  }> {
    const user = await this.repo.findUserById(userId);
    if (!user || user.isGuest) {
      throw new ForbiddenException('MFA is only available for registered accounts');
    }
    const secret = this.crypto.generateTotpSecret();
    const { plain: backupCodes, hashes } = this.crypto.generateBackupCodes(8);
    user.mfaSecret = secret;
    user.mfaBackupCodeHashes = hashes;
    await this.repo.updateUser(user);

    const label = user.email ?? user.phoneE164 ?? user.id;
    return {
      secret,
      otpauthUri: this.crypto.buildTotpUri(secret, label),
      backupCodes,
    };
  }

  async verifyMfa(params: {
    userId: string;
    sessionId: string;
    code: string;
  }): Promise<{ mfaVerified: true; accessToken: string; expiresIn: number }> {
    const user = await this.repo.findUserById(params.userId);
    if (!user || !user.mfaSecret) {
      throw new BadRequestException('MFA has not been set up for this account');
    }

    let valid = this.crypto.verifyTotpCode(user.mfaSecret, params.code);

    // Fallback to single-use backup code
    if (!valid && user.mfaBackupCodeHashes.length > 0) {
      const idx = user.mfaBackupCodeHashes.findIndex((h) =>
        this.crypto.verifyHashedSecret(params.code.trim().toUpperCase(), h, 'mfa-backup'),
      );
      if (idx !== -1) {
        valid = true;
        user.mfaBackupCodeHashes.splice(idx, 1);
      }
    }

    if (!valid) {
      throw new UnauthorizedException('Invalid MFA code');
    }

    user.mfaEnabled = true;
    await this.repo.updateUser(user);

    const session = await this.repo.findSessionById(params.sessionId);
    if (!session || session.revokedAt || session.userId !== user.id) {
      throw new UnauthorizedException('Session invalid');
    }
    session.mfaVerified = true;
    await this.repo.updateSession(session);

    const { token: accessToken, expiresIn } = await this.crypto.signAccessToken({
      sub: user.id,
      sid: session.id,
      roles: user.roles.map((r) => r.role),
      orgScopes: user.roles,
      isGuest: user.isGuest,
      mfaVerified: true,
      locale: user.locale,
    });

    return { mfaVerified: true, accessToken, expiresIn };
  }

  async getJwks() {
    return this.crypto.getJwks();
  }
}
