import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Sse,
  type MessageEvent,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { from, map, type Observable } from 'rxjs';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { resolveLocale } from '../catalogue/domain/http-helpers';
import { IdentityCryptoService } from '../identity/domain/crypto.service';
import { ACCESS_COOKIE_NAME } from '../identity/guards/auth.guard';
import {
  IDENTITY_REPOSITORY_PORT,
  type IdentityRepositoryPort,
} from '../identity/ports/identity.repository.port';
import { JonoService } from './jono.service';

const ChatMessageSchema = z.object({
  message: z.string().min(1).max(4000),
  sessionId: z.string().min(4).max(128).optional(),
  locale: z.enum(['bn', 'en']).optional(),
});

const ChatFeedbackSchema = z.object({
  sessionId: z.string().min(4).max(128),
  turnId: z.string().min(4).max(128),
  rating: z.enum(['up', 'down']),
  reason: z.string().max(500).optional(),
});

@ApiTags('Jono AI Assistant')
@Controller(['api/v1/assistant', 'api/v1/chat'])
export class JonoController {
  constructor(
    private readonly jono: JonoService,
    private readonly crypto: IdentityCryptoService,
    @Inject(IDENTITY_REPOSITORY_PORT)
    private readonly identityRepo: IdentityRepositoryPort,
  ) {}

  /** Resolves verified authenticated user ID if a valid active JWT is supplied (never trusts raw headers) */
  private async resolveOptionalUserId(req: Request): Promise<string | undefined> {
    const authHeader = req.headers.authorization;
    const cookies = (req as unknown as { cookies?: Record<string, string> }).cookies ?? {};
    let token: string | null = null;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else if (typeof cookies[ACCESS_COOKIE_NAME] === 'string') {
      token = cookies[ACCESS_COOKIE_NAME];
    }
    if (!token) return undefined;

    try {
      const claims = await this.crypto.verifyAccessToken(token);
      const session = await this.identityRepo.findSessionById(claims.sid);
      if (!session || session.revokedAt !== null || session.expiresAt <= new Date()) {
        return undefined;
      }
      return claims.sub;
    } catch {
      return undefined;
    }
  }

  @Post('message')
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: 'X-Session-Token',
    required: false,
    description: 'HMAC token required when continuing an anonymous session',
  })
  @ApiOperation({
    summary: 'Send a message to Jono (grounded RAG + tools + emergency fast-path)',
  })
  async sendMessage(
    @Req() req: Request & { locale?: 'bn' | 'en' },
    @Body(new ZodValidationPipe(ChatMessageSchema)) body: z.infer<typeof ChatMessageSchema>,
    @Headers('accept-language') acceptLanguage?: string,
    @Headers('x-session-token') sessionToken?: string,
  ) {
    const explicitLocale = body.locale ?? (acceptLanguage ? resolveLocale(acceptLanguage) : undefined);
    const userId = await this.resolveOptionalUserId(req);
    return this.jono.sendMessage({
      message: body.message,
      userId,
      sessionToken: sessionToken?.trim() || undefined,
      sessionId: body.sessionId,
      locale: explicitLocale,
    });
  }

  @Sse('stream')
  @ApiHeader({
    name: 'X-Session-Token',
    required: false,
    description: 'HMAC token required when continuing an anonymous session',
  })
  @ApiOperation({ summary: 'Stream a grounded Jono response via Server-Sent Events (SSE)' })
  streamMessage(
    @Req() req: Request,
    @Query('message') message: string,
    @Query('sessionId') sessionId?: string,
    @Query('locale') locale?: 'bn' | 'en',
    @Headers('x-session-token') sessionToken?: string,
  ): Observable<MessageEvent> {
    const text = (message ?? '').trim() || 'হ্যালো';
    return from(
      this.resolveOptionalUserId(req).then((userId) =>
        this.jono
          .sendMessage({
            message: text,
            userId,
            sessionToken: sessionToken?.trim() || undefined,
            sessionId,
            locale,
          })
          .then((res) => {
            const words = res.reply.split(' ');
            const events: Array<{ type: string; data: unknown }> = [];
            for (let i = 0; i < words.length; i += 6) {
              events.push({
                type: 'delta',
                data: { chunk: `${words.slice(i, i + 6).join(' ')} ` },
              });
            }
            events.push({
              type: 'done',
              data: res,
            });
            return events;
          }),
      ),
    ).pipe(
      map((events) => ({
        type: 'jono_stream',
        data: events,
      })),
    );
  }

  @Get('sessions/:sessionId')
  @ApiBearerAuth()
  @ApiSecurity('chat-session-token')
  @ApiOperation({
    summary: 'Retrieve owned chat session history (requires JWT owner or X-Session-Token; 404 otherwise)',
  })
  async getHistory(
    @Req() req: Request,
    @Param('sessionId') sessionId: string,
    @Headers('x-session-token') sessionToken?: string,
  ) {
    const userId = await this.resolveOptionalUserId(req);
    return this.jono.getHistory(sessionId, {
      userId,
      sessionToken: sessionToken?.trim() || undefined,
    });
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiSecurity('chat-session-token')
  @ApiOperation({
    summary: 'Delete my chat session (requires JWT owner or X-Session-Token; 404 otherwise)',
  })
  async deleteSession(
    @Req() req: Request,
    @Param('sessionId') sessionId: string,
    @Headers('x-session-token') sessionToken?: string,
  ) {
    const userId = await this.resolveOptionalUserId(req);
    return this.jono.deleteSession(sessionId, {
      userId,
      sessionToken: sessionToken?.trim() || undefined,
    });
  }

  @Post('feedback')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiSecurity('chat-session-token')
  @ApiOperation({ summary: 'Submit thumbs up/down feedback on an owned Jono turn' })
  async submitFeedback(
    @Req() req: Request,
    @Body(new ZodValidationPipe(ChatFeedbackSchema)) body: z.infer<typeof ChatFeedbackSchema>,
    @Headers('x-session-token') sessionToken?: string,
  ) {
    const userId = await this.resolveOptionalUserId(req);
    return this.jono.submitFeedback({
      sessionId: body.sessionId,
      userId,
      sessionToken: sessionToken?.trim() || undefined,
      turnId: body.turnId,
      rating: body.rating,
      reason: body.reason,
    });
  }
}
