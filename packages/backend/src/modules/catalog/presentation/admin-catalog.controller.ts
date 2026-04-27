import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type {
  AdminIdolDto,
  AgencyDto,
  IdolScheduleDto,
  PaginatedResponseDto,
} from '@a-idol/shared';
import { AdminJwtAuthGuard } from '../../../shared/guards/admin-jwt.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import {
  CreateAgencyUseCase,
  DeleteAgencyUseCase,
  ListAgenciesUseCase,
  UpdateAgencyUseCase,
} from '../application/agency.usecase';
import {
  GetAdminIdolUseCase,
  ListAllIdolsUseCase,
  PublishIdolUseCase,
  SoftDeleteIdolUseCase,
  UnpublishIdolUseCase,
  UpdateIdolUseCase,
} from '../application/admin-idol.usecase';
import { CreateIdolUseCase } from '../application/create-idol.usecase';
import {
  CreateScheduleUseCase,
  DeleteScheduleUseCase,
  ListSchedulesUseCase,
} from '../application/schedule.usecase';
import type { IdolScheduleRecord } from '../application/admin-interfaces';
import {
  CreateAgencyDto,
  CreateIdolDto,
  CreateScheduleDto,
  ListAdminIdolsQuery,
  UpdateAgencyDto,
  UpdateIdolDto,
} from './dto/admin-catalog.dto';
import { toAdminIdolDto, toAgencyDto } from './dto/admin-catalog-view';

function toScheduleDto(r: IdolScheduleRecord): IdolScheduleDto {
  return {
    id: r.id,
    idolId: r.idolId,
    type: r.type,
    title: r.title,
    location: r.location,
    startAt: r.startAt.toISOString(),
    endAt: r.endAt ? r.endAt.toISOString() : null,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
  };
}

@ApiTags('admin-catalog')
@Controller('admin/catalog')
@UseGuards(AdminJwtAuthGuard, RolesGuard)
@Roles('admin', 'operator')
@ApiBearerAuth()
export class AdminCatalogController {
  constructor(
    private readonly listAgencies: ListAgenciesUseCase,
    private readonly createAgency: CreateAgencyUseCase,
    private readonly updateAgency: UpdateAgencyUseCase,
    private readonly deleteAgency: DeleteAgencyUseCase,
    private readonly listIdols: ListAllIdolsUseCase,
    private readonly getIdol: GetAdminIdolUseCase,
    private readonly createIdol: CreateIdolUseCase,
    private readonly updateIdol: UpdateIdolUseCase,
    private readonly publishIdol: PublishIdolUseCase,
    private readonly unpublishIdol: UnpublishIdolUseCase,
    private readonly deleteIdol: SoftDeleteIdolUseCase,
    private readonly listSchedules: ListSchedulesUseCase,
    private readonly createSchedule: CreateScheduleUseCase,
    private readonly deleteSchedule: DeleteScheduleUseCase,
  ) {}

  // -- Agencies ---------------------------------------------------------
  @Get('agencies')
  @ApiOperation({ summary: 'List agencies (admin/operator)' })
  async getAgencies(): Promise<AgencyDto[]> {
    const rows = await this.listAgencies.execute();
    return rows.map(toAgencyDto);
  }

  @Post('agencies')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create agency' })
  async postAgency(@Body() body: CreateAgencyDto): Promise<AgencyDto> {
    const agency = await this.createAgency.execute({
      name: body.name,
      description: body.description ?? null,
    });
    return toAgencyDto(agency);
  }

  @Patch('agencies/:id')
  @ApiOperation({ summary: 'Update agency' })
  async patchAgency(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateAgencyDto,
  ): Promise<AgencyDto> {
    const agency = await this.updateAgency.execute(id, {
      name: body.name,
      description: body.description === undefined ? undefined : body.description,
    });
    return toAgencyDto(agency);
  }

  @Delete('agencies/:id')
  @HttpCode(204)
  @Roles('admin')
  @ApiOperation({ summary: 'Soft-delete agency (admin only; fails if idols remain)' })
  async removeAgency(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.deleteAgency.execute(id);
  }

