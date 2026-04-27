import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AdminAnalyticsOverviewDto } from '@a-idol/shared';
import { AdminJwtAuthGuard } from '../../../shared/guards/admin-jwt.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { GetAdminAnalyticsOverviewUseCase } from '../application/get-analytics-overview.usecase';

@ApiTags('admin-analytics')
@Controller('admin/analytics')
@UseGuards(AdminJwtAuthGuard, RolesGuard)
@Roles('admin', 'operator')
@ApiBearerAuth()
export class AdminAnalyticsController {
  constructor(private readonly overview: GetAdminAnalyticsOverviewUseCase) {}

  @Get('overview')
  @ApiOperation({ summary: 'Dashboard KPIs + active-round top 3' })
  async get(): Promise<AdminAnalyticsOverviewDto> {
    return this.overview.execute();
  }
}
