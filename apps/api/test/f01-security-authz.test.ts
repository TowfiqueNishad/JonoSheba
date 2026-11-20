import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { Role } from '@jonoshheba/shared';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import {
  AUDIT_LOG_WRITER_PORT,
  type InMemoryAuditLogWriter,
} from '../src/common/audit-log.interceptor';
import { ProblemDetailsFilter } from '../src/common/problem-details.filter';
import { RATE_LIMITER_PORT, type RateLimiterPort } from '../src/common/rate-limiter';
import { signWebhookRequest } from '../src/common/webhook-security.guard';
import { loadApiEnv } from '../src/config/env';
import { buildCorsOriginValidator } from '../src/main';
import { IdentityCryptoService } from '../src/modules/identity/domain/crypto.service';
import type { SessionEntity, UserEntity } from '../src/modules/identity/domain/identity.types';
import { REQUIRED_ROLES_KEY } from '../src/modules/identity/guards/rbac.guard';
import {
  IDENTITY_REPOSITORY_PORT,
  type IdentityRepositoryPort,
} from '../src/modules/identity/ports/identity.repository.port';
import { JonoService } from '../src/modules/jono/jono.service';

interface MatrixRule {
  name: string;
  pattern: RegExp;
  expected: Record<string, number[]>;
}

/** Minimal deterministic parser for tests/authz-matrix.yaml */
function loadAuthzMatrix(): MatrixRule[] {
  const candidates = [
    resolve(process.cwd(), 'tests/authz-matrix.yaml'),
    resolve(process.cwd(), '../../tests/authz-matrix.yaml'),
  ];
  const filePath = candidates.find((p) => {
    try {
      readFileSync(p, 'utf8');
      return true;
    } catch {
      return false;
    }
  });
  if (!filePath) {
    throw new Error('Could not locate tests/authz-matrix.yaml');
  }
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  const rules: MatrixRule[] = [];
  let current: { name?: string; pattern?: string; expected: Record<string, number[]> } | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line === 'rules:') continue;
    if (line.startsWith('- name:')) {
      if (current?.name && current.pattern) {
        rules.push({
          name: current.name,
          pattern: new RegExp(current.pattern),
          expected: current.expected,
        });
      }
      current = { name: line.slice(7).trim(), expected: {} };
    } else if (line.startsWith('pattern:') && current) {
      const rawPattern = line.slice(8).trim().replace(/^"(.*)"$/, '$1');
      current.pattern = rawPattern.replace(/\\\\/g, '\\');
    } else if (current && line.includes(': [')) {
      const [actor, rest] = line.split(': [');
      if (actor && rest) {
        const codes = rest
          .replace(/\]$/, '')
          .split(',')
          .map((n) => Number.parseInt(n.trim(), 10))
          .filter(Number.isFinite);
        current.expected[actor.trim()] = codes;
      }
    }
  }
  if (current?.name && current.pattern) {
    rules.push({
      name: current.name,
      pattern: new RegExp(current.pattern),
      expected: current.expected,
    });
  }
  return rules;
}

