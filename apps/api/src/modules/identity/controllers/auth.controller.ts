import { randomBytes } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../common/zod-validation.pipe';
import { AuthService, type AuthTokenBundle } from '../application/auth.service';
import {
  ACCESS_COOKIE_NAME,
  AuthGuard,
  CSRF_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  type AuthenticatedRequest,
} from '../guards/auth.guard';

const PlatformEnum = z.enum(['web', 'ios', 'android']).default('web');

const OtpRequestSchema = z.object({
  phone: z.string().min(10).max(20),
  locale: z.enum(['bn', 'en']).optional(),
  turnstileToken: z.string().optional(),
});

const OtpVerifySchema = z.object({
  phone: z.string().min(10).max(20),
  code: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
  deviceId: z.string().min(2).max(128).default('default-device'),
  platform: PlatformEnum,
  guestUserId: z.string().uuid().optional(),
});

const EmailRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(100).optional(),
  locale: z.enum(['bn', 'en']).optional(),
  deviceId: z.string().min(2).max(128).default('default-device'),
  platform: PlatformEnum,
  guestUserId: z.string().uuid().optional(),
});

const EmailLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
  deviceId: z.string().min(2).max(128).default('default-device'),
  platform: PlatformEnum,
});

const TokenOnlySchema = z.object({ token: z.string().min(8) });

const ForgotPasswordSchema = z.object({ email: z.string().email() });

const ResetPasswordSchema = z.object({
  token: z.string().min(8),
  newPassword: z.string().min(8).max(128),
});

const OAuthSchema = z.object({
  idToken: z.string().min(8),
  deviceId: z.string().min(2).max(128).default('default-device'),
  platform: PlatformEnum,
});

const GuestSchema = z.object({
  deviceId: z.string().min(2).max(128).default('guest-device'),
  platform: PlatformEnum,
  locale: z.enum(['bn', 'en']).optional(),
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(16).optional(),
});

const MfaVerifySchema = z.object({
  code: z.string().min(6).max(12),
});

