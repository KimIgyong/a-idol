import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import type { Response } from 'express';
import 'multer';
import type { AttachmentOwnerType } from '@prisma/client';
import { AdminJwtAuthGuard } from '../../../shared/guards/admin-jwt.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import {
  CurrentAdmin,
  type CurrentAdminContext,
} from '../../../shared/decorators/current-admin.decorator';
import {
  DeleteAttachmentUseCase,
  GetAttachmentUseCase,
  UploadAttachmentUseCase,
} from '../application/attachment.usecases';

const OWNER_TYPES: AttachmentOwnerType[] = ['ISSUE', 'NOTE', 'DOC', 'DRAFT'];

class UploadAttachmentBody {
  @IsIn(OWNER_TYPES)
  owner_type!: AttachmentOwnerType;

  @IsOptional() @IsUUID()
  owner_id?: string;
}

interface AttachmentResponseDto {
  id: string;
  ownerType: AttachmentOwnerType;
  ownerId: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  createdAt: string;
}

@ApiTags('admin-attachments')
@Controller('admin/attachments')
@UseGuards(AdminJwtAuthGuard, RolesGuard)
@Roles('admin', 'operator')
@ApiBearerAuth()
export class AdminAttachmentsController {
  constructor(
    private readonly uploadUC: UploadAttachmentUseCase,
    private readonly getUC: GetAttachmentUseCase,
    private readonly deleteUC: DeleteAttachmentUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: '첨부파일 업로드 (multipart). owner_type=DRAFT 로 우선 업로드 후 entity 저장 시 link.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        owner_type: { type: 'string', enum: OWNER_TYPES },
        owner_id: { type: 'string', format: 'uuid' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  async upload(
    @CurrentAdmin() admin: CurrentAdminContext,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: UploadAttachmentBody,
  ): Promise<AttachmentResponseDto> {
    if (!file) {
      throw new Error('file is required');
    }
    const r = await this.uploadUC.execute({
      ownerType: body.owner_type,
      ownerId: body.owner_id ?? null,
      filename: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
      uploadedById: admin.id,
    });
    return {
      id: r.id,
      ownerType: r.ownerType,
      ownerId: r.ownerId,
      filename: r.filename,
      mimeType: r.mimeType,
      sizeBytes: r.sizeBytes,
      url: `/api/v1/admin/attachments/${r.id}`,
      createdAt: r.createdAt.toISOString(),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: '첨부 다운로드 / 인라인 표시 (이미지)' })
  async download(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { record, buffer } = await this.getUC.execute(id);
    res.setHeader('Content-Type', record.mimeType);
    res.setHeader('Content-Length', record.sizeBytes);
    res.setHeader(
      'Content-Disposition',
      record.mimeType.startsWith('image/')
        ? `inline; filename="${encodeURIComponent(record.filename)}"`
        : `attachment; filename="${encodeURIComponent(record.filename)}"`,
    );
    res.end(buffer);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: '첨부 삭제' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.deleteUC.execute(id);
  }
}
