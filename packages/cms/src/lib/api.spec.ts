import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { apiFetch, ApiError, invalidateEtagCache } from './api';

/** T-088 / ADR-017 — apiFetch: ETag 304 캐시, 에러 매핑, request ID echo. */
describe('apiFetch', () => {
  let fetchMock: Mock;

  beforeEach(() => {
    invalidateEtagCache();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  const makeResponse = (init: {
    status?: number;
    headers?: Record<string, string>;
    json?: unknown;
    text?: string;
  }): Response =>
    ({
      ok: (init.status ?? 200) < 400,
      status: init.status ?? 200,
      statusText: 'mock',
      headers: {
        get: (key: string) => init.headers?.[key.toLowerCase()] ?? init.headers?.[key] ?? null,
      },
      json: async () => init.json,
      text: async () => init.text ?? '',
    }) as unknown as Response;

  it('TC-API-001 — GET 정상: JSON 반환 + Authorization header', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse({ status: 200, json: { foo: 'bar' } }));
    const data = await apiFetch<{ foo: string }>('/api/v1/test', { token: 'tok' });
    expect(data).toEqual({ foo: 'bar' });
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[0]).toContain('/api/v1/test');
    const headers = callArgs[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok');
    expect(headers['X-Request-ID']).toMatch(/.+/);
  });

  it('TC-API-002 — 4xx error → ApiError with code + message + status', async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({
        status: 409,
        headers: { 'x-request-id': 'req-xyz' },
        json: { code: 'EMAIL_ALREADY_EXISTS', message: 'duplicate' },
      }),
    );
    await expect(apiFetch('/api/v1/auth/signup', { method: 'POST', body: {} })).rejects.toMatchObject(
      {
        name: 'ApiError',
        status: 409,
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'duplicate',
        requestId: 'req-xyz',
      },
    );
  });

  it('TC-API-003 — 204 no-content → undefined 반환', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse({ status: 204 }));
    const data = await apiFetch<void>('/api/v1/test', { method: 'DELETE' });
    expect(data).toBeUndefined();
  });

  it('TC-API-004 — POST body 는 JSON.stringify 후 전송', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse({ status: 201, json: { id: '1' } }));
    await apiFetch('/api/v1/test', { method: 'POST', body: { foo: 'bar' } });
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[1]?.body).toBe(JSON.stringify({ foo: 'bar' }));
  });

  it('TC-API-005 — GET ETag 캐시: 첫 호출은 etag 헤더 없음, 두 번째는 If-None-Match 동봉', async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({
        status: 200,
        headers: { etag: 'W/"abc"' },
        json: { items: [1, 2, 3] },
      }),
    );
    const first = await apiFetch<{ items: number[] }>('/api/v1/list');
    expect(first.items).toEqual([1, 2, 3]);
    const firstHeaders = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
    expect(firstHeaders['If-None-Match']).toBeUndefined();

    fetchMock.mockResolvedValueOnce(makeResponse({ status: 304 }));
    const second = await apiFetch<{ items: number[] }>('/api/v1/list');
    expect(second.items).toEqual([1, 2, 3]); // cached body 반환
    const secondHeaders = fetchMock.mock.calls[1][1]?.headers as Record<string, string>;
    expect(secondHeaders['If-None-Match']).toBe('W/"abc"');
  });

  it('TC-API-006 — non-GET 응답은 동일 path 의 GET 캐시를 invalidate', async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({ status: 200, headers: { etag: 'W/"v1"' }, json: { items: [1] } }),
    );
    await apiFetch('/api/v1/list');

    fetchMock.mockResolvedValueOnce(makeResponse({ status: 200, json: { id: 'new' } }));
    await apiFetch('/api/v1/list', { method: 'POST', body: {} });

    fetchMock.mockResolvedValueOnce(
      makeResponse({ status: 200, headers: { etag: 'W/"v2"' }, json: { items: [1, 2] } }),
    );
    const refreshed = await apiFetch<{ items: number[] }>('/api/v1/list');
    expect(refreshed.items).toEqual([1, 2]); // new body, 304 short-circuit 안 일어남
    const thirdHeaders = fetchMock.mock.calls[2][1]?.headers as Record<string, string>;
    expect(thirdHeaders['If-None-Match']).toBeUndefined(); // POST 가 캐시 비워서
  });

  it('TC-API-007 — useEtagCache:false 면 캐시 동작 skip', async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({ status: 200, headers: { etag: 'W/"x"' }, json: { x: 1 } }),
    );
    await apiFetch('/api/v1/list', { useEtagCache: false });
    fetchMock.mockResolvedValueOnce(
      makeResponse({ status: 200, headers: { etag: 'W/"y"' }, json: { x: 2 } }),
    );
    const out = await apiFetch<{ x: number }>('/api/v1/list', { useEtagCache: false });
    expect(out.x).toBe(2);
    const headersOnSecond = fetchMock.mock.calls[1][1]?.headers as Record<string, string>;
    // 첫 호출이 useEtagCache:false 라 캐시에 안 들어감 → 두 번째도 If-None-Match 없음
    expect(headersOnSecond['If-None-Match']).toBeUndefined();
  });

  it('TC-API-008 — non-JSON 4xx body → ApiError statusText fallback', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      headers: { get: () => null },
      json: async () => {
        throw new Error('not json');
      },
      text: async () => '',
    } as unknown as Response);

    const err = await apiFetch('/api/v1/test')
      .then(() => null)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(502);
    expect((err as ApiError).message).toBe('Bad Gateway');
  });

  it('TC-API-009 — invalidateEtagCache(undefined) 가 모든 entry 비움', async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({ status: 200, headers: { etag: 'W/"a"' }, json: { x: 1 } }),
    );
    await apiFetch('/api/v1/list-a');
    fetchMock.mockResolvedValueOnce(
      makeResponse({ status: 200, headers: { etag: 'W/"b"' }, json: { x: 2 } }),
    );
    await apiFetch('/api/v1/list-b');

    invalidateEtagCache();

    fetchMock.mockResolvedValueOnce(
      makeResponse({ status: 200, headers: { etag: 'W/"a2"' }, json: { x: 3 } }),
    );
    await apiFetch('/api/v1/list-a');
    const headers = fetchMock.mock.calls[2][1]?.headers as Record<string, string>;
    expect(headers['If-None-Match']).toBeUndefined();
  });
});
