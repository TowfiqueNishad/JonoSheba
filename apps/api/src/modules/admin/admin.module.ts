import { Module } from '@nestjs/common';
import { CoverageModule } from '../coverage/coverage.module';
import { AdminController } from './admin.controller';
import { AdminOpsService } from './admin.service';

@Module({
  imports: [CoverageModule],
  controllers: [AdminController],
  providers: [AdminOpsService],
  exports: [AdminOpsService],
})
export class AdminModule {}
