/**
 * EmailPort — interface for sending transactional emails.
 * Implementations: ResendEmailAdapter (production), ConsoleEmailAdapter (dev/test).
 */

export const EMAIL_PORT = 'EMAIL_PORT';

export interface EmailPort {
  sendVerificationCode(to: string, code: string, locale: 'bn' | 'en'): Promise<void>;
  sendMagicLink(to: string, link: string, locale: 'bn' | 'en'): Promise<void>;
  sendPasswordReset(to: string, link: string, locale: 'bn' | 'en'): Promise<void>;
  sendNewDeviceAlert(to: string, deviceInfo: string, locale: 'bn' | 'en'): Promise<void>;
  sendWelcome(to: string, displayName: string | null, locale: 'bn' | 'en'): Promise<void>;
}
