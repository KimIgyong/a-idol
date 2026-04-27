import { act, renderHook, waitFor } from '@testing-library/react';
import { useCastVote } from '../useVote';
import { installFetchMock, type FetchMock } from './test-utils';

describe('useCastVote — error paths + correlation id (ADR-017)', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = installFetchMock();
  });

  it('4xx business error surfaces code + message but suppresses errorRequestId', async () => {
    fetchMock.enqueue({
      ok: false,
      status: 409,
      requestId: 'server-reqid-4xx',
      body: { code: 'NOT_ENOUGH_TICKETS', message: 'No tickets left' },
    });

    const { result } = renderHook(() => useCastVote('round-1', 'tok'));

    let ret: unknown;
    await act(async () => {
      ret = await result.current.cast('idol-1', 'HEART');
    });

    expect(ret).toBeNull();
    expect(result.current.error).toBe('NOT_ENOUGH_TICKETS: No tickets left');
    // Per ADR-017: expected business errors shouldn't expose support ticket id.
    expect(result.current.errorRequestId).toBeNull();
  });

  it('5xx server error surfaces errorRequestId from echoed header', async () => {
    fetchMock.enqueue({
      ok: false,
      status: 500,
      requestId: 'server-reqid-5xx',
      body: { code: 'INTERNAL_ERROR', message: 'boom' },
    });

    const { result } = renderHook(() => useCastVote('round-1', 'tok'));

    await act(async () => {
      await result.current.cast('idol-1', 'HEART');
    });

    expect(result.current.error).toBe('INTERNAL_ERROR: boom');
    expect(result.current.errorRequestId).toBe('server-reqid-5xx');
  });

  it('sends fresh X-Request-ID header on each call', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'echoed-1',
      body: { idolId: 'idol-1', method: 'HEART', heartCount: 7 },
    });
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'echoed-2',
      body: { idolId: 'idol-1', method: 'HEART', heartCount: 8 },
    });

    const { result } = renderHook(() => useCastVote('round-1', 'tok'));

    await act(async () => {
      await result.current.cast('idol-1', 'HEART');
    });
    await act(async () => {
      await result.current.cast('idol-1', 'HEART');
    });

    await waitFor(() => expect(fetchMock.calls.length).toBe(2));
    const id1 = fetchMock.calls[0].headers['X-Request-ID'];
    const id2 = fetchMock.calls[1].headers['X-Request-ID'];
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
    // Authorization bearer should also be attached.
    expect(fetchMock.calls[0].headers['Authorization']).toBe('Bearer tok');
  });
});