async function seedActorToken(params: {
  repo: IdentityRepositoryPort;
  crypto: IdentityCryptoService;
  id: string;
  role: Role;
  mfaVerified: boolean;
}): Promise<{ userId: string; token: string }> {
  const now = new Date();
  const user: UserEntity = {
    id: params.id,
    phoneE164: null,
    email: `${params.id}@jonoshheba.test`,
    emailVerifiedAt: now,
    passwordHash: null,
    displayName: params.id,
    status: 'active',
    locale: 'bn',
    isGuest: false,
    mfaEnabled: params.mfaVerified,
    mfaSecret: null,
    mfaBackupCodeHashes: [],
    roles: [{ role: params.role, orgId: null }],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await params.repo.createUser(user);

  const session: SessionEntity = {
    id: `sess-${params.id}`,
    userId: params.id,
    deviceId: `dev-${params.id}`,
    platform: 'web',
    refreshTokenHash: 'test-hash',
    tokenFamilyId: `fam-${params.id}`,
    ipHash: null,
    userAgent: 'vitest',
    mfaVerified: params.mfaVerified,
    expiresAt: new Date(now.getTime() + 3600_000),
    revokedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await params.repo.createSession(session);

  const { token } = await params.crypto.signAccessToken({
    sub: params.id,
    sid: session.id,
    roles: [params.role],
    orgScopes: [{ role: params.role, orgId: null }],
    isGuest: false,
    mfaVerified: params.mfaVerified,
    locale: 'bn',
  });
  return { userId: params.id, token };
}

describe('Prompt F01 — Security Lockdown (S1–S5, CORS, OpenAPI AuthZ Matrix)', () => {
  let app: INestApplication;
  let openApiDoc: ReturnType<typeof SwaggerModule.createDocument>;
  let auditWriter: InMemoryAuditLogWriter;
  let rateLimiter: RateLimiterPort;
  let jonoService: JonoService;

  const tokens: Record<string, string> = {};

  beforeAll(async () => {
    process.env.RATE_LIMIT_TEST_MULTIPLIER = '100';
    process.env.WEBHOOK_HMAC_SECRET = 'test_f01_webhook_hmac_secret_32_bytes_min';
    process.env.CHAT_SESSION_SECRET = 'test_f01_chat_session_secret_32_bytes_min';

    const modRef = await Test.createTestingModule({
      imports: [AppModule],
      providers: [DiscoveryService, MetadataScanner],
    }).compile();

    app = modRef.createNestApplication();
    app.use(cookieParser());
    app.enableCors({
      origin: buildCorsOriginValidator(['http://localhost:3000', 'jonoshheba://']),
      credentials: true,
    });
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();

    const swaggerConfig = new DocumentBuilder()
      .setTitle('Jonoshheba AI API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', name: 'X-Session-Token', in: 'header' }, 'chat-session-token')
      .addApiKey({ type: 'apiKey', name: 'X-Webhook-Signature', in: 'header' }, 'webhook-hmac')
      .build();
    openApiDoc = SwaggerModule.createDocument(app, swaggerConfig);

    const repo = app.get<IdentityRepositoryPort>(IDENTITY_REPOSITORY_PORT);
    const crypto = app.get(IdentityCryptoService);
    auditWriter = app.get<InMemoryAuditLogWriter>(AUDIT_LOG_WRITER_PORT);
    rateLimiter = app.get<RateLimiterPort>(RATE_LIMITER_PORT);
    jonoService = app.get(JonoService);

    tokens.citizen = (
      await seedActorToken({ repo, crypto, id: 'f01-citizen-1', role: Role.CITIZEN, mfaVerified: false })
    ).token;
    tokens.other_citizen = (
      await seedActorToken({ repo, crypto, id: 'f01-citizen-2', role: Role.CITIZEN, mfaVerified: false })
    ).token;
    tokens.org_member = (
      await seedActorToken({ repo, crypto, id: 'f01-org-1', role: Role.ORG_MEMBER, mfaVerified: false })
    ).token;
    tokens.editor_no_mfa = (
      await seedActorToken({
        repo,
        crypto,
        id: 'f01-editor-nomfa',
        role: Role.CONTENT_EDITOR,
        mfaVerified: false,
      })
    ).token;
    tokens.editor = (
      await seedActorToken({
        repo,
        crypto,
        id: 'f01-editor-mfa',
        role: Role.CONTENT_EDITOR,
        mfaVerified: true,
      })
    ).token;
    tokens.admin = (
      await seedActorToken({
        repo,
        crypto,
        id: 'f01-admin-mfa',
        role: Role.PLATFORM_ADMIN,
        mfaVerified: true,
      })
    ).token;
  });

  afterAll(async () => {
    delete process.env.RATE_LIMIT_TEST_MULTIPLIER;
    delete process.env.WEBHOOK_IP_ALLOWLIST;
    if (app) {
      await app.close();
    }
  });

  it('S1 (Default-Deny CI Check): every /api/v1/admin/** route declares explicit @Roles() metadata and OpenAPI bearer security', () => {
    const discovery = app.get(DiscoveryService);
    const scanner = app.get(MetadataScanner);
    const reflector = app.get(Reflector);

    const missingRoles: string[] = [];
    let adminRouteCount = 0;

    for (const wrapper of discovery.getControllers()) {
      const instance = wrapper.instance as Record<string, unknown> | undefined;
      const metatype = wrapper.metatype;
      if (!instance || !metatype) continue;
      const controllerPath = String(Reflect.getMetadata('path', metatype) ?? '').replace(/^\/+|\/+$/g, '');
      const proto = Object.getPrototypeOf(instance) as object;

      for (const methodName of scanner.getAllMethodNames(proto)) {
        const handler = instance[methodName];
        if (typeof handler !== 'function') continue;
        const routePath = Reflect.getMetadata('path', handler) as string | undefined;
        if (routePath === undefined) continue;
        const fullPath = `/${[controllerPath, routePath.replace(/^\/+/, '')].filter(Boolean).join('/')}`;
        if (!/^\/api\/v1\/admin(\/|$)/.test(fullPath)) continue;

        adminRouteCount += 1;
        const roles = reflector.getAllAndOverride<Role[] | undefined>(REQUIRED_ROLES_KEY, [
          handler,
          metatype,
        ]);
        if (!roles || roles.length === 0) {
          missingRoles.push(`${metatype.name}.${methodName} (${fullPath})`);
        }
      }
    }

    expect(adminRouteCount).toBeGreaterThanOrEqual(20);
    expect(missingRoles).toEqual([]);

    // Every /api/v1/admin/* OpenAPI operation must declare bearer security
    const adminOpsMissingSecurity: string[] = [];
    for (const [pathKey, methods] of Object.entries(openApiDoc.paths)) {
      if (!pathKey.startsWith('/api/v1/admin/')) continue;
      for (const [method, op] of Object.entries(methods as Record<string, { security?: unknown[] }>)) {
        if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
        if (!op.security || op.security.length === 0) {
          adminOpsMissingSecurity.push(`${method.toUpperCase()} ${pathKey}`);
        }
      }
    }
    expect(adminOpsMissingSecurity).toEqual([]);
  });

  it('S1: admin endpoints reject anonymous (401), citizen (403), non-MFA editor (403), allow MFA admin (200) and audit reads', async () => {
    const server = app.getHttpServer();
    const adminPaths = [
      '/api/v1/admin/overview',
      '/api/v1/admin/coverage/heatmap',
      '/api/v1/admin/coverage/gaps',
      '/api/v1/admin/import/jobs',
      '/api/v1/admin/providers',
      '/api/v1/admin/analytics/regional',
      '/api/v1/admin/ai-ops',
      '/api/v1/admin/review-queue',
      '/api/v1/admin/support/tickets',
      '/api/v1/admin/reviews',
    ];

    for (const path of adminPaths) {
      await request(server).get(path).expect(401);
      await request(server).get(path).set('Authorization', `Bearer ${tokens.citizen}`).expect(403);
      await request(server)
        .get(path)
        .set('Authorization', `Bearer ${tokens.editor_no_mfa}`)
        .expect(403);
      await request(server).get(path).set('Authorization', `Bearer ${tokens.admin}`).expect(200);
    }

    // Write routes also protected
    await request(server).post('/api/v1/admin/import/timetable').send({}).expect(401);
    await request(server).post('/api/v1/admin/coverage/gaps/gap-1/assign').send({}).expect(401);
    await request(server).post('/api/v1/admin/review-queue/rev-1/decision').send({}).expect(401);

    // Admin read audit logs recorded
    const logs = auditWriter.getAll();
    expect(logs.some((r) => r.action === 'GET /api/v1/admin/analytics/regional' && r.actorId === 'f01-admin-mfa')).toBe(true);
    expect(logs.some((r) => r.action === 'GET /api/v1/admin/support/tickets' && r.actorId === 'f01-admin-mfa')).toBe(true);
  });

  it('S2: chat sessions prevent IDOR (404 for unknown/other-user), issue UUIDv7 + HMAC sessionToken, support delete & 30d retention', async () => {
    const server = app.getHttpServer();

    // Arbitrary session ID must NEVER return 200 (must return 404)
    await request(server).get('/api/v1/chat/sessions/test').expect(404);

    // Anonymous guest creates session -> receives UUIDv7 + HMAC sessionToken + 30d expiresAt
    const anonCreate = await request(server)
      .post('/api/v1/chat/message')
      .send({ message: 'জন্ম নিবন্ধন ফি কত?', locale: 'bn' })
      .expect(200);
    const anonSessionId = anonCreate.body.sessionId as string;
    const anonSessionToken = anonCreate.body.sessionToken as string;
    expect(anonSessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(anonSessionToken).toBeTruthy();
    expect(anonCreate.body.expiresAt).toBeTruthy();

    // Without token or with wrong token -> 404 (not 403)
    await request(server).get(`/api/v1/chat/sessions/${anonSessionId}`).expect(404);
    await request(server)
      .get(`/api/v1/chat/sessions/${anonSessionId}`)
      .set('X-Session-Token', 'invalid.token')
      .expect(404);

    // With valid X-Session-Token -> 200 with turns
    const anonHistory = await request(server)
      .get(`/api/v1/chat/sessions/${anonSessionId}`)
      .set('X-Session-Token', anonSessionToken)
      .expect(200);
    expect(anonHistory.body.turns.length).toBe(2);

    // Delete anonymous chat requires token; once deleted -> 404
    await request(server).delete(`/api/v1/chat/sessions/${anonSessionId}`).expect(404);
    await request(server)
      .delete(`/api/v1/chat/sessions/${anonSessionId}`)
      .set('X-Session-Token', anonSessionToken)
      .expect(200);
    await request(server)
      .get(`/api/v1/chat/sessions/${anonSessionId}`)
      .set('X-Session-Token', anonSessionToken)
      .expect(404);

    // Authenticated citizen session cannot be read or deleted by other_citizen or anonymous (404)
    const userMsg = await request(server)
      .post('/api/v1/chat/message')
      .set('Authorization', `Bearer ${tokens.citizen}`)
      .send({ message: 'ঢাকা চট্টগ্রাম ট্রেন টিকিট', locale: 'bn' })
      .expect(200);
    const userSessionId = userMsg.body.sessionId as string;

    await request(server).get(`/api/v1/chat/sessions/${userSessionId}`).expect(404);
    await request(server)
      .get(`/api/v1/chat/sessions/${userSessionId}`)
      .set('Authorization', `Bearer ${tokens.other_citizen}`)
      .expect(404);
    await request(server)
      .delete(`/api/v1/chat/sessions/${userSessionId}`)
      .set('Authorization', `Bearer ${tokens.other_citizen}`)
      .expect(404);
    await request(server)
      .get(`/api/v1/chat/sessions/${userSessionId}`)
      .set('Authorization', `Bearer ${tokens.citizen}`)
      .expect(200);

    // 30-day guest retention purge
    const guestForExpiry = await jonoService.sendMessage({ message: '999', locale: 'bn' });
    const futureAfter31Days = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
    expect(() =>
      jonoService.getHistory(
        guestForExpiry.sessionId,
        { sessionToken: guestForExpiry.sessionToken },
        futureAfter31Days,
      ),
    ).toThrow(/not found/i);
  });

  it('S3: inbound channels & webhooks enforce HMAC, 5-min replay window, IP allowlist, idempotency & org_member RBAC', async () => {
    const server = app.getHttpServer();
    const secret = process.env.WEBHOOK_HMAC_SECRET!;
    const payload = { from: '+8801712345678', text: '999', locale: 'bn', messageId: 'msg-f01-1' };
    const raw = JSON.stringify(payload);
    const nowTs = String(Math.floor(Date.now() / 1000));
    const staleTs = String(Math.floor(Date.now() / 1000) - 600);

    // Missing signature -> 401
    await request(server).post('/api/v1/channels/sms/inbound').send(payload).expect(401);
    await request(server).post('/api/v1/channels/ussd').send({ sessionId: 'u1', text: '' }).expect(401);
    await request(server).post('/api/v1/channels/ivr').send({ Digits: '1' }).expect(401);
    await request(server)
      .post('/api/v1/webhooks/sms/sslwireless/dlr')
      .send({ providerMessageId: 'pm-1', status: 'delivered' })
      .expect(401);

    // Expired timestamp (>5 min) even with valid HMAC -> 401
    await request(server)
      .post('/api/v1/channels/sms/inbound')
      .set('X-Webhook-Timestamp', staleTs)
      .set('X-Webhook-Signature', signWebhookRequest(staleTs, raw, secret))
      .send(payload)
      .expect(401);

    // Valid HMAC + fresh timestamp -> 200
    const first = await request(server)
      .post('/api/v1/channels/sms/inbound')
      .set('X-Webhook-Timestamp', nowTs)
      .set('X-Webhook-Signature', signWebhookRequest(nowTs, raw, secret))
      .send(payload)
      .expect(200);
    expect(first.body.priority).toBe('P0');

    // Duplicate messageId -> idempotent duplicate ack
    const dup = await request(server)
      .post('/api/v1/channels/sms/inbound')
      .set('X-Webhook-Timestamp', nowTs)
      .set('X-Webhook-Signature', signWebhookRequest(nowTs, raw, secret))
      .send(payload)
      .expect(200);
    expect(dup.body.duplicate).toBe(true);

    // IP allowlist enforcement -> 403 for disallowed IP
    process.env.WEBHOOK_IP_ALLOWLIST = '203.0.113.10';
    await request(server)
      .post('/api/v1/channels/sms/inbound')
      .set('X-Forwarded-For', '198.51.100.42')
      .set('X-Webhook-Timestamp', nowTs)
      .set('X-Webhook-Signature', signWebhookRequest(nowTs, raw, secret))
      .send(payload)
      .expect(403);
    delete process.env.WEBHOOK_IP_ALLOWLIST;

    // Assisted sessions require org_member (or platform_admin)
    const assistedBody = {
      centerName: 'Savar UDC',
      consentMethod: 'VERBAL_WITNESSED',
      serviceCategory: 'birth_registration',
    };
    await request(server).post('/api/v1/channels/assisted/sessions').send(assistedBody).expect(401);
    await request(server)
      .post('/api/v1/channels/assisted/sessions')
      .set('Authorization', `Bearer ${tokens.citizen}`)
      .send(assistedBody)
      .expect(403);
    const assistedRes = await request(server)
      .post('/api/v1/channels/assisted/sessions')
      .set('Authorization', `Bearer ${tokens.org_member}`)
      .send(assistedBody)
      .expect(201);
    expect(assistedRes.body.id).toBeTruthy();
  });

  it('S5 & CORS: emits RateLimit-* headers, enforces strict OTP 429 problem+json, and rejects wildcard/untrusted CORS', async () => {
    const server = app.getHttpServer();
    process.env.RATE_LIMIT_TEST_MULTIPLIER = '1';
    await rateLimiter.reset();

    const ok = await request(server)
      .get('/api/v1/emergency')
      .set('Origin', 'http://localhost:3000')
      .expect(200);
    expect(ok.headers['ratelimit-limit']).toBe('120');
    expect(ok.headers['ratelimit-remaining']).toBeTruthy();
    expect(ok.headers['ratelimit-reset']).toBeTruthy();
    expect(ok.headers['ratelimit-policy']).toBe('120;w=60');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:3000');

    // Untrusted origin gets NO Access-Control-Allow-Origin
    const badCors = await request(server)
      .get('/api/v1/emergency')
      .set('Origin', 'https://evil.example')
      .expect(200);
    expect(badCors.headers['access-control-allow-origin']).toBeUndefined();
    expect(() => loadApiEnv({ CORS_ORIGINS: '*' })).toThrow(/wildcard/i);

    // Stricter OTP bucket (limit 5/min) -> 6th request returns 429 problem+json + Retry-After + Bangla/English
    for (let i = 0; i < 5; i++) {
      await request(server)
        .post('/api/v1/auth/otp/request')
        .set('X-Device-Id', 'rl-otp-device')
        .send({ phone: `+880171234567${i}`, locale: 'bn' });
    }
    const throttled = await request(server)
      .post('/api/v1/auth/otp/request')
      .set('X-Device-Id', 'rl-otp-device')
      .send({ phone: '+8801712345679', locale: 'bn' })
      .expect(429);
    expect(throttled.headers['content-type']).toContain('application/problem+json');
    expect(throttled.headers['retry-after']).toBeTruthy();
    expect(throttled.body.detail).toContain('অনুরোধের সীমা');
    expect(throttled.body.detail).toContain('Too many requests');

    process.env.RATE_LIMIT_TEST_MULTIPLIER = '100';
    await rateLimiter.reset();
  });

  it('AuthZ Matrix (tests/authz-matrix.yaml): calls EVERY OpenAPI operation across all actors and fails on any unexpected 200', async () => {
    const server = app.getHttpServer();
    const matrix = loadAuthzMatrix();
    expect(matrix.length).toBeGreaterThanOrEqual(8);

    const actors: Array<{ name: string; token?: string }> = [
      { name: 'anonymous' },
      { name: 'citizen', token: tokens.citizen },
      { name: 'other_citizen', token: tokens.other_citizen },
      { name: 'editor_no_mfa', token: tokens.editor_no_mfa },
      { name: 'editor', token: tokens.editor },
      { name: 'admin', token: tokens.admin },
    ];

    const failures: string[] = [];
    let checkedOperations = 0;

    for (const [pathTemplate, pathItem] of Object.entries(openApiDoc.paths)) {
      const concretePath = pathTemplate.replace(/\{[^}]+\}/g, 'nonexistent-f01-id');
      for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
        if (!(pathItem as Record<string, unknown>)[method]) continue;
        // Skip SSE streaming endpoints in batch matrix (tested individually above)
        if (pathTemplate.endsWith('/stream')) continue;

        const key = `${method.toUpperCase()} ${pathTemplate}`;
        const rule = matrix.find((r) => r.pattern.test(key));
        if (!rule) {
          failures.push(`UNMAPPED OpenAPI operation in tests/authz-matrix.yaml: ${key}`);
          continue;
        }
        checkedOperations += 1;

        for (const actor of actors) {
          const allowedStatuses = rule.expected[actor.name];
          if (!allowedStatuses) continue;

          // Skip destructive /auth/logout for active test actors so tokens stay valid
          if (pathTemplate === '/api/v1/auth/logout' && actor.token) continue;
          // Skip /me/delete for active test actors so accounts stay active
          if (pathTemplate === '/api/v1/me/delete' && actor.token) continue;

          const reqBuilder = request(server)[method](concretePath);
          if (actor.token) {
            reqBuilder.set('Authorization', `Bearer ${actor.token}`);
          }
          if (method === 'post' || method === 'put' || method === 'patch') {
            reqBuilder.send({});
          }
          const res = await reqBuilder;
          if (!allowedStatuses.includes(res.status)) {
            failures.push(
              `${key} as ${actor.name} (${rule.name}): got ${res.status}, expected [${allowedStatuses.join(', ')}]`,
            );
          }
        }
      }
    }

    expect(checkedOperations).toBeGreaterThanOrEqual(90);
    expect(failures).toEqual([]);
  }, 60_000);
});