function setWebAuthCookies(res: Response, bundle: AuthTokenBundle, platform: string): void {
  if (platform !== 'web') return;
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(ACCESS_COOKIE_NAME, bundle.accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: bundle.expiresIn * 1000,
    path: '/',
  });
  res.cookie(REFRESH_COOKIE_NAME, bundle.refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/api/v1/auth',
  });
  res.cookie(CSRF_COOKIE_NAME, randomBytes(16).toString('hex'), {
    httpOnly: false,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

@ApiTags('Auth & JWKS')
@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('.well-known/jwks.json')
  @ApiOperation({ summary: 'Public EdDSA JWKS for JWT verification (bn: পাবলিক JWKS কী)' })
  @ApiOkResponse({ description: 'JSON Web Key Set' })
  getRootJwks() {
    return this.auth.getJwks();
  }

  @Get('api/v1/.well-known/jwks.json')
  @ApiOperation({ summary: 'Versioned public JWKS endpoint' })
  getVersionedJwks() {
    return this.auth.getJwks();
  }

  @Post('api/v1/auth/otp/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request 6-digit Bangladesh phone OTP (bn: মোবাইলে ওটিপি কোড পাঠান)',
  })
  @ApiBody({
    schema: {
      example: {
        phone: '+8801712345678',
        locale: 'bn',
        turnstileToken: 'optional-cf-turnstile-token',
      },
    },
  })
  requestOtp(
    @Body(new ZodValidationPipe(OtpRequestSchema)) body: z.infer<typeof OtpRequestSchema>,
    @Req() req: Request,
  ) {
    return this.auth.requestOtp({
      phone: body.phone,
      locale: body.locale,
      turnstileToken: body.turnstileToken,
      ip: req.ip,
    });
  }

  @Post('api/v1/auth/otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify phone OTP & issue EdDSA access + rotating refresh tokens (bn: ওটিপি যাচাই)',
  })
  @ApiBody({
    schema: {
      example: {
        phone: '+8801712345678',
        code: '123456',
        deviceId: 'pixel-7-dhaka',
        platform: 'web',
      },
    },
  })
  async verifyOtp(
    @Body(new ZodValidationPipe(OtpVerifySchema)) body: z.infer<typeof OtpVerifySchema>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const bundle = await this.auth.verifyOtp({
      phone: body.phone,
      code: body.code,
      deviceId: body.deviceId,
      platform: body.platform,
      guestUserId: body.guestUserId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    setWebAuthCookies(res, bundle, body.platform);
    return bundle;
  }

  @Post('api/v1/auth/register')
  @ApiOperation({ summary: 'Register with email & password (Argon2id) (bn: ইমেইল নিবন্ধন)' })
  async register(
    @Body(new ZodValidationPipe(EmailRegisterSchema)) body: z.infer<typeof EmailRegisterSchema>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const bundle = await this.auth.registerEmail({
      ...body,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    setWebAuthCookies(res, bundle, body.platform);
    return bundle;
  }

  @Post('api/v1/auth/email/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email address via token (bn: ইমেইল যাচাই)' })
  verifyEmail(@Body(new ZodValidationPipe(TokenOnlySchema)) body: z.infer<typeof TokenOnlySchema>) {
    return this.auth.verifyEmail(body.token);
  }

  @Post('api/v1/auth/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email & password (bn: ইমেইল লগইন)' })
  async login(
    @Body(new ZodValidationPipe(EmailLoginSchema)) body: z.infer<typeof EmailLoginSchema>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const bundle = await this.auth.loginEmail({
      ...body,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    setWebAuthCookies(res, bundle, body.platform);
    return bundle;
  }

  @Post('api/v1/auth/password/forgot')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset token (bn: পাসওয়ার্ড রিসেট অনুরোধ)' })
  forgotPassword(
    @Body(new ZodValidationPipe(ForgotPasswordSchema)) body: z.infer<typeof ForgotPasswordSchema>,
  ) {
    return this.auth.forgotPassword(body.email);
  }

  @Post('api/v1/auth/password/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password & revoke all active sessions (bn: পাসওয়ার্ড পরিবর্তন)' })
  resetPassword(
    @Body(new ZodValidationPipe(ResetPasswordSchema)) body: z.infer<typeof ResetPasswordSchema>,
  ) {
    return this.auth.resetPassword(body.token, body.newPassword);
  }

  @Post('api/v1/auth/oauth/:provider')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'OAuth2/OIDC login (Google; pluggable National Digital ID) (bn: ওঅথ লগইন)',
  })
  async oauthLogin(
    @Param('provider') provider: string,
    @Body(new ZodValidationPipe(OAuthSchema)) body: z.infer<typeof OAuthSchema>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const bundle = await this.auth.oauthLogin({
      provider,
      idToken: body.idToken,
      deviceId: body.deviceId,
      platform: body.platform,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    setWebAuthCookies(res, bundle, body.platform);
    return bundle;
  }

  @Post('api/v1/auth/guest')
  @ApiOperation({
    summary: 'Create anonymous guest session upgradable later (bn: অতিথি সেশন শুরু করুন)',
  })
  async guestSession(
    @Body(new ZodValidationPipe(GuestSchema)) body: z.infer<typeof GuestSchema>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const bundle = await this.auth.createGuestSession({
      deviceId: body.deviceId,
      platform: body.platform,
      locale: body.locale,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    setWebAuthCookies(res, bundle, body.platform);
    return bundle;
  }

  @Post('api/v1/auth/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate refresh token with reuse detection (bn: টোকেন নবায়ন)',
  })
  async refresh(
    @Body(new ZodValidationPipe(RefreshSchema)) body: z.infer<typeof RefreshSchema>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookies = (req as unknown as { cookies?: Record<string, string> }).cookies ?? {};
    const token = body.refreshToken ?? cookies[REFRESH_COOKIE_NAME] ?? '';
    const bundle = await this.auth.refreshTokens({
      refreshToken: token,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    if (cookies[REFRESH_COOKIE_NAME]) {
      setWebAuthCookies(res, bundle, 'web');
    }
    return bundle;
  }

  @Post('api/v1/auth/logout')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke current session & clear cookies (bn: লগআউট)' })
  async logout(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    res.clearCookie(ACCESS_COOKIE_NAME, { path: '/' });
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' });
    res.clearCookie(CSRF_COOKIE_NAME, { path: '/' });
    return this.auth.logout(req.user!.sid);
  }

  @Post('api/v1/auth/mfa/setup')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Setup TOTP MFA + 8 backup codes (mandatory for staff/partners) (bn: এমএফএ সেটআপ)',
  })
  setupMfa(@Req() req: AuthenticatedRequest) {
    return this.auth.setupMfa(req.user!.sub);
  }

  @Post('api/v1/auth/mfa/verify')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify TOTP or backup code & upgrade session (bn: এমএফএ যাচাই)' })
  verifyMfa(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(MfaVerifySchema)) body: z.infer<typeof MfaVerifySchema>,
  ) {
    return this.auth.verifyMfa({
      userId: req.user!.sub,
      sessionId: req.user!.sid,
      code: body.code,
    });
  }
}
