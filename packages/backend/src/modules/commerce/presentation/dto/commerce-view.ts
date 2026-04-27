import type {
  PurchaseProductDto,
  PurchaseTransactionDto,
} from '@a-idol/shared';
import type {
  ProductRecord,
  TransactionRecord,
} from '../../application/interfaces';

export function toProductDto(r: ProductRecord): PurchaseProductDto {
  return {
    id: r.id,
    sku: r.sku,
    kind: r.kind,
    title: r.title,
    description: r.description,
    priceKrw: r.priceKrw,
    deliveryPayload: r.deliveryPayload,
    isActive: r.isActive,
  };
}

export function toTransactionDto(r: TransactionRecord): PurchaseTransactionDto {
  return {
    id: r.id,
    productId: r.productId,
    sku: r.product.sku,
    title: r.product.title,
    kind: r.product.kind,
    provider: r.provider,
    providerTxId: r.providerTxId,
    status: r.status,
    priceKrw: r.priceKrw,
    deliverySnapshot: r.deliverySnapshot,
    fulfilledAt: r.fulfilledAt ? r.fulfilledAt.toISOString() : null,
    failedReason: r.failedReason,
    createdAt: r.createdAt.toISOString(),
  };
}
