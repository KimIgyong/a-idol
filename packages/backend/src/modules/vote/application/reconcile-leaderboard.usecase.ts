import { Inject, Injectable, Logger } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import type { Redis } from 'ioredis';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { REDIS_CLIENT } from '../../../shared/redis/redis.module';

export interface ReconcileResult {
  roundId: string;
  sourceRows: number;
  entriesWritten: number;
  totalScore: number;
  completedAt: Date;
}

/**
 * Rebuild `vote:leaderboard:r:{roundId}` from the `Vote` audit table.
 *
 * Called when Redis is flushed mid-round, or as a periodic sanity check.
 * Uses the `Vote` rows as authority (each row has its applied weight at the
 * time of cast), sums per idol, then overwrites the ZSET atomically via
 * DEL + ZADD in a MULTI.
 *
 * ADR-014 names Redis as source of truth for the live leaderboard; this
 * usecase is the Postgres-side recovery path.
 */
@Injectable()
export class ReconcileLeaderboardUseCase {
  private readonly log = new Logger(ReconcileLeaderboardUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async execute(roundId: string): Promise<ReconcileResult> {
    const round = await this.prisma.round.findUnique({
      where: { id: roundId },
      select: { id: true },
    });
    if (!round) {
      throw new DomainError(ErrorCodes.ROUND_NOT_FOUND, 'Round not found');
    }

    // GROUP BY idol — Prisma doesn't have SUM(Decimal) natively without
    // groupBy aggregates, but we can use it directly.
    const rows = await this.prisma.vote.groupBy({
      by: ['idolId'],
      where: { roundId },
      _sum: { weight: true },
    });

    const sourceRows = rows.length;
    const key = `vote:leaderboard:r:${roundId}`;

    if (sourceRows === 0) {
      await this.redis.del(key);
      return {
        roundId,
        sourceRows: 0,
        entriesWritten: 0,
        totalScore: 0,
        completedAt: new Date(),
      };
    }

    const pipeline = this.redis.multi();
    pipeline.del(key);
    let totalScore = 0;
    const zaddArgs: (string | number)[] = [];
    for (const r of rows) {
      const score = r._sum.weight ? Number(r._sum.weight) : 0;
      if (score <= 0) continue;
      zaddArgs.push(score, r.idolId);
      totalScore += score;
    }
    if (zaddArgs.length > 0) {
      pipeline.zadd(key, ...zaddArgs);
    }
    await pipeline.exec();

    const entriesWritten = zaddArgs.length / 2;
    this.log.log(
      `reconciled round=${roundId} rows=${sourceRows} entries=${entriesWritten} total=${totalScore}`,
    );
    return {
      roundId,
      sourceRows,
      entriesWritten,
      totalScore,
      completedAt: new Date(),
    };
  }
}
