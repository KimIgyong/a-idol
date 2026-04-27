import { Inject, Injectable } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import type {
  AutoMessageRecord,
  AutoMessageRepository,
  AutoMessageScheduler,
} from './auto-message-interfaces';
import {
  AUTO_MESSAGE_REPOSITORY,
  AUTO_MESSAGE_SCHEDULER,
} from './auto-message-interfaces';
import type { AdminIdolRepository } from '../../catalog/application/admin-interfaces';
import { ADMIN_IDOL_REPOSITORY } from '../../catalog/application/admin-interfaces';

@Injectable()
export class ScheduleAutoMessageUseCase {
  constructor(
    @Inject(AUTO_MESSAGE_REPOSITORY) private readonly repo: AutoMessageRepository,
    @Inject(AUTO_MESSAGE_SCHEDULER) private readonly scheduler: AutoMessageScheduler,
    @Inject(ADMIN_IDOL_REPOSITORY) private readonly idols: AdminIdolRepository,
  ) {}

  async execute(input: {
    idolId: string;
    title: string;
    content: string;
    scheduledAt: string;
    createdBy: string;
  }): Promise<AutoMessageRecord> {
    const idol = await this.idols.findById(input.idolId);
    if (!idol) throw new DomainError(ErrorCodes.IDOL_NOT_FOUND, 'Idol not found');

    const scheduledAt = new Date(input.scheduledAt);
    const now = new Date();
    // Allow a small clock-skew tolerance (30s past) so admins can submit
    // "now" without fighting milliseconds.
    if (scheduledAt.getTime() < now.getTime() - 30_000) {
      throw new DomainError(
        ErrorCodes.AUTO_MESSAGE_PAST_SCHEDULE,
        'scheduledAt must be in the future',
      );
    }

    const record = await this.repo.create({
      idolId: input.idolId,
      title: input.title.trim(),
      content: input.content.trim(),
      scheduledAt,
      createdBy: input.createdBy,
    });

    await this.scheduler.schedule({ templateId: record.id, scheduledAt });

    return record;
  }
}
