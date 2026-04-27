import { useCallback, useEffect, useRef, useState } from 'react';
import type { IdolCardDto } from '@a-idol/shared';
import { api, type IdolsSort } from '../api/client';

const PAGE_SIZE = 20;

export function useIdolsList(token: string | null) {
  const [sort, setSort] = useState<IdolsSort>('popularity');
  const [items, setItems] = useState<IdolCardDto[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the in-flight request so a newer sort/refresh cancels stale results.
  const reqIdRef = useRef(0);

  const fetchPage = useCallback(
    async (nextPage: number, nextSort: IdolsSort, mode: 'refresh' | 'append') => {
      const myReq = ++reqIdRef.current;
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await api.listIdols(token, {
          page: nextPage,
          size: PAGE_SIZE,
          sort: nextSort,
        });
        if (reqIdRef.current !== myReq) return; // superseded
        setItems((prev) => (mode === 'append' ? [...prev, ...res.items] : res.items));
        setPage(nextPage);
        setHasMore(res.nextCursor !== null);
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
    [token],
  );

  useEffect(() => {
    void fetchPage(1, sort, 'refresh');
  }, [fetchPage, sort]);

  const refresh = useCallback(() => {
    void fetchPage(1, sort, 'refresh');
  }, [fetchPage, sort]);

  const loadMore = useCallback(() => {
    if (loading || refreshing || !hasMore) return;
    void fetchPage(page + 1, sort, 'append');
  }, [loading, refreshing, hasMore, page, sort, fetchPage]);

  // Mutate a single card (e.g. optimistic heartCount update after toggle).
  const patchItem = useCallback((idolId: string, patch: Partial<IdolCardDto>) => {
    setItems((prev) => prev.map((i) => (i.id === idolId ? { ...i, ...patch } : i)));
  }, []);

  return {
    items,
    sort,
    setSort,
    loading,
    refreshing,
    error,
    hasMore,
    refresh,
    loadMore,
    patchItem,
  };
}
