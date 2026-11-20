import { z } from 'zod';

const mobileEnvSchema = z.object({
  EXPO_PUBLIC_API_BASE_URL: z.string().url().default('http://localhost:4000'),
  EXPO_PUBLIC_DEFAULT_LOCALE: z.enum(['bn', 'en']).default('bn'),
  EXPO_PUBLIC_SENTRY_DSN: z.string().optional().default(''),
});

export type MobileEnv = z.infer<typeof mobileEnvSchema>;

export function loadMobileEnv(raw: Record<string, string | undefined> = process.env): MobileEnv {
  return mobileEnvSchema.parse(raw);
}
