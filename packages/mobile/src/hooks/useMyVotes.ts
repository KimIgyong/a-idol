import { useCallback, useEffect, useRef, useState } from 'react';
import type { MyVoteEntryDto } from '@a-idol/shared';
import { api, takeErrorRequestId } from '../api/client';

const PAGE_SIZE = 20;

/**
 * SCR-023 — 내 투표 이력 (최신순, paginated). stale-cancel via reqIdRef.
 */
export function useMyVotes(token: string | null) {
  const [items, setItems] = useState<MyVoteEntryDto[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorRequestId, setErrorRequestId] = useState<string | null>(null);

  const reqIdRef = useRef(0);

  const fetchPage = useCallback(
    async (nextPage: number, mode: 'refresh' | 'append') => {
      if (!token) return;
      const myReq = ++reqIdRef.current;
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await api.listMyVotes(token, { page: nextPage, size: PAGE_SIZE });
        if (reqIdRef.current !== myReq) return;
        setItems((prev) => (mode === 'append' ? [...prev, ...res.items] : res.items));
        setPage(nextPage);
        setHasMore(res.nextCursor !== null);
        setTotal(res.total ?? res.items.length);
      } catch (e) {
        if (reqIdRef.current !== myReq) return;
        setError((e as Error).message);
        setErrorRequestId(takeErrorRequestId(e));
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
    if (!token) return;
    void fetchPage(1, 'refresh');
  }, [fetchPage, token]);

  const refresh = useCallback(() => fetchPage(1, 'refresh'), [fetchPage]);
  const loadMore = useCallback(() => {
    if (loading || refreshing || !hasMore) return;
    void fetchPage(page + 1, 'append');
  }, [loading, refreshing, hasMore, page, fetchPage]);

  return {
    items,
    total,
    page,
    loading,
    refreshing,
    error,
    errorRequestId,
    hasMore,
    refresh,
    loadMore,
  };
}
