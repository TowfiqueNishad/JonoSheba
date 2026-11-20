import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuditLogInterceptor } from './common/audit-log.interceptor';
import { LocaleProjectionInterceptor } from './common/locale-projection.interceptor';
import { LocaleMiddleware } from './common/locale.middleware';
import { GlobalRateLimitMiddleware } from './common/rate-limit.middleware';
import { RequestIdMiddleware } from './common/request-id.middleware';
import { HealthController } from './health/health.controller';
import { AdminModule } from './modules/admin/admin.module';
import { CatalogueModule } from './modules/catalogue/catalogue.module';
import { CitizenSupportModule } from './modules/citizen-support/citizen-support.module';
import { CountryPacksModule } from './modules/country-packs/country-packs.module';
import { CoverageModule } from './modules/coverage/coverage.module';
import { EducationModule } from './modules/education/education.module';
import { GlobalAdminGuard } from './modules/identity/guards/admin-prefix.guard';
import { IdentityModule } from './modules/identity/identity.module';
import { InclusionModule } from './modules/inclusion/inclusion.module';
import { JonoModule } from './modules/jono/jono.module';
import { NotifyModule } from './modules/notify/notify.module';
import { OpportunitiesModule } from './modules/opportunities/opportunities.module';
import { TransportModule } from './modules/transport/transport.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    IdentityModule,
    CoverageModule,
    CatalogueModule,
    TransportModule,
    NotifyModule,
    OpportunitiesModule,
    CitizenSupportModule,
    JonoModule,
    AdminModule,
    InclusionModule,
    CountryPacksModule,
    EducationModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: GlobalAdminGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LocaleProjectionInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware, LocaleMiddleware, GlobalRateLimitMiddleware).forRoutes('*');
  }
}
