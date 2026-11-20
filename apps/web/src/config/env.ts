import { z } from 'zod';

const webEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default('জনসেবা AI'),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(['bn', 'en']).default('bn'),
  NEXT_PUBLIC_API_BASE_URL: z.string().url().default('http://localhost:4000'),
  NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY: z.string().optional().default(''),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional().default(''),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export function loadWebEnv(raw: Record<string, string | undefined> = process.env): WebEnv {
  return webEnvSchema.parse(raw);
}
