import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '@a-idol/shared';
import type { CouponReason } from '@a-idol/shared';
import type { ChatBillingRepository } from './coupon-interfaces';
import { CHAT_BILLING_REPOSITORY } from './coupon-interfaces';

@Injectable()
export class GrantCouponUseCase {
  constructor(
    @Inject(CHAT_BILLING_REPOSITORY) private readonly repo: ChatBillingRepository,
  ) {}

  async execute(input: {
    userId: string;
    delta: number;
    reason?: CouponReason;
    memo?: string;
  }) {
    if (!Number.isInteger(input.delta) || input.delta === 0) {
      throw new DomainError('COUPON_INVALID_DELTA', 'delta must be a non-zero integer');
    }
    return this.repo.adjustWallet({
      userId: input.userId,
      delta: input.delta,
      reason: input.reason ?? 'ADMIN_GRANT',
      memo: input.memo ?? null,
    });
  }
}
