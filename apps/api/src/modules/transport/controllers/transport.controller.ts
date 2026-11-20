import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../common/zod-validation.pipe';
import { TransportService } from '../application/transport.service';

const TransportSearchSchema = z.object({
  mode: z.enum(['train', 'bus', 'launch', 'flight', 'metro']),
  origin: z.string().min(2).max(32),
  destination: z.string().min(2).max(32),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD in Asia/Dhaka'),
  passengers: z.number().int().min(1).max(10).default(1),
  seatClass: z.string().max(32).optional(),
  operator: z.string().max(64).optional(),
  departWindow: z
    .object({
      startHour: z.number().int().min(0).max(23),
      endHour: z.number().int().min(0).max(23),
    })
    .optional(),
});

@ApiTags('Smart Transportation Hub')
@Controller('api/v1/transport')
export class TransportController {
  constructor(private readonly transport: TransportService) {}

  @Get('stops')
  @ApiOperation({
    summary: 'Fuzzy Bangla/English/Banglish rail station & bus stop search (bn: স্টেশন খুঁজুন)',
  })
  @ApiQuery({ name: 'query', required: false, example: 'kamalapur' })
  @ApiQuery({ name: 'mode', required: false, example: 'train' })
  async searchStops(
    @Query('query') query: string | undefined,
    @Query('mode') mode: string | undefined,
  ) {
    return { items: await this.transport.searchStops(query ?? '', mode) };
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Search train/bus journeys with honest availability states (R6), official hand-off links, alternatives & demand hint',
  })
  @ApiBody({
    schema: {
      example: {
        mode: 'train',
        origin: 'RAIL-DA',
        destination: 'RAIL-CTG',
        date: '2026-12-20',
        passengers: 2,
        seatClass: 'SNIGDHA',
      },
    },
  })
  search(
    @Body(new ZodValidationPipe(TransportSearchSchema))
    body: z.infer<typeof TransportSearchSchema>,
  ) {
    return this.transport.searchJourneys({
      mode: body.mode,
      originCode: body.origin,
      destinationCode: body.destination,
      journeyDate: body.date,
      passengers: body.passengers,
      seatClass: body.seatClass,
      operator: body.operator,
      departWindow: body.departWindow,
    });
  }

  @Get('providers/health')
  @ApiOperation({
    summary: 'Public transport provider adapter health & integration status (bn: প্রোভাইডার স্ট্যাটাস)',
  })
  async providersHealth() {
    return { items: await this.transport.getProvidersHealth() };
  }
}
