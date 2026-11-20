import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Role } from '@jonoshheba/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { WebhookSecurityGuard } from '../../common/webhook-security.guard';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { AuthGuard, type AuthenticatedRequest } from '../identity/guards/auth.guard';
import { Can, RbacGuard, Roles } from '../identity/guards/rbac.guard';
import { InclusionService } from './inclusion.service';

const SmsInboundSchema = z.object({
  from: z.string().min(6).max(20),
  text: z.string().min(1).max(320),
  locale: z.enum(['bn', 'en']).optional(),
  messageId: z.string().min(2).max(128).optional(),
});

const UssdSchema = z.object({
  sessionId: z.string().min(2).max(128),
  text: z.string().max(128).default(''),
  locale: z.enum(['bn', 'en']).optional(),
  messageId: z.string().min(2).max(128).optional(),
});

const IvrSchema = z.object({
  Digits: z.string().max(4).optional(),
  From: z.string().max(24).optional(),
  messageId: z.string().min(2).max(128).optional(),
});

const AssistedSessionSchema = z.object({
  operatorId: z.string().min(2).max(64).optional(),
  centerName: z.string().min(2).max(160),
  consentMethod: z.enum(['VERBAL_WITNESSED', 'OTP_SMS', 'SIGNED_PAPER']),
  serviceCategory: z.string().min(2).max(64),
});

type WebhookRequest = Request & { webhookDuplicate?: boolean; webhookMessageId?: string };

@ApiTags('Low-Connectivity & Inclusion Channels')
@Controller('api/v1/channels')
export class InclusionController {
  constructor(private readonly inclusion: InclusionService) {}

  @Post('sms/inbound')
  @UseGuards(WebhookSecurityGuard)
  @ApiSecurity('webhook-hmac')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'HMAC-verified SMS bot webhook (keywords: 999, TRAIN, SERVICE, BHATA, STOP)',
  })
  inboundSms(
    @Req() req: WebhookRequest,
    @Body(new ZodValidationPipe(SmsInboundSchema)) body: z.infer<typeof SmsInboundSchema>,
  ) {
    if (req.webhookDuplicate) {
      return { duplicate: true, accepted: true, messageId: req.webhookMessageId };
    }
    return this.inclusion.handleInboundSms(body);
  }

  @Post('ussd')
  @UseGuards(WebhookSecurityGuard)
  @ApiSecurity('webhook-hmac')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'HMAC-verified USSD menu session handler (CON/END stateful responses)' })
  ussd(
    @Req() req: WebhookRequest,
    @Body(new ZodValidationPipe(UssdSchema)) body: z.infer<typeof UssdSchema>,
  ) {
    if (req.webhookDuplicate) {
      return { duplicate: true, accepted: true, messageId: req.webhookMessageId };
    }
    return this.inclusion.handleUssd(body);
  }

  @Post('ivr')
  @UseGuards(WebhookSecurityGuard)
  @ApiSecurity('webhook-hmac')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @ApiOperation({ summary: 'HMAC-verified IVR TwiML voice menu (digit 1 -> immediate 999 guidance)' })
  ivr(
    @Req() req: WebhookRequest,
    @Body(new ZodValidationPipe(IvrSchema)) body: z.infer<typeof IvrSchema>,
  ) {
    if (req.webhookDuplicate) {
      return '<?xml version="1.0" encoding="UTF-8"?><Response/>';
    }
    return this.inclusion.buildIvrTwiml(body.Digits);
  }

  @Post('assisted/sessions')
  @UseGuards(AuthGuard, RbacGuard)
  @Roles(Role.ORG_MEMBER, Role.PLATFORM_ADMIN)
  @Can('assisted:session')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Start consent-tracked Assisted Mode session (requires org_member role)',
  })
  createAssisted(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(AssistedSessionSchema))
    body: z.infer<typeof AssistedSessionSchema>,
  ) {
    return this.inclusion.createAssistedSession({
      operatorId: req.user!.sub,
      centerName: body.centerName,
      consentMethod: body.consentMethod,
      serviceCategory: body.serviceCategory,
    });
  }

  @Get('assisted/sessions/:id')
  @UseGuards(AuthGuard, RbacGuard)
  @Roles(Role.ORG_MEMBER, Role.PLATFORM_ADMIN)
  @Can('assisted:session')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Assisted Mode session metadata (owner org_member or admin)' })
  getAssisted(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const sess = this.inclusion.getAssistedSession(id);
    const isAdmin = req.user!.roles.includes(Role.PLATFORM_ADMIN);
    if (!isAdmin && sess.operatorId !== req.user!.sub) {
      throw new NotFoundException(`Assisted session '${id}' not found`);
    }
    return sess;
  }
}
