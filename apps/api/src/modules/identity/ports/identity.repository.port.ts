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

export interface IdentityRepositoryPort {
  // Users
  findUserById(id: string): Promise<UserEntity | null>;
  findUserByPhone(phoneE164: string): Promise<UserEntity | null>;
  findUserByEmail(email: string): Promise<UserEntity | null>;
  findUserByOAuth(provider: string, providerUserId: string): Promise<UserEntity | null>;
  createUser(user: UserEntity): Promise<UserEntity>;
  updateUser(user: UserEntity): Promise<UserEntity>;
  linkOAuthProvider(userId: string, provider: string, providerUserId: string, email: string | null): Promise<void>;

  // OTP challenges
  createOtpChallenge(challenge: OtpChallengeEntity): Promise<OtpChallengeEntity>;
  findLatestActiveOtp(phoneE164: string): Promise<OtpChallengeEntity | null>;
  updateOtpChallenge(challenge: OtpChallengeEntity): Promise<OtpChallengeEntity>;

  // Email verification & password reset tokens
  saveEmailVerificationToken(token: EmailVerificationTokenEntity): Promise<void>;
  findEmailVerificationTokenByHash(tokenHash: string): Promise<EmailVerificationTokenEntity | null>;
  markEmailVerificationConsumed(id: string): Promise<void>;

  savePasswordResetToken(token: PasswordResetTokenEntity): Promise<void>;
  findPasswordResetTokenByHash(tokenHash: string): Promise<PasswordResetTokenEntity | null>;
  markPasswordResetConsumed(id: string): Promise<void>;

  // Sessions & refresh token families
  createSession(session: SessionEntity): Promise<SessionEntity>;
  findSessionById(sessionId: string): Promise<SessionEntity | null>;
  findSessionByRefreshHash(refreshTokenHash: string): Promise<SessionEntity | null>;
  listActiveSessionsForUser(userId: string): Promise<SessionEntity[]>;
  updateSession(session: SessionEntity): Promise<SessionEntity>;
  revokeSessionFamily(tokenFamilyId: string): Promise<number>;
  revokeAllUserSessions(userId: string): Promise<number>;

  // Preferences & consented profile hints
  getPreferences(userId: string): Promise<UserPreferenceEntity>;
  savePreferences(pref: UserPreferenceEntity): Promise<UserPreferenceEntity>;

  getProfileHints(userId: string): Promise<UserProfileHintEntity>;
  saveProfileHints(hints: UserProfileHintEntity): Promise<UserProfileHintEntity>;

  // Consents
  listConsents(userId: string): Promise<ConsentEntity[]>;
  findConsentById(consentId: string): Promise<ConsentEntity | null>;
  findActiveConsent(userId: string, purpose: ConsentPurpose): Promise<ConsentEntity | null>;
  saveConsent(consent: ConsentEntity): Promise<ConsentEntity>;

  // Privacy export & deletion
  createDataExportRequest(req: DataExportRequestEntity): Promise<DataExportRequestEntity>;
  listDataExportRequests(userId: string): Promise<DataExportRequestEntity[]>;
  saveDeletionRequest(req: DeletionRequestEntity): Promise<DeletionRequestEntity>;
  findActiveDeletionRequest(userId: string): Promise<DeletionRequestEntity | null>;
}

export const IDENTITY_REPOSITORY_PORT = Symbol('IDENTITY_REPOSITORY_PORT');
