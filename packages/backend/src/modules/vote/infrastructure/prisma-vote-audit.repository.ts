import { Injectable } from '@nestjs/common';
import type { VoteMethod } from '@a-idol/shared';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { MyVoteEntry, VoteAuditRepository } from '../application/interfaces';

@Injectable()
export class PrismaVoteAuditRepository implements VoteAuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async append(input: {
    roundId: string;
    idolId: string;
    userId: string;
    method: VoteMethod;
    weight: number;
  }): Promise<void> {
    await this.prisma.vote.create({
      data: {
        roundId: input.roundId,
        idolId: input.idolId,
        userId: input.userId,
        method: input.method,
        weight: input.weight,
      },
    });
  }

  async listMyVotes(
    userId: string,
    opts: { take: number; skip: number },
  ): Promise<{ items: MyVoteEntry[]; total: number }> {
    const where = { userId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.vote.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: opts.take,
        skip: opts.skip,
      }),
      this.prisma.vote.count({ where }),
    ]);
    if (rows.length === 0) return { items: [], total };

    const idolIds = Array.from(new Set(rows.map((r) => r.idolId)));
    const roundIds = Array.from(new Set(rows.map((r) => r.roundId)));

    const [idols, rounds] = await Promise.all([
      this.prisma.idol.findMany({
        where: { id: { in: idolIds } },
        select: { id: true, name: true, stageName: true, heroImageUrl: true },
      }),
      this.prisma.round.findMany({
        where: { id: { in: roundIds } },
        select: {
          id: true,
          name: true,
          auditionId: true,
          audition: { select: { id: true, name: true } },
        },
      }),
    ]);

    const idolMap = new Map(idols.map((i) => [i.id, i]));
    const roundMap = new Map(rounds.map((r) => [r.id, r]));

    const items: MyVoteEntry[] = rows.map((v) => {
      const idol = idolMap.get(v.idolId);
      const round = roundMap.get(v.roundId);
      const weight =
        typeof v.weight === 'number'
          ? v.weight
          : Number(v.weight.toString());
      return {
        id: v.id,
        roundId: v.roundId,
        roundName: round?.name ?? '— 삭제된 라운드',
        auditionId: round?.audition?.id ?? '',
        auditionName: round?.audition?.name ?? '— 삭제된 오디션',
        idolId: v.idolId,
        idolName: idol?.name ?? '— 삭제된 아이돌',
        idolStageName: idol?.stageName ?? null,
        idolHeroImageUrl: idol?.heroImageUrl ?? null,
        method: v.method as VoteMethod,
        weight,
        createdAt: v.createdAt,
      };
    });

    return { items, total };
  }
}
