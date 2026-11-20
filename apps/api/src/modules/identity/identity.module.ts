import { Global, Module } from '@nestjs/common';
import {
  AUDIT_LOG_WRITER_PORT,
  AuditLogInterceptor,
  InMemoryAuditLogWriter,
} from '../../common/audit-log.interceptor';
import { RATE_LIMITER_PORT, SlidingWindowRateLimiter } from '../../common/rate-limiter';
import { WebhookSecurityGuard } from '../../common/webhook-security.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { InMemoryIdentityRepository } from './adapters/in-memory-identity.repository';
import { GoogleOAuthAdapter, NationalDigitalIdStubAdapter } from './adapters/oauth.adapters';
import { PrismaIdentityRepository } from './adapters/prisma-identity.repository';
import { ConsoleSmsAdapter } from './adapters/sms.adapters';
import { CloudflareTurnstileAdapter } from './adapters/turnstile.adapter';
import { AuthService } from './application/auth.service';
import { MeService } from './application/me.service';
import { AuthController } from './controllers/auth.controller';
import { MeController } from './controllers/me.controller';
import { IdentityCryptoService } from './domain/crypto.service';
import { PolicyService } from './domain/policy.service';
import { GlobalAdminGuard } from './guards/admin-prefix.guard';
import { AuthGuard } from './guards/auth.guard';
import { RbacGuard } from './guards/rbac.guard';
import { IDENTITY_REPOSITORY_PORT } from './ports/identity.repository.port';
import { OAUTH_PROVIDERS_PORT } from './ports/oauth.port';
import { SMS_PORT } from './ports/sms.port';
import { TURNSTILE_PORT } from './ports/turnstile.port';

@Global()
@Module({
  controllers: [AuthController, MeController],
  providers: [
    IdentityCryptoService,
    PolicyService,
    AuthService,
    MeService,
    AuthGuard,
    RbacGuard,
    GlobalAdminGuard,
    WebhookSecurityGuard,
    InMemoryIdentityRepository,
    PrismaIdentityRepository,
    ConsoleSmsAdapter,
    CloudflareTurnstileAdapter,
    GoogleOAuthAdapter,
    NationalDigitalIdStubAdapter,
    SlidingWindowRateLimiter,
    InMemoryAuditLogWriter,
    AuditLogInterceptor,
    {
      provide: IDENTITY_REPOSITORY_PORT,
      useFactory: (inMem: InMemoryIdentityRepository, prisma: PrismaService) => {
        if (process.env.IDENTITY_STORAGE === 'prisma') {
          return new PrismaIdentityRepository(prisma);
        }
        return inMem;
      },
      inject: [InMemoryIdentityRepository, PrismaService],
    },
    { provide: SMS_PORT, useExisting: ConsoleSmsAdapter },
    { provide: TURNSTILE_PORT, useExisting: CloudflareTurnstileAdapter },
    { provide: RATE_LIMITER_PORT, useExisting: SlidingWindowRateLimiter },
    { provide: AUDIT_LOG_WRITER_PORT, useExisting: InMemoryAuditLogWriter },
    {
      provide: OAUTH_PROVIDERS_PORT,
      useFactory: (google: GoogleOAuthAdapter, nid: NationalDigitalIdStubAdapter) => [google, nid],
      inject: [GoogleOAuthAdapter, NationalDigitalIdStubAdapter],
    },
  ],
  exports: [
    IdentityCryptoService,
    PolicyService,
    AuthGuard,
    RbacGuard,
    GlobalAdminGuard,
    WebhookSecurityGuard,
    IDENTITY_REPOSITORY_PORT,
    AUDIT_LOG_WRITER_PORT,
    RATE_LIMITER_PORT,
    SMS_PORT,
  ],
})
export class IdentityModule {}
