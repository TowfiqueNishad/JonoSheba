import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@jonoshheba/shared';
import { AuthGuard, type AuthenticatedRequest } from './auth.guard';
import { REQUIRED_ROLES_KEY } from './rbac.guard';

/** Staff roles eligible to access /api/v1/admin/** endpoints (Finding S1) */
export const ADMIN_ELIGIBLE_ROLES: ReadonlySet<Role> = new Set([
  Role.PLATFORM_ADMIN,
  Role.CONTENT_EDITOR,
  Role.REVIEWER,
  Role.MODERATOR,
  Role.SUPPORT_AGENT,
]);

/**
 * Global default-deny guard for the entire /api/v1/admin/** prefix (Finding S1).
 * Every route under /api/v1/admin/** MUST:
 * 1. Authenticate with a valid, non-revoked JWT session (401 if missing/invalid)
 * 2. Declare explicit @Roles(...) metadata (default-deny 403 if omitted)
 * 3. Match both ADMIN_ELIGIBLE_ROLES and the route's explicit @Roles(...)
 * 4. Have an MFA-verified session claim (req.user.mfaVerified === true)
 */
@Injectable()
export class GlobalAdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authGuard: AuthGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const rawPath = (req.originalUrl ?? req.url ?? '').split('?')[0] ?? '';

    if (!/^\/api\/v1\/admin(\/|$)/.test(rawPath)) {
      return true;
    }

    // 1. Require valid JWT + active non-revoked session
    if (!req.user) {
      await this.authGuard.canActivate(context);
    }

    // 2. Default-deny: explicit @Roles(...) metadata is mandatory on every admin route
    const routeRoles = this.reflector.getAllAndOverride<Role[] | undefined>(REQUIRED_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!routeRoles || routeRoles.length === 0) {
      throw new ForbiddenException(
        'Admin route is missing explicit @Roles() declaration (default-deny)',
      );
    }

    // 3. User must have at least one eligible admin staff role allowed for this route
    const userRoles = req.user?.roles ?? [];
    const authorized = userRoles.some(
      (role) => ADMIN_ELIGIBLE_ROLES.has(role) && routeRoles.includes(role),
    );
    if (!authorized) {
      throw new ForbiddenException('Insufficient admin role for this operation');
    }

    // 4. Mandatory MFA-verified session claim on all admin routes
    if (!req.user?.mfaVerified) {
      throw new ForbiddenException('MFA verification is mandatory for admin access');
    }

    return true;
  }
}
