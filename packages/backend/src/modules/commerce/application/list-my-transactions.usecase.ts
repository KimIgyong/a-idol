import { Inject, Injectable } from '@nestjs/common';
import type { TransactionRecord, TransactionRepository } from './interfaces';
import { TRANSACTION_REPOSITORY } from './interfaces';

@Injectable()
export class ListMyTransactionsUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY) private readonly txs: TransactionRepository,
  ) {}

  execute(userId: string, take = 50): Promise<TransactionRecord[]> {
    return this.txs.listByUser(userId, Math.min(Math.max(take, 1), 100));
  }
}
