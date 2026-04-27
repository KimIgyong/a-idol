import { Inject, Injectable } from '@nestjs/common';
import type { ChatBillingRepository, ConsumeOutcome } from './coupon-interfaces';
import { CHAT_BILLING_REPOSITORY } from './coupon-interfaces';

/**
 * Try the daily free quota first; if exhausted, charge one coupon.
 * Throws DomainError(NO_COUPON) when both are empty — surfaced as HTTP 402.
 */
@Injectable()
export class ConsumeQuotaOrCouponUseCase {
  constructor(
    @Inject(CHAT_BILLING_REPOSITORY) private readonly repo: ChatBillingRepository,
  ) {}

  execute(userId: string, now: Date = new Date()): Promise<ConsumeOutcome> {
    return this.repo.consumeOne(userId, now);
  }
}
