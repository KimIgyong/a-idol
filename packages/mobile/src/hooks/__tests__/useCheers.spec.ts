import { act, renderHook, waitFor } from '@testing-library/react';
import { useCheers } from '../useCheers';
import { invalidateEtagCache } from '../../api/client';
import { installFetchMock, type FetchMock } from './test-utils';

/** T-084 — useCheers: 페이지네이션 + post optimistic + 빈 메시지 차단. */
describe('useCheers', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = installFetchMock();
    invalidateEtagCache();
  });

  const makeCheer = (id: string, msg = 'hi'): Record<string, unknown> => ({
    id,
    idolId: 'idol-1',
    message: msg,
    createdAt: '2026-04-28T00:00:00.000Z',
    author: { userId: 'u-1', nickname: 'demo', avatarUrl: null },
  });

  it('TC-MCH-001 — 초기 load: page 1 fetch + items/total 채움', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r1',
      body: {
        items: [makeCheer('c-1'), makeCheer('c-2')],
        nextCursor: null,
        total: 2,
      },
    });

    const { result } = renderHook(() => useCheers('idol-1', 'tok'));
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.total).toBe(2);
    expect(result.current.hasMore).toBe(false);
    expect(fetchMock.calls[0].path).toBe('/idols/idol-1/cheers');
  });

  it('TC-MCH-002 — idolId undefined 이면 fetch 안 함', async () => {
    const { result } = renderHook(() => useCheers(undefined, 'tok'));
    expect(result.current.items).toEqual([]);
    expect(fetchMock.calls.length).toBe(0);
  });

  it('TC-MCH-003 — post 빈 메시지 무시 (false 반환, fetch 안 함)', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r1',
      body: { items: [], nextCursor: null, total: 0 },
    });
    const { result } = renderHook(() => useCheers('idol-1', 'tok'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let posted = true;
    await act(async () => {
      posted = await result.current.post('   ');
    });
    expect(posted).toBe(false);
    // 첫 listCheers 호출 1번만, post 는 fetch 안 함
    expect(fetchMock.calls.length).toBe(1);
  });

  it('TC-MCH-004 — post 성공 시 head prepend + total +1', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r1',
      body: {
        items: [makeCheer('c-old')],
        nextCursor: null,
        total: 1,
      },
    });
    const { result } = renderHook(() => useCheers('idol-1', 'tok'));
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    fetchMock.enqueue({
      ok: true,
      status: 201,
      requestId: 'r2',
      body: makeCheer('c-new', '오늘 무대 최고'),
    });

    await act(async () => {
      await result.current.post('오늘 무대 최고');
    });

    expect(result.current.items[0].id).toBe('c-new');
    expect(result.current.items).toHaveLength(2);
    expect(result.current.total).toBe(2);
  });

  it('TC-MCH-005 — loadMore: nextCursor 가 있어야 호출, append', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r1',
      body: {
        items: [makeCheer('c-1')],
        nextCursor: 'next',
        total: 30,
      },
    });
    const { result } = renderHook(() => useCheers('idol-1', 'tok'));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.hasMore).toBe(true);

    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r2',
      body: {
        items: [makeCheer('c-2')],
        nextCursor: null,
        total: 30,
      },
    });

    await act(async () => {
      result.current.loadMore();
    });

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.hasMore).toBe(false);
    expect(result.current.page).toBe(2);
  });
});
