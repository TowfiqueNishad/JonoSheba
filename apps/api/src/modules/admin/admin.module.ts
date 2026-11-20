import { Module } from '@nestjs/common';
import { CoverageModule } from '../coverage/coverage.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminController } from './admin.controller';
import { AdminAuthController } from './admin-auth.controller';
import { AdminOpsService } from './admin.service';
import { AdminAuthService } from './admin-auth.service';

@Module({
  imports: [CoverageModule, PrismaModule],
  controllers: [AdminController, AdminAuthController],
  providers: [AdminOpsService, AdminAuthService],
  exports: [AdminOpsService, AdminAuthService],
})
export class AdminModule {}
