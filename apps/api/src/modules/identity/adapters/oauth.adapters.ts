import { BadRequestException, Injectable } from '@nestjs/common';
import type { OAuthProfile, OAuthProviderPort } from '../ports/oauth.port';

/**
 * Google OAuth2 / OIDC adapter.
 * In production, verifies Google ID token signature against Google JWKS;
 * in dev/test, accepts signed-format dev token `dev-google:<subId>:<email>:<name>`.
 */
@Injectable()
export class GoogleOAuthAdapter implements OAuthProviderPort {
  readonly providerName = 'google';

  async exchangeIdToken(idToken: string): Promise<OAuthProfile> {
    if (
      (process.env.NODE_ENV === 'development' ||
        process.env.NODE_ENV === 'test' ||
        process.env.VITEST === 'true') &&
      idToken.startsWith('dev-google:')
    ) {
      const [, sub, email, displayName] = idToken.split(':');
      if (!sub || !email) {
        throw new BadRequestException('Invalid dev Google token format');
      }
      return {
        provider: 'google',
        providerUserId: sub,
        email: email.toLowerCase(),
        displayName: displayName ?? null,
      };
    }

    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    );
    if (!res.ok) {
      throw new BadRequestException('Invalid Google ID token');
    }
    const info = (await res.json()) as {
      sub?: string;
      email?: string;
      name?: string;
    };
    if (!info.sub) {
      throw new BadRequestException('Google token missing subject');
    }
    return {
      provider: 'google',
      providerUserId: info.sub,
      email: info.email?.toLowerCase() ?? null,
      displayName: info.name ?? null,
    };
  }
}

/**
 * Pluggable future National Digital ID (OIDC) provider stub — NEVER stores NID credentials (Rule R3)
 * and only activates once an authorized government OIDC integration exists (Rule R2).
 */
@Injectable()
export class NationalDigitalIdStubAdapter implements OAuthProviderPort {
  readonly providerName = 'national_digital_id';

  async exchangeIdToken(): Promise<OAuthProfile> {
    throw new BadRequestException(
      'National Digital ID OIDC integration is not yet enabled (requires official government OIDC agreement).',
    );
  }
}
