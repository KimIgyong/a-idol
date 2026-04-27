import { Injectable } from '@nestjs/common';
import { DomainError, ErrorCodes, Idol } from '@a-idol/shared';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { FollowRepository } from '../application/interfaces';

@Injectable()
export class PrismaFollowRepository implements FollowRepository {
  constructor(private readonly prisma: PrismaService) {}

  async toggle(userId: string, idolId: string): Promise<{ following: boolean; followCount: number }> {
    return this.prisma.$transaction(async (tx) => {
      const idol = await tx.idol.findFirst({
        where: { id: idolId, deletedAt: null },
        select: { id: true },
      });
      if (!idol) throw new DomainError(ErrorCodes.IDOL_NOT_FOUND, 'Idol not found');

      const existing = await tx.follow.findUnique({
        where: { userId_idolId: { userId, idolId } },
        select: { userId: true },
      });

      let following: boolean;
      if (existing) {
        await tx.follow.delete({ where: { userId_idolId: { userId, idolId } } });
        following = false;
      } else {
        await tx.follow.create({ data: { userId, idolId } });
        following = true;
      }

      const updated = await tx.idol.update({
        where: { id: idolId },
        data: { followCount: { increment: following ? 1 : -1 } },
        select: { followCount: true },
      });
      return { following, followCount: Number(updated.followCount) };
    });
  }

  async getMyListIdentity(userId: string): Promise<{ total: number; maxCreatedAt: Date | null }> {
    const where = { userId, idol: { deletedAt: null } };
    const [total, agg] = await this.prisma.$transaction([
      this.prisma.follow.count({ where }),
      this.prisma.follow.aggregate({ where, _max: { createdAt: true } }),
    ]);
    return { total, maxCreatedAt: agg._max.createdAt ?? null };
  }

  async listFollowedIdols(
    userId: string,
    opts: { take: number; skip: number },
  ): Promise<{ items: Idol[]; total: number }> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.follow.findMany({
        where: { userId, idol: { deletedAt: null } },
        // Exclude Idol.profileJson (~10 KB JSONB) — mapper only reads 10
        // scalar fields. Matches PrismaIdolRepository.listPublished narrowing.
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
      this.prisma.follow.count({ where: { userId, idol: { deletedAt: null } } }),
    ]);

    const items = rows.map(
      (f) =>
        new Idol({
          id: f.idol.id,
          agencyId: f.idol.agencyId,
          name: f.idol.name,
          stageName: f.idol.stageName,
          mbti: f.idol.mbti,
          bio: f.idol.bio,
          heroImageUrl: f.idol.heroImageUrl,
          heartCount: Number(f.idol.heartCount),
          followCount: Number(f.idol.followCount),
          publishedAt: f.idol.publishedAt,
        }),
    );
    return { items, total };
  }
}
