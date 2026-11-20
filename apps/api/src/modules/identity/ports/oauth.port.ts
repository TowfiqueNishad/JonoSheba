export interface OAuthProfile {
  provider: string;
  providerUserId: string;
  email: string | null;
  displayName: string | null;
}

export interface OAuthProviderPort {
  readonly providerName: string;
  exchangeIdToken(idToken: string): Promise<OAuthProfile>;
}

export const OAUTH_PROVIDERS_PORT = Symbol('OAUTH_PROVIDERS_PORT');
