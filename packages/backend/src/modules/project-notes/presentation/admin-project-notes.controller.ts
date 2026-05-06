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
import type { ProjectNoteCategory } from '@prisma/client';
import { AdminJwtAuthGuard } from '../../../shared/guards/admin-jwt.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import {
  CurrentAdmin,
  type CurrentAdminContext,
} from '../../../shared/decorators/current-admin.decorator';
import {
  CreateProjectNoteUseCase,
  DeleteProjectNoteUseCase,
  GetProjectNoteUseCase,
  ListProjectNotesUseCase,
  TogglePinProjectNoteUseCase,
  UpdateProjectNoteUseCase,
} from '../application/project-note.usecases';
import {
  CreateProjectNoteBody,
  TogglePinBody,
  UpdateProjectNoteBody,
  toProjectNoteDto,
  type ProjectNoteDto,
} from './dto/project-note.dto';

@ApiTags('admin-project-notes')
@Controller('admin/project-notes')
@UseGuards(AdminJwtAuthGuard, RolesGuard)
@Roles('admin', 'operator')
@ApiBearerAuth()
export class AdminProjectNotesController {
  constructor(
    private readonly listUC: ListProjectNotesUseCase,
    private readonly getUC: GetProjectNoteUseCase,
    private readonly createUC: CreateProjectNoteUseCase,
    private readonly updateUC: UpdateProjectNoteUseCase,
    private readonly deleteUC: DeleteProjectNoteUseCase,
    private readonly pinUC: TogglePinProjectNoteUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: '노트 목록 (pinned 상단 → updatedAt desc)' })
  async list(
    @Query('category') category?: ProjectNoteCategory,
    @Query('pinned_only') pinnedOnly?: string,
    @Query('q') q?: string,
  ): Promise<ProjectNoteDto[]> {
    const rows = await this.listUC.execute({
      category,
      pinnedOnly: pinnedOnly === '1' || pinnedOnly === 'true',
      q,
    });
    return rows.map(toProjectNoteDto);
  }

  @Get(':id')
  @ApiOperation({ summary: '노트 상세' })
  async detail(@Param('id', new ParseUUIDPipe()) id: string): Promise<ProjectNoteDto> {
    return toProjectNoteDto(await this.getUC.execute(id));
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: '노트 생성' })
  async create(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Body() body: CreateProjectNoteBody,
  ): Promise<ProjectNoteDto> {
    const r = await this.createUC.execute({
      title: body.title,
      body: body.body,
      category: body.category,
      pinned: body.pinned,
      authorAdminId: admin.id,
      attachmentIds: body.attachment_ids,
    });
    return toProjectNoteDto(r);
  }

  @Patch(':id')
  @ApiOperation({ summary: '노트 수정 (작성자 또는 admin)' })
  async update(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateProjectNoteBody,
  ): Promise<ProjectNoteDto> {
    const r = await this.updateUC.execute(
      { id: admin.id, role: admin.role },
      id,
      {
        title: body.title,
        body: body.body,
        category: body.category,
        pinned: body.pinned,
        attachmentIds: body.attachment_ids,
      },
    );
    return toProjectNoteDto(r);
  }

  @Patch(':id/pin')
  @ApiOperation({ summary: '핀 토글 (admin/operator 모두)' })
  async pin(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: TogglePinBody,
  ): Promise<ProjectNoteDto> {
    return toProjectNoteDto(await this.pinUC.execute(id, body.pinned));
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: '노트 삭제 (작성자 또는 admin)' })
  async remove(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.deleteUC.execute({ id: admin.id, role: admin.role }, id);
  }
}
