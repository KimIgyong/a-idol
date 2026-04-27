import { act, renderHook, waitFor } from '@testing-library/react';
import { useMyVotes } from '../useMyVotes';
import { invalidateEtagCache } from '../../api/client';
import { installFetchMock, type FetchMock } from './test-utils';

/** T-084 — useMyVotes: pagination + nextCursor + null token skip + loadMore. */
describe('useMyVotes', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = installFetchMock();
    invalidateEtagCache();
  });

  const makeVote = (id: string): Record<string, unknown> => ({
    id,
    roundId: 'r-1',
    roundName: 'R1',
    auditionId: 'a-1',
    auditionName: 'A',
    idolId: 'i-1',
    idolName: 'lee',
    idolStageName: null,
    idolHeroImageUrl: null,
    method: 'HEART',
    weight: 1,
    createdAt: '2026-04-28T00:00:00.000Z',
  });

  it('TC-MMV-001 — token null → fetch 안 함', () => {
    const { result } = renderHook(() => useMyVotes(null));
    expect(result.current.items).toEqual([]);
    expect(fetchMock.calls.length).toBe(0);
  });

  it('TC-MMV-002 — 초기 load: page=1 + items/total/nextCursor', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r1',
      body: { items: [makeVote('v-1'), makeVote('v-2')], total: 30, nextCursor: '2' },
    });
    const { result } = renderHook(() => useMyVotes('tok'));
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.total).toBe(30);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.page).toBe(1);
    expect(fetchMock.calls[0].path).toBe('/me/votes');
    expect(fetchMock.calls[0].headers.Authorization).toBe('Bearer tok');
  });

  it('TC-MMV-003 — loadMore: nextCursor null 시 호출 안 됨', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r1',
      body: { items: [makeVote('v-1')], total: 1, nextCursor: null },
    });
    const { result } = renderHook(() => useMyVotes('tok'));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.hasMore).toBe(false);
    await act(async () => {
      result.current.loadMore();
    });
    expect(fetchMock.calls.length).toBe(1); // loadMore 호출 안 함
  });

  it('TC-MMV-004 — loadMore append + page+1', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r1',
      body: { items: [makeVote('v-1')], total: 30, nextCursor: '2' },
    });
    const { result } = renderHook(() => useMyVotes('tok'));
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r2',
      body: { items: [makeVote('v-2')], total: 30, nextCursor: null },
    });
    await act(async () => {
      result.current.loadMore();
    });
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.page).toBe(2);
    expect(result.current.hasMore).toBe(false);
  });

  it('TC-MMV-005 — 5xx error 시 error state + items 보존', async () => {
    fetchMock.enqueue({
      ok: false,
      status: 503,
      requestId: 'r-fail',
      body: { code: 'X', message: 'down' },
    });
    const { result } = renderHook(() => useMyVotes('tok'));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.items).toEqual([]);
  });
});
