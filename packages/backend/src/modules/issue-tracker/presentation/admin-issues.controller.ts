/**
 * RPT-260506 — Admin Issues HTTP controller.
 * GET (list/board/detail): admin/operator/viewer.
 * POST/PATCH/DELETE/move: admin/operator only.
 */
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
  IssueDto,
  IssuePriority,
  IssueStatus,
  IssueType,
  KanbanIssuesDto,
} from '@a-idol/shared';
import { AdminJwtAuthGuard } from '../../../shared/guards/admin-jwt.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import {
  CurrentAdmin,
  type CurrentAdminContext,
} from '../../../shared/decorators/current-admin.decorator';
import {
  CreateIssueUseCase,
  DeleteIssueUseCase,
  GetIssueUseCase,
  ListIssuesUseCase,
  MoveIssueUseCase,
  UpdateIssueUseCase,
} from '../application/issue.usecases';
import {
  CreateIssueBody,
  MoveIssueBody,
  UpdateIssueBody,
  toIssueDto,
  toKanbanDto,
} from './dto/issue.dto';

@ApiTags('admin-issues')
@Controller('admin/issues')
@UseGuards(AdminJwtAuthGuard, RolesGuard)
@Roles('admin', 'operator', 'viewer')
@ApiBearerAuth()
export class AdminIssuesController {
  constructor(
    private readonly listUC: ListIssuesUseCase,
    private readonly getUC: GetIssueUseCase,
    private readonly createUC: CreateIssueUseCase,
    private readonly updateUC: UpdateIssueUseCase,
    private readonly moveUC: MoveIssueUseCase,
    private readonly deleteUC: DeleteIssueUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: '이슈 목록 (필터)' })
  async list(
    @Query('status') status?: IssueStatus,
    @Query('type') type?: IssueType,
    @Query('priority') priority?: IssuePriority,
    @Query('assignee_admin_id') assigneeAdminId?: string,
    @Query('q') q?: string,
  ): Promise<IssueDto[]> {
    const rows = await this.listUC.execute({
      status,
      type,
      priority,
      assigneeAdminId,
      q,
    });
    return rows.map(toIssueDto);
  }

  @Get('board')
  @ApiOperation({ summary: '칸반 보드 (status 별 그룹핑, CANCELED 제외)' })
  async board(
    @Query('type') type?: IssueType,
    @Query('priority') priority?: IssuePriority,
    @Query('assignee_admin_id') assigneeAdminId?: string,
    @Query('q') q?: string,
  ): Promise<KanbanIssuesDto> {
    const rows = await this.listUC.execute({ type, priority, assigneeAdminId, q });
    return toKanbanDto(rows);
  }

  @Get(':idOrKey')
  @ApiOperation({ summary: '이슈 상세 (id UUID 또는 key IIS-N)' })
  async detail(@Param('idOrKey') idOrKey: string): Promise<IssueDto> {
    const r = await this.getUC.execute(idOrKey);
    return toIssueDto(r);
  }

  @Post()
  @HttpCode(201)
  @Roles('admin', 'operator')
  @ApiOperation({ summary: '이슈 생성' })
  async create(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Body() body: CreateIssueBody,
  ): Promise<IssueDto> {
    const r = await this.createUC.execute({
      title: body.title,
      description: body.description,
      type: body.type,
      status: body.status,
      priority: body.priority,
      assigneeAdminId: body.assignee_admin_id,
      reporterAdminId: admin.id,
      dueDate: body.due_date,
      labels: body.labels,
    });
    return toIssueDto(r);
  }

  @Patch(':id')
  @Roles('admin', 'operator')
  @ApiOperation({ summary: '이슈 수정' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateIssueBody,
  ): Promise<IssueDto> {
    const r = await this.updateUC.execute(id, {
      title: body.title,
      description: body.description,
      type: body.type,
      status: body.status,
      priority: body.priority,
      assigneeAdminId: body.assignee_admin_id,
      dueDate: body.due_date,
      labels: body.labels,
    });
    return toIssueDto(r);
  }

  @Patch(':id/move')
  @Roles('admin', 'operator')
  @ApiOperation({ summary: '칸반 이동 (status + index)' })
  async move(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: MoveIssueBody,
  ): Promise<IssueDto> {
    const r = await this.moveUC.execute(id, {
      toStatus: body.to_status,
      toIndex: body.to_index,
    });
    return toIssueDto(r);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('admin')
  @ApiOperation({ summary: '이슈 삭제 (admin only)' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.deleteUC.execute(id);
  }
}
