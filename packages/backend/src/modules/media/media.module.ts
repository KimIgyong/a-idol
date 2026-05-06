import { Module } from '@nestjs/common';
import { AdminOpsModule } from '../admin-ops/admin-ops.module';
import { AdminAttachmentsController } from './presentation/admin-attachments.controller';
import {
  DeleteAttachmentUseCase,
  GetAttachmentUseCase,
  UploadAttachmentUseCase,
} from './application/attachment.usecases';
import {
  ATTACHMENT_REPOSITORY,
  STORAGE_PORT,
} from './application/interfaces';
import { LocalDiskStorage } from './infrastructure/local-disk-storage';
import { PrismaAttachmentRepository } from './infrastructure/prisma-attachment.repository';

@Module({
  imports: [AdminOpsModule],
  controllers: [AdminAttachmentsController],
  providers: [
    UploadAttachmentUseCase,
    GetAttachmentUseCase,
    DeleteAttachmentUseCase,
    { provide: STORAGE_PORT, useClass: LocalDiskStorage },
    { provide: ATTACHMENT_REPOSITORY, useClass: PrismaAttachmentRepository },
  ],
  exports: [ATTACHMENT_REPOSITORY],
})
export class MediaModule {}
