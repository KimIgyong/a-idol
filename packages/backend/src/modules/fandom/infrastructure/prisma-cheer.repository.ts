import { Injectable } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { CheerRecord, CheerRepository } from '../application/interfaces';

@Injectable()
export class PrismaCheerRepository implements CheerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: { userId: string; idolId: string; message: string }): Promise<CheerRecord> {
    // Idol이 존재하고 published되었는지 확인 — soft-deleted/draft에는 응원 불가.
    const idol = await this.prisma.idol.findFirst({
      where: { id: input.idolId, deletedAt: null, publishedAt: { lte: new Date() } },
      select: { id: true },
    });
    if (!idol) {
      throw new DomainError(ErrorCodes.IDOL_NOT_FOUND, 'Idol not found or not published');
    }

    const row = await this.prisma.cheer.create({
      data: { userId: input.userId, idolId: input.idolId, message: input.message },
      include: { user: { select: { nickname: true, avatarUrl: true } } },
    });
    return this.toRecord(row);
  }

  async listByIdol(
    idolId: string,
    opts: { take: number; skip: number },
  ): Promise<{ items: CheerRecord[]; total: number }> {
    const where = { idolId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.cheer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: opts.take,
        skip: opts.skip,
        include: { user: { select: { nickname: true, avatarUrl: true } } },
      }),
      this.prisma.cheer.count({ where }),
    ]);
    return { items: rows.map((r) => this.toRecord(r)), total };
  }

  private toRecord(row: {
    id: string;
    userId: string;
    idolId: string;
    message: string;
    createdAt: Date;
    user: { nickname: string; avatarUrl: string | null };
  }): CheerRecord {
    return {
      id: row.id,
      userId: row.userId,
      idolId: row.idolId,
      message: row.message,
      createdAt: row.createdAt,
      authorNickname: row.user.nickname,
      authorAvatarUrl: row.user.avatarUrl,
    };
  }
}
