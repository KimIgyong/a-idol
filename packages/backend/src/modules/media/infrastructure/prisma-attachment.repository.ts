import { Injectable } from '@nestjs/common';
import type { AttachmentOwnerType } from '@prisma/client';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { AttachmentRepository } from '../application/interfaces';
import type { AttachmentRecord } from '../domain/attachment';

@Injectable()
export class PrismaAttachmentRepository implements AttachmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    ownerType: AttachmentOwnerType;
    ownerId: string | null;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
    uploadedById: string;
  }): Promise<AttachmentRecord> {
    const row = await this.prisma.attachment.create({
      data: {
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        storageKey: input.storageKey,
        uploadedById: input.uploadedById,
      },
    });
    return row;
  }

  async findById(id: string): Promise<AttachmentRecord | null> {
    return this.prisma.attachment.findUnique({ where: { id } });
  }

  async linkToOwner(ids: string[], ownerType: AttachmentOwnerType, ownerId: string): Promise<void> {
    if (ids.length === 0) return;
    await this.prisma.attachment.updateMany({
      where: { id: { in: ids } },
      data: { ownerType, ownerId },
    });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.attachment.delete({ where: { id } });
  }
}
