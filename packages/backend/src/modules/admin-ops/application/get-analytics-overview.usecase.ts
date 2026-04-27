import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { AdminAnalyticsOverviewDto } from '@a-idol/shared';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { REDIS_CLIENT } from '../../../shared/redis/redis.module';

/**
 * Single aggregated snapshot for the CMS dashboard. Intentionally read-only:
 * everything here is a Postgres `count` or a single Redis fan-out — no
 * expensive joins. Refresh on every page load is cheap enough for MVP;
 * cache later if p95 degrades.
 */
@Injectable()
export class GetAdminAnalyticsOverviewUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async execute(): Promise<AdminAnalyticsOverviewDto> {
    const now = new Date();
    const startOfTodayKst = this.startOfKstDay(now);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);

    const [
      usersTotal,
      usersActive,
      usersNew7d,
      totalIdols,
      publishedIdols,
      draftIdols,
      agencies,
      totalHearts,
      totalFollows,
      activeMemberships,
      roomsCreated,
      messagesToday,
      couponSum,
      activeAuditions,
      activeRounds,
      votesToday,
    ] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null, status: 'active' } }),
      this.prisma.user.count({
        where: { deletedAt: null, createdAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.idol.count({ where: { deletedAt: null } }),
      this.prisma.idol.count({
        where: { deletedAt: null, publishedAt: { not: null, lte: now } },
      }),
      this.prisma.idol.count({
        where: { deletedAt: null, publishedAt: null },
      }),
      this.prisma.agency.count({ where: { deletedAt: null } }),
      this.prisma.heart.count(),
      this.prisma.follow.count(),
      this.prisma.membership.count({ where: { leftAt: null } }),
      this.prisma.chatRoom.count(),
      this.prisma.chatMessage.count({ where: { createdAt: { gte: startOfTodayKst } } }),
      this.prisma.chatCouponWallet.aggregate({ _sum: { balance: true } }),
      this.prisma.audition.count({
        where: { deletedAt: null, status: 'ACTIVE' },
      }),
      this.prisma.round.count({ where: { status: 'ACTIVE' } }),
      this.prisma.vote.count({ where: { createdAt: { gte: startOfTodayKst } } }),
    ]);

    // Active-round leaders: one Redis `ZREVRANGE` per round with top 3.
    const activeRoundRows = await this.prisma.round.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        audition: { select: { name: true } },
      },
      take: 5,
      orderBy: { startAt: 'asc' },
    });

    const activeRoundLeaders = await Promise.all(
      activeRoundRows.map(async (r) => {
        const raw = await this.redis.zrevrange(
          `vote:leaderboard:r:${r.id}`,
          0,
          2,
          'WITHSCORES',
        );
        const pairs: Array<{ idolId: string; score: number }> = [];
        for (let i = 0; i < raw.length; i += 2) {
          pairs.push({ idolId: raw[i]!, score: Number(raw[i + 1]!) });
        }
        const idolIds = pairs.map((p) => p.idolId);
        const idols = idolIds.length
          ? await this.prisma.idol.findMany({
              where: { id: { in: idolIds } },
              select: { id: true, name: true, stageName: true },
            })
          : [];
        const byId = new Map(idols.map((i) => [i.id, i]));
        return {
          roundId: r.id,
          roundName: r.name,
          auditionName: r.audition.name,
          top: pairs.map((p, idx) => {
            const i = byId.get(p.idolId);
            return {
              rank: idx + 1,
              idolName: i?.stageName ?? i?.name ?? '(unknown)',
              score: p.score,
            };
          }),
        };
      }),
    );

    return {
      users: { total: usersTotal, active: usersActive, new7d: usersNew7d },
      catalog: { totalIdols, published: publishedIdols, draft: draftIdols, agencies },
      fandom: {
        totalHearts,
        totalFollows,
        activeMemberships,
      },
      chat: {
        roomsCreated,
        messagesToday,
        couponBalanceSum: couponSum._sum.balance ?? 0,
      },
      auditions: {
        active: activeAuditions,
        activeRounds,
        totalVotesToday: votesToday,
      },
      activeRoundLeaders,
      generatedAt: now.toISOString(),
    };
  }

  /** Start of the current KST calendar day, expressed as a UTC Date. */
  private startOfKstDay(now: Date): Date {
    const kstOffsetMs = 9 * 3600 * 1000;
    const day = Math.floor((now.getTime() + kstOffsetMs) / 86_400_000);
    return new Date(day * 86_400_000 - kstOffsetMs);
  }
}
