import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@jonoshheba/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../common/zod-validation.pipe';
import { resolveLocale } from '../../catalogue/domain/http-helpers';
import { AuthGuard, type AuthenticatedRequest } from '../../identity/guards/auth.guard';
import { Can, RbacGuard, Roles } from '../../identity/guards/rbac.guard';
import { OpportunitiesService } from '../application/opportunities.service';

const EvaluateSchema = z.object({
  need: z.enum(['benefits', 'scholarships', 'all']).optional(),
  slugs: z.array(z.string()).optional(),
  answers: z.record(z.unknown()).default({}),
  evaluationDate: z.string().datetime().optional(),
});

const WizardNextSchema = z.object({
  need: z.enum(['benefits', 'scholarships', 'all']).optional(),
  answers: z.record(z.unknown()).default({}),
  evaluationDate: z.string().datetime().optional(),
});

const SaveChecklistSchema = z.object({
  targetType: z.enum(['program', 'scholarship', 'job', 'service']),
  targetSlug: z.string().min(1).max(128),
  titleBn: z.string().min(1).max(200),
  titleEn: z.string().min(1).max(200),
  deadlineAt: z.string().datetime().nullable().optional(),
  applicationUrl: z.string().url(),
  documents: z.array(z.string()).default([]),
});

const ParseCircularSchema = z.object({
  rawText: z.string().min(20),
  sourceUrl: z.string().url(),
  organizationEn: z.string().min(2),
  organizationBn: z.string().optional(),
});

@ApiTags('Benefits, Scholarships, Jobs & Deterministic Eligibility Engine')
@Controller('api/v1')
export class OpportunitiesController {
  constructor(private readonly opportunities: OpportunitiesService) {}

  @Get('programs')
  @ApiOperation({ summary: 'List government benefit & allowance programs (bn: সরকারি ভাতা কর্মসূচি)' })
  async listPrograms(
    @Query('category') category: string | undefined,
    @Query('region') region: string | undefined,
    @Query('deadline_before') deadlineBefore: string | undefined,
    @Query('open_now') openNow: string | undefined,
  ) {
    return {
      items: await this.opportunities.listPrograms({
        category,
        region,
        deadlineBefore: deadlineBefore ? new Date(deadlineBefore) : undefined,
        openNow: openNow === 'true',
      }),
    };
  }

  @Get('programs/:slug')
  @ApiOperation({ summary: 'Get benefit program detail with verified official URL' })
  getProgram(@Param('slug') slug: string) {
    return this.opportunities.getProgram(slug);
  }

  @Get('scholarships')
  @ApiOperation({ summary: 'List government scholarships & stipends (bn: শিক্ষাবৃত্তি ও উপবৃত্তি)' })
  async listScholarships(
    @Query('level') level: string | undefined,
    @Query('region') region: string | undefined,
    @Query('deadline_before') deadlineBefore: string | undefined,
    @Query('open_now') openNow: string | undefined,
  ) {
    return {
      items: await this.opportunities.listScholarships({
        level,
        region,
        deadlineBefore: deadlineBefore ? new Date(deadlineBefore) : undefined,
        openNow: openNow === 'true',
      }),
    };
  }

  @Get('scholarships/:slug')
  @ApiOperation({ summary: 'Get scholarship detail' })
  getScholarship(@Param('slug') slug: string) {
    return this.opportunities.getScholarship(slug);
  }

  @Get('jobs')
  @ApiOperation({ summary: 'List verified public job circulars (bn: সরকারি চাকরির বিজ্ঞপ্তি)' })
  async listJobs(
    @Query('grade') grade: string | undefined,
    @Query('region') region: string | undefined,
    @Query('deadline_before') deadlineBefore: string | undefined,
    @Query('open_now') openNow: string | undefined,
  ) {
    return {
      items: await this.opportunities.listJobs({
        grade,
        region,
        deadlineBefore: deadlineBefore ? new Date(deadlineBefore) : undefined,
        openNow: openNow === 'true',
      }),
    };
  }

