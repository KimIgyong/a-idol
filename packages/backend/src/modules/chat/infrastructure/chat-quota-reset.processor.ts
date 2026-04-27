import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { CHAT_QUOTA_RESET_QUEUE } from '../../../shared/queue/queue.module';

/**
 * Safety-net for ChatQuota. Lazy reset (in PrismaChatBillingRepository) is
 * the primary path; this cron guarantees any quota rows that are NOT read
 * across a KST day boundary still get zeroed.
 *
 * Cron pattern: `0 0 * * *` in Asia/Seoul → midnight KST.
 */
@Processor(CHAT_QUOTA_RESET_QUEUE)
export class ChatQuotaResetProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  private readonly log = new Logger(ChatQuotaResetProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(CHAT_QUOTA_RESET_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    // Register a repeatable job at startup (idempotent by job name).
    await this.queue.add(
      'reset',
      {},
      {
        repeat: { pattern: '0 0 * * *', tz: 'Asia/Seoul' },
        jobId: 'chat-quota-reset:daily',
        removeOnComplete: { count: 30 },
        removeOnFail: { count: 30 },
      },
    );
    this.log.log('repeatable chat-quota-reset job registered (daily 00:00 KST)');
  }

  async process(_job: Job): Promise<{ affected: number }> {
    // Reset quotas that are stale by calendar day.
    const now = new Date();
    const kstOffsetMs = 9 * 60 * 60 * 1000;
    const todayKstStart = new Date(
      Math.floor((now.getTime() + kstOffsetMs) / 86_400_000) * 86_400_000 - kstOffsetMs,
    );
    const res = await this.prisma.chatQuota.updateMany({
      where: { lastResetAt: { lt: todayKstStart } },
      data: { messagesToday: 0, lastResetAt: now },
    });
    return { affected: res.count };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job, result: { affected: number }): void {
    this.log.log(`quota reset completed: affected=${result?.affected ?? 0} jobId=${job.id}`);
  }
}
