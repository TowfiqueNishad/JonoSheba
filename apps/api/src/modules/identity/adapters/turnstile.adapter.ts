import { Injectable } from '@nestjs/common';
import type { TurnstilePort, TurnstileVerificationResult } from '../ports/turnstile.port';

@Injectable()
export class CloudflareTurnstileAdapter implements TurnstilePort {
  private readonly secretKey = process.env.TURNSTILE_SECRET_KEY ?? '';

  async verify(token: string | undefined, remoteIp?: string): Promise<TurnstileVerificationResult> {
    // When no Turnstile secret is configured in local dev/test, allow unless explicit fail token sent
    if (!this.secretKey) {
      if (token === 'FORCE_FAIL_BOT') {
        return { success: false, reason: 'Bot verification failed' };
      }
      return { success: true };
    }

    if (!token) {
      return { success: false, reason: 'Missing Turnstile verification token' };
    }

    const form = new URLSearchParams({
      secret: this.secretKey,
      response: token,
    });
    if (remoteIp) {
      form.set('remoteip', remoteIp);
    }

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    if (!res.ok) {
      return { success: false, reason: 'Bot verification service unavailable' };
    }
    const data = (await res.json()) as { success?: boolean };
    return data.success ? { success: true } : { success: false, reason: 'Turnstile challenge failed' };
  }
}
