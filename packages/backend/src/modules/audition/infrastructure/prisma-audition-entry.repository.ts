import { Injectable } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type {
  AuditionEntryRecord,
  AuditionEntryRepository,
} from '../application/interfaces';

type Row = {
  id: string;
  auditionId: string;
  idolId: string;
  eliminatedAt: Date | null;
  eliminatedAtRoundId: string | null;
  idol: { name: string; stageName: string | null; heroImageUrl: string | null };
};

@Injectable()
export class PrismaAuditionEntryRepository implements AuditionEntryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async addMany(auditionId: string, idolIds: string[]): Promise<AuditionEntryRecord[]> {
    const rows = await this.prisma.$transaction(async (tx) => {
      // Existing idolIds in this audition.
      const existing = await tx.auditionEntry.findMany({
        where: { auditionId, idolId: { in: idolIds } },
        select: { idolId: true },
      });
      const existingSet = new Set(existing.map((e) => e.idolId));
      if (existingSet.size > 0) {
        throw new DomainError(
          ErrorCodes.IDOL_ALREADY_IN_AUDITION,
          'Some idols are already entered in this audition',
          { idolIds: [...existingSet] },
        );
      }
      await tx.auditionEntry.createMany({
        data: idolIds.map((idolId) => ({ auditionId, idolId })),
      });
      return tx.auditionEntry.findMany({
        where: { auditionId, idolId: { in: idolIds } },
        include: {
          idol: { select: { name: true, stageName: true, heroImageUrl: true } },
        },
      });
    });
    return rows.map((r) => this.toRecord(r));
  }

  async remove(auditionId: string, idolId: string): Promise<void> {
    const existing = await this.prisma.auditionEntry.findUnique({
      where: { auditionId_idolId: { auditionId, idolId } },
    });
    if (!existing) {
      throw new DomainError(
        ErrorCodes.AUDITION_ENTRY_NOT_FOUND,
        'Idol is not entered in this audition',
      );
    }
    await this.prisma.auditionEntry.delete({
      where: { auditionId_idolId: { auditionId, idolId } },
    });
  }

  async listByAudition(auditionId: string): Promise<AuditionEntryRecord[]> {
    const rows = await this.prisma.auditionEntry.findMany({
      where: { auditionId },
      include: {
        idol: { select: { name: true, stageName: true, heroImageUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toRecord(r));
  }

  private toRecord(row: Row): AuditionEntryRecord {
    return {
      id: row.id,
      auditionId: row.auditionId,
      idolId: row.idolId,
      idolName: row.idol.name,
      stageName: row.idol.stageName,
      heroImageUrl: row.idol.heroImageUrl,
      eliminatedAt: row.eliminatedAt,
      eliminatedAtRoundId: row.eliminatedAtRoundId,
    };
  }
}
