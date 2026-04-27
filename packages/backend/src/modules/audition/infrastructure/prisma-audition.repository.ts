import { Injectable } from '@nestjs/common';
import type { AuditionStatus, RoundStatus } from '@a-idol/shared';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type {
  AuditionDetailRecord,
  AuditionEntryRecord,
  AuditionListItem,
  AuditionRecord,
  AuditionRepository,
  RoundRecord,
} from '../application/interfaces';

type Row = {
  id: string;
  name: string;
  description: string | null;
  status: AuditionStatus;
  startAt: Date;
  endAt: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type DetailRow = Row & {
  rounds: Array<{
    id: string;
    auditionId: string;
    name: string;
    orderIndex: number;
    status: RoundStatus;
    startAt: Date;
    endAt: Date;
    maxAdvancers: number | null;
  }>;
  entries: Array<{
    id: string;
    auditionId: string;
    idolId: string;
    eliminatedAt: Date | null;
    eliminatedAtRoundId: string | null;
    idol: { name: string; stageName: string | null; heroImageUrl: string | null };
  }>;
};

@Injectable()
export class PrismaAuditionRepository implements AuditionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    name: string;
    description: string | null;
    startAt: Date;
    endAt: Date;
    createdBy: string;
  }): Promise<AuditionRecord> {
    const row = await this.prisma.audition.create({
      data: {
        name: input.name,
        description: input.description,
        startAt: input.startAt,
        endAt: input.endAt,
        createdBy: input.createdBy,
      },
    });
    return this.toRecord(row);
  }

  async findById(id: string): Promise<AuditionRecord | null> {
    const row = await this.prisma.audition.findUnique({ where: { id } });
    return row ? this.toRecord(row) : null;
  }

  async findDetail(id: string): Promise<AuditionDetailRecord | null> {
    const row = await this.prisma.audition.findUnique({
      where: { id },
      include: {
        rounds: { orderBy: { orderIndex: 'asc' } },
        entries: {
          include: {
            idol: { select: { name: true, stageName: true, heroImageUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!row) return null;
    return this.toDetail(row as DetailRow);
  }

  async listAdmin(): Promise<AuditionListItem[]> {
    const rows = await this.prisma.audition.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { rounds: true, entries: true } },
      },
    });
    return rows.map((r) =>
      Object.assign(this.toRecord(r), {
        roundCount: r._count.rounds,
        entryCount: r._count.entries,
      }),
    );
  }

  async listActive(): Promise<AuditionListItem[]> {
    const rows = await this.prisma.audition.findMany({
      where: { deletedAt: null, status: 'ACTIVE' },
      orderBy: { startAt: 'asc' },
      include: {
        _count: { select: { rounds: true, entries: true } },
      },
    });
    return rows.map((r) =>
      Object.assign(this.toRecord(r), {
        roundCount: r._count.rounds,
        entryCount: r._count.entries,
      }),
    );
  }

  async listFinished(): Promise<AuditionListItem[]> {
    const rows = await this.prisma.audition.findMany({
      where: { deletedAt: null, status: 'FINISHED' },
      orderBy: { endAt: 'desc' },
      include: {
        _count: { select: { rounds: true, entries: true } },
      },
    });
    return rows.map((r) =>
      Object.assign(this.toRecord(r), {
        roundCount: r._count.rounds,
        entryCount: r._count.entries,
      }),
    );
  }

  async update(
    id: string,
    patch: {
      name?: string;
      description?: string | null;
      startAt?: Date;
      endAt?: Date;
    },
  ): Promise<AuditionRecord> {
    const row = await this.prisma.audition.update({
      where: { id },
      data: {
        name: patch.name,
        description: patch.description === undefined ? undefined : patch.description,
        startAt: patch.startAt,
        endAt: patch.endAt,
      },
    });
    return this.toRecord(row);
  }

  async setStatus(id: string, status: AuditionStatus): Promise<AuditionRecord> {
    const row = await this.prisma.audition.update({ where: { id }, data: { status } });
    return this.toRecord(row);
  }

  async touchUpdatedAt(id: string): Promise<void> {
    // Manual `updatedAt` write bypasses Prisma `@updatedAt` (which only fires
    // on field-level changes). Empty `data: {}` is a no-op in Prisma, so we
    // explicitly set the column. Idempotent — failing silently on a missing
    // audition is fine (the child mutation upstream would've already raised).
    await this.prisma.audition.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.audition.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private toRecord(row: Row): AuditionRecord {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status,
      startAt: row.startAt,
      endAt: row.endAt,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    };
  }

  private toDetail(row: DetailRow): AuditionDetailRecord {
    const rounds: RoundRecord[] = row.rounds.map((r) => ({
      id: r.id,
      auditionId: r.auditionId,
      name: r.name,
      orderIndex: r.orderIndex,
      status: r.status,
      startAt: r.startAt,
      endAt: r.endAt,
      maxAdvancers: r.maxAdvancers,
    }));
    const entries: AuditionEntryRecord[] = row.entries.map((e) => ({
      id: e.id,
      auditionId: e.auditionId,
      idolId: e.idolId,
      idolName: e.idol.name,
      stageName: e.idol.stageName,
      heroImageUrl: e.idol.heroImageUrl,
      eliminatedAt: e.eliminatedAt,
      eliminatedAtRoundId: e.eliminatedAtRoundId,
    }));
    return { ...this.toRecord(row), rounds, entries };
  }
}
