import { act, renderHook } from '@testing-library/react';
import { usePurchase } from '../useCommerce';
import { installFetchMock, type FetchMock } from './test-utils';

describe('usePurchase — error paths + correlation id (ADR-017)', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = installFetchMock();
  });

  it('success path returns PurchaseTransactionDto and stores lastResult', async () => {
    const tx = {
      id: 'tx-1',
      userId: 'u-1',
      productId: 'p-1',
      provider: 'DEV_SANDBOX' as const,
      providerTxId: 'sandbox-1',
      priceKrw: 1000,
      status: 'FULFILLED' as const,
      fulfilledAt: '2026-04-24T00:00:00.000Z',
      failureReason: null,
      deliverySnapshot: { kind: 'TICKET' as const, tickets: 10, scope: 'GLOBAL' as const },
      createdAt: '2026-04-24T00:00:00.000Z',
    };
    fetchMock.enqueue({
      ok: true,
      status: 201,
      requestId: 'reqid-ok',
      body: tx,
    });

    const { result } = renderHook(() => usePurchase('tok'));

    let ret: unknown;
    await act(async () => {
      ret = await result.current.buy('p-1');
    });

    expect(ret).toMatchObject({ id: 'tx-1', status: 'FULFILLED' });
    expect(result.current.lastResult).toMatchObject({ id: 'tx-1' });
    expect(result.current.error).toBeNull();
    expect(result.current.errorRequestId).toBeNull();
  });

  it('4xx PRODUCT_INACTIVE suppresses errorRequestId (business rule, not outage)', async () => {
    fetchMock.enqueue({
      ok: false,
      status: 400,
      requestId: 'reqid-business',
      body: { code: 'PRODUCT_INACTIVE', message: 'Product is inactive' },
    });

    const { result } = renderHook(() => usePurchase('tok'));

    await act(async () => {
      await result.current.buy('p-1');
    });

    expect(result.current.error).toBe('PRODUCT_INACTIVE: Product is inactive');
    expect(result.current.errorRequestId).toBeNull();
  });

  it('5xx INTERNAL exposes errorRequestId for the support ticket flow', async () => {
    fetchMock.enqueue({
      ok: false,
      status: 500,
      requestId: 'reqid-incident-42',
      body: { code: 'INTERNAL_ERROR', message: 'db connection lost' },
    });

    const { result } = renderHook(() => usePurchase('tok'));

    await act(async () => {
      await result.current.buy('p-1');
    });

    expect(result.current.error).toBe('INTERNAL_ERROR: db connection lost');
    expect(result.current.errorRequestId).toBe('reqid-incident-42');
  });

  it('no-ops without token', async () => {
    const { result } = renderHook(() => usePurchase(null));

    let ret: unknown;
    await act(async () => {
      ret = await result.current.buy('p-1');
    });

    expect(ret).toBeNull();
    expect(fetchMock.calls.length).toBe(0);
  });
});
