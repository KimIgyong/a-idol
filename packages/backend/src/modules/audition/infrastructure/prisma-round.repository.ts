import { Injectable } from '@nestjs/common';
import type { RoundStatus } from '@a-idol/shared';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { RoundRecord, RoundRepository } from '../application/interfaces';

type Row = {
  id: string;
  auditionId: string;
  name: string;
  orderIndex: number;
  status: RoundStatus;
  startAt: Date;
  endAt: Date;
  maxAdvancers: number | null;
};

@Injectable()
export class PrismaRoundRepository implements RoundRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    auditionId: string;
    name: string;
    orderIndex: number;
    startAt: Date;
    endAt: Date;
    maxAdvancers: number | null;
  }): Promise<RoundRecord> {
    const row = await this.prisma.round.create({ data: input });
    return this.toRecord(row);
  }

  async findById(id: string): Promise<RoundRecord | null> {
    const row = await this.prisma.round.findUnique({ where: { id } });
    return row ? this.toRecord(row) : null;
  }

  async listByAudition(auditionId: string): Promise<RoundRecord[]> {
    const rows = await this.prisma.round.findMany({
      where: { auditionId },
      orderBy: { orderIndex: 'asc' },
    });
    return rows.map((r) => this.toRecord(r));
  }

  async update(
    id: string,
    patch: {
      name?: string;
      orderIndex?: number;
      startAt?: Date;
      endAt?: Date;
      maxAdvancers?: number | null;
    },
  ): Promise<RoundRecord> {
    const row = await this.prisma.round.update({
      where: { id },
      data: {
        name: patch.name,
        orderIndex: patch.orderIndex,
        startAt: patch.startAt,
        endAt: patch.endAt,
        maxAdvancers:
          patch.maxAdvancers === undefined ? undefined : patch.maxAdvancers,
      },
    });
    return this.toRecord(row);
  }

  async setStatus(id: string, status: RoundStatus): Promise<RoundRecord> {
    const row = await this.prisma.round.update({ where: { id }, data: { status } });
    return this.toRecord(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.round.delete({ where: { id } });
  }

  private toRecord(row: Row): RoundRecord {
    return {
      id: row.id,
      auditionId: row.auditionId,
      name: row.name,
      orderIndex: row.orderIndex,
      status: row.status,
      startAt: row.startAt,
      endAt: row.endAt,
      maxAdvancers: row.maxAdvancers,
    };
  }
}