  @Get('jobs/:slug')
  @ApiOperation({ summary: 'Get public job circular detail' })
  getJob(@Param('slug') slug: string) {
    return this.opportunities.getJob(slug);
  }

  @Post('eligibility/wizard/next')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Adaptive information-gain eligibility wizard (stateless, deterministic JSON-Logic, never LLM-decided)',
  })
  wizardNext(@Body(new ZodValidationPipe(WizardNextSchema)) body: z.infer<typeof WizardNextSchema>) {
    return this.opportunities.nextWizardStep({
      need: body.need,
      answers: body.answers,
      evaluationDate: body.evaluationDate ? new Date(body.evaluationDate) : undefined,
    });
  }

  @Post('eligibility/evaluate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Evaluate eligibility deterministically with bilingual reasons & official source citations (Rule R7)',
  })
  evaluate(@Body(new ZodValidationPipe(EvaluateSchema)) body: z.infer<typeof EvaluateSchema>) {
    return this.opportunities.evaluateEligibility({
      need: body.need,
      slugs: body.slugs,
      answers: body.answers,
      evaluationDate: body.evaluationDate ? new Date(body.evaluationDate) : undefined,
    });
  }

  @Get('me/checklists')
  @UseGuards(AuthGuard, RbacGuard)
  @Can('me:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List citizen saved document checklists' })
  async listChecklists(@Req() req: AuthenticatedRequest) {
    return { items: await this.opportunities.listChecklists(req.user!.sub) };
  }

  @Post('me/checklists')
  @UseGuards(AuthGuard, RbacGuard)
  @Can('me:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Save a document checklist for a program/scholarship/job/service' })
  saveChecklist(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(SaveChecklistSchema)) body: z.infer<typeof SaveChecklistSchema>,
  ) {
    return this.opportunities.saveChecklist(req.user!.sub, {
      ...body,
      deadlineAt: body.deadlineAt ? new Date(body.deadlineAt) : null,
    });
  }

  @Delete('me/checklists/:id')
  @UseGuards(AuthGuard, RbacGuard)
  @Can('me:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a saved checklist (owner-only)' })
  deleteChecklist(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.opportunities.deleteChecklist(req.user!.sub, id);
  }

  @Get('me/deadlines')
  @UseGuards(AuthGuard, RbacGuard)
  @Can('me:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deadline Radar: saved program, scholarship & job deadlines' })
  getDeadlines(
    @Req() req: AuthenticatedRequest,
    @Headers('accept-language') lang: string | undefined,
  ) {
    return this.opportunities.getDeadlineRadar(req.user!.sub, resolveLocale(lang));
  }

  @Get('me/deadlines.ics')
  @UseGuards(AuthGuard, RbacGuard)
  @Can('me:manage')
  @ApiBearerAuth()
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="jonoshheba-deadlines.ics"')
  @ApiOperation({ summary: 'Export Deadline Radar as an RFC 5545 iCalendar (.ics) file' })
  exportDeadlinesIcs(
    @Req() req: AuthenticatedRequest,
    @Headers('accept-language') lang: string | undefined,
  ) {
    return this.opportunities.exportDeadlinesIcs(req.user!.sub, resolveLocale(lang));
  }

  @Post('admin/jobs/parse-circular')
  @UseGuards(AuthGuard, RbacGuard)
  @Roles(Role.PLATFORM_ADMIN, Role.CONTENT_EDITOR)
  @Can('service:write')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Extract structured draft job circular from circular text/PDF (human-in-the-loop review)',
  })
  parseCircular(
    @Body(new ZodValidationPipe(ParseCircularSchema)) body: z.infer<typeof ParseCircularSchema>,
  ) {
    return this.opportunities.parseJobCircularDraft(body);
  }
}
