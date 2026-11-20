export interface TurnstileVerificationResult {
  success: boolean;
  reason?: string;
}

export interface TurnstilePort {
  verify(token: string | undefined, remoteIp?: string): Promise<TurnstileVerificationResult>;
}

export const TURNSTILE_PORT = Symbol('TURNSTILE_PORT');
