import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { SnapshotRankingUseCase } from '../application/snapshot-ranking.usecase';
import { RANKING_SNAPSHOT_QUEUE } from '../../../shared/queue/queue.module';

// Cron pattern: every 5 minutes — every_5min
const CRON_EVERY_5_MIN = '*/5 * * * *';

// Snapshot the live Redis leaderboard for every ACTIVE round into Postgres.
// Redis remains the serving path for GET /rounds/:id/leaderboard; these rows
// are durable backup + final-result fixation when a round closes.
@Processor(RANKING_SNAPSHOT_QUEUE)
export class RankingSnapshotProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  private readonly log = new Logger(RankingSnapshotProcessor.name);

  constructor(
    private readonly snapshot: SnapshotRankingUseCase,
    @InjectQueue(RANKING_SNAPSHOT_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.add(
      'snapshot',
      {},
      {
        repeat: { pattern: CRON_EVERY_5_MIN },
        jobId: 'ranking-snapshot:every-5min',
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 50 },
      },
    );
    this.log.log('repeatable ranking-snapshot job registered (every 5 min)');
  }

  async process(_job: Job): Promise<{ rounds: number; rows: number }> {
    const roundIds = await this.snapshot.listRoundIdsNeedingSnapshot();
    let totalRows = 0;
    for (const roundId of roundIds) {
      try {
        const res = await this.snapshot.execute(roundId);
        totalRows += res.rows;
      } catch (err) {
        this.log.warn(`snapshot failed for round=${roundId}: ${(err as Error).message}`);
      }
    }
    return { rounds: roundIds.length, rows: totalRows };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job, result: { rounds: number; rows: number }): void {
    this.log.debug(`snapshot run rounds=${result?.rounds ?? 0} rows=${result?.rows ?? 0}`);
  }
}
