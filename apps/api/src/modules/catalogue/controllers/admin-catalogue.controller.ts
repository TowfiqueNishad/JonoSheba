import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@jonoshheba/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../common/zod-validation.pipe';
import { AuthGuard, type AuthenticatedRequest } from '../../identity/guards/auth.guard';
import { Can, RbacGuard, Roles } from '../../identity/guards/rbac.guard';
import { CatalogueService } from '../application/catalogue.service';

const CreateDraftServiceSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  titleBn: z.string().min(2),
  titleEn: z.string().min(2),
  summaryBn: z.string().min(5),
  summaryEn: z.string().min(5),
  agencySlug: z.string().min(2),
  categorySlug: z.string().min(2),
  officialUrl: z.string().url(),
  feeInfo: z.object({ bn: z.string(), en: z.string() }),
  processingTime: z.string().min(1),
  sourceUrl: z.string().url(),
  sourceAgency: z.string().min(2),
  aliases: z.array(z.string()).optional(),
});

const PublishSchema = z.object({
  changeSummary: z.string().min(3).max(500).default('Verified and published'),
});

@ApiTags('Admin Content Lifecycle')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
@Controller('api/v1/admin')
export class AdminCatalogueController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Post('services')
  @Roles(Role.PLATFORM_ADMIN, Role.CONTENT_EDITOR)
  @Can('service:write')
  @ApiOperation({ summary: 'Create a draft service (requires MFA + content_editor)' })
  createDraft(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(CreateDraftServiceSchema))
    body: z.infer<typeof CreateDraftServiceSchema>,
  ) {
    return this.catalogue.createDraftService(req.user!.sub, body);
  }

  @Post('services/:slug/submit-review')
  @Roles(Role.PLATFORM_ADMIN, Role.CONTENT_EDITOR)
  @Can('service:write')
  @ApiOperation({ summary: 'Submit draft service for independent peer review' })
  submitReview(@Param('slug') slug: string, @Req() req: AuthenticatedRequest) {
    return this.catalogue.submitServiceForReview(slug, req.user!.sub);
  }

  @Post('services/:slug/publish')
  @Roles(Role.PLATFORM_ADMIN, Role.REVIEWER)
  @Can('service:publish')
  @ApiOperation({ summary: 'Publish reviewed service (enforces reviewer !== author & creates version)' })
  publish(
    @Param('slug') slug: string,
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(PublishSchema)) body: z.infer<typeof PublishSchema>,
  ) {
    return this.catalogue.publishService(slug, req.user!.sub, body.changeSummary);
  }

  @Post('services/:slug/archive')
  @Roles(Role.PLATFORM_ADMIN, Role.REVIEWER)
  @Can('service:publish')
  @ApiOperation({ summary: 'Archive a published service' })
  archive(@Param('slug') slug: string) {
    return this.catalogue.archiveService(slug);
  }

  @Get('reviews')
  @Roles(Role.PLATFORM_ADMIN, Role.REVIEWER)
  @Can('service:publish')
  @ApiOperation({ summary: 'List open content & freshness review tasks' })
  listReviewTasks() {
    return this.catalogue.listReviewTasks();
  }

  @Get('search/zero-results')
  @Roles(Role.PLATFORM_ADMIN, Role.CONTENT_EDITOR, Role.REVIEWER)
  @ApiOperation({ summary: 'List zero-result citizen search queries logged as content gaps' })
  listZeroResultSearchGaps() {
    return this.catalogue.listZeroResultSearchGaps();
  }
}
