import { z } from 'zod';

export const workerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  APP_TIMEZONE: z.literal('Asia/Dhaka').default('Asia/Dhaka'),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(100).default(5),
  WATCH_SCHEDULER_ENABLED: z.coerce.boolean().default(true),
  NOTIFICATION_WORKER_ENABLED: z.coerce.boolean().default(true),
  OUTBOX_RELAY_ENABLED: z.coerce.boolean().default(true),
  DATABASE_URL: z
    .string()
    .url()
    .default(
      'postgresql://jonoshheba:jonoshheba_dev_password_change_me@localhost:5432/jonoshheba?schema=public',
    ),
  REDIS_URL: z.string().url().default('redis://localhost:6379/0'),
  AI_SERVICE_URL: z.string().url().default('http://localhost:8000'),
  AI_SERVICE_JWT_SECRET: z
    .string()
    .min(32)
    .default('dev_only_replace_with_32_byte_internal_ai_shared_secret'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://localhost:4318'),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export function loadWorkerEnv(raw: Record<string, string | undefined> = process.env): WorkerEnv {
  const result = workerEnvSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid apps/workers environment configuration:\n${issues}`);
  }
  return result.data;
}
