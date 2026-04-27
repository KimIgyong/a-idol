import { Inject, Injectable, Logger } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import type { PaymentProvider } from '@a-idol/shared';
import type {
  ProductRepository,
  PurchaseFulfiller,
  TransactionRecord,
  TransactionRepository,
} from './interfaces';
import {
  PRODUCT_REPOSITORY,
  PURCHASE_FULFILLERS,
  TRANSACTION_REPOSITORY,
} from './interfaces';

/**
 * Creates a PurchaseTransaction and — for DEV_SANDBOX — fulfills immediately.
 * For APPLE_IAP/GOOGLE_IAP/STRIPE the transaction stays `PENDING` until the
 * corresponding receipt-verification adapter flips it to `FULFILLED`
 * (those adapters ship in T-044 follow-ups).
 */
@Injectable()
export class CreatePurchaseUseCase {
  private readonly log = new Logger(CreatePurchaseUseCase.name);

  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(TRANSACTION_REPOSITORY) private readonly txs: TransactionRepository,
    @Inject(PURCHASE_FULFILLERS) private readonly fulfillers: PurchaseFulfiller[],
  ) {}

  async execute(input: {
    userId: string;
    productId: string;
    provider?: PaymentProvider;
    providerTxId?: string;
    /**
     * StoreKit v2 compact JWS — ADR-019. Accepted at the boundary but
     * not yet consumed (verifier injection lands in Phase 1 W2, after
     * `jose` install). Field is typed here so `CreatePurchaseBody`
     * → usecase contract is aligned the day verifier wiring flips.
     */
    receiptJws?: string;
  }): Promise<TransactionRecord> {
    const product = await this.products.findById(input.productId);
    if (!product) {
      throw new DomainError(ErrorCodes.PRODUCT_NOT_FOUND, 'Product not found');
    }
    if (!product.isActive) {
      throw new DomainError(ErrorCodes.PRODUCT_INACTIVE, 'Product is inactive');
    }

    const provider: PaymentProvider = input.provider ?? 'DEV_SANDBOX';
    if (provider !== 'DEV_SANDBOX') {
      // MVP: only DEV_SANDBOX is wired. Apple/Google/Stripe verifiers land
      // in T-044 follow-up. Reject explicitly so clients know it's disabled.
      throw new DomainError(
        ErrorCodes.PROVIDER_NOT_SUPPORTED,
        `Payment provider ${provider} is not enabled in this build`,
      );
    }

    const tx = await this.txs.create({
      userId: input.userId,
      productId: product.id,
      provider,
      providerTxId: input.providerTxId ?? `sandbox-${Date.now()}-${product.id.slice(0, 8)}`,
      priceKrw: product.priceKrw,
      deliverySnapshot: product.deliveryPayload,
    });

    // DEV_SANDBOX fulfills inline.
    const fulfiller = this.fulfillers.find((f) => f.canHandle(product.kind));
    if (!fulfiller) {
      const failed = await this.txs.markFailed(
        tx.id,
        `No fulfiller registered for kind ${product.kind}`,
      );
      throw new DomainError(
        ErrorCodes.PROVIDER_NOT_SUPPORTED,
        `No fulfiller registered for product kind ${product.kind}`,
        { transactionId: failed.id },
      );
    }

    try {
      await fulfiller.fulfill({
        userId: input.userId,
        transactionId: tx.id,
        deliveryPayload: product.deliveryPayload,
      });
      return this.txs.markFulfilled(tx.id, new Date());
    } catch (err) {
      this.log.warn(
        `fulfillment failed for tx=${tx.id} kind=${product.kind}: ${(err as Error).message}`,
      );
      return this.txs.markFailed(tx.id, (err as Error).message);
    }
  }
}
