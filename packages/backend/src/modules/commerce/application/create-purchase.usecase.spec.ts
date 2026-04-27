import { ErrorCodes } from '@a-idol/shared';
import { CreatePurchaseUseCase } from './create-purchase.usecase';
import type {
  ProductRecord,
  ProductRepository,
  PurchaseFulfiller,
  TransactionRecord,
  TransactionRepository,
} from './interfaces';

const PRODUCT: ProductRecord = {
  id: 'prod-1',
  sku: 'chat-coupon-10',
  kind: 'CHAT_COUPON',
  title: '10장',
  description: null,
  priceKrw: 1100,
  deliveryPayload: { couponAmount: 10 },
  isActive: true,
};

function makeTxRecord(status: 'PENDING' | 'FULFILLED' | 'FAILED' = 'PENDING'): TransactionRecord {
  return {
    id: 'tx-1',
    userId: 'user-1',
    productId: 'prod-1',
    product: { sku: PRODUCT.sku, title: PRODUCT.title, kind: PRODUCT.kind },
    provider: 'DEV_SANDBOX',
    providerTxId: 'sandbox-xxx',
    status,
    priceKrw: 1100,
    deliverySnapshot: PRODUCT.deliveryPayload,
    fulfilledAt: status === 'FULFILLED' ? new Date() : null,
    failedReason: null,
    createdAt: new Date(),
  };
}

function makeDeps(opts: { product?: ProductRecord | null; fulfillers?: PurchaseFulfiller[] } = {}) {
  const product: ProductRecord | null = 'product' in opts ? (opts.product ?? null) : PRODUCT;
  const products: ProductRepository = {
    list: jest.fn(),
    getListIdentity: jest.fn(),
    findById: jest.fn<Promise<ProductRecord | null>, [string]>(async () => product),
    findBySku: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const txs: TransactionRepository = {
    create: jest.fn(async () => makeTxRecord('PENDING')),
    markFulfilled: jest.fn(async () => makeTxRecord('FULFILLED')),
    markFailed: jest.fn(async () => makeTxRecord('FAILED')),
    listByUser: jest.fn(),
    findById: jest.fn(),
  };
  const fulfillers = opts.fulfillers ?? [
    {
      canHandle: (k) => k === 'CHAT_COUPON',
      fulfill: jest.fn(async () => undefined),
    },
  ];
  return { products, txs, fulfillers };
}

describe('CreatePurchaseUseCase', () => {
  it('TC-CM001 — DEV_SANDBOX happy path → FULFILLED', async () => {
    const d = makeDeps();
    const uc = new CreatePurchaseUseCase(d.products, d.txs, d.fulfillers);
    const res = await uc.execute({ userId: 'user-1', productId: 'prod-1' });
    expect(res.status).toBe('FULFILLED');
    expect(d.txs.create).toHaveBeenCalledTimes(1);
    expect(d.fulfillers[0].fulfill).toHaveBeenCalled();
    expect(d.txs.markFulfilled).toHaveBeenCalled();
  });

  it('TC-CM002 — unknown product → PRODUCT_NOT_FOUND', async () => {
    const d = makeDeps({ product: null });
    const uc = new CreatePurchaseUseCase(d.products, d.txs, d.fulfillers);
    await expect(
      uc.execute({ userId: 'user-1', productId: 'nope' }),
    ).rejects.toMatchObject({ code: ErrorCodes.PRODUCT_NOT_FOUND });
    expect(d.txs.create).not.toHaveBeenCalled();
  });

  it('TC-CM003 — inactive product → PRODUCT_INACTIVE', async () => {
    const d = makeDeps({ product: { ...PRODUCT, isActive: false } });
    const uc = new CreatePurchaseUseCase(d.products, d.txs, d.fulfillers);
    await expect(
      uc.execute({ userId: 'user-1', productId: 'prod-1' }),
    ).rejects.toMatchObject({ code: ErrorCodes.PRODUCT_INACTIVE });
  });

  it('TC-CM004 — APPLE_IAP rejected until adapter lands', async () => {
    const d = makeDeps();
    const uc = new CreatePurchaseUseCase(d.products, d.txs, d.fulfillers);
    await expect(
      uc.execute({ userId: 'user-1', productId: 'prod-1', provider: 'APPLE_IAP' }),
    ).rejects.toMatchObject({ code: ErrorCodes.PROVIDER_NOT_SUPPORTED });
  });

  it('TC-CM005 — fulfiller throws → tx marked FAILED', async () => {
    const d = makeDeps({
      fulfillers: [
        {
          canHandle: () => true,
          fulfill: jest.fn(async () => {
            throw new Error('downstream boom');
          }),
        },
      ],
    });
    const uc = new CreatePurchaseUseCase(d.products, d.txs, d.fulfillers);
    const res = await uc.execute({ userId: 'user-1', productId: 'prod-1' });
    expect(res.status).toBe('FAILED');
    expect(d.txs.markFailed).toHaveBeenCalled();
    expect(d.txs.markFulfilled).not.toHaveBeenCalled();
  });
});
