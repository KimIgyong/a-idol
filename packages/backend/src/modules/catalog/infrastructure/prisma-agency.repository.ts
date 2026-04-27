import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { AgencyRecord, AgencyRepository } from '../application/admin-interfaces';

@Injectable()
export class PrismaAgencyRepository implements AgencyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<AgencyRecord[]> {
    const rows = await this.prisma.agency.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      include: { _count: { select: { idols: { where: { deletedAt: null } } } } },
    });
    return rows.map((r) => this.toRecord(r));
  }

  async findById(id: string): Promise<AgencyRecord | null> {
    const row = await this.prisma.agency.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { idols: { where: { deletedAt: null } } } } },
    });
    return row ? this.toRecord(row) : null;
  }

  async create(input: { name: string; description: string | null }): Promise<AgencyRecord> {
    const row = await this.prisma.agency.create({
      data: { name: input.name, description: input.description },
      include: { _count: { select: { idols: { where: { deletedAt: null } } } } },
    });
    return this.toRecord(row);
  }

  async update(
    id: string,
    patch: { name?: string; description?: string | null },
  ): Promise<AgencyRecord> {
    const row = await this.prisma.agency.update({
      where: { id },
      data: {
        name: patch.name,
        description: patch.description === undefined ? undefined : patch.description,
      },
      include: { _count: { select: { idols: { where: { deletedAt: null } } } } },
    });
    return this.toRecord(row);
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.agency.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private toRecord(row: {
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count: { idols: number };
  }): AgencyRecord {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      idolCount: row._count.idols,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
