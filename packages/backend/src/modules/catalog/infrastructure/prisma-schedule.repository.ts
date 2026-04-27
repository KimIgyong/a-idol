import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type {
  IdolScheduleRecord,
  IdolScheduleRepository,
  IdolScheduleType,
} from '../application/admin-interfaces';

type ScheduleRow = {
  id: string;
  idolId: string;
  type: IdolScheduleType;
  title: string;
  location: string | null;
  startAt: Date;
  endAt: Date | null;
  notes: string | null;
  createdAt: Date;
};

@Injectable()
export class PrismaIdolScheduleRepository implements IdolScheduleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByIdol(idolId: string): Promise<IdolScheduleRecord[]> {
    const rows = await this.prisma.idolSchedule.findMany({
      where: { idolId, deletedAt: null },
      orderBy: { startAt: 'asc' },
    });
    return rows.map((r) => this.toRecord(r));
  }

  async create(input: {
    idolId: string;
    type: IdolScheduleType;
    title: string;
    location: string | null;
    startAt: Date;
    endAt: Date | null;
    notes: string | null;
  }): Promise<IdolScheduleRecord> {
    const row = await this.prisma.idolSchedule.create({ data: input });
    return this.toRecord(row);
  }

  async findById(id: string): Promise<IdolScheduleRecord | null> {
    const row = await this.prisma.idolSchedule.findFirst({ where: { id, deletedAt: null } });
    return row ? this.toRecord(row) : null;
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.idolSchedule.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private toRecord(r: ScheduleRow): IdolScheduleRecord {
    return {
      id: r.id,
      idolId: r.idolId,
      type: r.type,
      title: r.title,
      location: r.location,
      startAt: r.startAt,
      endAt: r.endAt,
      notes: r.notes,
      createdAt: r.createdAt,
    };
  }
}
