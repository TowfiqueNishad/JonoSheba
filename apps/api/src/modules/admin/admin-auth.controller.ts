/**
 * AdminAuthController — HTTP layer for admin authentication.
 * All routes under /api/v1/admin/auth/** are exempt from the citizen JWT guard.
 * Sensitive actions require re-auth.
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { Request, Response } from 'express';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { AdminAuthService } from './admin-auth.service';

const ADMIN_SESSION_COOKIE = 'jono_admin_session';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env['NODE_ENV'] === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 8 * 60 * 60, // 8 hours in seconds
};

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const TotpSchema = z.object({
  pendingToken: z.string().min(1),
  code: z.string().min(4).max(10),
});

const TotpConfirmSchema = z.object({
  secret: z.string().min(16),
  code: z.string().length(6),
});

const BootstrapSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
});

function getAdminSession(req: Request): string | undefined {
  const cookies = (req as any).cookies as Record<string, string> | undefined;
  return cookies?.[ADMIN_SESSION_COOKIE];
}

function getIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim() ?? '0.0.0.0';
  return req.socket?.remoteAddress ?? '0.0.0.0';
}

@ApiTags('Admin Authentication')
@Controller('api/v1/admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuth: AdminAuthService) {}

  /**
   * One-time bootstrap — creates the owner account.
   * Protected by BOOTSTRAP_SECRET env var.
   */
  @Post('bootstrap')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'One-time owner bootstrap (requires BOOTSTRAP_SECRET header)' })
  async bootstrap(
    @Req() req: Request,
    @Body(new ZodValidationPipe(BootstrapSchema)) body: z.infer<typeof BootstrapSchema>,
  ) {
    const secret = req.headers['x-bootstrap-secret'];
    if (!secret || secret !== process.env['ADMIN_BOOTSTRAP_SECRET']) {
      return { error: 'Forbidden' };
    }
    return this.adminAuth.bootstrapOwner(body.email, body.password);
  }

  /**
   * Step 1: email + password → returns pendingToken and whether TOTP is required.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login step 1: email + password' })
  async login(
    @Req() req: Request,
    @Body(new ZodValidationPipe(LoginSchema)) body: z.infer<typeof LoginSchema>,
  ) {
    const ip = getIp(req);
    const ua = (req.headers['user-agent'] ?? '') as string;
    return this.adminAuth.loginStep1(body.email, body.password, ip, ua);
  }

  /**
   * Step 2: verify TOTP → sets jono_admin_session cookie.
   */
  @Post('totp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login step 2: TOTP verification' })
  async verifyTotp(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body(new ZodValidationPipe(TotpSchema)) body: z.infer<typeof TotpSchema>,
  ) {
    const ip = getIp(req);
    const { sessionToken } = await this.adminAuth.loginStep2(body.pendingToken, body.code, ip);
    res.cookie(ADMIN_SESSION_COOKIE, sessionToken, COOKIE_OPTS);
    return { ok: true };
  }

  /**
   * Get current admin user info.
   */
  @Get('me')
  @ApiOperation({ summary: 'Get current admin user' })
  async me(@Req() req: Request) {
    const token = getAdminSession(req);
    if (!token) return { error: 'Not authenticated', code: 401 };
    const session = await this.adminAuth.validateSession(token);
    return this.adminAuth.getMe(session.adminUserId);
  }

  /**
   * Logout — clears session cookie.
   */
  @Delete('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout admin session' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = getAdminSession(req);
    if (token) await this.adminAuth.logout(token);
    res.clearCookie(ADMIN_SESSION_COOKIE, { path: '/' });
    return { ok: true };
  }

  /**
   * Generate TOTP setup info (QR URI + secret).
   */
  @Post('totp/setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate TOTP setup (after password login)' })
  async totpSetup(@Req() req: Request) {
    const token = getAdminSession(req);
    if (!token) return { error: 'Not authenticated', code: 401 };
    const session = await this.adminAuth.validateSession(token).catch(() => null);
    if (!session) return { error: 'Invalid session', code: 401 };
    const me = await this.adminAuth.getMe(session.adminUserId);
    return this.adminAuth.generateTotpSetup(me.email);
  }

  /**
   * Confirm TOTP setup — verifies first code and stores secret.
   */
  @Post('totp/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm TOTP setup and get recovery codes' })
  async totpConfirm(
    @Req() req: Request,
    @Body(new ZodValidationPipe(TotpConfirmSchema)) body: z.infer<typeof TotpConfirmSchema>,
  ) {
    const token = getAdminSession(req);
    if (!token) return { error: 'Not authenticated', code: 401 };
    const session = await this.adminAuth.validateSession(token).catch(() => null);
    if (!session) return { error: 'Invalid session', code: 401 };
    return this.adminAuth.confirmTotpSetup(session.adminUserId, body.secret, body.code);
  }
}
