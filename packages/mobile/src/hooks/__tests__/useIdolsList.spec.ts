import { act, renderHook, waitFor } from '@testing-library/react';
import { useIdolsList } from '../useIdolsList';
import { installFetchMock, type FetchMock } from './test-utils';

function mkItems(n: number, prefix = 'a'): Array<Record<string, unknown>> {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}-${i}`,
    name: `Idol ${prefix}${i}`,
    stageName: null,
    heroImageUrl: null,
    heartCount: i * 10,
    followCount: i,
    publishedAt: '2026-04-01T00:00:00.000Z',
  }));
}

describe('useIdolsList — pagination + refresh + stale-cancel', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = installFetchMock();
  });

  it('loads page 1 on mount and exposes nextCursor → hasMore', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'reqid-initial',
      body: { items: mkItems(20), nextCursor: '2', total: 40 },
    });
    const { result } = renderHook(() => useIdolsList(null));

    await waitFor(() => expect(result.current.items.length).toBe(20));
    expect(result.current.hasMore).toBe(true);
    expect(result.current.error).toBeNull();
    expect(fetchMock.calls[0].path).toBe('/idols');
  });

  it('loadMore appends page 2 items and toggles hasMore off when nextCursor is null', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'reqid-p1',
      body: { items: mkItems(20, 'p1'), nextCursor: '2', total: 30 },
    });
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'reqid-p2',
      body: { items: mkItems(10, 'p2'), nextCursor: null, total: 30 },
    });
    const { result } = renderHook(() => useIdolsList(null));

    await waitFor(() => expect(result.current.items.length).toBe(20));
    await act(async () => {
      result.current.loadMore();
    });
    await waitFor(() => expect(result.current.items.length).toBe(30));
    expect(result.current.hasMore).toBe(false);
    // Page 2 items appended at the end.
    expect(result.current.items[20].id).toBe('p2-0');
  });

  it('patchItem mutates only the matching idol', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r',
      body: { items: mkItems(3), nextCursor: null, total: 3 },
    });
    const { result } = renderHook(() => useIdolsList(null));

    await waitFor(() => expect(result.current.items.length).toBe(3));
    act(() => {
      result.current.patchItem('a-1', { heartCount: 999 });
    });
    expect(result.current.items[0].heartCount).toBe(0);
    expect(result.current.items[1].heartCount).toBe(999);
    expect(result.current.items[2].heartCount).toBe(20);
  });

  it('surfaces fetch errors without clearing prior items', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r1',
      body: { items: mkItems(5), nextCursor: '2', total: 10 },
    });
    fetchMock.enqueue({
      ok: false,
      status: 500,
      requestId: 'r-boom',
      body: { code: 'INTERNAL_ERROR', message: 'db down' },
    });
    const { result } = renderHook(() => useIdolsList(null));

    await waitFor(() => expect(result.current.items.length).toBe(5));
    await act(async () => {
      result.current.loadMore();
    });
    await waitFor(() => expect(result.current.error).toBeTruthy());
    // Items from the successful first page are preserved.
    expect(result.current.items.length).toBe(5);
  });

  it('sort change triggers a refresh (page 1) and supersedes stale in-flight responses', async () => {
    // Initial popularity page, then a 'name' sort page.
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'pop',
      body: { items: mkItems(20, 'pop'), nextCursor: null, total: 20 },
    });
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'name',
      body: { items: mkItems(20, 'nm'), nextCursor: null, total: 20 },
    });

    const { result } = renderHook(() => useIdolsList(null));
    await waitFor(() => expect(result.current.items[0].id).toBe('pop-0'));

    act(() => {
      result.current.setSort('name');
    });
    await waitFor(() => expect(result.current.items[0].id).toBe('nm-0'));
    // Two network calls: initial popularity, then the name-sorted refresh.
    expect(fetchMock.calls.length).toBe(2);
    expect(fetchMock.calls[1].path).toBe('/idols');
  });
});