  // -- Idols ------------------------------------------------------------
  @Get('idols')
  @ApiOperation({ summary: 'List all idols (including unpublished / optionally deleted)' })
  async getIdols(
    @Query() q: ListAdminIdolsQuery,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PaginatedResponseDto<AdminIdolDto> | undefined> {
    // ETag pattern matches ADR-021 lever 4 list-endpoint probe. The CMS
    // apiFetch forwards `If-None-Match` automatically on GETs; a match
    // short-circuits before the findMany + toAdminIdolDto fan-out.
    const identity = await this.listIdols.getIdentity({
      includeDeleted: q.includeDeleted,
    });
    const stamp = identity.maxUpdatedAt ? identity.maxUpdatedAt.getTime() : 0;
    const etag = `W/"admin-idols-${identity.total}-${stamp}-p${q.page}-s${q.size}-d${q.includeDeleted ? 1 : 0}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');

    if (ifNoneMatch && ifNoneMatch === etag) {
      res.status(304);
      return undefined;
    }

    const list = await this.listIdols.execute({
      page: q.page,
      size: q.size,
      includeDeleted: q.includeDeleted,
    });
    return {
      items: list.items.map(toAdminIdolDto),
      nextCursor: list.nextCursor,
      total: list.total,
    };
  }

  @Get('idols/:id')
  @ApiOperation({ summary: 'Idol detail (admin — includes soft-deleted)' })
  async getIdolById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<AdminIdolDto> {
    const row = await this.getIdol.execute(id);
    return toAdminIdolDto(row);
  }

  @Post('idols')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a new idol (auto-creates a free fan club)' })
  async postIdol(@Body() body: CreateIdolDto): Promise<AdminIdolDto> {
    const row = await this.createIdol.execute(body);
    return toAdminIdolDto(row);
  }

  @Patch('idols/:id')
  @ApiOperation({ summary: 'Update idol fields' })
  async patchIdol(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateIdolDto,
  ): Promise<AdminIdolDto> {
    const row = await this.updateIdol.execute(id, body);
    return toAdminIdolDto(row);
  }

  @Post('idols/:id/publish')
  @HttpCode(200)
  @ApiOperation({ summary: 'Publish idol (sets publishedAt = now)' })
  async postPublish(@Param('id', new ParseUUIDPipe()) id: string): Promise<AdminIdolDto> {
    const row = await this.publishIdol.execute(id);
    return toAdminIdolDto(row);
  }

  @Post('idols/:id/unpublish')
  @HttpCode(200)
  @ApiOperation({ summary: 'Unpublish idol (publishedAt = null)' })
  async postUnpublish(@Param('id', new ParseUUIDPipe()) id: string): Promise<AdminIdolDto> {
    const row = await this.unpublishIdol.execute(id);
    return toAdminIdolDto(row);
  }

  @Delete('idols/:id')
  @HttpCode(204)
  @Roles('admin')
  @ApiOperation({ summary: 'Soft-delete idol (admin only)' })
  async removeIdol(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.deleteIdol.execute(id);
  }

  // -- Idol Schedules ---------------------------------------------------
  @Get('idols/:id/schedules')
  @ApiOperation({ summary: 'List schedules for an idol' })
  async getSchedules(
    @Param('id', new ParseUUIDPipe()) idolId: string,
  ): Promise<IdolScheduleDto[]> {
    const rows = await this.listSchedules.execute(idolId);
    return rows.map(toScheduleDto);
  }

  @Post('idols/:id/schedules')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a schedule entry' })
  async postSchedule(
    @Param('id', new ParseUUIDPipe()) idolId: string,
    @Body() body: CreateScheduleDto,
  ): Promise<IdolScheduleDto> {
    const row = await this.createSchedule.execute(idolId, body);
    return toScheduleDto(row);
  }

  @Delete('schedules/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft-delete a schedule entry' })
  async removeSchedule(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.deleteSchedule.execute(id);
  }
}
