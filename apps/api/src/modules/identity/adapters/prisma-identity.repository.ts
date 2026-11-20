import { Injectable } from '@nestjs/common';
import type { Role } from '@jonoshheba/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  ConsentEntity,
  ConsentPurpose,
  DataExportRequestEntity,
  DeletionRequestEntity,
  EmailVerificationTokenEntity,
  OtpChallengeEntity,
  PasswordResetTokenEntity,
  PlatformType,
  SessionEntity,
  UserEntity,
  UserPreferenceEntity,
  UserProfileHintEntity,
} from '../domain/identity.types';
import type { IdentityRepositoryPort } from '../ports/identity.repository.port';

/**
 * Production PostgreSQL / Prisma adapter for IdentityRepositoryPort.
 * Activated when IDENTITY_STORAGE=prisma (and PostgreSQL is online).
 */
@Injectable()
export class PrismaIdentityRepository implements IdentityRepositoryPort {
  private readonly transientEmailTokens = new Map<string, EmailVerificationTokenEntity>();
  private readonly transientResetTokens = new Map<string, PasswordResetTokenEntity>();

  constructor(private readonly prisma: PrismaService) {}

  private mapUser(row: {
    id: string;
    phoneE164: string | null;
    email: string | null;
    passwordHash: string | null;
    displayName: string | null;
    status: 'active' | 'suspended' | 'pending_deletion' | 'deleted';
    locale: string;
    isGuest: boolean;
    mfaEnabled: boolean;
    mfaSecretEnc: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    userRoles: Array<{ orgId: string | null; role: { code: string } }>;
  }): UserEntity {
    return {
      id: row.id,
      phoneE164: row.phoneE164,
      email: row.email,
      emailVerifiedAt: row.email ? row.createdAt : null,
      passwordHash: row.passwordHash,
      displayName: row.displayName,
      status: row.status,
      locale: row.locale === 'en' ? 'en' : 'bn',
      isGuest: row.isGuest,
      mfaEnabled: row.mfaEnabled,
      mfaSecret: row.mfaSecretEnc,
      mfaBackupCodeHashes: [],
      roles: row.userRoles.map((ur) => ({
        role: ur.role.code as Role,
        orgId: ur.orgId,
      })),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    };
  }

