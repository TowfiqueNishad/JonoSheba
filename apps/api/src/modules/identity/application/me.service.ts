import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AUDIT_LOG_WRITER_PORT,
  type AuditLogWriterPort,
} from '../../../common/audit-log.interceptor';
import { uuidv7 } from '../../../common/uuidv7';
import { IdentityCryptoService } from '../domain/crypto.service';
import {
  PROFILE_HINT_METADATA,
  type ConsentEntity,
  type ConsentPurpose,
  type DataExportRequestEntity,
  type DeletionRequestEntity,
  type UserPreferenceEntity,
} from '../domain/identity.types';
import {
  IDENTITY_REPOSITORY_PORT,
  type IdentityRepositoryPort,
} from '../ports/identity.repository.port';

const DELETION_GRACE_DAYS = 30;

@Injectable()
export class MeService {
  constructor(
    @Inject(IDENTITY_REPOSITORY_PORT)
    private readonly repo: IdentityRepositoryPort,
    @Inject(AUDIT_LOG_WRITER_PORT)
    private readonly auditWriter: AuditLogWriterPort,
    private readonly crypto: IdentityCryptoService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new NotFoundException('User not found');
    return {
      id: user.id,
      phoneE164: user.phoneE164,
      email: user.email,
      emailVerified: Boolean(user.emailVerifiedAt),
      displayName: user.displayName,
      locale: user.locale,
      isGuest: user.isGuest,
      mfaEnabled: user.mfaEnabled,
      status: user.status,
      roles: user.roles,
      createdAt: user.createdAt,
    };
  }

  async updateProfile(userId: string, patch: { displayName?: string; locale?: 'bn' | 'en' }) {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (patch.displayName !== undefined) user.displayName = patch.displayName;
    if (patch.locale !== undefined) user.locale = patch.locale;
    await this.repo.updateUser(user);
    return this.getProfile(userId);
  }

  async getPreferences(userId: string): Promise<UserPreferenceEntity> {
    return this.repo.getPreferences(userId);
  }

  async updatePreferences(
    userId: string,
    patch: Partial<
      Pick<
        UserPreferenceEntity,
        'language' | 'numeralStyle' | 'notificationChannels' | 'quietHours' | 'accessibility'
      >
    >,
  ): Promise<UserPreferenceEntity> {
    const current = await this.repo.getPreferences(userId);
    const updated: UserPreferenceEntity = {
      ...current,
      language: patch.language ?? current.language,
      numeralStyle: patch.numeralStyle ?? current.numeralStyle,
      notificationChannels: patch.notificationChannels
        ? { ...current.notificationChannels, ...patch.notificationChannels }
        : current.notificationChannels,
      quietHours: patch.quietHours
        ? { ...current.quietHours, ...patch.quietHours }
        : current.quietHours,
      accessibility: patch.accessibility
        ? { ...current.accessibility, ...patch.accessibility }
        : current.accessibility,
      updatedAt: new Date(),
    };
    return this.repo.savePreferences(updated);
  }

  /** R9: Returns optional profile hints alongside explicit bilingual purpose_bn/purpose_en metadata */
  async getProfileHints(userId: string) {
    const hints = await this.repo.getProfileHints(userId);
    return {
      values: {
        ageBand: hints.ageBand,
        divisionId: hints.divisionId,
        districtId: hints.districtId,
        upazilaId: hints.upazilaId,
        occupationBand: hints.occupationBand,
        studentLevel: hints.studentLevel,
        hasDisability: hints.hasDisability,
      },
      consentIds: {
        ageBand: hints.ageBandConsentId,
        location: hints.locationConsentId,
        occupationBand: hints.occupationConsentId,
        studentLevel: hints.studentConsentId,
        hasDisability: hints.disabilityConsentId,
      },
      fieldsMetadata: PROFILE_HINT_METADATA,
    };
  }

  /** R9: Updating any sensitive profile hint requires an active consent for that exact purpose */
  async updateProfileHints(
    userId: string,
    patch: {
      ageBand?: string | null;
      divisionId?: string | null;
      districtId?: string | null;
      upazilaId?: string | null;
      occupationBand?: string | null;
      studentLevel?: string | null;
      hasDisability?: boolean | null;
    },
  ) {
    const hints = await this.repo.getProfileHints(userId);

    const requireConsent = async (purpose: ConsentPurpose): Promise<string> => {
      const active = await this.repo.findActiveConsent(userId, purpose);
      if (!active) {
        throw new ForbiddenException(
          `Explicit consent required for '${purpose}' before saving this profile hint (Rule R9).`,
        );
      }
      return active.id;
    };

    if (patch.ageBand !== undefined) {
      hints.ageBand = patch.ageBand;
      hints.ageBandConsentId =
        patch.ageBand === null ? null : await requireConsent('profile_hint_age_band');
    }

    if (
      patch.divisionId !== undefined ||
      patch.districtId !== undefined ||
      patch.upazilaId !== undefined
    ) {
      const clearing =
        patch.divisionId === null && patch.districtId === null && patch.upazilaId === null;
      if (!clearing) {
        hints.locationConsentId = await requireConsent('profile_hint_location');
      } else {
        hints.locationConsentId = null;
      }
      if (patch.divisionId !== undefined) hints.divisionId = patch.divisionId;
      if (patch.districtId !== undefined) hints.districtId = patch.districtId;
      if (patch.upazilaId !== undefined) hints.upazilaId = patch.upazilaId;
    }

    if (patch.occupationBand !== undefined) {
      hints.occupationBand = patch.occupationBand;
      hints.occupationConsentId =
        patch.occupationBand === null ? null : await requireConsent('profile_hint_occupation');
    }

    if (patch.studentLevel !== undefined) {
      hints.studentLevel = patch.studentLevel;
      hints.studentConsentId =
        patch.studentLevel === null ? null : await requireConsent('profile_hint_student_level');
    }

    if (patch.hasDisability !== undefined) {
      hints.hasDisability = patch.hasDisability;
      hints.disabilityConsentId =
        patch.hasDisability === null ? null : await requireConsent('profile_hint_disability');
    }

    await this.repo.saveProfileHints(hints);
    return this.getProfileHints(userId);
  }

