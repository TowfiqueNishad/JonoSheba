import { Injectable } from '@nestjs/common';
import type {
  ConsentEntity,
  ConsentPurpose,
  DataExportRequestEntity,
  DeletionRequestEntity,
  EmailVerificationTokenEntity,
  OtpChallengeEntity,
  PasswordResetTokenEntity,
  SessionEntity,
  UserEntity,
  UserPreferenceEntity,
  UserProfileHintEntity,
} from '../domain/identity.types';
import type { IdentityRepositoryPort } from '../ports/identity.repository.port';

@Injectable()
export class InMemoryIdentityRepository implements IdentityRepositoryPort {
  private readonly users = new Map<string, UserEntity>();
  private readonly oauthLinks = new Map<string, string>(); // `${provider}:${providerUserId}` -> userId
  private readonly otps = new Map<string, OtpChallengeEntity>();
  private readonly emailTokens = new Map<string, EmailVerificationTokenEntity>();
  private readonly resetTokens = new Map<string, PasswordResetTokenEntity>();
  private readonly sessions = new Map<string, SessionEntity>();
  private readonly preferences = new Map<string, UserPreferenceEntity>();
  private readonly profileHints = new Map<string, UserProfileHintEntity>();
  private readonly consents = new Map<string, ConsentEntity>();
  private readonly exportRequests = new Map<string, DataExportRequestEntity>();
  private readonly deletionRequests = new Map<string, DeletionRequestEntity>();

  async findUserById(id: string): Promise<UserEntity | null> {
    return this.users.get(id) ?? null;
  }

  async findUserByPhone(phoneE164: string): Promise<UserEntity | null> {
    for (const u of this.users.values()) {
      if (u.phoneE164 === phoneE164 && !u.deletedAt) return u;
    }
    return null;
  }

  async findUserByEmail(email: string): Promise<UserEntity | null> {
    const normalized = email.toLowerCase();
    for (const u of this.users.values()) {
      if (u.email?.toLowerCase() === normalized && !u.deletedAt) return u;
    }
    return null;
  }

  async findUserByOAuth(provider: string, providerUserId: string): Promise<UserEntity | null> {
    const userId = this.oauthLinks.get(`${provider}:${providerUserId}`);
    if (!userId) return null;
    return this.findUserById(userId);
  }

  async createUser(user: UserEntity): Promise<UserEntity> {
    this.users.set(user.id, user);
    return user;
  }

  async updateUser(user: UserEntity): Promise<UserEntity> {
    user.updatedAt = new Date();
    this.users.set(user.id, user);
    return user;
  }

  async linkOAuthProvider(userId: string, provider: string, providerUserId: string): Promise<void> {
    this.oauthLinks.set(`${provider}:${providerUserId}`, userId);
  }

  async createOtpChallenge(challenge: OtpChallengeEntity): Promise<OtpChallengeEntity> {
    this.otps.set(challenge.id, challenge);
    return challenge;
  }

  async findLatestActiveOtp(phoneE164: string): Promise<OtpChallengeEntity | null> {
    let latest: OtpChallengeEntity | null = null;
    for (const c of this.otps.values()) {
      if (c.phoneE164 === phoneE164 && !c.consumedAt) {
        if (!latest || c.createdAt > latest.createdAt) {
          latest = c;
        }
      }
    }
    return latest;
  }

  async updateOtpChallenge(challenge: OtpChallengeEntity): Promise<OtpChallengeEntity> {
    this.otps.set(challenge.id, challenge);
    return challenge;
  }

  async saveEmailVerificationToken(token: EmailVerificationTokenEntity): Promise<void> {
    this.emailTokens.set(token.id, token);
  }

  async findEmailVerificationTokenByHash(
    tokenHash: string,
  ): Promise<EmailVerificationTokenEntity | null> {
    for (const t of this.emailTokens.values()) {
      if (t.tokenHash === tokenHash) return t;
    }
    return null;
  }

  async markEmailVerificationConsumed(id: string): Promise<void> {
    const t = this.emailTokens.get(id);
    if (t) {
      t.consumedAt = new Date();
    }
  }

  async savePasswordResetToken(token: PasswordResetTokenEntity): Promise<void> {
    this.resetTokens.set(token.id, token);
  }

  async findPasswordResetTokenByHash(tokenHash: string): Promise<PasswordResetTokenEntity | null> {
    for (const t of this.resetTokens.values()) {
      if (t.tokenHash === tokenHash) return t;
    }
    return null;
  }

  async markPasswordResetConsumed(id: string): Promise<void> {
    const t = this.resetTokens.get(id);
    if (t) {
      t.consumedAt = new Date();
    }
  }

  async createSession(session: SessionEntity): Promise<SessionEntity> {
    this.sessions.set(session.id, session);
    return session;
  }