  async findUserById(id: string): Promise<UserEntity | null> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      include: { userRoles: { where: { deletedAt: null }, include: { role: true } } },
    });
    return row ? this.mapUser(row) : null;
  }

  async findUserByPhone(phoneE164: string): Promise<UserEntity | null> {
    const row = await this.prisma.user.findUnique({
      where: { phoneE164 },
      include: { userRoles: { where: { deletedAt: null }, include: { role: true } } },
    });
    return row && !row.deletedAt ? this.mapUser(row) : null;
  }

  async findUserByEmail(email: string): Promise<UserEntity | null> {
    const row = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { userRoles: { where: { deletedAt: null }, include: { role: true } } },
    });
    return row && !row.deletedAt ? this.mapUser(row) : null;
  }

  async findUserByOAuth(provider: string, providerUserId: string): Promise<UserEntity | null> {
    const link = await this.prisma.identityProvider.findUnique({
      where: { provider_providerUserId: { provider, providerUserId } },
    });
    return link ? this.findUserById(link.userId) : null;
  }

  async createUser(user: UserEntity): Promise<UserEntity> {
    await this.prisma.user.create({
      data: {
        id: user.id,
        phoneE164: user.phoneE164,
        email: user.email?.toLowerCase() ?? null,
        passwordHash: user.passwordHash,
        displayName: user.displayName,
        status: user.status,
        locale: user.locale,
        isGuest: user.isGuest,
        mfaEnabled: user.mfaEnabled,
        mfaSecretEnc: user.mfaSecret,
      },
    });
    for (const assignment of user.roles) {
      const roleRow = await this.prisma.role.findUnique({ where: { code: assignment.role } });
      if (roleRow) {
        await this.prisma.userRole.create({
          data: { userId: user.id, roleId: roleRow.id, orgId: assignment.orgId },
        });
      }
    }
    return user;
  }

  async updateUser(user: UserEntity): Promise<UserEntity> {
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        phoneE164: user.phoneE164,
        email: user.email?.toLowerCase() ?? null,
        passwordHash: user.passwordHash,
        displayName: user.displayName,
        status: user.status,
        locale: user.locale,
        isGuest: user.isGuest,
        mfaEnabled: user.mfaEnabled,
        mfaSecretEnc: user.mfaSecret,
        deletedAt: user.deletedAt,
      },
    });
    return user;
  }

  async linkOAuthProvider(
    userId: string,
    provider: string,
    providerUserId: string,
    email: string | null,
  ): Promise<void> {
    await this.prisma.identityProvider.upsert({
      where: { provider_providerUserId: { provider, providerUserId } },
      update: { email },
      create: { userId, provider, providerUserId, email },
    });
  }

  async createOtpChallenge(challenge: OtpChallengeEntity): Promise<OtpChallengeEntity> {
    await this.prisma.otpChallenge.create({
      data: {
        id: challenge.id,
        phoneE164: challenge.phoneE164,
        codeHash: challenge.codeHash,
        purpose: challenge.purpose,
        attempts: challenge.attempts,
        maxAttempts: challenge.maxAttempts,
        ipHash: challenge.ipHash,
        expiresAt: challenge.expiresAt,
      },
    });
    return challenge;
  }

  async findLatestActiveOtp(phoneE164: string): Promise<OtpChallengeEntity | null> {
    const row = await this.prisma.otpChallenge.findFirst({
      where: { phoneE164, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) return null;
    return {
      id: row.id,
      phoneE164: row.phoneE164,
      codeHash: row.codeHash,
      purpose: row.purpose === 'verify_phone' ? 'verify_phone' : 'login',
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      ipHash: row.ipHash,
      expiresAt: row.expiresAt,
      consumedAt: row.consumedAt,
      createdAt: row.createdAt,
    };
  }

  async updateOtpChallenge(challenge: OtpChallengeEntity): Promise<OtpChallengeEntity> {
    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: challenge.attempts, consumedAt: challenge.consumedAt },
    });
    return challenge;
  }

  async saveEmailVerificationToken(token: EmailVerificationTokenEntity): Promise<void> {
    this.transientEmailTokens.set(token.id, token);
  }

  async findEmailVerificationTokenByHash(
    tokenHash: string,
  ): Promise<EmailVerificationTokenEntity | null> {
    for (const t of this.transientEmailTokens.values()) {
      if (t.tokenHash === tokenHash) return t;
    }
    return null;
  }

  async markEmailVerificationConsumed(id: string): Promise<void> {
    const t = this.transientEmailTokens.get(id);
    if (t) t.consumedAt = new Date();
  }

  async savePasswordResetToken(token: PasswordResetTokenEntity): Promise<void> {
    this.transientResetTokens.set(token.id, token);
  }

  async findPasswordResetTokenByHash(tokenHash: string): Promise<PasswordResetTokenEntity | null> {
    for (const t of this.transientResetTokens.values()) {
      if (t.tokenHash === tokenHash) return t;
    }
    return null;
  }

  async markPasswordResetConsumed(id: string): Promise<void> {
    const t = this.transientResetTokens.get(id);
    if (t) t.consumedAt = new Date();
  }

  async createSession(session: SessionEntity): Promise<SessionEntity> {
    await this.prisma.session.create({
      data: {
        id: session.id,
        userId: session.userId,
        deviceId: session.deviceId,
        platform: session.platform,
        refreshTokenHash: session.refreshTokenHash,
        tokenFamilyId: session.tokenFamilyId,
        ipHash: session.ipHash,
        userAgent: session.userAgent,
        expiresAt: session.expiresAt,
        revokedAt: session.revokedAt,
      },
    });
    return session;
  }

  async findSessionById(sessionId: string): Promise<SessionEntity | null> {
    const row = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!row) return null;
    return {
      ...row,
      platform: row.platform as PlatformType,
      mfaVerified: false,
    };
  }

  async findSessionByRefreshHash(refreshTokenHash: string): Promise<SessionEntity | null> {
    const row = await this.prisma.session.findUnique({ where: { refreshTokenHash } });
    if (!row) return null;
    return {
      ...row,
      platform: row.platform as PlatformType,
      mfaVerified: false,
    };
  }

  async listActiveSessionsForUser(userId: string): Promise<SessionEntity[]> {
    const rows = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      ...row,
      platform: row.platform as PlatformType,
      mfaVerified: false,
    }));
  }

  async updateSession(session: SessionEntity): Promise<SessionEntity> {
    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: session.revokedAt, refreshTokenHash: session.refreshTokenHash },
    });
    return session;
  }

  async revokeSessionFamily(tokenFamilyId: string): Promise<number> {
    const res = await this.prisma.session.updateMany({
      where: { tokenFamilyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return res.count;
  }

  async revokeAllUserSessions(userId: string): Promise<number> {
    const res = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return res.count;
  }

  async getPreferences(userId: string): Promise<UserPreferenceEntity> {
    const row = await this.prisma.userPreference.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    return {
      userId: row.userId,
      language: row.language === 'en' ? 'en' : 'bn',
      numeralStyle: row.numeralStyle === 'en' ? 'en' : 'bn',
      notificationChannels: row.notificationChannels as UserPreferenceEntity['notificationChannels'],
      quietHours: row.quietHours as UserPreferenceEntity['quietHours'],
      accessibility: row.accessibility as UserPreferenceEntity['accessibility'],
      updatedAt: row.updatedAt,
    };
  }

  async savePreferences(pref: UserPreferenceEntity): Promise<UserPreferenceEntity> {
    await this.prisma.userPreference.upsert({
      where: { userId: pref.userId },
      update: {
        language: pref.language,
        numeralStyle: pref.numeralStyle,
        notificationChannels: pref.notificationChannels,
        quietHours: pref.quietHours,
        accessibility: pref.accessibility,
      },
      create: {
        userId: pref.userId,
        language: pref.language,
        numeralStyle: pref.numeralStyle,
        notificationChannels: pref.notificationChannels,
        quietHours: pref.quietHours,
        accessibility: pref.accessibility,
      },
    });
    return pref;
  }

  async getProfileHints(userId: string): Promise<UserProfileHintEntity> {
    const row = await this.prisma.userProfileHint.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    return { ...row };
  }

  async saveProfileHints(hints: UserProfileHintEntity): Promise<UserProfileHintEntity> {
    await this.prisma.userProfileHint.upsert({
      where: { userId: hints.userId },
      update: {
        ageBand: hints.ageBand,
        ageBandConsentId: hints.ageBandConsentId,
        divisionId: hints.divisionId,
        districtId: hints.districtId,
        upazilaId: hints.upazilaId,
        locationConsentId: hints.locationConsentId,
        occupationBand: hints.occupationBand,
        occupationConsentId: hints.occupationConsentId,
        studentLevel: hints.studentLevel,
        studentConsentId: hints.studentConsentId,
        hasDisability: hints.hasDisability,
        disabilityConsentId: hints.disabilityConsentId,
      },
      create: {
        userId: hints.userId,
        ageBand: hints.ageBand,
        ageBandConsentId: hints.ageBandConsentId,
        divisionId: hints.divisionId,
        districtId: hints.districtId,
        upazilaId: hints.upazilaId,
        locationConsentId: hints.locationConsentId,
        occupationBand: hints.occupationBand,
        occupationConsentId: hints.occupationConsentId,
        studentLevel: hints.studentLevel,
        studentConsentId: hints.studentConsentId,
        hasDisability: hints.hasDisability,
        disabilityConsentId: hints.disabilityConsentId,
      },
    });
    return hints;
  }

  async listConsents(userId: string): Promise<ConsentEntity[]> {
    const rows = await this.prisma.consent.findMany({ where: { userId } });
    return rows.map((r) => ({ ...r, purpose: r.purpose as ConsentPurpose }));
  }

  async findConsentById(consentId: string): Promise<ConsentEntity | null> {
    const row = await this.prisma.consent.findUnique({ where: { id: consentId } });
    return row ? { ...row, purpose: row.purpose as ConsentPurpose } : null;
  }

  async findActiveConsent(userId: string, purpose: ConsentPurpose): Promise<ConsentEntity | null> {
    const row = await this.prisma.consent.findFirst({
      where: { userId, purpose, withdrawnAt: null },
      orderBy: { grantedAt: 'desc' },
    });
    return row ? { ...row, purpose: row.purpose as ConsentPurpose } : null;
  }

  async saveConsent(consent: ConsentEntity): Promise<ConsentEntity> {
    await this.prisma.consent.upsert({
      where: { id: consent.id },
      update: { withdrawnAt: consent.withdrawnAt },
      create: {
        id: consent.id,
        userId: consent.userId,
        purpose: consent.purpose,
        version: consent.version,
        grantedAt: consent.grantedAt,
        withdrawnAt: consent.withdrawnAt,
        ipHash: consent.ipHash,
      },
    });
    return consent;
  }

  async createDataExportRequest(req: DataExportRequestEntity): Promise<DataExportRequestEntity> {
    await this.prisma.dataExportRequest.create({
      data: {
        id: req.id,
        userId: req.userId,
        status: req.status,
        objectKey: req.signedDownloadUrl,
        expiresAt: req.expiresAt,
      },
    });
    return req;
  }

  async listDataExportRequests(userId: string): Promise<DataExportRequestEntity[]> {
    const rows = await this.prisma.dataExportRequest.findMany({ where: { userId } });
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      status: r.status as DataExportRequestEntity['status'],
      signedDownloadUrl: r.objectKey,
      expiresAt: r.expiresAt ?? new Date(),
      createdAt: r.createdAt,
    }));
  }

  async saveDeletionRequest(req: DeletionRequestEntity): Promise<DeletionRequestEntity> {
    await this.prisma.deletionRequest.upsert({
      where: { id: req.id },
      update: { status: req.status, completedAt: req.completedAt },
      create: {
        id: req.id,
        userId: req.userId,
        status: req.status,
        requestedAt: req.requestedAt,
        graceUntil: req.graceUntil,
        completedAt: req.completedAt,
      },
    });
    return req;
  }

  async findActiveDeletionRequest(userId: string): Promise<DeletionRequestEntity | null> {
    const row = await this.prisma.deletionRequest.findFirst({
      where: { userId, status: 'requested' },
    });
    return row ? { ...row, status: row.status as DeletionRequestEntity['status'] } : null;
  }
}
