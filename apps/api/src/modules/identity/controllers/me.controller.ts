import {
  Body,
  Controller,
  Delete,
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
import { z } from 'zod';
import { ZodValidationPipe } from '../../../common/zod-validation.pipe';
import { MeService } from '../application/me.service';
import type { ConsentPurpose } from '../domain/identity.types';
import { AuthGuard, type AuthenticatedRequest } from '../guards/auth.guard';
import { Can, RbacGuard } from '../guards/rbac.guard';

const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  locale: z.enum(['bn', 'en']).optional(),
});

const UpdatePreferencesSchema = z.object({
  language: z.enum(['bn', 'en']).optional(),
  numeralStyle: z.enum(['bn', 'en']).optional(),
  notificationChannels: z
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
  accessibility: z
    .object({
      font_scale: z.number().min(100).max(200).optional(),
      high_contrast: z.boolean().optional(),
      voice_first: z.boolean().optional(),
      low_data: z.boolean().optional(),
    })
    .optional(),
});

const UpdateProfileHintsSchema = z.object({
  ageBand: z.string().max(32).nullable().optional(),
  divisionId: z.string().uuid().nullable().optional(),
  districtId: z.string().uuid().nullable().optional(),
  upazilaId: z.string().uuid().nullable().optional(),
  occupationBand: z.string().max(64).nullable().optional(),
  studentLevel: z.string().max(48).nullable().optional(),
  hasDisability: z.boolean().nullable().optional(),
});

const GrantConsentSchema = z.object({
  purpose: z.enum([
    'profile_hint_age_band',
    'profile_hint_location',
    'profile_hint_occupation',
    'profile_hint_student_level',
    'profile_hint_disability',
    'assistant_long_term_memory',
    'notifications_sms',
    'notifications_email',
  ]),
  version: z.string().min(1).max(24).default('1.0'),
});

@ApiTags('Me (Profile, Preferences, Consents & Privacy)')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
@Controller('api/v1/me')
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get()
  @Can('me:manage')
  @ApiOperation({ summary: 'Get authenticated citizen profile (bn: নিজের প্রোফাইল দেখুন)' })
  getProfile(@Req() req: AuthenticatedRequest) {
    return this.me.getProfile(req.user!.sub);
  }

  @Patch()
  @Can('me:manage')
  @ApiOperation({ summary: 'Update display name or default locale (bn: প্রোফাইল হালনাগাদ)' })
  updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(UpdateProfileSchema)) body: z.infer<typeof UpdateProfileSchema>,
  ) {
    return this.me.updateProfile(req.user!.sub, body);
  }

  @Get('preferences')
  @Can('me:manage')
  @ApiOperation({
    summary: 'Get language, quiet hours & accessibility preferences (bn: পছন্দসমূহ)',
  })
  getPreferences(@Req() req: AuthenticatedRequest) {
    return this.me.getPreferences(req.user!.sub);
  }

  @Patch('preferences')
  @Can('me:manage')
  @ApiOperation({ summary: 'Update user preferences (bn: পছন্দসমূহ পরিবর্তন)' })
  updatePreferences(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(UpdatePreferencesSchema))
    body: z.infer<typeof UpdatePreferencesSchema>,
  ) {
    return this.me.updatePreferences(req.user!.sub, {
      language: body.language,
      numeralStyle: body.numeralStyle,
      notificationChannels: body.notificationChannels as never,
      quietHours: body.quietHours as never,
      accessibility: body.accessibility as never,
    });
  }

  @Get('profile-hints')
  @Can('me:manage')
  @ApiOperation({
    summary:
      'Get optional consented profile hints with bilingual purpose_bn/purpose_en explanations (Rule R9)',
  })
  getProfileHints(@Req() req: AuthenticatedRequest) {
    return this.me.getProfileHints(req.user!.sub);
  }

  @Patch('profile-hints')
  @Can('me:manage')
  @ApiOperation({
    summary: 'Update optional profile hints (requires active consent per field, Rule R9)',
  })
  updateProfileHints(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(UpdateProfileHintsSchema))
    body: z.infer<typeof UpdateProfileHintsSchema>,
  ) {
    return this.me.updateProfileHints(req.user!.sub, body);
  }

  @Get('consents')
  @Can('me:manage')
  @ApiOperation({ summary: 'List citizen consent history (bn: সম্মতির তালিকা)' })
  listConsents(@Req() req: AuthenticatedRequest) {
    return this.me.listConsents(req.user!.sub);
  }

  @Post('consents')
  @Can('me:manage')
  @ApiOperation({ summary: 'Grant explicit consent for a specific purpose (bn: সম্মতি প্রদান)' })
  grantConsent(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(GrantConsentSchema)) body: z.infer<typeof GrantConsentSchema>,
  ) {
    return this.me.grantConsent(req.user!.sub, body.purpose as ConsentPurpose, body.version, req.ip);
  }

  @Delete('consents/:id')
  @Can('me:manage')
  @ApiOperation({
    summary: 'Withdraw consent & automatically clear linked profile hints (bn: সম্মতি প্রত্যাহার)',
  })
  withdrawConsent(@Req() req: AuthenticatedRequest, @Param('id') consentId: string) {
    return this.me.withdrawConsent(req.user!.sub, consentId);
  }

  @Get('sessions')
  @Can('me:manage')
  @ApiOperation({ summary: 'List active device sessions (bn: সক্রিয় ডিভাইস তালিকা)' })
  listSessions(@Req() req: AuthenticatedRequest) {
    return this.me.listSessions(req.user!.sub, req.user!.sid);
  }

  @Delete('sessions/:sessionId')
  @Can('me:manage')
  @ApiOperation({ summary: 'Revoke a specific device session (bn: ডিভাইস লগআউট)' })
  revokeSession(@Req() req: AuthenticatedRequest, @Param('sessionId') sessionId: string) {
    return this.me.revokeSession(req.user!.sub, sessionId);
  }

  @Post('data-export')
  @Can('me:manage')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Request async personal data export (ZIP/JSON signed URL) (bn: ব্যক্তিগত ডেটা ডাউনলোড)',
  })
  requestDataExport(@Req() req: AuthenticatedRequest) {
    return this.me.requestDataExport(req.user!.sub);
  }

  @Post('delete')
  @Can('me:manage')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary:
      'Request account deletion with 30-day grace period & immediate session revocation (bn: অ্যাকাউন্ট মুছে ফেলার অনুরোধ)',
  })
  requestDeletion(@Req() req: AuthenticatedRequest) {
    return this.me.requestAccountDeletion(req.user!.sub);
  }

  @Get('activity')
  @Can('me:manage')
  @ApiOperation({ summary: 'Get authenticated citizen’s own redacted activity log (bn: কার্যকলাপ)' })
  getActivity(@Req() req: AuthenticatedRequest) {
    return this.me.getActivity(req.user!.sub);
  }
}
