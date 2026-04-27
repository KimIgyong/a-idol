import { useCallback, useEffect, useRef, useState } from 'react';
import type { IdolCardDto, PaginatedResponseDto } from '@a-idol/shared';
import { api } from '../api/client';

const PAGE_SIZE = 20;

type ListFn = (
  token: string,
  opts: { page: number; size: number },
) => Promise<PaginatedResponseDto<IdolCardDto>>;

/**
 * Generic internal helper — `useMyHearts` and `useMyFollows` are thin
 * wrappers that bind their respective api method. Mirrors `useIdolsList`
 * patterns (stale-cancel via reqIdRef, append mode for loadMore, local
 * `removeLocally` for optimistic updates after a toggle).
 *
 * Not currently wired to an ETag cache on the client side — the server
 * returns 200 on each refetch and the hook replaces state. A follow-up
 * could introduce a module-level ETag cache in `api/client.ts` (mirror
 * of CMS `apiFetch`) to short-circuit identical repeated reads; deferred
 * because (a) React Native has no browser cache to lean on, (b) this
 * hook's refresh cadence is low (pull-to-refresh, not poll).
 */
function useMyListOfIdols(list: ListFn, token: string | null) {
  const [items, setItems] = useState<IdolCardDto[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reqIdRef = useRef(0);

  const fetchPage = useCallback(
    async (nextPage: number, mode: 'refresh' | 'append') => {
      if (!token) return;
      const myReq = ++reqIdRef.current;
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await list(token, { page: nextPage, size: PAGE_SIZE });
        if (reqIdRef.current !== myReq) return;
        setItems((prev) => (mode === 'append' ? [...prev, ...res.items] : res.items));
        setPage(nextPage);
        setHasMore(res.nextCursor !== null);
        setTotal(res.total ?? res.items.length);
      } catch (e) {
        if (reqIdRef.current !== myReq) return;
        setError((e as Error).message);
      } finally {
        if (reqIdRef.current === myReq) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [list, token],
  );

  useEffect(() => {
    if (!token) return;
    void fetchPage(1, 'refresh');
  }, [fetchPage, token]);

  const refresh = useCallback(() => {
    void fetchPage(1, 'refresh');
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (loading || refreshing || !hasMore) return;
    void fetchPage(page + 1, 'append');
  }, [loading, refreshing, hasMore, page, fetchPage]);

  /**
   * Local-only removal — after the caller unhearts an idol, drop it from
   * the visible list without waiting for a server refresh. Call `refresh()`
   * afterwards if the total counter needs to re-sync.
   */
  const removeLocally = useCallback((idolId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== idolId));
    setTotal((prev) => Math.max(prev - 1, 0));
  }, []);

  return {
    items,
    total,
    page,
    loading,
    refreshing,
    error,
    hasMore,
    refresh,
    loadMore,
    removeLocally,
  };
}

export function useMyHearts(token: string | null) {
  return useMyListOfIdols(api.listMyHearts, token);
}

export function useMyFollows(token: string | null) {
  return useMyListOfIdols(api.listMyFollows, token);
}
