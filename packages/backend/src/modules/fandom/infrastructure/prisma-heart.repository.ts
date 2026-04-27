import { Injectable } from '@nestjs/common';
import { DomainError, ErrorCodes, Idol } from '@a-idol/shared';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { HeartRepository } from '../application/interfaces';

@Injectable()
export class PrismaHeartRepository implements HeartRepository {
  constructor(private readonly prisma: PrismaService) {}

  async toggle(userId: string, idolId: string): Promise<{ hearted: boolean; heartCount: number }> {
    return this.prisma.$transaction(async (tx) => {
      // Ensure the idol exists and is not soft-deleted — avoids orphan rows.
      const idol = await tx.idol.findFirst({
        where: { id: idolId, deletedAt: null },
        select: { id: true },
      });
      if (!idol) throw new DomainError(ErrorCodes.IDOL_NOT_FOUND, 'Idol not found');

      const existing = await tx.heart.findUnique({
        where: { userId_idolId: { userId, idolId } },
        select: { userId: true },
      });

      let hearted: boolean;
      if (existing) {
        await tx.heart.delete({ where: { userId_idolId: { userId, idolId } } });
        hearted = false;
      } else {
        await tx.heart.create({ data: { userId, idolId } });
        hearted = true;
      }

      const updated = await tx.idol.update({
        where: { id: idolId },
        data: { heartCount: { increment: hearted ? 1 : -1 } },
        select: { heartCount: true },
      });
      return { hearted, heartCount: Number(updated.heartCount) };
    });
  }

  async getMyListIdentity(userId: string): Promise<{ total: number; maxCreatedAt: Date | null }> {
    const where = { userId, idol: { deletedAt: null } };
    const [total, agg] = await this.prisma.$transaction([
      this.prisma.heart.count({ where }),
      this.prisma.heart.aggregate({ where, _max: { createdAt: true } }),
    ]);
    return { total, maxCreatedAt: agg._max.createdAt ?? null };
  }

  async listHeartedIdols(
    userId: string,
    opts: { take: number; skip: number },
  ): Promise<{ items: Idol[]; total: number }> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.heart.findMany({
        where: { userId, idol: { deletedAt: null } },
        // Exclude Idol.profileJson (~10 KB JSONB) — the mapper below only uses
        // 10 scalar fields to build the Idol entity. Same narrowing rationale
        // as PrismaIdolRepository.listPublished (see perf-baseline-ko.md).
        select: {
          idol: {
            select: {
              id: true,
              agencyId: true,
              name: true,
              stageName: true,
              mbti: true,
              bio: true,
              heroImageUrl: true,
              heartCount: true,
              followCount: true,
              publishedAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: opts.take,
        skip: opts.skip,
      }),
      this.prisma.heart.count({ where: { userId, idol: { deletedAt: null } } }),
    ]);

    const items = rows.map(
      (h) =>
        new Idol({
          id: h.idol.id,
          agencyId: h.idol.agencyId,
          name: h.idol.name,
          stageName: h.idol.stageName,
          mbti: h.idol.mbti,
          bio: h.idol.bio,
          heroImageUrl: h.idol.heroImageUrl,
          heartCount: Number(h.idol.heartCount),
          followCount: Number(h.idol.followCount),
          publishedAt: h.idol.publishedAt,
        }),
    );
    return { items, total };
  }
}
