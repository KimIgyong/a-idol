import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  ProjectDocCategory,
  ProjectDocDto,
  ProjectDocStatus,
  ProjectDocSummaryDto,
} from '@a-idol/shared';
import { AdminJwtAuthGuard } from '../../../shared/guards/admin-jwt.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import {
  CurrentAdmin,
  type CurrentAdminContext,
} from '../../../shared/decorators/current-admin.decorator';
import {
  CreateProjectDocUseCase,
  DeleteProjectDocUseCase,
  GetProjectDocUseCase,
  ListProjectDocsUseCase,
  UpdateProjectDocUseCase,
} from '../application/project-doc.usecases';
import {
  CreateProjectDocBody,
  UpdateProjectDocBody,
  toProjectDocDto,
  toProjectDocSummaryDto,
} from './dto/project-doc.dto';

/**
 * 프로젝트 산출물 관리 (CMS UI 백엔드).
 * - ADR / 설계 / WBS / 산출물 (수행계획·요구·기능·개발·중간보고) 통합.
 * - admin/operator 모두 read OK. 작성/수정/삭제는 admin only.
 */
@ApiTags('admin-project-docs')
@Controller('admin/project-docs')
@UseGuards(AdminJwtAuthGuard, RolesGuard)
@Roles('admin', 'operator')
@ApiBearerAuth()
export class AdminProjectDocsController {
  constructor(
    private readonly listUC: ListProjectDocsUseCase,
    private readonly getUC: GetProjectDocUseCase,
    private readonly createUC: CreateProjectDocUseCase,
    private readonly updateUC: UpdateProjectDocUseCase,
    private readonly deleteUC: DeleteProjectDocUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: '프로젝트 산출물 목록 (category/status 필터, content 제외)' })
  async list(
    @Query('category') category?: ProjectDocCategory,
    @Query('status') status?: ProjectDocStatus,
  ): Promise<ProjectDocSummaryDto[]> {
    const rows = await this.listUC.execute({ category, status });
    return rows.map(toProjectDocSummaryDto);
  }

  @Get(':slug')
  @ApiOperation({ summary: '프로젝트 산출물 상세 (slug 기반, content 포함)' })
  async detail(@Param('slug') slug: string): Promise<ProjectDocDto> {
    const r = await this.getUC.execute(slug);
    return toProjectDocDto(r);
  }

  @Post()
  @HttpCode(201)
  @Roles('admin')
  @ApiOperation({ summary: '산출물 신규 작성 (admin only)' })
  async create(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Body() body: CreateProjectDocBody,
  ): Promise<ProjectDocDto> {
    const r = await this.createUC.execute({ ...body, createdBy: admin.id });
    return toProjectDocDto(r);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: '산출물 수정 (admin only, content 변경 시 version++)' })
  async update(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateProjectDocBody,
  ): Promise<ProjectDocDto> {
    const r = await this.updateUC.execute(id, { ...body, updatedBy: admin.id });
    return toProjectDocDto(r);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('admin')
  @ApiOperation({ summary: '산출물 삭제 (admin only)' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.deleteUC.execute(id);
  }
}
