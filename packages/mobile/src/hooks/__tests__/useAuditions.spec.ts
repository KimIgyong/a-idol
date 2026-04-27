import { act, renderHook, waitFor } from '@testing-library/react';
import { useAudition, useAuditionsList } from '../useAuditions';
import { invalidateEtagCache } from '../../api/client';
import { installFetchMock, type FetchMock } from './test-utils';

/** T-084 — useAuditionsList + useAudition: list/detail fetch + status filter. */
describe('useAuditionsList', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = installFetchMock();
    invalidateEtagCache();
  });

  it('TC-MA-001 — ACTIVE 기본 status 로 fetch', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r1',
      body: [{ id: 'a-1', name: 'A1', status: 'ACTIVE' }],
    });
    const { result } = renderHook(() => useAuditionsList());
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(fetchMock.calls[0].path).toBe('/auditions');
    expect(fetchMock.calls[0].url).toContain('status=ACTIVE');
  });

  it('TC-MA-002 — FINISHED status 인자 전달', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r1',
      body: [],
    });
    renderHook(() => useAuditionsList('FINISHED'));
    await waitFor(() => expect(fetchMock.calls.length).toBe(1));
    expect(fetchMock.calls[0].url).toContain('status=FINISHED');
  });

  it('TC-MA-003 — 5xx error 시 error state', async () => {
    fetchMock.enqueue({
      ok: false,
      status: 503,
      requestId: 'r-fail',
      body: { code: 'X', message: 'down' },
    });
    const { result } = renderHook(() => useAuditionsList());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.items).toEqual([]);
  });

  it('TC-MA-004 — refresh() 명시 호출', async () => {
    fetchMock.enqueue({ ok: true, status: 200, requestId: 'r1', body: [] });
    const { result } = renderHook(() => useAuditionsList());
    await waitFor(() => expect(result.current.loading).toBe(false));

    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r2',
      body: [{ id: 'a-2', name: 'A2', status: 'ACTIVE' }],
    });
    await act(async () => {
      await result.current.refresh();
    });
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(fetchMock.calls.length).toBe(2);
  });
});

describe('useAudition', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = installFetchMock();
    invalidateEtagCache();
  });

  it('TC-MA-005 — id 있으면 detail fetch', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r1',
      body: { id: 'a-1', name: 'A1', status: 'ACTIVE', rounds: [], entries: [] },
    });
    const { result } = renderHook(() => useAudition('a-1'));
    await waitFor(() => expect(result.current.audition).not.toBeNull());
    expect(fetchMock.calls[0].path).toBe('/auditions/a-1');
  });

  it('TC-MA-006 — id undefined 이면 fetch 안 함', async () => {
    const { result } = renderHook(() => useAudition(undefined));
    expect(result.current.audition).toBeNull();
    expect(fetchMock.calls.length).toBe(0);
  });
});
