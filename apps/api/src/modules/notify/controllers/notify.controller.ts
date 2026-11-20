import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import { z } from 'zod';
import { WebhookSecurityGuard } from '../../../common/webhook-security.guard';
import { ZodValidationPipe } from '../../../common/zod-validation.pipe';
import { AuthGuard, type AuthenticatedRequest } from '../../identity/guards/auth.guard';
import { Can, RbacGuard } from '../../identity/guards/rbac.guard';
import { NotifyService } from '../application/notify.service';

const UpdateNotifyPrefsSchema = z.object({
  locale: z.enum(['bn', 'en']).optional(),
  digestFrequency: z.enum(['daily', 'weekly', 'off']).optional(),
  emailAddress: z.string().email().nullable().optional(),
  phoneE164: z.string().max(20).nullable().optional(),
  channels: z
    .object({
      in_app: z.boolean().optional(),
      web_push: z.boolean().optional(),
      mobile_push: z.boolean().optional(),
      email: z.boolean().optional(),
      sms: z.boolean().optional(),
    })
    .optional(),
  quietHours: z
    .object({
      enabled: z.boolean().optional(),
      start: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      end: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    })
    .optional(),
});

const RegisterDeviceSchema = z.object({
  platform: z.enum(['web', 'ios', 'android']),
  pushToken: z.string().min(8).max(512),
  deviceLabel: z.string().max(100).optional(),
});

const FeedbackSchema = z.object({
  isUseful: z.boolean(),
  reason: z.string().max(500).optional(),
});

const SmsDlrSchema = z.object({
  providerMessageId: z.string().min(3),
  status: z.enum(['delivered', 'failed']),
  error: z.string().optional(),
});

@ApiTags('Notifications & Devices')
@Controller('api/v1')
export class NotifyController {
  constructor(private readonly notify: NotifyService) {}

  @Get('notifications')
  @UseGuards(AuthGuard, RbacGuard)
  @Can('me:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List citizen in-app notification inbox (cursor paginated)' })
  listInbox(
    @Req() req: AuthenticatedRequest,
    @Query('cursor') cursor: string | undefined,
    @Query('limit') limit: string | undefined,
  ) {
    return this.notify.listInbox(req.user!.sub, cursor, limit ? Number(limit) : undefined);
  }

  @Sse('notifications/stream')
  @UseGuards(AuthGuard, RbacGuard)
  @Can('me:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Live Server-Sent Events (SSE) stream for in-app notifications' })
  stream(@Req() req: AuthenticatedRequest): Observable<{ data: unknown }> {
    return this.notify.streamForUser(req.user!.sub);
  }

  @Patch('notifications/:id/read')
  @UseGuards(AuthGuard, RbacGuard)
  @Can('me:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark a notification as read (owner-only)' })
  markRead(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.notify.markRead(req.user!.sub, id);
  }

  @Post('notifications/read-all')
  @UseGuards(AuthGuard, RbacGuard)
  @Can('me:manage')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications in inbox as read' })
  markAllRead(@Req() req: AuthenticatedRequest) {
    return this.notify.markAllRead(req.user!.sub);
  }

  @Post('notifications/test')
  @UseGuards(AuthGuard, RbacGuard)
  @Can('me:manage')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send an explicit user-triggered test notification' })
  sendTest(@Req() req: AuthenticatedRequest) {
    return this.notify.sendTestNotification(req.user!.sub);
  }

  @Post('notifications/:id/feedback')
  @UseGuards(AuthGuard, RbacGuard)
  @Can('me:manage')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit useful / not useful notification feedback (ML signal)' })
  submitFeedback(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(FeedbackSchema)) body: z.infer<typeof FeedbackSchema>,
  ) {
    return this.notify.submitFeedback(req.user!.sub, id, body);
  }

  @Get('me/notification-preferences')
  @UseGuards(AuthGuard, RbacGuard)
  @Can('me:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get citizen notification channel & quiet-hour preferences' })
  getPreferences(@Req() req: AuthenticatedRequest) {
    return this.notify.getPreferences(req.user!.sub);
  }

  @Put('me/notification-preferences')
  @UseGuards(AuthGuard, RbacGuard)
  @Can('me:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update notification channel opt-ins & Asia/Dhaka quiet hours' })
  updatePreferences(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(UpdateNotifyPrefsSchema))
    body: z.infer<typeof UpdateNotifyPrefsSchema>,
  ) {
    return this.notify.updatePreferences(req.user!.sub, body as never);
  }

  @Post('me/devices')
  @UseGuards(AuthGuard, RbacGuard)
  @Can('me:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register web/mobile push notification token' })
  registerDevice(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(RegisterDeviceSchema)) body: z.infer<typeof RegisterDeviceSchema>,
  ) {
    return this.notify.registerDevice(req.user!.sub, body);
  }

  @Delete('me/devices/:id')
  @UseGuards(AuthGuard, RbacGuard)
  @Can('me:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unregister a push device (owner-only)' })
  deleteDevice(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.notify.deleteDevice(req.user!.sub, id);
  }

  @Post('webhooks/sms/:provider/dlr')
  @UseGuards(WebhookSecurityGuard)
  @ApiSecurity('webhook-hmac')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Signature, timestamp & IP-verified SMS Delivery Receipt (DLR) webhook' })
  handleSmsDlr(
    @Req() req: Request & { webhookDuplicate?: boolean; webhookMessageId?: string },
    @Param('provider') provider: string,
    @Headers('x-webhook-signature') signature: string | undefined,
    @Body(new ZodValidationPipe(SmsDlrSchema)) body: z.infer<typeof SmsDlrSchema>,
  ) {
    if (req.webhookDuplicate) {
      return { updated: false, duplicate: true, messageId: req.webhookMessageId };
    }
    return this.notify.handleSmsDlrWebhook({
      provider,
      signatureHeader: signature,
      rawPayload: JSON.stringify(body),
      providerMessageId: body.providerMessageId,
      status: body.status,
      error: body.error,
      signatureAlreadyVerified: true,
    });
  }
}
