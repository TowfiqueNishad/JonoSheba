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
import { EmergencyHealthUtilityService } from '../application/emergency-health-utility.service';

const ProposeHotlineEditSchema = z.object({
  proposedNameBn: z.string().min(2).max(200),
  proposedNameEn: z.string().min(2).max(200),
  sourceUrl: z.string().url(),
});

const HealthGuidanceSchema = z.object({
  query: z.string().min(2).max(1000),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

const UtilitySubSchema = z.object({
  districtEn: z.string().min(2).max(64),
  utilityType: z.enum(['electricity', 'water', 'gas']),
  providerName: z.string().max(64).optional(),
});

@ApiTags('Emergency Center, Health Guidance & Utilities')
@Controller('api/v1')
export class EmergencyHealthUtilityController {
  constructor(private readonly support: EmergencyHealthUtilityService) {}

  @Get('emergency')
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400')
  @ApiOperation({
    summary:
      'Ultra-compact (< 5 KB) DB-down resilient emergency hotlines with tap-to-call tel: URIs (Rule R8)',
  })
  getEmergency() {
    return this.support.getEmergencyPayload();
  }

  @Get('emergency/nearby')
  @ApiOperation({ summary: 'Nearest hospitals, police, fire stations & cyclone/flood shelters' })
  getNearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius: string | undefined,
    @Headers('accept-language') lang: string | undefined,
  ) {
    return this.support.getNearbyEmergencyFacilities(
      Number(lat) || 23.73,
      Number(lng) || 90.4,
      Number(radius) || 25,
      resolveLocale(lang),
    );
  }

  @Get('emergency/alerts')
  @ApiOperation({ summary: 'Active disaster & early-warning notices by district' })
  getAlerts(
    @Query('district') district: string | undefined,
    @Headers('accept-language') lang: string | undefined,
  ) {
    return this.support.getEmergencyAlerts(district, resolveLocale(lang));
  }

  @Post('admin/hotlines/:number/propose-edit')
  @UseGuards(AuthGuard, RbacGuard)
  @Roles(Role.PLATFORM_ADMIN, Role.CONTENT_EDITOR)
  @Can('hotline:edit')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Propose hotline edit (requires second independent reviewer to approve)' })
  proposeHotlineEdit(
    @Req() req: AuthenticatedRequest,
    @Param('number') number: string,
    @Body(new ZodValidationPipe(ProposeHotlineEditSchema))
    body: z.infer<typeof ProposeHotlineEditSchema>,
  ) {
    return this.support.proposeHotlineEdit(req.user!.sub, number, body);
  }

  @Post('admin/hotlines/proposals/:id/approve')
  @UseGuards(AuthGuard, RbacGuard)
  @Roles(Role.PLATFORM_ADMIN, Role.REVIEWER)
  @Can('hotline:approve')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve hotline edit (two-person rule: reviewer !== author, MFA required)' })
  approveHotlineEdit(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.support.approveHotlineEdit(id, req.user!);
  }

  @Post('health/guidance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Public health guidance & nearest hospitals (NEVER diagnoses; red-flag symptoms immediately return 999)',
  })
  getHealthGuidance(
    @Body(new ZodValidationPipe(HealthGuidanceSchema)) body: z.infer<typeof HealthGuidanceSchema>,
    @Headers('accept-language') lang: string | undefined,
  ) {
    return this.support.getHealthGuidance({
      query: body.query,
      lat: body.lat,
      lng: body.lng,
      locale: resolveLocale(lang),
    });
  }

  @Get('utilities/providers')
  @ApiOperation({ summary: 'Verified official electricity, water & gas payment links (Rule R3)' })
  listUtilityProviders() {
    return this.support.listVerifiedUtilityProviders();
  }

  @Get('utilities/outage-subscriptions')
  @UseGuards(AuthGuard, RbacGuard)
  @Can('me:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List citizen’s utility outage alert subscriptions' })
  listUtilitySubs(@Req() req: AuthenticatedRequest) {
    return { items: this.support.listUtilitySubscriptions(req.user!.sub) };
  }

  @Post('utilities/outage-subscriptions')
  @UseGuards(AuthGuard, RbacGuard)
  @Can('me:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Subscribe to outage notices for your district/utility' })
  createUtilitySub(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(UtilitySubSchema)) body: z.infer<typeof UtilitySubSchema>,
  ) {
    return this.support.subscribeUtilityOutages(req.user!.sub, body);
  }

  @Delete('utilities/outage-subscriptions/:id')
  @UseGuards(AuthGuard, RbacGuard)
  @Can('me:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a utility outage subscription (owner-only)' })
  deleteUtilitySub(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.support.deleteUtilitySubscription(req.user!.sub, id);
  }
}
