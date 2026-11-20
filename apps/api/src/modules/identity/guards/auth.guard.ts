import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { IdentityCryptoService } from '../domain/crypto.service';
import type { AccessTokenClaims } from '../domain/identity.types';
import {
  IDENTITY_REPOSITORY_PORT,
  type IdentityRepositoryPort,
} from '../ports/identity.repository.port';

export const ACCESS_COOKIE_NAME = 'jonoshheba_at';
export const REFRESH_COOKIE_NAME = 'jonoshheba_rt';
export const CSRF_COOKIE_NAME = 'jonoshheba_csrf';

export interface AuthenticatedRequest extends Request {
  user?: AccessTokenClaims;
  authTransport?: 'bearer' | 'cookie';
}

const MUTATION_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly crypto: IdentityCryptoService,
    @Inject(IDENTITY_REPOSITORY_PORT)
    private readonly repo: IdentityRepositoryPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = req.headers.authorization;
    const cookies = (req as unknown as { cookies?: Record<string, string> }).cookies ?? {};

    let token: string | null = null;
    let transport: 'bearer' | 'cookie' = 'bearer';

    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
      transport = 'bearer';
    } else if (typeof cookies[ACCESS_COOKIE_NAME] === 'string') {
      token = cookies[ACCESS_COOKIE_NAME];
      transport = 'cookie';
    }

    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    // Cookie-authenticated mutations require double-submit CSRF header
    if (transport === 'cookie' && MUTATION_METHODS.has(req.method)) {
      const csrfCookie = cookies[CSRF_COOKIE_NAME];
      const csrfHeader = req.headers['x-csrf-token'];
      if (!csrfCookie || typeof csrfHeader !== 'string' || csrfHeader !== csrfCookie) {
        throw new ForbiddenException('Invalid or missing CSRF token');
      }
    }

    let claims: AccessTokenClaims;
    try {
      claims = await this.crypto.verifyAccessToken(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    // Verify backing session has not been revoked
    const session = await this.repo.findSessionById(claims.sid);
    if (!session || session.revokedAt !== null || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Session has been revoked or expired');
    }

    req.user = claims;
    req.authTransport = transport;
    return true;
  }
}
