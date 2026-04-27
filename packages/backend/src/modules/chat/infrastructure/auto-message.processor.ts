import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { DispatchAutoMessageUseCase } from '../application/dispatch-auto-message.usecase';
import { AUTO_MESSAGE_QUEUE } from '../../../shared/queue/queue.module';

@Processor(AUTO_MESSAGE_QUEUE)
export class AutoMessageProcessor extends WorkerHost {
  private readonly log = new Logger(AutoMessageProcessor.name);

  constructor(private readonly dispatch: DispatchAutoMessageUseCase) {
    super();
  }

  async process(job: Job<{ templateId: string }>): Promise<{ recipients: number }> {
    const { templateId } = job.data;
    this.log.log(`dispatching auto-message ${templateId}`);
    const res = await this.dispatch.execute(templateId);
    this.log.log(
      `auto-message ${templateId} delivered=${res.recipients} status=${res.status}`,
    );
    return { recipients: res.recipients };
  }
}
