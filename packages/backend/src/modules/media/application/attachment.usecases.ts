import { Inject, Injectable } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import type { AttachmentOwnerType } from '@prisma/client';
import type { AttachmentRecord } from '../domain/attachment';
import { ALLOWED_MIME_TYPES, DEFAULT_MAX_BYTES } from '../domain/attachment';
import {
  ATTACHMENT_REPOSITORY,
  STORAGE_PORT,
  type AttachmentRepository,
  type StoragePort,
} from './interfaces';

export interface UploadAttachmentInput {
  ownerType: AttachmentOwnerType;
  ownerId?: string | null;
  filename: string;
  mimeType: string;
  buffer: Buffer;
  uploadedById: string;
  maxBytes?: number;
}

@Injectable()
export class UploadAttachmentUseCase {
  constructor(
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    @Inject(ATTACHMENT_REPOSITORY) private readonly repo: AttachmentRepository,
  ) {}

  async execute(input: UploadAttachmentInput): Promise<AttachmentRecord> {
    const max = input.maxBytes ?? DEFAULT_MAX_BYTES;
    if (input.buffer.length > max) {
      throw new DomainError(
        ErrorCodes.ATTACHMENT_TOO_LARGE,
        `파일 크기는 ${Math.floor(max / 1024 / 1024)}MB 이하여야 합니다.`,
        { sizeBytes: input.buffer.length, maxBytes: max },
      );
    }
    if (!ALLOWED_MIME_TYPES.includes(input.mimeType)) {
      throw new DomainError(
        ErrorCodes.ATTACHMENT_MIME_NOT_ALLOWED,
        '지원하지 않는 파일 형식입니다.',
        { mimeType: input.mimeType },
      );
    }
    const { storageKey } = await this.storage.save({
      buffer: input.buffer,
      filename: input.filename,
      mimeType: input.mimeType,
    });
    return this.repo.create({
      ownerType: input.ownerType,
      ownerId: input.ownerId ?? null,
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.buffer.length,
      storageKey,
      uploadedById: input.uploadedById,
    });
  }
}

@Injectable()
export class GetAttachmentUseCase {
  constructor(
    @Inject(ATTACHMENT_REPOSITORY) private readonly repo: AttachmentRepository,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  async execute(id: string): Promise<{ record: AttachmentRecord; buffer: Buffer }> {
    const record = await this.repo.findById(id);
    if (!record) {
      throw new DomainError(ErrorCodes.ATTACHMENT_NOT_FOUND, '첨부파일을 찾을 수 없습니다.');
    }
    const { buffer } = await this.storage.read(record.storageKey);
    return { record, buffer };
  }
}

@Injectable()
export class DeleteAttachmentUseCase {
  constructor(
    @Inject(ATTACHMENT_REPOSITORY) private readonly repo: AttachmentRepository,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  async execute(id: string): Promise<void> {
    const record = await this.repo.findById(id);
    if (!record) {
      throw new DomainError(ErrorCodes.ATTACHMENT_NOT_FOUND, '첨부파일을 찾을 수 없습니다.');
    }
    await this.storage.remove(record.storageKey);
    await this.repo.remove(id);
  }
}
