import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type {
  AutoMessageStatus,
  AutoMessageTemplateDto,
  PaginatedResponseDto,
} from '@a-idol/shared';
import { AdminJwtAuthGuard } from '../../../shared/guards/admin-jwt.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import {
  CurrentAdmin,
  type CurrentAdminContext,
} from '../../../shared/decorators/current-admin.decorator';
import { ScheduleAutoMessageUseCase } from '../application/schedule-auto-message.usecase';
import { ListAutoMessagesUseCase } from '../application/list-auto-messages.usecase';
import { CancelAutoMessageUseCase } from '../application/cancel-auto-message.usecase';
import { DispatchAutoMessageUseCase } from '../application/dispatch-auto-message.usecase';
import type { AutoMessageRecord } from '../application/auto-message-interfaces';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class CreateAutoMessageBody {
  @IsString()
  @Matches(UUID_REGEX, { message: 'idolId must be a UUID' })
  idolId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;

  @IsISO8601()
  scheduledAt!: string;
}

class ListAutoMessagesQuery {
  @IsOptional()
  @IsString()
  @Matches(UUID_REGEX)
  idolId?: string;

  @IsOptional()
  @IsIn(['SCHEDULED', 'DISPATCHED', 'CANCELED', 'FAILED'])
  status?: AutoMessageStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size: number = 25;
}

function toDto(r: AutoMessageRecord): AutoMessageTemplateDto {
  return {
    id: r.id,
    idolId: r.idolId,
    idolName: r.idolName,
    title: r.title,
    content: r.content,
    scheduledAt: r.scheduledAt.toISOString(),
    dispatchedAt: r.dispatchedAt ? r.dispatchedAt.toISOString() : null,
    status: r.status,
    recipients: r.recipients,
    failedReason: r.failedReason,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
  };
}

@ApiTags('admin-chat')
@Controller('admin/chat/auto-messages')
@UseGuards(AdminJwtAuthGuard, RolesGuard)
@Roles('admin', 'operator')
@ApiBearerAuth()
export class AdminAutoMessageController {
  constructor(
    private readonly schedule: ScheduleAutoMessageUseCase,
    private readonly list: ListAutoMessagesUseCase,
    private readonly cancel: CancelAutoMessageUseCase,
    private readonly dispatch: DispatchAutoMessageUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Schedule a new auto-message' })
  async postSchedule(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Body() body: CreateAutoMessageBody,
  ): Promise<AutoMessageTemplateDto> {
    const rec = await this.schedule.execute({
      idolId: body.idolId,
      title: body.title,
      content: body.content,
      scheduledAt: body.scheduledAt,
      createdBy: admin.id,
    });
    return toDto(rec);
  }

  @Get()
  @ApiOperation({ summary: 'List auto-messages (by idol / status)' })
  async getList(
    @Query() q: ListAutoMessagesQuery,
  ): Promise<PaginatedResponseDto<AutoMessageTemplateDto>> {
    const res = await this.list.execute(q);
    const nextCursor = q.page * q.size < res.total ? String(q.page + 1) : null;
    return {
      items: res.items.map(toDto),
      nextCursor,
      total: res.total,
    };
  }

  @Delete(':id')
  @HttpCode(200)
  @Roles('admin')
  @ApiOperation({ summary: 'Cancel a scheduled auto-message (admin only)' })
  async removeScheduled(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<AutoMessageTemplateDto> {
    const rec = await this.cancel.execute(id);
    return toDto(rec);
  }

  @Post(':id/dispatch')
  @HttpCode(200)
  @Roles('admin')
  @ApiOperation({ summary: 'Force-dispatch now (debug / manual trigger)' })
  async postDispatchNow(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<AutoMessageTemplateDto> {
    const rec = await this.dispatch.execute(id);
    return toDto(rec);
  }
}
