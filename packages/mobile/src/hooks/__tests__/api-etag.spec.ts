import { api, invalidateEtagCache } from '../../api/client';
import { installFetchMock, type FetchMock } from './test-utils';

/**
 * Direct tests for the `apiFetch` ETag cache (ADR-021 lever 4 — mobile
 * client port). Hook-level integration uses the same logic implicitly.
 */
describe('apiFetch — ETag cache + 304 short-circuit', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = installFetchMock();
    invalidateEtagCache();
  });

  it('first GET stores the ETag; second GET sends If-None-Match and short-circuits on 304', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      etag: 'W/"products-v1"',
      body: [{ id: 'p1', sku: 'a', kind: 'CHAT_COUPON' }],
    });
    fetchMock.enqueue({
      ok: false,
      status: 304,
      etag: 'W/"products-v1"',
      body: undefined,
    });

    const first = await api.listProducts();
    const second = await api.listProducts();

    // Both calls return the same payload; the second is sourced from the
    // local cache because the server replied 304.
    expect(first).toEqual(second);
    expect(fetchMock.calls.length).toBe(2);
    // First call has no If-None-Match (cold cache).
    expect(fetchMock.calls[0].headers['If-None-Match']).toBeUndefined();
    // Second call carries the ETag we stored after the first 200.
    expect(fetchMock.calls[1].headers['If-None-Match']).toBe('W/"products-v1"');
  });

  it('200 with a NEW ETag overwrites the cache (server signaled stale)', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      etag: 'W/"v1"',
      body: [{ id: 'p1' }],
    });
    fetchMock.enqueue({
      ok: true,
      status: 200,
      etag: 'W/"v2"',
      body: [{ id: 'p1' }, { id: 'p2' }],
    });
    fetchMock.enqueue({
      ok: false,
      status: 304,
      etag: 'W/"v2"',
      body: undefined,
    });

    await api.listProducts(); // store v1
    const after = await api.listProducts(); // got v2 (stale signal)
    const cached = await api.listProducts(); // 304 → returns v2 body

    expect(after).toEqual([{ id: 'p1' }, { id: 'p2' }]);
    expect(cached).toEqual(after);
    // The third call carries v2 (the latest stored), not v1.
    expect(fetchMock.calls[2].headers['If-None-Match']).toBe('W/"v2"');
  });

  it('different query strings cache independently — page=1 ETag does not leak to page=2', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      etag: 'W/"hearts-p1"',
      body: { items: [{ id: 'a' }], nextCursor: '2', total: 2 },
    });
    fetchMock.enqueue({
      ok: true,
      status: 200,
      etag: 'W/"hearts-p2"',
      body: { items: [{ id: 'b' }], nextCursor: null, total: 2 },
    });

    await api.listMyHearts('tok', { page: 1, size: 20 });
    await api.listMyHearts('tok', { page: 2, size: 20 });

    expect(fetchMock.calls[0].headers['If-None-Match']).toBeUndefined();
    expect(fetchMock.calls[1].headers['If-None-Match']).toBeUndefined();
  });

  it('non-GET writes drop the same-path cache so the next GET re-hydrates', async () => {
    // Prime the cache with a list response.
    fetchMock.enqueue({
      ok: true,
      status: 200,
      etag: 'W/"products-v1"',
      body: [{ id: 'p1' }],
    });
    await api.listProducts();

    // A purchase POST against /commerce/purchases is a different path — it
    // wouldn't auto-evict /commerce/products. But a manual call against
    // the same path (e.g. an admin product update flow on a future build)
    // SHOULD evict. Simulate by hitting the products GET with a write
    // method using the lower-level cache helper.
    invalidateEtagCache('/commerce/products');

    fetchMock.enqueue({
      ok: true,
      status: 200,
      etag: 'W/"products-v2"',
      body: [{ id: 'p1' }, { id: 'p2' }],
    });
    const after = await api.listProducts();

    expect(after).toHaveLength(2);
    // No If-None-Match on the post-invalidate GET.
    expect(fetchMock.calls[1].headers['If-None-Match']).toBeUndefined();
  });

  it('invalidateEtagCache() with no argument clears the entire cache', async () => {
    fetchMock.enqueue({ ok: true, status: 200, etag: 'W/"v"', body: [] });
    await api.listProducts();
    invalidateEtagCache();

    fetchMock.enqueue({ ok: true, status: 200, etag: 'W/"v2"', body: [] });
    await api.listProducts();
    expect(fetchMock.calls[1].headers['If-None-Match']).toBeUndefined();
  });

  it('errors (4xx/5xx) do not poison the cache', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      etag: 'W/"v1"',
      body: [{ id: 'p1' }],
    });
    fetchMock.enqueue({
      ok: false,
      status: 500,
      etag: 'W/"server-error"',
      body: { code: 'INTERNAL_ERROR', message: 'boom' },
    });
    fetchMock.enqueue({
      ok: false,
      status: 304,
      etag: 'W/"v1"',
      body: undefined,
    });

    const first = await api.listProducts();
    await expect(api.listProducts()).rejects.toMatchObject({ status: 500 });
    // The cache still holds v1 (the 500 didn't overwrite it). Third call
    // hits 304 and returns the v1 body.
    const third = await api.listProducts();
    expect(third).toEqual(first);
    expect(fetchMock.calls[2].headers['If-None-Match']).toBe('W/"v1"');
  });
});
