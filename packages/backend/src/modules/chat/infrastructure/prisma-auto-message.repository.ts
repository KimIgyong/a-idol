import { Injectable } from '@nestjs/common';
import type { AutoMessageStatus } from '@a-idol/shared';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type {
  AutoMessageRecord,
  AutoMessageRepository,
} from '../application/auto-message-interfaces';

type Row = {
  id: string;
  idolId: string;
  title: string;
  content: string;
  scheduledAt: Date;
  dispatchedAt: Date | null;
  status: AutoMessageStatus;
  recipients: number;
  failedReason: string | null;
  createdBy: string;
  createdAt: Date;
  idol: { name: string; stageName: string | null };
};

@Injectable()
export class PrismaAutoMessageRepository implements AutoMessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    idolId: string;
    title: string;
    content: string;
    scheduledAt: Date;
    createdBy: string;
  }): Promise<AutoMessageRecord> {
    const row = await this.prisma.autoMessageTemplate.create({
      data: {
        idolId: input.idolId,
        title: input.title,
        content: input.content,
        scheduledAt: input.scheduledAt,
        createdBy: input.createdBy,
      },
      include: { idol: { select: { name: true, stageName: true } } },
    });
    return this.toRecord(row);
  }

  async findById(id: string): Promise<AutoMessageRecord | null> {
    const row = await this.prisma.autoMessageTemplate.findUnique({
      where: { id },
      include: { idol: { select: { name: true, stageName: true } } },
    });
    return row ? this.toRecord(row) : null;
  }

  async list(opts: {
    idolId?: string;
    status?: AutoMessageStatus;
    take: number;
    skip: number;
  }): Promise<{ items: AutoMessageRecord[]; total: number }> {
    const where = {
      ...(opts.idolId ? { idolId: opts.idolId } : {}),
      ...(opts.status ? { status: opts.status } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.autoMessageTemplate.findMany({
        where,
        orderBy: { scheduledAt: 'desc' },
        take: opts.take,
        skip: opts.skip,
        include: { idol: { select: { name: true, stageName: true } } },
      }),
      this.prisma.autoMessageTemplate.count({ where }),
    ]);
    return { items: rows.map((r) => this.toRecord(r)), total };
  }

  async updateStatus(
    id: string,
    patch: {
      status: AutoMessageStatus;
      dispatchedAt?: Date | null;
      recipients?: number;
      failedReason?: string | null;
    },
  ): Promise<AutoMessageRecord> {
    const row = await this.prisma.autoMessageTemplate.update({
      where: { id },
      data: {
        status: patch.status,
        dispatchedAt: patch.dispatchedAt,
        recipients: patch.recipients,
        failedReason: patch.failedReason,
      },
      include: { idol: { select: { name: true, stageName: true } } },
    });
    return this.toRecord(row);
  }

  private toRecord(row: Row): AutoMessageRecord {
    return {
      id: row.id,
      idolId: row.idolId,
      idolName: row.idol.stageName ?? row.idol.name,
      title: row.title,
      content: row.content,
      scheduledAt: row.scheduledAt,
      dispatchedAt: row.dispatchedAt,
      status: row.status,
      recipients: row.recipients,
      failedReason: row.failedReason,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
    };
  }
}
