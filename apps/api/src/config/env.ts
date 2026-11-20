import { z } from 'zod';

export const apiEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_HOST: z.string().default('0.0.0.0'),
  APP_TIMEZONE: z.literal('Asia/Dhaka').default('Asia/Dhaka'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001,jonoshheba://')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),

  DATABASE_URL: z
    .string()
    .url()
    .default(
      'postgresql://jonoshheba:jonoshheba_dev_password_change_me@localhost:5432/jonoshheba?schema=public',
    ),
  REDIS_URL: z.string().url().default('redis://localhost:6379/0'),

  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
  S3_REGION: z.string().min(1).default('ap-southeast-1'),
  S3_BUCKET: z.string().min(1).default('jonoshheba-dev'),
  S3_ACCESS_KEY_ID: z.string().min(1).default('jonoshheba_minio'),
  S3_SECRET_ACCESS_KEY: z.string().min(1).default('jonoshheba_minio_dev_password'),

  JWT_ISSUER: z.string().min(1).default('jonoshheba-api'),
  JWT_AUDIENCE: z.string().min(1).default('jonoshheba-clients'),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters')
    .default('dev_only_replace_with_32_byte_random_access_secret_key'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters')
    .default('dev_only_replace_with_32_byte_random_refresh_secret_key'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(600),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().min(3600).default(2592000),

  AI_SERVICE_URL: z.string().url().default('http://localhost:8000'),
  AI_SERVICE_JWT_SECRET: z
    .string()
    .min(32, 'AI_SERVICE_JWT_SECRET must be at least 32 characters')
    .default('dev_only_replace_with_32_byte_internal_ai_shared_secret'),
  CHAT_SESSION_SECRET: z
    .string()
    .min(32, 'CHAT_SESSION_SECRET must be at least 32 characters')
    .default('dev_only_replace_with_32_byte_chat_session_hmac_secret'),
  WEBHOOK_HMAC_SECRET: z
    .string()
    .min(24, 'WEBHOOK_HMAC_SECRET must be at least 24 characters')
    .default('dev_only_sms_dlr_webhook_hmac_secret'),
  WEBHOOK_IP_ALLOWLIST: z
    .string()
    .optional()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  WEBHOOK_REPLAY_WINDOW_SECONDS: z.coerce.number().int().min(30).max(900).default(300),

  SMS_PROVIDER: z.enum(['console', 'sslwireless', 'bulksmsbd', 'twilio']).default('console'),
  SMS_API_KEY: z.string().optional().default(''),
  SMS_SENDER_ID: z.string().default('JONOSHHEBA'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_FROM: z.string().email().default('no-reply@jonoshheba.local'),
  VAPID_PUBLIC_KEY: z.string().optional().default(''),
  VAPID_PRIVATE_KEY: z.string().optional().default(''),
  VAPID_SUBJECT: z.string().optional().default('mailto:ops@jonoshheba.local'),
  FCM_PROJECT_ID: z.string().optional().default(''),
  FCM_CLIENT_EMAIL: z.string().optional().default(''),
  FCM_PRIVATE_KEY: z.string().optional().default(''),

  TURNSTILE_SECRET_KEY: z.string().optional().default(''),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://localhost:4318'),
  SENTRY_DSN: z.string().optional().default(''),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

/** Validates API environment configuration and fails fast on misconfiguration. */
export function loadApiEnv(raw: Record<string, string | undefined> = process.env): ApiEnv {
  const result = apiEnvSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid apps/api environment configuration:\n${issues}`);
  }

  if (result.data.CORS_ORIGINS.includes('*')) {
    throw new Error('Invalid CORS_ORIGINS: wildcard "*" is forbidden when credentials are enabled.');
  }

  if (result.data.NODE_ENV === 'production') {
    if (result.data.JWT_ACCESS_SECRET.startsWith('dev_only_')) {
      throw new Error('Production boot refused: JWT_ACCESS_SECRET uses a development default.');
    }
    if (result.data.JWT_REFRESH_SECRET.startsWith('dev_only_')) {
      throw new Error('Production boot refused: JWT_REFRESH_SECRET uses a development default.');
    }
    if (result.data.AI_SERVICE_JWT_SECRET.startsWith('dev_only_')) {
      throw new Error('Production boot refused: AI_SERVICE_JWT_SECRET uses a development default.');
    }
    if (result.data.CHAT_SESSION_SECRET.startsWith('dev_only_')) {
      throw new Error('Production boot refused: CHAT_SESSION_SECRET uses a development default.');
    }
    if (result.data.WEBHOOK_HMAC_SECRET.startsWith('dev_only_')) {
      throw new Error('Production boot refused: WEBHOOK_HMAC_SECRET uses a development default.');
    }
  }

  return result.data;
}
