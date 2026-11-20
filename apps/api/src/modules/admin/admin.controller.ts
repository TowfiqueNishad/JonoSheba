import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@jonoshheba/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import type { AuthenticatedRequest } from '../identity/guards/auth.guard';
import { Roles } from '../identity/guards/rbac.guard';
import { AdminOpsService } from './admin.service';

const ReviewDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  note: z.string().max(500).optional(),
});

@ApiTags('Admin Operations & Intelligence')
@ApiBearerAuth()
@Controller('api/v1/admin')
export class AdminController {
  constructor(private readonly admin: AdminOpsService) {}

  @Get('overview')
  @Roles(
    Role.PLATFORM_ADMIN,
    Role.CONTENT_EDITOR,
    Role.REVIEWER,
    Role.MODERATOR,
    Role.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'Platform operations KPI overview (staff MFA required)' })
  getOverview() {
    return this.admin.getOverview();
  }

  @Get('review-queue')
  @Roles(Role.PLATFORM_ADMIN, Role.CONTENT_EDITOR, Role.REVIEWER, Role.MODERATOR)
  @ApiOperation({ summary: 'Editorial & hotline two-person review queue (staff MFA required)' })
  listReviewQueue(@Query('status') status?: string) {
    return { items: this.admin.listReviewQueue(status) };
  }

  @Post('review-queue/:id/decision')
  @Roles(Role.PLATFORM_ADMIN, Role.REVIEWER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve or reject a queued item (two-person rule: reviewer != author, MFA required)',
  })
  decideReview(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ReviewDecisionSchema)) body: z.infer<typeof ReviewDecisionSchema>,
  ) {
    const reviewerId = req.user!.sub;
    return this.admin.decideReview({
      id,
      reviewerId,
      decision: body.decision,
      note: body.note,
    });
  }

  @Get('providers')
  @Roles(Role.PLATFORM_ADMIN, Role.SUPPORT_AGENT)
  @ApiOperation({
    summary: 'External provider adapters health & integration_type registry (staff MFA required)',
  })
  listProviders() {
    return { providers: this.admin.listProviders() };
  }

  @Get('analytics/regional')
  @Roles(Role.PLATFORM_ADMIN, Role.CONTENT_EDITOR, Role.REVIEWER)
  @ApiOperation({
    summary: 'Privacy-preserving regional analytics enforcing k-anonymity >= 10 (R10, MFA required)',
  })
  getRegionalAnalytics(@Query('k') kParam?: string) {
    const k = kParam ? Number.parseInt(kParam, 10) : 10;
    return this.admin.getRegionalAnalytics(Number.isFinite(k) ? k : 10);
  }

  @Get('ai-ops')
  @Roles(Role.PLATFORM_ADMIN, Role.REVIEWER)
  @ApiOperation({
    summary: 'AI operations: RAG eval metrics, prompts, and MLflow model registry (MFA required)',
  })
  getAiOps() {
    return this.admin.getAiOpsSummary();
  }
}
