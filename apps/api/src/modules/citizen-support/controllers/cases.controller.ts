import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@jonoshheba/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../common/zod-validation.pipe';
import { AuthGuard, type AuthenticatedRequest } from '../../identity/guards/auth.guard';
import { Can, RbacGuard, Roles } from '../../identity/guards/rbac.guard';
import { CasesService } from '../application/cases.service';

const DraftCaseSchema = z.object({
  description: z.string().min(10).max(5000),
  category: z.string().max(64).optional(),
  location: z.string().max(200).optional(),
  title: z.string().max(150).optional(),
});

const EditCaseSchema = z.object({
  userFinalText: z.string().min(10).max(8000),
  title: z.string().max(150).optional(),
});

const ExternalRefSchema = z.object({
  reference: z.string().min(2).max(100),
  channel: z.string().min(2).max(100),
});

const UpdateNoteSchema = z.object({
  note: z.string().min(2).max(2000),
});

const SupportTicketSchema = z.object({
  subject: z.string().min(3).max(160),
  description: z.string().min(10).max(4000),
});

const SupportRespondSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']),
  agentResponse: z.string().min(2).max(4000),
});

@ApiTags('Complaints, Cases & Platform Support')
@Controller('api/v1')
export class CasesController {
  constructor(private readonly cases: CasesService) {}

  @Get('complaint-guides')
  @ApiOperation({ summary: 'List curated official complaint authorities & evidence checklists' })
  listGuides() {
    return { items: this.cases.listGuides() };
  }

  @Post('cases/draft')
  @UseGuards(AuthGuard, RbacGuard)
  @Can('case:manage')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Generate formal Bangla complaint draft & official authority guide (nothing sent externally — Rule R1)',
  })
  createDraft(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(DraftCaseSchema)) body: z.infer<typeof DraftCaseSchema>,
  ) {
    return this.cases.createDraft(req.user!.sub, body);
  }

  @Get('cases')
  @UseGuards(AuthGuard, RbacGuard)
  @Can('case:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List citizen’s own complaint cases (owner-only)' })
  async listCases(@Req() req: AuthenticatedRequest) {
    return { items: await this.cases.listCasesForUser(req.user!.sub) };
  }

  @Get('cases/:id')
  @UseGuards(AuthGuard, RbacGuard)
  @Can('case:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get citizen case detail (owner-only)' })
  getCase(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.cases.getCaseForUser(req.user!.sub, id);
  }

  @Patch('cases/:id')
  @UseGuards(AuthGuard, RbacGuard)
  @Can('case:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit & confirm final complaint text (mandatory before hand-off)' })
  editCase(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(EditCaseSchema)) body: z.infer<typeof EditCaseSchema>,
  ) {
    return this.cases.editCaseFinalText(req.user!.sub, id, body);
  }

  @Post('cases/:id/handoff')
  @UseGuards(AuthGuard, RbacGuard)
  @Can('case:manage')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Prepare official channel hand-off (URL + copy-ready text + printable document)',
  })
  handoff(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.cases.prepareHandoff(req.user!.sub, id);
  }

  @Post('cases/:id/external-reference')
  @UseGuards(AuthGuard, RbacGuard)
  @Can('case:manage')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save external tracking reference obtained from official portal (e.g. GRS)' })
  saveRef(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ExternalRefSchema)) body: z.infer<typeof ExternalRefSchema>,
  ) {
    return this.cases.saveExternalReference(req.user!.sub, id, body);
  }

  @Post('cases/:id/updates')
  @UseGuards(AuthGuard, RbacGuard)
  @Can('case:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record citizen-entered progress update on a tracked case' })
  addUpdate(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateNoteSchema)) body: z.infer<typeof UpdateNoteSchema>,
  ) {
    return this.cases.addUserUpdate(req.user!.sub, id, body);
  }

  @Post('support/tickets')
  @UseGuards(AuthGuard, RbacGuard)
  @Can('me:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Open a Jonoshheba platform support ticket' })
  createSupportTicket(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(SupportTicketSchema)) body: z.infer<typeof SupportTicketSchema>,
  ) {
    return this.cases.createSupportTicket(req.user!.sub, body);
  }

  @Get('admin/support/tickets')
  @UseGuards(AuthGuard, RbacGuard)
  @Roles(Role.PLATFORM_ADMIN, Role.SUPPORT_AGENT)
  @Can('support:respond')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Support agent console: list all platform support tickets (MFA required)' })
  async listSupportTickets() {
    return { items: await this.cases.listAllSupportTickets() };
  }

  @Patch('admin/support/tickets/:id')
  @UseGuards(AuthGuard, RbacGuard)
  @Roles(Role.PLATFORM_ADMIN, Role.SUPPORT_AGENT)
  @Can('support:respond')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Support agent console: respond & update ticket status (MFA required)' })
  respondSupportTicket(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SupportRespondSchema)) body: z.infer<typeof SupportRespondSchema>,
  ) {
    return this.cases.respondSupportTicket(req.user!.sub, id, body);
  }
}