  async listConsents(userId: string): Promise<ConsentEntity[]> {
    return this.repo.listConsents(userId);
  }

  async grantConsent(
    userId: string,
    purpose: ConsentPurpose,
    version: string,
    ip?: string,
  ): Promise<ConsentEntity> {
    const existing = await this.repo.findActiveConsent(userId, purpose);
    if (existing && existing.version === version) {
      return existing;
    }
    const consent: ConsentEntity = {
      id: uuidv7(),
      userId,
      purpose,
      version,
      grantedAt: new Date(),
      withdrawnAt: null,
      ipHash: this.crypto.hashIp(ip),
    };
    return this.repo.saveConsent(consent);
  }

  /** Owner-isolated consent withdrawal (IDOR protected); clears linked profile hints */
  async withdrawConsent(userId: string, consentId: string): Promise<ConsentEntity> {
    const consent = await this.repo.findConsentById(consentId);
    if (!consent) {
      throw new NotFoundException('Consent record not found');
    }
    if (consent.userId !== userId) {
      throw new ForbiddenException('You cannot modify another citizen’s consent record');
    }

    consent.withdrawnAt = new Date();
    await this.repo.saveConsent(consent);

    // Clear any profile hints relying on this withdrawn consent (Rule R9)
    const hints = await this.repo.getProfileHints(userId);
    let mutated = false;
    if (hints.ageBandConsentId === consentId) {
      hints.ageBand = null;
      hints.ageBandConsentId = null;
      mutated = true;
    }
    if (hints.locationConsentId === consentId) {
      hints.divisionId = null;
      hints.districtId = null;
      hints.upazilaId = null;
      hints.locationConsentId = null;
      mutated = true;
    }
    if (hints.occupationConsentId === consentId) {
      hints.occupationBand = null;
      hints.occupationConsentId = null;
      mutated = true;
    }
    if (hints.studentConsentId === consentId) {
      hints.studentLevel = null;
      hints.studentConsentId = null;
      mutated = true;
    }
    if (hints.disabilityConsentId === consentId) {
      hints.hasDisability = null;
      hints.disabilityConsentId = null;
      mutated = true;
    }
    if (mutated) {
      await this.repo.saveProfileHints(hints);
    }

    return consent;
  }

  async listSessions(userId: string, currentSessionId: string) {
    const sessions = await this.repo.listActiveSessionsForUser(userId);
    return sessions.map((s) => ({
      id: s.id,
      deviceId: s.deviceId,
      platform: s.platform,
      userAgent: s.userAgent,
      mfaVerified: s.mfaVerified,
      isCurrent: s.id === currentSessionId,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    }));
  }

  /** Owner-isolated session revocation (IDOR protected) */
  async revokeSession(userId: string, sessionId: string): Promise<{ revoked: true }> {
    const session = await this.repo.findSessionById(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    if (session.userId !== userId) {
      throw new ForbiddenException('You cannot revoke another citizen’s session');
    }
    session.revokedAt = new Date();
    await this.repo.updateSession(session);
    return { revoked: true };
  }

  async requestDataExport(userId: string): Promise<DataExportRequestEntity> {
    const now = new Date();
    const id = uuidv7();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const exportReq: DataExportRequestEntity = {
      id,
      userId,
      status: 'requested',
      signedDownloadUrl: `/api/v1/me/data-export/${id}/download?sig=${this.crypto.generateOpaqueToken(16)}`,
      expiresAt,
      createdAt: now,
    };
    return this.repo.createDataExportRequest(exportReq);
  }

  async requestAccountDeletion(userId: string): Promise<DeletionRequestEntity> {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new NotFoundException('User not found');

    const existing = await this.repo.findActiveDeletionRequest(userId);
    if (existing) return existing;

    const now = new Date();
    const graceUntil = new Date(now.getTime() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
    const req: DeletionRequestEntity = {
      id: uuidv7(),
      userId,
      status: 'requested',
      requestedAt: now,
      graceUntil,
      completedAt: null,
    };
    await this.repo.saveDeletionRequest(req);

    user.status = 'pending_deletion';
    await this.repo.updateUser(user);
    await this.repo.revokeAllUserSessions(userId);
    return req;
  }

  async getActivity(userId: string) {
    return this.auditWriter.listByActor(userId, 50);
  }
}
