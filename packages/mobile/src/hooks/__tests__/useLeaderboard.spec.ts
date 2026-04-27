import { act, renderHook, waitFor } from '@testing-library/react';
import { useLeaderboard, useMyVoteStatus } from '../useVote';
import { installFetchMock, type FetchMock } from './test-utils';

const dummyLeaderboard = {
  roundId: 'round-1',
  status: 'ACTIVE',
  entries: [
    { rank: 1, idolId: 'a', idolName: 'Alice', stageName: null, heroImageUrl: null, score: 100 },
    { rank: 2, idolId: 'b', idolName: 'Bob', stageName: null, heroImageUrl: null, score: 40 },
  ],
};

describe('useLeaderboard + useMyVoteStatus', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = installFetchMock();
  });

  it('useLeaderboard loads on mount when roundId is provided', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r1',
      body: dummyLeaderboard,
    });
    const { result } = renderHook(() => useLeaderboard('round-1'));

    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(result.current.data?.entries[0].idolName).toBe('Alice');
    expect(result.current.error).toBeNull();
    expect(fetchMock.calls[0].path).toBe('/rounds/round-1/leaderboard');
  });

  it('useLeaderboard is a no-op when roundId is undefined (no fetch, no loading spike)', async () => {
    const { result } = renderHook(() => useLeaderboard(undefined));
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(fetchMock.calls.length).toBe(0);
  });

  it('useLeaderboard surfaces error messages from failed fetches', async () => {
    fetchMock.enqueue({
      ok: false,
      status: 404,
      requestId: 'r-nf',
      body: { code: 'ROUND_NOT_FOUND', message: 'Round not found' },
    });
    const { result } = renderHook(() => useLeaderboard('round-x'));

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.data).toBeNull();
  });

  it('useLeaderboard.refresh triggers a second fetch', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r1',
      body: dummyLeaderboard,
    });
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r2',
      body: { ...dummyLeaderboard, entries: [dummyLeaderboard.entries[0]] },
    });
    const { result } = renderHook(() => useLeaderboard('round-1'));

    await waitFor(() => expect(result.current.data?.entries.length).toBe(2));
    await act(async () => {
      await result.current.refresh();
    });
    await waitFor(() => expect(result.current.data?.entries.length).toBe(1));
    expect(fetchMock.calls.length).toBe(2);
  });

  it('useMyVoteStatus requires both roundId and token, else no-ops', async () => {
    // No token → no fetch.
    const { result: noTok } = renderHook(() => useMyVoteStatus('round-1', null));
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock.calls.length).toBe(0);

    // With token → fetches.
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r',
      body: { roundId: 'round-1', method: 'HEART', remainingHearts: 5 },
    });
    const { result } = renderHook(() => useMyVoteStatus('round-1', 'tok'));
    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(fetchMock.calls.length).toBe(1);
    expect(fetchMock.calls[0].headers['Authorization']).toBe('Bearer tok');
    // Unused so TS doesn't complain.
    expect(noTok.current.error).toBeNull();
  });
});
