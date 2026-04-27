import { Inject, Injectable } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import type { ProductKind } from '@a-idol/shared';
import type { ChatBillingRepository } from '../../chat/application/coupon-interfaces';
import { CHAT_BILLING_REPOSITORY } from '../../chat/application/coupon-interfaces';
import type { PurchaseFulfiller } from '../application/interfaces';

/**
 * Delivers CHAT_COUPON products by adding `couponAmount` to the user's
 * chat wallet. The adjustment is atomic and writes a ledger row (see ADR
 * for ChatCouponLedger).
 */
@Injectable()
export class ChatCouponFulfiller implements PurchaseFulfiller {
  constructor(
    @Inject(CHAT_BILLING_REPOSITORY) private readonly billing: ChatBillingRepository,
  ) {}

  canHandle(kind: ProductKind): boolean {
    return kind === 'CHAT_COUPON';
  }

  async fulfill(input: {
    userId: string;
    transactionId: string;
    deliveryPayload: Record<string, unknown>;
  }): Promise<void> {
    const amount = Number(input.deliveryPayload.couponAmount);
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new DomainError(
        ErrorCodes.INVALID_DELIVERY_PAYLOAD,
        'CHAT_COUPON delivery payload must include positive integer `couponAmount`',
      );
    }
    await this.billing.adjustWallet({
      userId: input.userId,
      delta: amount,
      reason: 'PURCHASE',
      memo: `purchase:${input.transactionId}`,
    });
  }
}
