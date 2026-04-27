import { Injectable } from '@nestjs/common';
import type {
  DesignAssetPlatform,
  DesignAssetStatus,
  DesignAssetType,
} from '@a-idol/shared';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type {
  CreateDesignAssetInput,
  DesignAssetRecord,
  DesignAssetRepository,
  UpdateDesignAssetInput,
} from '../application/interfaces';

@Injectable()
export class PrismaDesignAssetRepository implements DesignAssetRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<DesignAssetRecord[]> {
    const rows = await this.prisma.designAsset.findMany({
      orderBy: [{ type: 'asc' }, { platform: 'asc' }, { orderIndex: 'asc' }],
    });
    return rows.map(toRecord);
  }

  async findById(id: string): Promise<DesignAssetRecord | null> {
    const row = await this.prisma.designAsset.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async create(input: CreateDesignAssetInput): Promise<DesignAssetRecord> {
    const row = await this.prisma.designAsset.create({
      data: {
        name: input.name,
        type: input.type,
        platform: input.platform ?? 'ALL',
        status: input.status ?? 'PLACEHOLDER',
        fileUrl: input.fileUrl ?? null,
        spec: input.spec ?? null,
        orderIndex: input.orderIndex ?? 0,
        caption: input.caption ?? null,
        notes: input.notes ?? null,
        createdBy: input.createdBy,
        updatedBy: input.createdBy,
      },
    });
    return toRecord(row);
  }

  async update(id: string, input: UpdateDesignAssetInput): Promise<DesignAssetRecord> {
    const row = await this.prisma.designAsset.update({
      where: { id },
      data: {
        name: input.name,
        type: input.type,
        platform: input.platform,
        status: input.status,
        fileUrl: input.fileUrl,
        spec: input.spec,
        orderIndex: input.orderIndex,
        caption: input.caption,
        notes: input.notes,
        updatedBy: input.updatedBy,
      },
    });
    return toRecord(row);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.designAsset.delete({ where: { id } });
  }
}

function toRecord(row: {
  id: string;
  name: string;
  type: string;
  platform: string;
  status: string;
  fileUrl: string | null;
  spec: string | null;
  orderIndex: number;
  caption: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): DesignAssetRecord {
  return {
    id: row.id,
    name: row.name,
    type: row.type as DesignAssetType,
    platform: row.platform as DesignAssetPlatform,
    status: row.status as DesignAssetStatus,
    fileUrl: row.fileUrl,
    spec: row.spec,
    orderIndex: row.orderIndex,
    caption: row.caption,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
