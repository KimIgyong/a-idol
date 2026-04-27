import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { REDIS_CLIENT } from '../../../shared/redis/redis.module';

export interface AuditResult {
  roundId: string;
  /** Number of idols in the Redis sorted set. 0 = empty / flushed cache. */
  zsetEntries: number;
  /** Sum of scores across all ZSET members. */
  redisSum: number;
  /** Sum of `Vote.weight` grouped by idol in the audit table. */
  auditSum: number;
  /** auditSum - redisSum (positive = Redis is missing votes). */
  divergenceAbs: number;
  /** |divergence| / max(auditSum, 1) * 100 — for alerting thresholds. */
  divergencePct: number;
}

/**
 * Compares the Redis ZSET score-total for a round against the Postgres
 * `Vote` audit-sum. Used by the hourly audit cron + the boot-time warmup
 * decision (see LeaderboardAuditProcessor).
 *
 * ADR-014 makes Redis the source of truth for the live leaderboard — this
 * usecase is the monitoring side of that invariant, not a corrector.
 */
@Injectable()
export class AuditLeaderboardUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async execute(roundId: string): Promise<AuditResult> {
    const key = `vote:leaderboard:r:${roundId}`;

    // ZRANGE WITHSCORES → even indices are members, odd are string scores.
    // Our sets are small (≤ ~100 idols) so reading the whole ZSET is fine.
    const [zRaw, groups] = await Promise.all([
      this.redis.zrange(key, 0, -1, 'WITHSCORES'),
      this.prisma.vote.groupBy({
        by: ['idolId'],
        where: { roundId },
        _sum: { weight: true },
      }),
    ]);

    let redisSum = 0;
    for (let i = 1; i < zRaw.length; i += 2) {
      redisSum += Number(zRaw[i]);
    }
    const zsetEntries = zRaw.length / 2;

    const auditSum = groups.reduce(
      (acc, g) => acc + (g._sum.weight ? Number(g._sum.weight) : 0),
      0,
    );
    const divergenceAbs = auditSum - redisSum;
    const divergencePct =
      auditSum === 0 ? 0 : (Math.abs(divergenceAbs) / auditSum) * 100;

    return {
      roundId,
      zsetEntries,
      redisSum,
      auditSum,
      divergenceAbs,
      divergencePct,
    };
  }

  /** ACTIVE rounds only — CLOSED rounds have their final snapshot already. */
  async listActiveRoundIds(): Promise<string[]> {
    const rows = await this.prisma.round.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
}
