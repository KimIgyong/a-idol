import { useCallback, useEffect, useRef, useState } from 'react';
import type { CheerDto } from '@a-idol/shared';
import { api, ApiError, invalidateEtagPrefix, takeErrorRequestId } from '../api/client';

const PAGE_SIZE = 20;

/**
 * 응원댓글 hook (SCR-006). 페이지네이션 + 작성 + stale-cancel.
 *
 * - `items`: 최신순(서버 기준 createdAt DESC).
 * - `post(message)`: 작성 성공 시 head에 prepend (optimistic) + total 증가.
 * - `loadMore`: 다음 페이지 append.
 */
export function useCheers(idolId: string | undefined, token: string | null) {
  const [items, setItems] = useState<CheerDto[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorRequestId, setErrorRequestId] = useState<string | null>(null);

  const reqIdRef = useRef(0);

  const fetchPage = useCallback(
    async (nextPage: number, mode: 'refresh' | 'append') => {
      if (!idolId) return;
      const myReq = ++reqIdRef.current;
      setLoading(true);
      setError(null);
      try {
        const res = await api.listCheers(idolId, { page: nextPage, size: PAGE_SIZE });
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
        if (reqIdRef.current === myReq) setLoading(false);
      }
    },
    [idolId],
  );

  useEffect(() => {
    void fetchPage(1, 'refresh');
  }, [fetchPage]);

  const refresh = useCallback(() => fetchPage(1, 'refresh'), [fetchPage]);
  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    void fetchPage(page + 1, 'append');
  }, [loading, hasMore, page, fetchPage]);

  /**
   * 응원댓글 작성. 성공 시 head에 prepend (서버도 최신순이라 일치). 실패는
   * `error` state로 surface — caller가 인풋 reset 또는 retry 결정.
   */
  const post = useCallback(
    async (message: string): Promise<boolean> => {
      if (!idolId || !token || posting) return false;
      const trimmed = message.trim();
      if (trimmed.length === 0) return false;
      setPosting(true);
      setError(null);
      setErrorRequestId(null);
      try {
        const created = await api.createCheer(idolId, { message: trimmed }, token);
        setItems((prev) => [created, ...prev]);
        setTotal((prev) => prev + 1);
        // 서버 측 cheers list는 새 ETag — same-path 캐시 drop. mobile prefix
        // invalidator는 `/idols/${id}` 같은 유사 경로도 같이 침범하지만 비용
        // 작아 (다음 fetch에서 fresh 받기) 그대로 둠.
        invalidateEtagPrefix(`/idols/${idolId}/cheers`);
        return true;
      } catch (e) {
        setError((e as ApiError).message);
        setErrorRequestId(takeErrorRequestId(e));
        return false;
      } finally {
        setPosting(false);
      }
    },
    [idolId, token, posting],
  );

  return {
    items,
    total,
    page,
    loading,
    posting,
    error,
    errorRequestId,
    hasMore,
    refresh,
    loadMore,
    post,
  };
}
