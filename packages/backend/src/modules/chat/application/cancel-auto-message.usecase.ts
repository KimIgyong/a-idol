import { Inject, Injectable } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import type {
  AutoMessageRepository,
  AutoMessageScheduler,
} from './auto-message-interfaces';
import {
  AUTO_MESSAGE_REPOSITORY,
  AUTO_MESSAGE_SCHEDULER,
} from './auto-message-interfaces';

@Injectable()
export class CancelAutoMessageUseCase {
  constructor(
    @Inject(AUTO_MESSAGE_REPOSITORY) private readonly repo: AutoMessageRepository,
    @Inject(AUTO_MESSAGE_SCHEDULER) private readonly scheduler: AutoMessageScheduler,
  ) {}

  async execute(id: string) {
    const record = await this.repo.findById(id);
    if (!record) throw new DomainError(ErrorCodes.AUTO_MESSAGE_NOT_FOUND, 'Auto-message not found');
    if (record.status === 'DISPATCHED') {
      throw new DomainError(
        ErrorCodes.AUTO_MESSAGE_ALREADY_DISPATCHED,
        'Already dispatched; cannot cancel',
      );
    }
    if (record.status === 'CANCELED') return record;

    await this.scheduler.cancel(id);
    return this.repo.updateStatus(id, { status: 'CANCELED' });
  }
}
