import type {
  PaymentProvider,
  ProductKind,
  TransactionStatus,
} from '@a-idol/shared';

export interface ProductRecord {
  id: string;
  sku: string;
  kind: ProductKind;
  title: string;
  description: string | null;
  priceKrw: number;
  deliveryPayload: Record<string, unknown>;
  isActive: boolean;
}

export interface TransactionRecord {
  id: string;
  userId: string;
  productId: string;
  product: { sku: string; title: string; kind: ProductKind };
  provider: PaymentProvider;
  providerTxId: string | null;
  status: TransactionStatus;
  priceKrw: number;
  deliverySnapshot: Record<string, unknown>;
  fulfilledAt: Date | null;
  failedReason: string | null;
  createdAt: Date;
}

export interface ProductRepository {
  list(opts: { activeOnly: boolean }): Promise<ProductRecord[]>;
  /**
   * Cheap identity probe for the list endpoint — returns count + max
   * updatedAt. Count changes on create/delete; updatedAt bumps on any column
   * change (including isActive toggle). Same filter as `list` so filtered
   * views share cache identity.
   */
  getListIdentity(opts: { activeOnly: boolean }): Promise<{ total: number; maxUpdatedAt: Date | null }>;
  findById(id: string): Promise<ProductRecord | null>;
  findBySku(sku: string): Promise<ProductRecord | null>;
  create(input: {
    sku: string;
    kind: ProductKind;
    title: string;
    description: string | null;
    priceKrw: number;
    deliveryPayload: Record<string, unknown>;
  }): Promise<ProductRecord>;
  update(
    id: string,
    patch: {
      title?: string;
      description?: string | null;
      priceKrw?: number;
      deliveryPayload?: Record<string, unknown>;
      isActive?: boolean;
    },
  ): Promise<ProductRecord>;
}

export interface TransactionRepository {
  create(input: {
    userId: string;
    productId: string;
    provider: PaymentProvider;
    providerTxId: string | null;
    priceKrw: number;
    deliverySnapshot: Record<string, unknown>;
  }): Promise<TransactionRecord>;
  markFulfilled(id: string, at: Date): Promise<TransactionRecord>;
  markFailed(id: string, reason: string): Promise<TransactionRecord>;
  listByUser(userId: string, take: number): Promise<TransactionRecord[]>;
  findById(id: string): Promise<TransactionRecord | null>;
}

/**
 * Fulfills a PurchaseTransaction by applying its delivery side-effects
 * (wallet top-up, ticket grant, subscription activation, …). Lives behind
 * a port so each kind's adapter can be swapped without touching the
 * CreatePurchase usecase.
 */
export interface PurchaseFulfiller {
  canHandle(kind: ProductKind): boolean;
  fulfill(input: {
    userId: string;
    transactionId: string;
    deliveryPayload: Record<string, unknown>;
  }): Promise<void>;
}

export const PRODUCT_REPOSITORY = 'ProductRepository';
export const TRANSACTION_REPOSITORY = 'TransactionRepository';
export const PURCHASE_FULFILLERS = 'PurchaseFulfillers';
