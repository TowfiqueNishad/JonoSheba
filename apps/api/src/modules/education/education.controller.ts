import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EducationService } from './education.service';

@ApiTags('Education Hub — Institutions (EIIN), UGC Universities & Boards (Section 5)')
@Controller('api/v1/education')
export class EducationController {
  constructor(private readonly education: EducationService) {}

  @Get('institutions')
  @ApiOperation({
    summary:
      'Search schools, colleges, madrasas, technical institutes & universities by name, EIIN, UGC ID, or district',
  })
  listInstitutions(
    @Query('q') q?: string,
    @Query('eiin') eiin?: string,
    @Query('code') code?: string,
    @Query('district') district?: string,
    @Query('upazila') upazila?: string,
    @Query('type') type?: string,
    @Query('level') level?: string,
    @Query('management') management?: string,
    @Query('limit') limit?: string,
  ) {
    return this.education.listInstitutions({
      q,
      eiin,
      code,
      district,
      upazila,
      type,
      level,
      management,
      limit,
    });
  }

  @Get('institutions/:id')
  @ApiOperation({ summary: 'Get institution profile with EIIN / UGC / NU / BTEB codes & official portals' })
  getInstitution(@Param('id') id: string) {
    return this.education.getInstitution(id);
  }

  @Get('universities')
  @ApiOperation({
    summary:
      'List UGC public, private & international universities (universities have no BANBEIS EIIN — never fabricated)',
  })
  listUniversities(@Query('q') q?: string, @Query('management') management?: string) {
    return this.education.listUniversities(q, management);
  }

  @Get('boards')
  @ApiOperation({
    summary: 'List education boards with official results, XI admission & certificate correction portals',
  })
  listBoards() {
    return this.education.listBoards();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Education directory counts & data-integrity quality checks' })
  getStats() {
    return this.education.runQualityChecks();
  }
}
