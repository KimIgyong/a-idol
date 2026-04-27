/**
 * Shared fetch mock for hook specs. The api client (src/api/client.ts) calls
 * global `fetch` and inspects `res.ok`, `res.status`, `res.headers.get()` and
 * `res.text()`. This helper enqueues fake responses in order and records the
 * outgoing calls (url, method, headers, body) for assertions.
 */
export type FetchMockResponse = {
  ok: boolean;
  status: number;
  /** Echoed as X-Request-ID header. */
  requestId?: string;
  /** Echoed as ETag response header. */
  etag?: string;
  body: unknown;
};

export type FetchCall = {
  url: string;
  /** Path portion after the apiBaseUrl. */
  path: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
};

export interface FetchMock {
  enqueue(res: FetchMockResponse): void;
  readonly calls: FetchCall[];
}

const API_BASE = 'http://localhost:3000/api/v1';

export function installFetchMock(): FetchMock {
  const queue: FetchMockResponse[] = [];
  const calls: FetchCall[] = [];

  const fn = jest.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input.toString();
    const path = url.startsWith(API_BASE) ? url.slice(API_BASE.length) : url;
    const headers: Record<string, string> = {};
    if (init.headers) {
      const h = init.headers as Record<string, string>;
      for (const k of Object.keys(h)) headers[k] = h[k];
    }
    calls.push({
      url,
      path: path.split('?')[0],
      method: (init.method ?? 'GET').toUpperCase(),
      headers,
      body: init.body ? JSON.parse(init.body as string) : undefined,
    });

    const next = queue.shift();
    if (!next) {
      throw new Error(`fetch mock: no response enqueued for ${url}`);
    }
    const reqId = next.requestId ?? 'mock-request-id';
    const etag = next.etag;
    // 304 carries no body — the api client returns the previously cached
    // body without parsing. Mirror that here so `text()` returns ''.
    const isNotModified = next.status === 304;
    return {
      ok: next.ok,
      status: next.status,
      statusText: next.ok ? 'OK' : 'Error',
      headers: {
        get: (name: string) => {
          const k = name.toLowerCase();
          if (k === 'x-request-id') return reqId;
          if (k === 'etag') return etag ?? null;
          return null;
        },
      },
      text: async () => (isNotModified ? '' : JSON.stringify(next.body)),
    } as unknown as Response;
  });

  (globalThis as unknown as { fetch: typeof fetch }).fetch = fn as unknown as typeof fetch;

  return {
    enqueue(res) {
      queue.push(res);
    },
    get calls() {
      return calls;
    },
  };
}
