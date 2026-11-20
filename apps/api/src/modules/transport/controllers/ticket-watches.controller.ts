import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../common/zod-validation.pipe';
import { AuthGuard, type AuthenticatedRequest } from '../../identity/guards/auth.guard';
import { Can, RbacGuard } from '../../identity/guards/rbac.guard';
import { TransportService } from '../application/transport.service';

const CreateWatchSchema = z.object({
  mode: z.enum(['train', 'bus', 'launch', 'flight', 'metro']),
  providerId: z.string().max(48).optional(),
  originCode: z.string().min(2).max(32),
  destinationCode: z.string().min(2).max(32),
  journeyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  passengers: z.number().int().min(1).max(10).default(1),
  preferences: z
    .object({
      trainName: z.string().max(80).optional(),
      seatClass: z.string().max(32).optional(),
      operator: z.string().max(64).optional(),
      seatType: z.string().max(32).optional(),
      departWindow: z
        .object({
          startHour: z.number().int().min(0).max(23),
          endHour: z.number().int().min(0).max(23),
        })
        .optional(),
    })
    .optional(),
  flexibility: z
    .object({
      altDatesDays: z.number().int().min(0).max(3).optional(),
      nearbyStops: z.boolean().optional(),
      maxFareBdt: z.number().int().positive().optional(),
    })
    .optional(),
  channels: z.array(z.enum(['in_app', 'web_push', 'mobile_push', 'email', 'sms'])).optional(),
});

const MutateWatchSchema = z.object({
  action: z.enum(['pause', 'resume', 'cancel', 'update']),
  preferences: CreateWatchSchema.shape.preferences,
  flexibility: CreateWatchSchema.shape.flexibility,
  channels: CreateWatchSchema.shape.channels,
});

@ApiTags('Ticket Availability Watches')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
@Controller('api/v1/ticket-watches')
export class TicketWatchesController {
  constructor(private readonly transport: TransportService) {}

  @Post()
  @Can('watch:manage')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiOperation({
    summary:
      'Create a ticket availability watch (max 10 active, expires at departure, Idempotency-Key supported)',
  })
  createWatch(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(CreateWatchSchema)) body: z.infer<typeof CreateWatchSchema>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.transport.createTicketWatch(req.user!.sub, body, idempotencyKey);
  }

  @Get()
  @Can('watch:manage')
  @ApiOperation({ summary: 'List citizen’s own ticket watches (bn: আমার টিকিট অ্যালার্ট)' })
  async listWatches(@Req() req: AuthenticatedRequest) {
    return { items: await this.transport.listWatches(req.user!.sub) };
  }

  @Get(':id')
  @Can('watch:manage')
  @ApiOperation({ summary: 'Get ticket watch details with check & match timeline (owner-only)' })
  getWatchDetail(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.transport.getWatchDetail(req.user!.sub, id);
  }

  @Patch(':id')
  @Can('watch:manage')
  @ApiOperation({ summary: 'Pause, resume, cancel, or update a ticket watch (owner-only)' })
  mutateWatch(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(MutateWatchSchema)) body: z.infer<typeof MutateWatchSchema>,
  ) {
    return this.transport.mutateWatch(req.user!.sub, id, body);
  }

  @Post(':id/complete')
  @Can('watch:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark ticket watch as completed ("I booked it") (bn: টিকিট বুক করেছি)' })
  completeWatch(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.transport.completeWatch(req.user!.sub, id);
  }
}
