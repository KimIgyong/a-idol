import { useCallback, useEffect, useState } from 'react';
import type { FanClubStatusDto } from '@a-idol/shared';
import { api, ApiError, invalidateEtagPrefix, takeErrorRequestId } from '../api/client';

/**
 * Heart + Follow toggle state for a single idol. Starts pessimistically:
 * on first mount we don't know whether the user already hearted/followed,
 * so we only show counts from the detail payload. The actual "is user
 * hearted/following?" flag is deduced from the toggle response.
 *
 * For richer UX (e.g. showing heart-filled on mount) the backend would need
 * a "me/relations" endpoint — deferred to a later sprint.
 */
export function useIdolFandom(options: {
  idolId: string | undefined;
  token: string | null;
  initialHeartCount: number;
  initialFollowCount: number;
}) {
  const { idolId, token, initialHeartCount, initialFollowCount } = options;

  const [hearted, setHearted] = useState<boolean | null>(null);
  const [heartCount, setHeartCount] = useState(initialHeartCount);
  const [heartBusy, setHeartBusy] = useState(false);

  const [following, setFollowing] = useState<boolean | null>(null);
  const [followCount, setFollowCount] = useState(initialFollowCount);
  const [followBusy, setFollowBusy] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [errorRequestId, setErrorRequestId] = useState<string | null>(null);

  // Keep counts in sync when the detail payload refreshes.
  useEffect(() => setHeartCount(initialHeartCount), [initialHeartCount]);
  useEffect(() => setFollowCount(initialFollowCount), [initialFollowCount]);

  const toggleHeart = useCallback(async () => {
    if (!idolId || !token || heartBusy) return;
    setHeartBusy(true);
    setError(null);
    setErrorRequestId(null);
    try {
      // Treat `hearted == null` (unknown) as "not hearted yet" for the first tap.
      const res = hearted
        ? await api.unheart(idolId, token)
        : await api.heart(idolId, token);
      setHearted(res.hearted);
      setHeartCount(res.heartCount);
      // Cross-entity ETag invalidation. The toggle bumps Idol.updatedAt +
      // the user's heart row count, so the cached `/me/hearts` pages and
      // any cached `/idols` list/detail responses must drop. Without this,
      // the next refetch would send a stale If-None-Match and the server
      // *would* reply 200 (since its own ETag changed) — correct, but the
      // client wastes the round-trip parsing the body. With invalidation,
      // the next refetch is a clean 200 + cache fill in one round-trip.
      invalidateEtagPrefix('/me/hearts');
      invalidateEtagPrefix('/idols');
    } catch (e) {
      setError((e as ApiError).message);
      setErrorRequestId(takeErrorRequestId(e));
    } finally {
      setHeartBusy(false);
    }
  }, [idolId, token, hearted, heartBusy]);

  const toggleFollow = useCallback(async () => {
    if (!idolId || !token || followBusy) return;
    setFollowBusy(true);
    setError(null);
    setErrorRequestId(null);
    try {
      const res = following
        ? await api.unfollow(idolId, token)
        : await api.follow(idolId, token);
      setFollowing(res.following);
      setFollowCount(res.followCount);
      // Same rationale as toggleHeart — `/me/follows` + idol detail/list.
      invalidateEtagPrefix('/me/follows');
      invalidateEtagPrefix('/idols');
    } catch (e) {
      setError((e as ApiError).message);
      setErrorRequestId(takeErrorRequestId(e));
    } finally {
      setFollowBusy(false);
    }
  }, [idolId, token, following, followBusy]);

  return {
    hearted,
    heartCount,
    heartBusy,
    toggleHeart,
    following,
    followCount,
    followBusy,
    toggleFollow,
    error,
    errorRequestId,
  };
}

/**
 * Fan club status + join/leave actions. Loads state on mount and exposes
 * a single busy flag for both mutations.
 */
export function useIdolFanClub(idolId: string | undefined, token: string | null) {
  const [status, setStatus] = useState<FanClubStatusDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorRequestId, setErrorRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (!idolId || !token) return;
    setLoading(true);
    setError(null);
    setErrorRequestId(null);
    api
      .fanClubStatus(idolId, token)
      .then(setStatus)
      .catch((e: ApiError) => {
        setError(e.message);
        setErrorRequestId(takeErrorRequestId(e));
      })
      .finally(() => setLoading(false));
  }, [idolId, token]);

  const join = useCallback(async () => {
    if (!idolId || !token || busy) return;
    setBusy(true);
    setError(null);
    setErrorRequestId(null);
    try {
      const res = await api.joinFanClub(idolId, token);
      setStatus(res);
    } catch (e) {
      setError((e as ApiError).message);
      setErrorRequestId(takeErrorRequestId(e));
    } finally {
      setBusy(false);
    }
  }, [idolId, token, busy]);

  const leave = useCallback(async () => {
    if (!idolId || !token || busy) return;
    setBusy(true);
    setError(null);
    setErrorRequestId(null);
    try {
      const res = await api.leaveFanClub(idolId, token);
      setStatus(res);
    } catch (e) {
      setError((e as ApiError).message);
      setErrorRequestId(takeErrorRequestId(e));
    } finally {
      setBusy(false);
    }
  }, [idolId, token, busy]);

  return { status, loading, busy, error, errorRequestId, join, leave };
}
