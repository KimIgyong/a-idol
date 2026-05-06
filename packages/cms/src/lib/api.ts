import { env } from '@/env';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | undefined,
    message: string,
    public readonly requestId: string | null = null,
    /** DomainError.details — RFC-7807 처럼 구조화된 보충 정보. */
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type ApiRequestInit = Omit<RequestInit, 'body'> & {
  body?: unknown;
  token?: string | null;
  /**
   * Opt out of the GET ETag cache for this call. Default: GET requests use
   * `If-None-Match` + 304 automatically; pass `false` to force a full read.
   */
  useEtagCache?: boolean;
};

/**
 * Per-request correlation id (ADR-017). Generates a fresh UUID per call,
 * sends it as `X-Request-ID`, and captures the echoed id so error
 * banners can surface it for support tickets.
 */
function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `cms-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Module-level ETag cache for GET responses. Keyed by path — one CMS tab
 * corresponds to one admin session, so keying on path alone is sufficient
 * (no cross-admin contamination). A write (non-GET) to the same path
 * invalidates its entry so the next GET re-hydrates.
 *
 * Not persisted: reloading the tab clears the cache (intentional — admins
 * often want a fresh page load after deploying changes).
 */
interface EtagEntry {
  etag: string;
  body: unknown;
}
const etagCache = new Map<string, EtagEntry>();

/**
 * Drop the cached ETag + body for a given path. Called automatically on any
 * non-GET request against the same path; exported for tests and for edge
 * cases (e.g. admin logs out and back in as a different admin).
 */
export function invalidateEtagCache(path?: string): void {
  if (path === undefined) {
    etagCache.clear();
    return;
  }
  etagCache.delete(path);
}

/**
 * Multipart 업로드 전용 fetch — JSON Content-Type 을 강제하지 않고 FormData 그대로 전송.
 * Browser 가 multipart boundary 를 자동 부여한다.
 */
export async function apiUpload<T>(
  path: string,
  formData: FormData,
  init: { token?: string | null } = {},
): Promise<T> {
  const requestId = newRequestId();
  const res = await fetch(`${env.VITE_API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'X-Request-ID': requestId,
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    },
    body: formData,
  });
  const echoed = res.headers.get('x-request-id') ?? requestId;
  if (!res.ok) {
    let code: string | undefined;
    let message = res.statusText;
    let details: unknown;
    try {
      const payload = (await res.json()) as { code?: string; message?: string; details?: unknown };
      code = payload.code;
      message = payload.message ?? message;
      details = payload.details;
    } catch {
      // non-json body
    }
    throw new ApiError(res.status, code, message, echoed, details);
  }
  return (await res.json()) as T;
}

export async function apiFetch<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const { body, token, headers, useEtagCache, ...rest } = init;
  const method = (init.method ?? 'GET').toUpperCase();
  const isGet = method === 'GET';
  const cacheable = isGet && useEtagCache !== false;
  const cached = cacheable ? etagCache.get(path) : undefined;

  const requestId = newRequestId();
  const res = await fetch(`${env.VITE_API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // Conditional GET — server returns 304 if the dataset hasn't changed,
      // and we short-circuit to the cached body below.
      ...(cached ? { 'If-None-Match': cached.etag } : {}),
      ...(headers ?? {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const echoed = res.headers.get('x-request-id') ?? requestId;

  if (res.status === 304 && cached) {
    // Server confirmed our cached body is current. Return it; do NOT update
    // the cache (nothing to update).
    return cached.body as T;
  }

  if (!res.ok) {
    let code: string | undefined;
    let message = res.statusText;
    let details: unknown;
    try {
      const payload = (await res.json()) as {
        code?: string;
        message?: string;
        details?: unknown;
      };
      code = payload.code;
      message = payload.message ?? message;
      details = payload.details;
    } catch {
      // non-JSON error body — keep statusText
    }
    throw new ApiError(res.status, code, message, echoed, details);
  }

  if (res.status === 204) {
    // Write-path 204 still invalidates the GET cache for this path.
    if (!isGet) etagCache.delete(path);
    return undefined as T;
  }

  const data = (await res.json()) as T;

  if (cacheable) {
    const etag = res.headers.get('etag');
    if (etag) etagCache.set(path, { etag, body: data });
  } else if (!isGet) {
    // A write succeeded — drop any cached GET body for this path so the
    // next GET re-hydrates with the post-mutation state. Best-effort: if
    // the write targets a different path than the cached list (usually the
    // case), the stale list lingers until its own ETag invalidates.
    etagCache.delete(path);
  }

  return data;
}
