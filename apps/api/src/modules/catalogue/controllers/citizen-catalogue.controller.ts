import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../common/zod-validation.pipe';
import { AuthGuard, type AuthenticatedRequest } from '../../identity/guards/auth.guard';
import { Can, RbacGuard } from '../../identity/guards/rbac.guard';
import { CatalogueService } from '../application/catalogue.service';

const SaveItemSchema = z.object({
  resourceType: z.enum(['service', 'program', 'scholarship', 'job', 'notice']),
  resourceId: z.string().min(1).max(128),
  notes: z.string().max(500).optional(),
});

const CreateReminderSchema = z.object({
  resourceType: z.string().min(1).max(48),
  resourceId: z.string().max(128).optional(),
  titleBn: z.string().min(1).max(200),
  titleEn: z.string().min(1).max(200),
  remindAt: z.string().datetime(),
});

const UpdateReminderSchema = z.object({
  remindAt: z.string().datetime().optional(),
  status: z.enum(['scheduled', 'cancelled']).optional(),
});

@ApiTags('Me (Saved Items & Reminders)')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
@Controller('api/v1/me')
export class CitizenCatalogueController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Get('saved')
  @Can('me:manage')
  @ApiOperation({ summary: 'List citizen’s saved services/opportunities (bn: সংরক্ষিত তালিকা)' })
  listSaved(@Req() req: AuthenticatedRequest) {
    return this.catalogue.listSavedItems(req.user!.sub);
  }

  @Post('saved')
  @Can('me:manage')
  @ApiOperation({ summary: 'Save a service, program, or notice (bn: সংরক্ষণ করুন)' })
  saveItem(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(SaveItemSchema)) body: z.infer<typeof SaveItemSchema>,
  ) {
    return this.catalogue.saveItem(req.user!.sub, body);
  }

  @Delete('saved/:id')
  @Can('me:manage')
  @ApiOperation({ summary: 'Remove a saved item (owner-only)' })
  deleteSaved(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.catalogue.deleteSavedItem(req.user!.sub, id);
  }

  @Get('reminders')
  @Can('me:manage')
  @ApiOperation({ summary: 'List personal reminders (bn: রিমাইন্ডার তালিকা)' })
  listReminders(@Req() req: AuthenticatedRequest) {
    return this.catalogue.listReminders(req.user!.sub);
  }

  @Post('reminders')
  @Can('me:manage')
  @ApiOperation({ summary: 'Create a personal deadline reminder (bn: রিমাইন্ডার যোগ করুন)' })
  createReminder(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(CreateReminderSchema)) body: z.infer<typeof CreateReminderSchema>,
  ) {
    return this.catalogue.createReminder(req.user!.sub, {
      ...body,
      remindAt: new Date(body.remindAt),
    });
  }

  @Patch('reminders/:id')
  @Can('me:manage')
  @ApiOperation({ summary: 'Update or cancel a personal reminder (owner-only)' })
  updateReminder(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateReminderSchema)) body: z.infer<typeof UpdateReminderSchema>,
  ) {
    return this.catalogue.updateReminder(req.user!.sub, id, {
      remindAt: body.remindAt ? new Date(body.remindAt) : undefined,
      status: body.status,
    });
  }

  @Delete('reminders/:id')
  @Can('me:manage')
  @ApiOperation({ summary: 'Delete a personal reminder (owner-only)' })
  deleteReminder(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.catalogue.deleteReminder(req.user!.sub, id);
  }
}