  async findSessionById(sessionId: string): Promise<SessionEntity | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async findSessionByRefreshHash(refreshTokenHash: string): Promise<SessionEntity | null> {
    for (const s of this.sessions.values()) {
      if (s.refreshTokenHash === refreshTokenHash) return s;
    }
    return null;
  }

  async listActiveSessionsForUser(userId: string): Promise<SessionEntity[]> {
    const now = new Date();
    return [...this.sessions.values()].filter(
      (s) => s.userId === userId && !s.revokedAt && s.expiresAt > now,
    );
  }

  async updateSession(session: SessionEntity): Promise<SessionEntity> {
    session.updatedAt = new Date();
    this.sessions.set(session.id, session);
    return session;
  }

  async revokeSessionFamily(tokenFamilyId: string): Promise<number> {
    let count = 0;
    const now = new Date();
    for (const s of this.sessions.values()) {
      if (s.tokenFamilyId === tokenFamilyId && !s.revokedAt) {
        s.revokedAt = now;
        s.updatedAt = now;
        count++;
      }
    }
    return count;
  }

  async revokeAllUserSessions(userId: string): Promise<number> {
    let count = 0;
    const now = new Date();
    for (const s of this.sessions.values()) {
      if (s.userId === userId && !s.revokedAt) {
        s.revokedAt = now;
        s.updatedAt = now;
        count++;
      }
    }
    return count;
  }

  async getPreferences(userId: string): Promise<UserPreferenceEntity> {
    const existing = this.preferences.get(userId);
    if (existing) return existing;
    const created: UserPreferenceEntity = {
      userId,
      language: 'bn',
      numeralStyle: 'bn',
      notificationChannels: {
        in_app: true,
        web_push: true,
        mobile_push: true,
        email: false,
        sms: false,
      },
      quietHours: {
        enabled: false,
        start: '23:00',
        end: '06:00',
        timezone: 'Asia/Dhaka',
      },
      accessibility: {
        font_scale: 100,
        high_contrast: false,
        voice_first: false,
        low_data: false,
      },
      updatedAt: new Date(),
    };
    this.preferences.set(userId, created);
    return created;
  }

  async savePreferences(pref: UserPreferenceEntity): Promise<UserPreferenceEntity> {
    pref.updatedAt = new Date();
    this.preferences.set(pref.userId, pref);
    return pref;
  }

  async getProfileHints(userId: string): Promise<UserProfileHintEntity> {
    const existing = this.profileHints.get(userId);
    if (existing) return existing;
    const empty: UserProfileHintEntity = {
      userId,
      ageBand: null,
      ageBandConsentId: null,
      divisionId: null,
      districtId: null,
      upazilaId: null,
      locationConsentId: null,
      occupationBand: null,
      occupationConsentId: null,
      studentLevel: null,
      studentConsentId: null,
      hasDisability: null,
      disabilityConsentId: null,
      updatedAt: new Date(),
    };
    this.profileHints.set(userId, empty);
    return empty;
  }

  async saveProfileHints(hints: UserProfileHintEntity): Promise<UserProfileHintEntity> {
    hints.updatedAt = new Date();
    this.profileHints.set(hints.userId, hints);
    return hints;
  }

  async listConsents(userId: string): Promise<ConsentEntity[]> {
    return [...this.consents.values()].filter((c) => c.userId === userId);
  }

  async findConsentById(consentId: string): Promise<ConsentEntity | null> {
    return this.consents.get(consentId) ?? null;
  }

  async findActiveConsent(userId: string, purpose: ConsentPurpose): Promise<ConsentEntity | null> {
    for (const c of this.consents.values()) {
      if (c.userId === userId && c.purpose === purpose && !c.withdrawnAt) {
        return c;
      }
    }
    return null;
  }

  async saveConsent(consent: ConsentEntity): Promise<ConsentEntity> {
    this.consents.set(consent.id, consent);
    return consent;
  }

  async createDataExportRequest(req: DataExportRequestEntity): Promise<DataExportRequestEntity> {
    this.exportRequests.set(req.id, req);
    return req;
  }

  async listDataExportRequests(userId: string): Promise<DataExportRequestEntity[]> {
    return [...this.exportRequests.values()].filter((r) => r.userId === userId);
  }

  async saveDeletionRequest(req: DeletionRequestEntity): Promise<DeletionRequestEntity> {
    this.deletionRequests.set(req.id, req);
    return req;
  }

  async findActiveDeletionRequest(userId: string): Promise<DeletionRequestEntity | null> {
    for (const r of this.deletionRequests.values()) {
      if (r.userId === userId && r.status === 'requested') {
        return r;
      }
    }
    return null;
  }
}
