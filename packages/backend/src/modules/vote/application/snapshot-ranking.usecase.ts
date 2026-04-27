import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { VoteCounterRepository } from './interfaces';
import { VOTE_COUNTER_REPOSITORY } from './interfaces';

export interface SnapshotResult {
  roundId: string;
  rows: number;
  snapshotAt: Date;
}

/**
 * Reads the top-100 from Redis and inserts a rank row per idol into
 * `round_ranking_snapshots`. Called by the BullMQ cron every 5 minutes
 * (per round with an ACTIVE status) and once more from the round-close hook.
 */
@Injectable()
export class SnapshotRankingUseCase {
  private readonly log = new Logger(SnapshotRankingUseCase.name);

  constructor(
    @Inject(VOTE_COUNTER_REPOSITORY) private readonly counters: VoteCounterRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(roundId: string): Promise<SnapshotResult> {
    const snapshotAt = new Date();
    const top = await this.counters.topForRound(roundId, 100);
    if (top.length === 0) {
      return { roundId, rows: 0, snapshotAt };
    }
    await this.prisma.roundRankingSnapshot.createMany({
      data: top.map((t, idx) => ({
        roundId,
        snapshotAt,
        idolId: t.idolId,
        rank: idx + 1,
        score: t.score,
      })),
    });
    this.log.debug(`snapshot round=${roundId} rows=${top.length}`);
    return { roundId, rows: top.length, snapshotAt };
  }

  /** List active rounds whose leaderboard the cron should flush. */
  async listRoundIdsNeedingSnapshot(): Promise<string[]> {
    const rows = await this.prisma.round.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
}
