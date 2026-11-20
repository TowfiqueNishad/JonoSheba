import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

// Load monorepo root .env first, then app-local .env if present
for (const envPath of [resolve(__dirname, '../../../.env'), resolve(process.cwd(), '.env')]) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ProblemDetailsFilter } from './common/problem-details.filter';
import { loadApiEnv } from './config/env';
import { setPublishedOpenApiDocument } from './health/health.controller';

export function buildCorsOriginValidator(allowedOrigins: readonly string[]) {
  const allowSet = new Set(allowedOrigins.map((o) => o.replace(/\/+$/, '')));
  return (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow non-browser / same-origin requests without an Origin header
    if (!origin) {
      callback(null, true);
      return;
    }
    const normalized = origin.replace(/\/+$/, '');
    if (allowSet.has(normalized)) {
      callback(null, true);
      return;
    }
    // Allow matching Vercel preview/production deployments when deployed on Vercel
    if (process.env.VERCEL && /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(normalized)) {
      callback(null, true);
      return;
    }
    // Allow configured custom mobile URI schemes (e.g., jonoshheba://)
    for (const allowed of allowSet) {
      if (allowed.endsWith('://') && normalized.startsWith(allowed)) {
        callback(null, true);
        return;
      }
    }
    callback(null, false);
  };
}

export async function createConfiguredExpressApp() {
  const env = loadApiEnv();
  const app = await NestFactory.create(AppModule);

  app.use(
    helmet({
      hsts: { maxAge: 31536000, includeSubDomains: true },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      frameguard: { action: 'deny' },
    }),
  );
  app.use(cookieParser());
  app.enableCors({
    origin: buildCorsOriginValidator(env.CORS_ORIGINS),
    credentials: true,
    exposedHeaders: [
      'X-Request-Id',
      'Content-Language',
      'Vary',
      'RateLimit-Limit',
      'RateLimit-Remaining',
      'RateLimit-Reset',
      'RateLimit-Policy',
      'Retry-After',
      'ETag',
      'Deprecation',
      'Sunset',
      'Link',
    ],
  });
  app.useGlobalFilters(new ProblemDetailsFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Jonoshheba AI API (জনসেবা AI)')
    .setDescription(
      'Independent citizen-service discovery, guidance, notification, and tracking API for Bangladesh. Not an official government service.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .addApiKey(
      { type: 'apiKey', name: 'X-Session-Token', in: 'header' },
      'chat-session-token',
    )
    .addApiKey(
      { type: 'apiKey', name: 'X-Webhook-Signature', in: 'header' },
      'webhook-hmac',
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  setPublishedOpenApiDocument(document as unknown as Record<string, unknown>);
  SwaggerModule.setup('api/docs', app, document);

  await app.init();
  return { app, env, expressInstance: app.getHttpAdapter().getInstance() };
}

let cachedServerlessHandler: ((req: unknown, res: unknown) => void) | null = null;

export async function handleServerlessRequest(req: unknown, res: unknown): Promise<void> {
  if (!cachedServerlessHandler) {
    // Default to staging safety checks on zero-config Vercel deployments unless explicit production secrets are set
    if (process.env.VERCEL && !process.env.JWT_ACCESS_SECRET) {
      process.env.NODE_ENV = 'staging';
    }
    const { expressInstance } = await createConfiguredExpressApp();
    cachedServerlessHandler = expressInstance as (req: unknown, res: unknown) => void;
  }
  cachedServerlessHandler(req, res);
}

async function bootstrap(): Promise<void> {
  const { app, env } = await createConfiguredExpressApp();
  await app.listen(env.API_PORT, env.API_HOST);
  console.info(
    `[jonoshheba-api] listening on http://${env.API_HOST}:${env.API_PORT} (health: /health, docs: /api/docs)`,
  );
}

if (require.main === module) {
  void bootstrap();
}
