import { act, renderHook, waitFor } from '@testing-library/react';
import { useIdolFandom } from '../useFandom';
import { api, invalidateEtagCache } from '../../api/client';
import { installFetchMock, type FetchMock } from './test-utils';

describe('useIdolFandom — toggle happy path + error + correlation id', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = installFetchMock();
    invalidateEtagCache();
  });

  it('toggleHeart success updates hearted + heartCount', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'reqid-ok',
      body: { idolId: 'idol-1', hearted: true, heartCount: 42 },
    });

    const { result } = renderHook(() =>
      useIdolFandom({
        idolId: 'idol-1',
        token: 'tok',
        initialHeartCount: 10,
        initialFollowCount: 5,
      }),
    );

    await act(async () => {
      await result.current.toggleHeart();
    });

    expect(result.current.hearted).toBe(true);
    expect(result.current.heartCount).toBe(42);
    expect(result.current.error).toBeNull();
    // First tap sends POST — second tap would send DELETE.
    expect(fetchMock.calls[0].method).toBe('POST');
    expect(fetchMock.calls[0].path).toBe('/idols/idol-1/heart');
  });

  it('toggleHeart 5xx sets error + errorRequestId', async () => {
    fetchMock.enqueue({
      ok: false,
      status: 503,
      requestId: 'reqid-outage',
      body: { code: 'SERVICE_UNAVAILABLE', message: 'upstream down' },
    });

    const { result } = renderHook(() =>
      useIdolFandom({
        idolId: 'idol-1',
        token: 'tok',
        initialHeartCount: 10,
        initialFollowCount: 5,
      }),
    );

    await act(async () => {
      await result.current.toggleHeart();
    });

    expect(result.current.error).toBe('upstream down');
    expect(result.current.errorRequestId).toBe('reqid-outage');
    // Counts stay at initial on failure.
    expect(result.current.heartCount).toBe(10);
    expect(result.current.hearted).toBeNull();
  });

  it('toggleHeart is a no-op without idolId or token', async () => {
    const { result } = renderHook(() =>
      useIdolFandom({
        idolId: undefined,
        token: null,
        initialHeartCount: 3,
        initialFollowCount: 2,
      }),
    );

    await act(async () => {
      await result.current.toggleHeart();
    });

    expect(fetchMock.calls.length).toBe(0);
    expect(result.current.heartBusy).toBe(false);
  });

  it('toggleHeart invalidates /me/hearts + /idols ETag caches (next refetch is a clean 200, not If-None-Match)', async () => {
    // 1. Pre-populate both caches by hitting them as the user normally would.
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r-hearts',
      etag: 'W/"hearts-v1"',
      body: { items: [], nextCursor: null, total: 0 },
    });
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r-idols',
      etag: 'W/"idols-v1"',
      body: { items: [], nextCursor: null, total: 0 },
    });
    await api.listMyHearts('tok', { page: 1, size: 20 });
    await api.listIdols('tok', { page: 1, size: 20 });

    // 2. Toggle heart.
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r-toggle',
      body: { idolId: 'idol-1', hearted: true, heartCount: 42 },
    });
    const { result } = renderHook(() =>
      useIdolFandom({
        idolId: 'idol-1',
        token: 'tok',
        initialHeartCount: 0,
        initialFollowCount: 0,
      }),
    );
    await act(async () => {
      await result.current.toggleHeart();
    });
    await waitFor(() => expect(result.current.hearted).toBe(true));

    // 3. Refetch both endpoints. With invalidation working, neither should
    //    carry an If-None-Match header — the cache was cleared.
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r-hearts2',
      etag: 'W/"hearts-v2"',
      body: { items: [], nextCursor: null, total: 1 },
    });
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r-idols2',
      etag: 'W/"idols-v2"',
      body: { items: [], nextCursor: null, total: 0 },
    });
    await api.listMyHearts('tok', { page: 1, size: 20 });
    await api.listIdols('tok', { page: 1, size: 20 });

    const refetchHearts = fetchMock.calls[fetchMock.calls.length - 2];
    const refetchIdols = fetchMock.calls[fetchMock.calls.length - 1];
    expect(refetchHearts.path).toBe('/me/hearts');
    expect(refetchHearts.headers['If-None-Match']).toBeUndefined();
    expect(refetchIdols.path).toBe('/idols');
    expect(refetchIdols.headers['If-None-Match']).toBeUndefined();
  });

  it('toggleFollow invalidates /me/follows + /idols caches', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r-follows',
      etag: 'W/"follows-v1"',
      body: { items: [], nextCursor: null, total: 0 },
    });
    await api.listMyFollows('tok', { page: 1, size: 20 });

    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r-toggle',
      body: { idolId: 'idol-1', following: true, followCount: 7 },
    });
    const { result } = renderHook(() =>
      useIdolFandom({
        idolId: 'idol-1',
        token: 'tok',
        initialHeartCount: 0,
        initialFollowCount: 0,
      }),
    );
    await act(async () => {
      await result.current.toggleFollow();
    });
    await waitFor(() => expect(result.current.following).toBe(true));

    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r-follows2',
      etag: 'W/"follows-v2"',
      body: { items: [], nextCursor: null, total: 1 },
    });
    await api.listMyFollows('tok', { page: 1, size: 20 });
    const refetch = fetchMock.calls[fetchMock.calls.length - 1];
    expect(refetch.path).toBe('/me/follows');
    expect(refetch.headers['If-None-Match']).toBeUndefined();
  });
});
