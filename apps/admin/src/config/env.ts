import { z } from 'zod';

const adminEnvSchema = z.object({
  NEXT_PUBLIC_ADMIN_API_BASE_URL: z.string().url().default('http://localhost:4000'),
  NEXT_PUBLIC_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
});

export type AdminEnv = z.infer<typeof adminEnvSchema>;

export function loadAdminEnv(raw: Record<string, string | undefined> = process.env): AdminEnv {
  return adminEnvSchema.parse(raw);
}
