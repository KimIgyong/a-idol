import { act, renderHook, waitFor } from '@testing-library/react';
import { useMyFollows, useMyHearts } from '../useMyFandom';
import { installFetchMock, type FetchMock } from './test-utils';

function card(id: string): Record<string, unknown> {
  return {
    id,
    name: `Idol ${id}`,
    stageName: null,
    heroImageUrl: null,
    heartCount: 10,
    followCount: 3,
    publishedAt: '2026-04-01T00:00:00.000Z',
  };
}

describe('useMyHearts / useMyFollows', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = installFetchMock();
  });

  it('useMyHearts loads page 1 on mount and respects hasMore/total', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r',
      body: { items: [card('a'), card('b')], nextCursor: '2', total: 5 },
    });
    const { result } = renderHook(() => useMyHearts('tok'));

    await waitFor(() => expect(result.current.items.length).toBe(2));
    expect(result.current.total).toBe(5);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.error).toBeNull();

    // Sent to the right endpoint with Authorization header.
    expect(fetchMock.calls[0].path).toBe('/me/hearts');
    expect(fetchMock.calls[0].headers['Authorization']).toBe('Bearer tok');
  });

  it('loadMore appends page 2 then turns off hasMore when nextCursor is null', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'p1',
      body: { items: [card('a'), card('b')], nextCursor: '2', total: 3 },
    });
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'p2',
      body: { items: [card('c')], nextCursor: null, total: 3 },
    });
    const { result } = renderHook(() => useMyHearts('tok'));

    await waitFor(() => expect(result.current.items.length).toBe(2));
    await act(async () => {
      result.current.loadMore();
    });
    await waitFor(() => expect(result.current.items.length).toBe(3));
    expect(result.current.hasMore).toBe(false);
    expect(result.current.items[2].id).toBe('c');
  });

  it('removeLocally drops one item + decrements total optimistically', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r',
      body: { items: [card('a'), card('b'), card('c')], nextCursor: null, total: 3 },
    });
    const { result } = renderHook(() => useMyHearts('tok'));
    await waitFor(() => expect(result.current.items.length).toBe(3));

    act(() => {
      result.current.removeLocally('b');
    });
    expect(result.current.items.map((i) => i.id)).toEqual(['a', 'c']);
    expect(result.current.total).toBe(2);
  });

  it('is a no-op without a token (no fetch, no loading spike)', async () => {
    const { result } = renderHook(() => useMyHearts(null));
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock.calls.length).toBe(0);
    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('surfaces 5xx error without clobbering prior items', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'p1',
      body: { items: [card('a')], nextCursor: '2', total: 2 },
    });
    fetchMock.enqueue({
      ok: false,
      status: 500,
      requestId: 'boom',
      body: { code: 'INTERNAL_ERROR', message: 'db down' },
    });
    const { result } = renderHook(() => useMyHearts('tok'));
    await waitFor(() => expect(result.current.items.length).toBe(1));

    await act(async () => {
      result.current.loadMore();
    });
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.items.length).toBe(1); // preserved
  });

  it('useMyFollows hits /me/follows and otherwise mirrors useMyHearts', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r',
      body: { items: [card('f1')], nextCursor: null, total: 1 },
    });
    const { result } = renderHook(() => useMyFollows('tok'));
    await waitFor(() => expect(result.current.items.length).toBe(1));
    expect(fetchMock.calls[0].path).toBe('/me/follows');
  });
});
