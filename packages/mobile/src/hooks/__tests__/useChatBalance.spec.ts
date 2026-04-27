import { renderHook, waitFor } from '@testing-library/react';
import { useChatBalance } from '../useChatBalance';
import { invalidateEtagCache } from '../../api/client';
import { installFetchMock, type FetchMock } from './test-utils';

/** T-084 — useChatBalance: 토큰 있으면 fetch / 에러 캡처 / refresh idempotent. */
describe('useChatBalance', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = installFetchMock();
    invalidateEtagCache();
  });

  const makeBalance = () => ({
    dailyLimit: 5,
    messagesToday: 2,
    remainingFreeMessages: 3,
    couponBalance: 7,
    nextResetAt: '2026-04-29T00:00:00.000Z',
  });

  it('TC-MCB-001 — 토큰 있으면 자동 refresh + state 채움', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r1',
      body: makeBalance(),
    });

    const { result } = renderHook(() => useChatBalance('tok'));

    await waitFor(() => expect(result.current.balance).not.toBeNull());
    expect(result.current.balance?.couponBalance).toBe(7);
    expect(result.current.balance?.remainingFreeMessages).toBe(3);
    expect(fetchMock.calls[0].path).toBe('/me/chat-balance');
    expect(fetchMock.calls[0].headers.Authorization).toBe('Bearer tok');
  });

  it('TC-MCB-002 — 토큰 null 이면 fetch 안 함', async () => {
    const { result } = renderHook(() => useChatBalance(null));
    // 비동기 처리가 일어나지 않음을 확인 (즉시 빈 상태)
    expect(result.current.balance).toBeNull();
    expect(result.current.error).toBeNull();
    expect(fetchMock.calls.length).toBe(0);
  });

  it('TC-MCB-003 — 5xx error 시 error state 채움', async () => {
    fetchMock.enqueue({
      ok: false,
      status: 503,
      requestId: 'r-fail',
      body: { code: 'SERVICE_UNAVAILABLE', message: 'down' },
    });

    const { result } = renderHook(() => useChatBalance('tok'));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.balance).toBeNull();
  });

  it('TC-MCB-004 — refresh() 명시 호출 시 두 번째 fetch', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r1',
      body: makeBalance(),
    });
    const { result } = renderHook(() => useChatBalance('tok'));
    await waitFor(() => expect(result.current.balance).not.toBeNull());

    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r2',
      body: { ...makeBalance(), couponBalance: 99 },
    });
    await result.current.refresh();
    await waitFor(() => expect(result.current.balance?.couponBalance).toBe(99));
    expect(fetchMock.calls.length).toBe(2);
  });
});
