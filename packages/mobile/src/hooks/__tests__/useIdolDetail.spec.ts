import { act, renderHook, waitFor } from '@testing-library/react';
import { useIdolDetail } from '../useIdolDetail';
import { installFetchMock, type FetchMock } from './test-utils';

const detailBody = {
  id: 'idol-1',
  agencyId: 'ag-1',
  name: 'Hyun',
  stageName: 'HYUN',
  birthdate: '2002-05-14',
  mbti: 'INFJ',
  bio: 'original',
  heroImageUrl: null,
  heartCount: 100,
  followCount: 5,
  publishedAt: '2026-04-01T00:00:00.000Z',
  profile: null,
  images: [],
};

describe('useIdolDetail', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = installFetchMock();
  });

  it('loads on mount and exposes detail DTO', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r',
      body: detailBody,
    });
    const { result } = renderHook(() => useIdolDetail('idol-1', null));

    await waitFor(() => expect(result.current.idol).not.toBeNull());
    expect(result.current.idol?.name).toBe('Hyun');
    expect(fetchMock.calls[0].path).toBe('/idols/idol-1');
  });

  it('is a no-op when id is undefined', async () => {
    const { result } = renderHook(() => useIdolDetail(undefined, null));
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.idol).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(fetchMock.calls.length).toBe(0);
  });

  it('surfaces 404 errors without clobbering prior detail', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r1',
      body: detailBody,
    });
    fetchMock.enqueue({
      ok: false,
      status: 404,
      requestId: 'r2',
      body: { code: 'IDOL_NOT_FOUND', message: 'Idol not found' },
    });
    const { result } = renderHook(() => useIdolDetail('idol-1', null));
    await waitFor(() => expect(result.current.idol?.name).toBe('Hyun'));

    await act(async () => {
      await result.current.reload();
    });
    await waitFor(() => expect(result.current.error).toBeTruthy());
    // Prior payload preserved — renderers can still display something.
    expect(result.current.idol?.name).toBe('Hyun');
  });

  it('patch() merges local state changes for optimistic UI', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'r',
      body: detailBody,
    });
    const { result } = renderHook(() => useIdolDetail('idol-1', null));
    await waitFor(() => expect(result.current.idol).not.toBeNull());

    act(() => {
      result.current.patch({ heartCount: 9999 });
    });
    expect(result.current.idol?.heartCount).toBe(9999);
    // Non-patched fields stay.
    expect(result.current.idol?.name).toBe('Hyun');
  });
});
