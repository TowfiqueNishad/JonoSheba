import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@jonoshheba/shared';
import type { AccessTokenClaims } from './identity.types';

export type Permission =
  | 'catalogue:read'
  | 'emergency:read'
  | 'me:manage'
  | 'watch:manage'
  | 'case:manage'
  | 'assisted:session'
  | 'service:write'
  | 'service:publish'
  | 'notice:write'
  | 'hotline:edit'
  | 'hotline:approve'
  | 'rule:write'
  | 'rule:publish'
  | 'report:moderate'
  | 'user:suspend'
  | 'support:respond'
  | 'partner:analytics:read'
  | 'admin:audit:read'
  | 'admin:flags:manage'
  | '*';

/** Staff & partner roles where TOTP MFA is mandatory (Prompt 03) */
export const MANDATORY_MFA_ROLES: ReadonlySet<Role> = new Set([
  Role.CONTENT_EDITOR,
  Role.REVIEWER,
  Role.MODERATOR,
  Role.SUPPORT_AGENT,
  Role.PLATFORM_ADMIN,
  Role.AGENCY_PARTNER,
]);

/** Role → Permissions matrix for all 9 Jonoshheba roles */
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  [Role.GUEST]: ['catalogue:read', 'emergency:read'],
  [Role.CITIZEN]: ['catalogue:read', 'emergency:read', 'me:manage', 'watch:manage', 'case:manage'],
  [Role.ORG_MEMBER]: [
    'catalogue:read',
    'emergency:read',
    'me:manage',
    'assisted:session',
  ],
  [Role.CONTENT_EDITOR]: [
    'catalogue:read',
    'emergency:read',
    'me:manage',
    'service:write',
    'notice:write',
    'hotline:edit',
    'rule:write',
  ],
  [Role.REVIEWER]: [
    'catalogue:read',
    'emergency:read',
    'me:manage',
    'service:publish',
    'hotline:approve',
    'rule:publish',
  ],
  [Role.MODERATOR]: [
    'catalogue:read',
    'emergency:read',
    'me:manage',
    'report:moderate',
    'user:suspend',
  ],
  [Role.SUPPORT_AGENT]: [
    'catalogue:read',
    'emergency:read',
    'me:manage',
    'support:respond',
  ],
  [Role.AGENCY_PARTNER]: [
    'catalogue:read',
    'emergency:read',
    'me:manage',
    'partner:analytics:read',
  ],
  [Role.PLATFORM_ADMIN]: ['*'],
};

/** Actions that ALWAYS require a distinct second reviewer (authorId !== reviewerId) */
export const TWO_PERSON_ACTIONS = new Set<Permission>(['hotline:approve', 'rule:publish']);

@Injectable()
export class PolicyService {
  /** Returns whether the user has a role that mandates MFA */
  requiresMfa(roles: readonly Role[]): boolean {
    return roles.some((r) => MANDATORY_MFA_ROLES.has(r));
  }

  /** Evaluates RBAC + ABAC (org scope + mandatory MFA check) */
  can(
    actor: Pick<AccessTokenClaims, 'roles' | 'orgScopes' | 'mfaVerified'>,
    permission: Permission,
    context?: { orgId?: string | null },
  ): { allowed: boolean; reason?: string } {
    if (actor.roles.length === 0) {
      return { allowed: false, reason: 'No role assigned' };
    }

    // Check matching role grants (with optional org scoping)
    const matchingAssignments = actor.orgScopes.filter((assignment) => {
      const perms = ROLE_PERMISSIONS[assignment.role] ?? [];
      const hasPerm = perms.includes('*') || perms.includes(permission);
      if (!hasPerm) return false;

      // Global assignment (orgId === null) applies everywhere; org-scoped applies only to matching org
      if (context?.orgId) {
        return assignment.orgId === null || assignment.orgId === context.orgId;
      }
      return true;
    });

    if (matchingAssignments.length === 0) {
      return { allowed: false, reason: `Missing required permission: ${permission}` };
    }

    // If the granting role is privileged and the action isn't basic self-service/public read, require MFA
    const isBasicAction =
      permission === 'catalogue:read' ||
      permission === 'emergency:read' ||
      permission === 'me:manage';
    const grantedOnlyByPrivileged = matchingAssignments.every((a) =>
      MANDATORY_MFA_ROLES.has(a.role),
    );

    if (!isBasicAction && grantedOnlyByPrivileged && !actor.mfaVerified) {
      return {
        allowed: false,
        reason: 'MFA verification is mandatory for staff and partner roles',
      };
    }

    return { allowed: true };
  }

  /**
   * Two-person approval enforcement for critical actions:
   * - Hotline edits/approvals (Rule R8)
   * - Publishing eligibility rules (Rule R7)
   */
  assertTwoPersonApproval(params: {
    action: 'hotline:approve' | 'rule:publish';
    authorId: string;
    reviewer: Pick<AccessTokenClaims, 'sub' | 'roles' | 'orgScopes' | 'mfaVerified'>;
  }): void {
    const decision = this.can(params.reviewer, params.action);
    if (!decision.allowed) {
      throw new ForbiddenException(decision.reason ?? 'Forbidden');
    }
    if (params.authorId === params.reviewer.sub) {
      throw new ForbiddenException(
        `Two-person approval rule violated: author cannot self-approve ${params.action}`,
      );
    }
  }
}
