import { useCallback, useEffect, useState } from 'react';
import type {
  CastVoteResultDto,
  MyVoteStatusDto,
  RoundLeaderboardDto,
  VoteMethod,
} from '@a-idol/shared';
import { api, ApiError, invalidateEtagPrefix, takeErrorRequestId } from '../api/client';

export function useLeaderboard(roundId: string | undefined) {
  const [data, setData] = useState<RoundLeaderboardDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!roundId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await api.getLeaderboard(roundId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [roundId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, refresh: load };
}

export function useMyVoteStatus(roundId: string | undefined, token: string | null) {
  const [data, setData] = useState<MyVoteStatusDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!roundId || !token) return;
    setError(null);
    try {
      setData(await api.getMyVoteStatus(roundId, token));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [roundId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, refresh: load };
}

export function useCastVote(roundId: string | undefined, token: string | null) {
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<CastVoteResultDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorRequestId, setErrorRequestId] = useState<string | null>(null);

  const cast = useCallback(
    async (idolId: string, method: VoteMethod = 'HEART'): Promise<CastVoteResultDto | null> => {
      if (!roundId || !token || busy) return null;
      setBusy(true);
      setError(null);
      setErrorRequestId(null);
      try {
        const res = await api.castVote(roundId, { idolId, method }, token);
        setLastResult(res);
        // T-084 cross-entity invalidation — 투표 후 /me/votes 와 leaderboard
        // 캐시는 stale. prefix-match 로 페이지네이션된 모든 엔트리 일괄 drop.
        invalidateEtagPrefix('/me/votes');
        invalidateEtagPrefix(`/rounds/${roundId}/leaderboard`);
        invalidateEtagPrefix('/me/vote-tickets');
        return res;
      } catch (e) {
        const code = (e as ApiError).code;
        const msg = (e as Error).message;
        setError(code ? `${code}: ${msg}` : msg);
        setErrorRequestId(takeErrorRequestId(e));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [roundId, token, busy],
  );

  return { cast, busy, lastResult, error, errorRequestId };
}
