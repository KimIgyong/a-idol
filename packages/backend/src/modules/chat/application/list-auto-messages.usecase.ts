import { Inject, Injectable } from '@nestjs/common';
import type { AutoMessageStatus } from '@a-idol/shared';
import type { AutoMessageRepository } from './auto-message-interfaces';
import { AUTO_MESSAGE_REPOSITORY } from './auto-message-interfaces';

@Injectable()
export class ListAutoMessagesUseCase {
  constructor(
    @Inject(AUTO_MESSAGE_REPOSITORY) private readonly repo: AutoMessageRepository,
  ) {}

  execute(opts: {
    idolId?: string;
    status?: AutoMessageStatus;
    page: number;
    size: number;
  }) {
    const page = Math.max(opts.page, 1);
    const size = Math.min(Math.max(opts.size, 1), 100);
    return this.repo.list({
      idolId: opts.idolId,
      status: opts.status,
      take: size,
      skip: (page - 1) * size,
    });
  }
}
