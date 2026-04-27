import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { AuditLeaderboardUseCase } from '../application/audit-leaderboard.usecase';
import { ReconcileLeaderboardUseCase } from '../application/reconcile-leaderboard.usecase';
import { LEADERBOARD_AUDIT_QUEUE } from '../../../shared/queue/queue.module';

// Cron pattern: hourly at minute 0.
const CRON_HOURLY = '0 * * * *';

// Threshold above which a divergence warrants a WARN log. Below this, we
// accept rounding / in-flight mutation noise.
const ALERT_PCT_THRESHOLD = 5;

export interface AuditTickResult {
  rounds: number;
  warmed: number;
  diverged: number;
}

/**
 * Observability + safety net for the Redis leaderboard (ADR-014).
 *
 * - On application bootstrap: register the hourly repeatable cron AND fire
 *   one immediate tick so a redeploy after a Redis flush recovers state
 *   without an operator running `POST /admin/rounds/:id/reconcile-leaderboard`.
 * - Per tick, for every ACTIVE round:
 *   - if the ZSET is empty but votes exist → auto-reconcile (boot warmup).
 *   - otherwise, if |audit - redis| / audit > ALERT_PCT_THRESHOLD → log WARN.
 *
 * We deliberately do NOT auto-reconcile on non-empty divergence — a partial
 * drift often signals a bug worth investigating; silently re-syncing would
 * mask it. Empty ZSET is the one case where "rebuild from audit" is
 * unambiguously correct.
 */
@Processor(LEADERBOARD_AUDIT_QUEUE)
export class LeaderboardAuditProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  private readonly log = new Logger(LeaderboardAuditProcessor.name);

  constructor(
    private readonly audit: AuditLeaderboardUseCase,
    private readonly reconcile: ReconcileLeaderboardUseCase,
    @InjectQueue(LEADERBOARD_AUDIT_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    // Hourly repeatable job for ongoing monitoring.
    await this.queue.add(
      'audit',
      {},
      {
        repeat: { pattern: CRON_HOURLY },
        jobId: 'leaderboard-audit:hourly',
        removeOnComplete: { count: 24 },
        removeOnFail: { count: 24 },
      },
    );
    // One immediate pass — this is the "boot warmup" path. Enqueued rather
    // than run inline so BullMQ retries on transient failures.
    await this.queue.add(
      'audit',
      { reason: 'bootstrap' },
      { removeOnComplete: true, removeOnFail: { count: 5 } },
    );
    this.log.log('leaderboard-audit cron registered (hourly) + bootstrap tick queued');
  }

  async process(job: Job<{ reason?: string }>): Promise<AuditTickResult> {
    const rounds = await this.audit.listActiveRoundIds();
    let warmed = 0;
    let diverged = 0;

    for (const roundId of rounds) {
      try {
        const result = await this.audit.execute(roundId);
        if (result.zsetEntries === 0 && result.auditSum > 0) {
          this.log.warn(
            `ZSET empty with votes present (round=${roundId}, auditSum=${result.auditSum}) — auto-reconciling`,
          );
          await this.reconcile.execute(roundId);
          warmed += 1;
          continue;
        }
        if (result.divergencePct > ALERT_PCT_THRESHOLD) {
          this.log.warn(
            `leaderboard divergence round=${roundId} audit=${result.auditSum} redis=${result.redisSum} diff=${result.divergenceAbs} (${result.divergencePct.toFixed(2)}%) — INVESTIGATE, not auto-fixing`,
          );
          diverged += 1;
        }
      } catch (err) {
        this.log.error(
          `audit failed for round=${roundId}: ${(err as Error).message}`,
        );
      }
    }

    const summary = { rounds: rounds.length, warmed, diverged };
    const reason = job.data?.reason ?? 'scheduled';
    if (warmed > 0 || diverged > 0 || reason === 'bootstrap') {
      this.log.log(
        `audit tick (${reason}): rounds=${summary.rounds} warmed=${summary.warmed} diverged=${summary.diverged}`,
      );
    }
    return summary;
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error): void {
    this.log.error(`audit job failed id=${job.id}: ${err.message}`);
  }
}
