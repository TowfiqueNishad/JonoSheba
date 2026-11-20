import { ForbiddenException, HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { Role } from '@jonoshheba/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryAuditLogWriter } from '../../common/audit-log.interceptor';
import { redactPii } from '../../common/pii-redaction';
import { SlidingWindowRateLimiter } from '../../common/rate-limiter';
import { InMemoryIdentityRepository } from './adapters/in-memory-identity.repository';
import { GoogleOAuthAdapter, NationalDigitalIdStubAdapter } from './adapters/oauth.adapters';
import { ConsoleSmsAdapter } from './adapters/sms.adapters';
import { CloudflareTurnstileAdapter } from './adapters/turnstile.adapter';
import { AuthService } from './application/auth.service';
import { MeService } from './application/me.service';
import { IdentityCryptoService } from './domain/crypto.service';
import { type Permission, PolicyService } from './domain/policy.service';

describe('Phase 03: Identity, Auth, RBAC, Consent & Privacy Security Suite', () => {
  let repo: InMemoryIdentityRepository;
  let sms: ConsoleSmsAdapter;
  let turnstile: CloudflareTurnstileAdapter;
  let rateLimiter: SlidingWindowRateLimiter;
  let auditWriter: InMemoryAuditLogWriter;
  let crypto: IdentityCryptoService;
  let policy: PolicyService;
  let auth: AuthService;
  let me: MeService;

  beforeEach(() => {
    repo = new InMemoryIdentityRepository();
    sms = new ConsoleSmsAdapter();
    turnstile = new CloudflareTurnstileAdapter();
    rateLimiter = new SlidingWindowRateLimiter();
    auditWriter = new InMemoryAuditLogWriter();
    crypto = new IdentityCryptoService();
    policy = new PolicyService();
    auth = new AuthService(
      repo,
      sms,
      turnstile,
      rateLimiter,
      [new GoogleOAuthAdapter(), new NationalDigitalIdStubAdapter()],
      crypto,
    );
    me = new MeService(repo, auditWriter, crypto);
  });

  // ---------------------------------------------------------------------------
  // 1. Phone OTP + Brute-Force Lockout + Bot Protection + EdDSA JWKS
  // ---------------------------------------------------------------------------
  it('completes Bangladesh phone OTP flow, normalizes 01X numbers, and exposes EdDSA JWKS with kid rotation', async () => {
    const req = await auth.requestOtp({ phone: '01712345678', locale: 'bn', ip: '10.0.0.1' });
    expect(req.devOtp).toMatch(/^\d{6}$/);
    expect(sms.sentMessages).toHaveLength(1);
    expect(sms.sentMessages[0]?.toE164).toBe('+8801712345678');

    const bundle = await auth.verifyOtp({
      phone: '+8801712345678',
      code: req.devOtp!,
      deviceId: 'android-1',
      platform: 'android',
      ip: '10.0.0.1',
    });

    expect(bundle.user.phoneE164).toBe('+8801712345678');
    expect(bundle.user.roles).toEqual([Role.CITIZEN]);
    expect(bundle.expiresIn).toBe(600);

    const claims = await crypto.verifyAccessToken(bundle.accessToken);
    expect(claims.sub).toBe(bundle.user.id);

    // Key rotation retains previous public key in JWKS so active tokens remain valid
    await crypto.rotateSigningKey();
    const jwks = await auth.getJwks();
    expect(jwks.keys.length).toBeGreaterThanOrEqual(2);
    const claimsAfterRotate = await crypto.verifyAccessToken(bundle.accessToken);
    expect(claimsAfterRotate.sub).toBe(bundle.user.id);
  });

  it('locks OTP challenge after 5 failed brute-force attempts (even if 6th uses correct code)', async () => {
    const req = await auth.requestOtp({ phone: '+8801812345678', ip: '10.0.0.2' });
    const wrongCode = req.devOtp === '000000' ? '999999' : '000000';

    for (let i = 0; i < 4; i++) {
      await expect(
        auth.verifyOtp({
          phone: '+8801812345678',
          code: wrongCode,
          deviceId: 'dev-1',
          platform: 'web',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }

    // 5th wrong attempt triggers 423 Locked
    try {
      await auth.verifyOtp({
        phone: '+8801812345678',
        code: wrongCode,
        deviceId: 'dev-1',
        platform: 'web',
      });
      expect.unreachable('Expected 5th failure to lock OTP');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(423);
    }

    // 6th attempt with the REAL code is STILL locked!
    try {
      await auth.verifyOtp({
        phone: '+8801812345678',
        code: req.devOtp!,
        deviceId: 'dev-1',
        platform: 'web',
      });
      expect.unreachable('Expected locked challenge to reject even correct OTP');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(423);
    }
  });

  it('enforces OTP resend cooldown and Turnstile bot protection', async () => {
    await expect(
      auth.requestOtp({
        phone: '+8801912345678',
        turnstileToken: 'FORCE_FAIL_BOT',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await auth.requestOtp({ phone: '+8801912345678', ip: '10.0.0.3' });

    try {
      await auth.requestOtp({ phone: '+8801912345678', ip: '10.0.0.3' });
      expect.unreachable('Expected resend cooldown 429');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  // ---------------------------------------------------------------------------
  // 2. Refresh-Token Rotation & Reuse Detection
  // ---------------------------------------------------------------------------
  it('rotates refresh tokens and revokes the ENTIRE token family upon reuse detection', async () => {
    const initial = await auth.registerEmail({
      email: 'citizen@example.com',
      password: 'StrongPassword#2026',
      deviceId: 'laptop-1',
      platform: 'web',
    });

    const r1 = initial.refreshToken;
    const rotated = await auth.refreshTokens({ refreshToken: r1 });
    const r2 = rotated.refreshToken;
    expect(r2).not.toBe(r1);

    // Replay old R1 -> triggers reuse detection and revokes the whole family!
    await expect(auth.refreshTokens({ refreshToken: r1 })).rejects.toThrow(/reuse detected/i);

    // Now even the legitimate latest R2 must fail because the entire family was revoked!
    await expect(auth.refreshTokens({ refreshToken: r2 })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    const remainingSessions = await repo.listActiveSessionsForUser(initial.user.id);
    expect(remainingSessions).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // 3. Email/Argon2id, Password Reset, OAuth Google & Guest Upgrade
  // ---------------------------------------------------------------------------
  it('hashes passwords with Argon2id, supports password reset (revoking sessions), Google OAuth, and guest upgrade', async () => {
    const guest = await auth.createGuestSession({ deviceId: 'guest-phone', platform: 'android' });
    expect(guest.user.isGuest).toBe(true);
    expect(guest.user.roles).toEqual([Role.GUEST]);

    // Upgrade guest via email registration
    const upgraded = await auth.registerEmail({
      email: 'upgraded@example.com',
      password: 'MySecurePassword99!',
      deviceId: 'guest-phone',
      platform: 'android',
      guestUserId: guest.user.id,
    });
    expect(upgraded.user.id).toBe(guest.user.id);
    expect(upgraded.user.isGuest).toBe(false);
    expect(upgraded.user.roles).toEqual([Role.CITIZEN]);

    const stored = await repo.findUserById(upgraded.user.id);
    expect(stored?.passwordHash).toMatch(/^\$argon2id\$/);

    // Verify email
    await auth.verifyEmail(upgraded.emailVerificationToken!);
    const afterVerify = await me.getProfile(upgraded.user.id);
    expect(afterVerify.emailVerified).toBe(true);

    // Password reset revokes active sessions
    const forgot = await auth.forgotPassword('upgraded@example.com');
    await auth.resetPassword(forgot.devResetToken!, 'BrandNewPassword99!');
    expect(await repo.listActiveSessionsForUser(upgraded.user.id)).toHaveLength(0);

    // Old password fails, new password succeeds
    await expect(
      auth.loginEmail({
        email: 'upgraded@example.com',
        password: 'MySecurePassword99!',
        deviceId: 'd2',
        platform: 'web',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const loggedIn = await auth.loginEmail({
      email: 'upgraded@example.com',
      password: 'BrandNewPassword99!',
      deviceId: 'd2',
      platform: 'web',
    });
    expect(loggedIn.user.id).toBe(upgraded.user.id);

    // Google OAuth dev token
    const oauthBundle = await auth.oauthLogin({
      provider: 'google',
      idToken: 'dev-google:sub-42:rahim@gmail.com:Rahim Uddin',
      deviceId: 'web-1',
      platform: 'web',
    });
    expect(oauthBundle.user.email).toBe('rahim@gmail.com');
    expect(oauthBundle.user.displayName).toBe('Rahim Uddin');
  });

  // ---------------------------------------------------------------------------
  // 4. MFA (TOTP + Single-Use Backup Codes)
  // ---------------------------------------------------------------------------
  it('supports RFC 6238 TOTP MFA and single-use backup codes', async () => {
    const bundle = await auth.registerEmail({
      email: 'editor@jonoshheba.app',
      password: 'EditorPassword#2026',
      deviceId: 'workstation',
      platform: 'web',
    });

    const setup = await auth.setupMfa(bundle.user.id);
    expect(setup.otpauthUri).toContain('otpauth://totp/');
    expect(setup.backupCodes).toHaveLength(8);

    const totp = crypto.computeTotpCode(setup.secret);
    const verified = await auth.verifyMfa({
      userId: bundle.user.id,
      sessionId: bundle.sessionId,
      code: totp,
    });
    expect(verified.mfaVerified).toBe(true);
    const claims = await crypto.verifyAccessToken(verified.accessToken);
    expect(claims.mfaVerified).toBe(true);

    // Backup code works once, fails on replay
    const backupCode = setup.backupCodes[0]!;
    const viaBackup = await auth.verifyMfa({
      userId: bundle.user.id,
      sessionId: bundle.sessionId,
      code: backupCode,
    });
    expect(viaBackup.mfaVerified).toBe(true);

    await expect(
      auth.verifyMfa({
        userId: bundle.user.id,
        sessionId: bundle.sessionId,
        code: backupCode,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  // ---------------------------------------------------------------------------
  // 5. IDOR Protection on /me Resources (Rule R10)
  // ---------------------------------------------------------------------------
  it('blocks IDOR attempts across citizens on sessions, consents, and activity', async () => {
    const userA = await auth.registerEmail({
      email: 'userA@example.com',
      password: 'PasswordA#2026',
      deviceId: 'a-phone',
      platform: 'android',
    });
    const userB = await auth.registerEmail({
      email: 'userB@example.com',
      password: 'PasswordB#2026',
      deviceId: 'b-phone',
      platform: 'android',
    });

    const consentA = await me.grantConsent(userA.user.id, 'profile_hint_age_band', '1.0');

    // User B tries to revoke User A's session -> 403 Forbidden
    await expect(me.revokeSession(userB.user.id, userA.sessionId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    // User B tries to withdraw User A's consent -> 403 Forbidden
    await expect(me.withdrawConsent(userB.user.id, consentA.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    // User A's session & consent remain untouched
    const sessionsA = await me.listSessions(userA.user.id, userA.sessionId);
    expect(sessionsA).toHaveLength(1);
    const consentsA = await me.listConsents(userA.user.id);
    expect(consentsA[0]?.withdrawnAt).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // 6. Consent, Profile Hints (purpose_bn/en), Data Export, 30-day Delete & PII Redaction
  // ---------------------------------------------------------------------------
  it('enforces Rule R9 consent-backed profile hints with purpose metadata, export, and 30-day deletion grace', async () => {
    const citizen = await auth.registerEmail({
      email: 'privacy@example.com',
      password: 'PrivacyPassword#2026',
      deviceId: 'web-browser',
      platform: 'web',
    });

    // Metadata explains purpose_bn and purpose_en for every hint
    const initialHints = await me.getProfileHints(citizen.user.id);
    expect(initialHints.fieldsMetadata.ageBand.purpose_bn).toBeTruthy();
    expect(initialHints.fieldsMetadata.ageBand.purpose_en).toBeTruthy();
    expect(initialHints.fieldsMetadata.hasDisability.purpose_bn).toBeTruthy();

    // Updating without consent -> rejected!
    await expect(
      me.updateProfileHints(citizen.user.id, { ageBand: '25-34' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Grant consent -> updating succeeds
    const consent = await me.grantConsent(citizen.user.id, 'profile_hint_age_band', '1.0');
    const updated = await me.updateProfileHints(citizen.user.id, { ageBand: '25-34' });
    expect(updated.values.ageBand).toBe('25-34');
    expect(updated.consentIds.ageBand).toBe(consent.id);

    // Withdraw consent -> linked hint automatically cleared!
    await me.withdrawConsent(citizen.user.id, consent.id);
    const afterWithdraw = await me.getProfileHints(citizen.user.id);
    expect(afterWithdraw.values.ageBand).toBeNull();
    expect(afterWithdraw.consentIds.ageBand).toBeNull();

    // Data export
    const exportJob = await me.requestDataExport(citizen.user.id);
    expect(exportJob.status).toBe('requested');
    expect(exportJob.signedDownloadUrl).toContain('/api/v1/me/data-export/');

    // Deletion with 30-day grace & immediate session revocation
    const delReq = await me.requestAccountDeletion(citizen.user.id);
    const diffDays = (delReq.graceUntil.getTime() - delReq.requestedAt.getTime()) / 86_400_000;
    expect(Math.round(diffDays)).toBe(30);
    expect(await repo.listActiveSessionsForUser(citizen.user.id)).toHaveLength(0);

    // PII Redaction check
    const redacted = redactPii({
      phone: '+8801712345678',
      password: 'secret',
      otp: '123456',
      nested: { authorization: 'Bearer abc.def.ghi', okField: 'public' },
    }) as Record<string, unknown>;
    expect(redacted.phone).toBe('**********5678');
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.otp).toBe('[REDACTED]');
    expect((redacted.nested as Record<string, unknown>).authorization).toBe('[REDACTED]');
    expect((redacted.nested as Record<string, unknown>).okField).toBe('public');
  });

  // ---------------------------------------------------------------------------
  // 7. Complete RBAC + ABAC Matrix for EVERY Role + Mandatory MFA + Two-Person Rule
  // ---------------------------------------------------------------------------
  it('enforces the complete RBAC matrix for all 9 roles, org scoping, MFA mandate, and two-person approval', () => {
    const matrix: Array<{
      role: Role;
      mfaRequired: boolean;
      allowed: Permission[];
      denied: Permission[];
    }> = [
      {
        role: Role.GUEST,
        mfaRequired: false,
        allowed: ['catalogue:read', 'emergency:read'],
        denied: ['me:manage', 'watch:manage', 'service:write', 'service:publish', 'admin:flags:manage'],
      },
      {
        role: Role.CITIZEN,
        mfaRequired: false,
        allowed: ['catalogue:read', 'emergency:read', 'me:manage', 'watch:manage', 'case:manage'],
        denied: ['assisted:session', 'service:write', 'service:publish', 'report:moderate', 'admin:flags:manage'],
      },
      {
        role: Role.ORG_MEMBER,
        mfaRequired: false,
        allowed: ['catalogue:read', 'me:manage', 'assisted:session'],
        denied: ['service:write', 'service:publish', 'partner:analytics:read', 'admin:flags:manage'],
      },
      {
        role: Role.CONTENT_EDITOR,
        mfaRequired: true,
        allowed: ['service:write', 'notice:write', 'hotline:edit', 'rule:write'],
        denied: ['service:publish', 'hotline:approve', 'rule:publish', 'admin:flags:manage'],
      },
      {
        role: Role.REVIEWER,
        mfaRequired: true,
        allowed: ['service:publish', 'hotline:approve', 'rule:publish'],
        denied: ['service:write', 'user:suspend', 'admin:flags:manage'],
      },
      {
        role: Role.MODERATOR,
        mfaRequired: true,
        allowed: ['report:moderate', 'user:suspend'],
        denied: ['service:publish', 'hotline:approve', 'admin:flags:manage'],
      },
      {
        role: Role.SUPPORT_AGENT,
        mfaRequired: true,
        allowed: ['support:respond'],
        denied: ['service:publish', 'user:suspend', 'admin:flags:manage'],
      },
      {
        role: Role.AGENCY_PARTNER,
        mfaRequired: true,
        allowed: ['partner:analytics:read'],
        denied: ['service:write', 'service:publish', 'admin:flags:manage'],
      },
      {
        role: Role.PLATFORM_ADMIN,
        mfaRequired: true,
        allowed: ['service:publish', 'hotline:approve', 'rule:publish', 'admin:flags:manage', 'admin:audit:read'],
        denied: [],
      },
    ];

    for (const row of matrix) {
      expect(policy.requiresMfa([row.role])).toBe(row.mfaRequired);

      const actorWithMfa = {
        roles: [row.role],
        orgScopes: [{ role: row.role, orgId: null }],
        mfaVerified: true,
      };
      const actorWithoutMfa = {
        roles: [row.role],
        orgScopes: [{ role: row.role, orgId: null }],
        mfaVerified: false,
      };

      for (const perm of row.allowed) {
        expect(policy.can(actorWithMfa, perm).allowed).toBe(true);
        if (row.mfaRequired && !['catalogue:read', 'emergency:read', 'me:manage'].includes(perm)) {
          // Staff/partner privileged actions MUST be denied without MFA!
          expect(policy.can(actorWithoutMfa, perm).allowed).toBe(false);
        }
      }

      for (const perm of row.denied) {
        expect(policy.can(actorWithMfa, perm).allowed).toBe(false);
      }
    }

    // ABAC Organization Scoping
    const orgScopedPartner = {
      roles: [Role.AGENCY_PARTNER],
      orgScopes: [{ role: Role.AGENCY_PARTNER, orgId: 'org-brta' }],
      mfaVerified: true,
    };
    expect(policy.can(orgScopedPartner, 'partner:analytics:read', { orgId: 'org-brta' }).allowed).toBe(true);
    expect(policy.can(orgScopedPartner, 'partner:analytics:read', { orgId: 'org-nbr' }).allowed).toBe(false);

    // Two-Person Approval Rule (hotline:approve & rule:publish)
    const reviewer = {
      sub: 'user-reviewer-1',
      roles: [Role.REVIEWER],
      orgScopes: [{ role: Role.REVIEWER, orgId: null }],
      mfaVerified: true,
    };
    expect(() =>
      policy.assertTwoPersonApproval({
        action: 'hotline:approve',
        authorId: 'user-reviewer-1', // Self-approval MUST fail!
        reviewer,
      }),
    ).toThrow(ForbiddenException);

    expect(() =>
      policy.assertTwoPersonApproval({
        action: 'rule:publish',
        authorId: 'user-editor-2', // Distinct reviewer succeeds!
        reviewer,
      }),
    ).not.toThrow();
  });
});
