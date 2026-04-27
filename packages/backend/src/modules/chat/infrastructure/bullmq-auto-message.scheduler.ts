import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { AutoMessageScheduler } from '../application/auto-message-interfaces';
import { AUTO_MESSAGE_QUEUE } from '../../../shared/queue/queue.module';

@Injectable()
export class BullmqAutoMessageScheduler implements AutoMessageScheduler {
  constructor(
    @InjectQueue(AUTO_MESSAGE_QUEUE) private readonly queue: Queue,
  ) {}

  async schedule(input: { templateId: string; scheduledAt: Date }): Promise<void> {
    const delay = Math.max(0, input.scheduledAt.getTime() - Date.now());
    await this.queue.add(
      'dispatch',
      { templateId: input.templateId },
      {
        jobId: input.templateId, // enables cancel(templateId)
        delay,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 200 },
      },
    );
  }

  async cancel(templateId: string): Promise<void> {
    const job = await this.queue.getJob(templateId);
    if (job) await job.remove();
  }
}
