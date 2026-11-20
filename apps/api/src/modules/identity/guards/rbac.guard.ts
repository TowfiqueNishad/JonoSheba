import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@jonoshheba/shared';
import { type Permission, PolicyService } from '../domain/policy.service';
import type { AuthenticatedRequest } from './auth.guard';

export const REQUIRED_PERMISSION_KEY = 'jonoshheba:required_permission';
export const REQUIRED_ROLES_KEY = 'jonoshheba:required_roles';

/** Declarative RBAC + ABAC permission decorator (e.g., @Can('service:publish')) */
export const Can = (permission: Permission) => SetMetadata(REQUIRED_PERMISSION_KEY, permission);

/** Explicit role allowlist decorator — mandatory on all /api/v1/admin/** routes (default-deny) */
export const Roles = (...roles: Role[]) => SetMetadata(REQUIRED_ROLES_KEY, roles);

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly policy: PolicyService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(REQUIRED_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredPermission = this.reflector.getAllAndOverride<Permission | undefined>(
      REQUIRED_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermission && (!requiredRoles || requiredRoles.length === 0)) {
      return true;
    }

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.user) {
      throw new UnauthorizedException('Authentication required');
    }

    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = req.user.roles.some((r) => requiredRoles.includes(r));
      if (!hasRole) {
        throw new ForbiddenException('Insufficient role permissions');
      }
    }

    if (requiredPermission) {
      const orgIdHeader = req.headers['x-org-id'];
      const orgId = typeof orgIdHeader === 'string' ? orgIdHeader : undefined;

      const decision = this.policy.can(req.user, requiredPermission, { orgId });
      if (!decision.allowed) {
        throw new ForbiddenException(decision.reason ?? 'Insufficient permissions');
      }
    }

    return true;
  }
}
