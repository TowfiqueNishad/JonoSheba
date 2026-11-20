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
import { CoverageOpsService, type ImportBatchJob } from './coverage-ops.service';

const AssignGapSchema = z.object({
  editorId: z.string().min(2).max(64),
});

const ImportUploadSchema = z.object({
  sourceId: z.string().min(3).max(64),
  sourceUrl: z.string().url(),
  submittedBy: z.string().min(2).max(64).optional(),
  rawContent: z.string().min(4).max(200000),
});

@ApiTags('Admin Coverage Dashboard & Import Studio (C12–C13)')
@ApiBearerAuth()
@Controller('api/v1/admin')
export class CoverageOpsController {
  constructor(private readonly ops: CoverageOpsService) {}

  @Get('coverage/heatmap')
  @Roles(Role.PLATFORM_ADMIN, Role.CONTENT_EDITOR, Role.REVIEWER)
  @ApiOperation({
    summary: 'Districts × Categories coverage heatmap & loaded vs reference counts (Rule C2/C4)',
  })
  heatmap() {
    return this.ops.getHeatmap();
  }

  @Get('coverage/gaps')
  @Roles(Role.PLATFORM_ADMIN, Role.CONTENT_EDITOR, Role.REVIEWER)
  @ApiOperation({ summary: 'Open missing/stale coverage gaps queue with suggested official sources' })
  gaps(@Query('severity') severity?: string) {
    return this.ops.listGaps(severity);
  }

  @Post('coverage/gaps/:id/assign')
  @Roles(Role.PLATFORM_ADMIN, Role.CONTENT_EDITOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign a district/category coverage gap to an editor or NGO partner' })
  assignGap(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AssignGapSchema)) body: z.infer<typeof AssignGapSchema>,
  ) {
    return this.ops.assignGap(id, body.editorId);
  }

  @Get('coverage/sources')
  @Roles(Role.PLATFORM_ADMIN, Role.CONTENT_EDITOR, Role.REVIEWER)
  @ApiOperation({ summary: 'Registered data sources health, licences (ODbL/BBS) & freshness SLAs' })
  sources() {
    return this.ops.getSources();
  }

  @Get('coverage/quality')
  @Roles(Role.PLATFORM_ADMIN, Role.CONTENT_EDITOR, Role.REVIEWER)
  @ApiOperation({
    summary: 'Automated data quality audit (missing Bangla C8, stale SLA C5, BD coords, +880 phones)',
  })
  quality() {
    return this.ops.runQualityAudit();
  }

  @Get('coverage/releases')
  @Roles(Role.PLATFORM_ADMIN, Role.CONTENT_EDITOR, Role.REVIEWER)
  @ApiOperation({ summary: 'Weekly data-ops coverage release notes' })
  releases() {
    return this.ops.getReleases();
  }

  @Get('import/jobs')
  @Roles(Role.PLATFORM_ADMIN, Role.CONTENT_EDITOR, Role.REVIEWER)
  @ApiOperation({ summary: 'List submitted Import Studio batch jobs awaiting human review' })
  importJobs() {
    return this.ops.listImportJobs();
  }

  @Post('import/:kind')
  @Roles(Role.PLATFORM_ADMIN, Role.CONTENT_EDITOR)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Import timetable / fares / citizen-charter / notice / csv / geojson into PENDING_REVIEW queue',
  })
  importData(
    @Req() req: AuthenticatedRequest,
    @Param('kind') kind: ImportBatchJob['kind'],
    @Body(new ZodValidationPipe(ImportUploadSchema)) body: z.infer<typeof ImportUploadSchema>,
  ) {
    return this.ops.createImportJob({
      kind,
      sourceId: body.sourceId,
      sourceUrl: body.sourceUrl,
      submittedBy: body.submittedBy ?? req.user!.sub,
      rawContent: body.rawContent,
    });
  }
}
