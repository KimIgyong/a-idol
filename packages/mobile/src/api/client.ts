import Constants from 'expo-constants';
import type {
  AuditionDto,
  AuditionListItemDto,
  AuthResponseDto,
  AuthTokensDto,
  CastVoteResultDto,
  ChatBalanceDto,
  ChatMessageDto,
  ChatRoomDto,
  CheerDto,
  CreateCheerDto,
  CreatePurchaseDto,
  UpdateUserMeDto,
  FanClubStatusDto,
  PhotocardSetDto,
  UserPhotocardDto,
  FollowToggleResponseDto,
  HeartToggleResponseDto,
  IdolCardDto,
  IdolDetailDto,
  MembershipDto,
  MyVoteEntryDto,
  MyVoteStatusDto,
  MyVoteTicketsDto,
  PaginatedResponseDto,
  PurchaseProductDto,
  PurchaseTransactionDto,
  RoundLeaderboardDto,
  UserDto,
  VoteMethod,
} from '@a-idol/shared';

const apiBaseUrl =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | undefined,
    message: string,
    public readonly requestId: string | null = null,
    /** DomainError.details — RFC-7807 "details" 처럼 구조화된 보충 정보. */
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Per ADR-017: only surface the correlation id on errors that imply a
 * server-side or network failure (5xx / no response). Expected 4xx
 * business-rule errors (NOT_ENOUGH_TICKETS, VOTE_ROUND_NOT_ACTIVE, …)
 * don't need the id — they tell the user what to do already.
 *
 * Returns the id to display, or null to suppress.
 */
export function takeErrorRequestId(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  if (!err.requestId) return null;
  if (!err.status || err.status >= 500) return err.requestId;
  return null;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  query?: Record<string, string | number | undefined>;
  /**
   * Opt out of the GET ETag cache for this call. Default: GETs auto-send
   * `If-None-Match` and short-circuit on 304. Pass `false` to force a full
   * read (e.g. background refresh that explicitly wants fresh server state).
   */
  useEtagCache?: boolean;
};

/**
 * Module-level ETag cache for GET responses. Keyed by `${path}${qs}` so
 * two queries against the same path with different params (e.g.
 * `/me/hearts?page=1` vs `?page=2`) cache independently.
 *
 * Mirrors the CMS apiFetch cache (packages/cms/src/lib/api.ts) — see
 * ADR-021 lever 4 + the CMS apiFetch follow-up. Lifetime is the JS
 * runtime, so a React Native reload clears it (intentional — admins /
 * users expect a fresh refetch after killing and relaunching the app).
 */
interface EtagEntry {
  etag: string;
  body: unknown;
}
const etagCache = new Map<string, EtagEntry>();

/**
 * Drop the cached ETag + body for a given cache key (`${path}${qs}`).
 * Pass no argument to clear the entire cache — useful on logout or on a
 * forced re-sync.
 */
export function invalidateEtagCache(cacheKey?: string): void {
  if (cacheKey === undefined) {
    etagCache.clear();
    return;
  }
  etagCache.delete(cacheKey);
}

/**
 * Drop every cache entry whose key starts with `prefix`. Useful for
 * cross-entity invalidation where the cache holds many query-string
 * variants under one logical resource — e.g. `/me/hearts?page=1`,
 * `/me/hearts?page=2`, … all need to clear when the user toggles a heart.
 *
 * Note: `/idols` would also match `/idols/<uuid>` (detail). That over-
 * invalidation is intentional: a heart bump changes both the list's
 * `heartCount` ranking AND the detail's count.
 */
export function invalidateEtagPrefix(prefix: string): void {
  for (const key of etagCache.keys()) {
    if (key.startsWith(prefix)) etagCache.delete(key);
  }
}

/**
 * Per-request correlation id (ADR-017). Each call generates a fresh UUID,
 * sends it as `X-Request-ID`, and captures the echoed id from the response
 * so error UIs can surface it for support tickets.
 */
function newRequestId(): string {
  // RN 0.74+ and modern browsers ship crypto.randomUUID. Fall back to
  // Math.random for the dev stub path (unlikely to hit in practice).
  const c = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const requestId = newRequestId();
  const method = (opts.method ?? 'GET').toUpperCase();
  const isGet = method === 'GET';

  const qs = opts.query
    ? '?' +
      Object.entries(opts.query)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  const cacheKey = `${path}${qs}`;
  const cacheable = isGet && opts.useEtagCache !== false;
  const cached = cacheable ? etagCache.get(cacheKey) : undefined;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Request-ID': requestId,
  };
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
  if (cached) headers['If-None-Match'] = cached.etag;

  const res = await fetch(`${apiBaseUrl}${path}${qs}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  // Backend echoes X-Request-ID on every response; fall back to the
  // client-side id if a proxy stripped the header.
  const echoed = res.headers.get('x-request-id') ?? requestId;

  // Conditional-GET hit: server confirmed our cached body is current.
  // Note: 304 has no body, and Response.ok is false for 3xx, so we have to
  // check status before the !res.ok branch below.
  if (res.status === 304 && cached) {
    return cached.body as T;
  }

  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const record = (data ?? {}) as {
      code?: string;
      message?: unknown;
      error?: unknown;
      details?: unknown;
    };
    const raw = record.message ?? record.error ?? res.statusText;
    const msg = Array.isArray(raw) ? raw.join(', ') : String(raw);
    throw new ApiError(res.status, record.code, msg, echoed, record.details);
  }

  if (cacheable) {
    const etag = res.headers.get('etag');
    if (etag) etagCache.set(cacheKey, { etag, body: data });
  } else if (!isGet) {
    // A write succeeded — drop the same-path GET cache so the next refetch
    // re-hydrates with post-mutation state. Cross-entity invalidation
    // (e.g. heart toggle on /idols/:id should also stale /me/hearts) is
    // handled by hooks calling invalidateEtagCache() explicitly.
    etagCache.delete(cacheKey);
  }

  return data as T;
}

export type IdolsSort = 'popularity' | 'name' | 'new';

export const api = {
  baseUrl: apiBaseUrl,

  // -- auth ---------------------------------------------------------------
  signup: (body: {
    email: string;
    password: string;
    nickname: string;
    birthdate: string;
    deviceId?: string;
  }) => request<AuthResponseDto>('/auth/signup', { method: 'POST', body }),
  login: (body: { email: string; password: string; deviceId?: string }) =>
    request<AuthResponseDto>('/auth/login', { method: 'POST', body }),
  refresh: (body: { refreshToken: string }) =>
    request<AuthTokensDto>('/auth/refresh', { method: 'POST', body }),
  logout: (body: { refreshToken: string }) =>
    request<{ revoked: boolean }>('/auth/logout', { method: 'POST', body }),
  me: (token: string) => request<UserDto>('/me', { token }),
  patchMe: (body: UpdateUserMeDto, token: string) =>
    request<UserDto>('/me', { method: 'PATCH', body, token }),

  // -- catalog ------------------------------------------------------------
  listIdols: (
    token: string | null,
    opts: { page?: number; size?: number; sort?: IdolsSort } = {},
  ) =>
    request<PaginatedResponseDto<IdolCardDto>>('/idols', {
      token: token ?? null,
      query: { page: opts.page, size: opts.size, sort: opts.sort },
    }),
  getIdol: (id: string, token: string | null) =>
    request<IdolDetailDto>(`/idols/${id}`, { token: token ?? null }),

  // -- fandom (hearts/follows) -------------------------------------------
  heart: (idolId: string, token: string) =>
    request<HeartToggleResponseDto>(`/idols/${idolId}/heart`, { method: 'POST', token }),
  unheart: (idolId: string, token: string) =>
    request<HeartToggleResponseDto>(`/idols/${idolId}/heart`, { method: 'DELETE', token }),
  follow: (idolId: string, token: string) =>
    request<FollowToggleResponseDto>(`/idols/${idolId}/follow`, { method: 'POST', token }),
  unfollow: (idolId: string, token: string) =>
    request<FollowToggleResponseDto>(`/idols/${idolId}/follow`, { method: 'DELETE', token }),
  listMyHearts: (token: string, opts: { page?: number; size?: number } = {}) =>
    request<PaginatedResponseDto<IdolCardDto>>('/me/hearts', {
      token,
      query: { page: opts.page, size: opts.size },
    }),
  listMyFollows: (token: string, opts: { page?: number; size?: number } = {}) =>
    request<PaginatedResponseDto<IdolCardDto>>('/me/follows', {
      token,
      query: { page: opts.page, size: opts.size },
    }),

  // -- cheers (응원댓글) — RPT-260426-C P2 SCR-006 ----------------------
  listCheers: (idolId: string, opts: { page?: number; size?: number } = {}) =>
    request<PaginatedResponseDto<CheerDto>>(`/idols/${idolId}/cheers`, {
      query: { page: opts.page, size: opts.size },
    }),
  createCheer: (idolId: string, body: CreateCheerDto, token: string) =>
    request<CheerDto>(`/idols/${idolId}/cheers`, { method: 'POST', body, token }),

  // -- fan club -----------------------------------------------------------
  fanClubStatus: (idolId: string, token: string) =>
    request<FanClubStatusDto>(`/idols/${idolId}/fan-club`, { token }),
  joinFanClub: (idolId: string, token: string) =>
    request<FanClubStatusDto>(`/idols/${idolId}/fan-club/join`, { method: 'POST', token }),
  leaveFanClub: (idolId: string, token: string) =>
    request<FanClubStatusDto>(`/idols/${idolId}/fan-club/leave`, { method: 'POST', token }),
  listMyMemberships: (token: string) =>
    request<PaginatedResponseDto<MembershipDto>>('/me/memberships', { token }),

  // -- chat ---------------------------------------------------------------
  openChatRoom: (idolId: string, token: string) =>
    request<ChatRoomDto>(`/chat/rooms/${idolId}/open`, { method: 'POST', token }),
  listChatMessages: (roomId: string, token: string, take = 50) =>
    request<ChatMessageDto[]>(`/chat/rooms/${roomId}/messages`, {
      token,
      query: { take },
    }),
  sendChatMessage: (roomId: string, content: string, token: string) =>
    request<{ user: ChatMessageDto; idol: ChatMessageDto }>(
      `/chat/rooms/${roomId}/messages`,
      { method: 'POST', body: { content }, token },
    ),
  getChatBalance: (token: string) =>
    request<ChatBalanceDto>('/me/chat-balance', { token }),

  // -- auditions (public) ------------------------------------------------
  listAuditions: (opts: { status?: 'ACTIVE' | 'FINISHED' } = {}) =>
    request<AuditionListItemDto[]>('/auditions', { query: { status: opts.status } }),
  getAudition: (id: string) => request<AuditionDto>(`/auditions/${id}`),

  // -- votes -------------------------------------------------------------
  getLeaderboard: (roundId: string) =>
    request<RoundLeaderboardDto>(`/rounds/${roundId}/leaderboard`),
  getMyVoteStatus: (roundId: string, token: string) =>
    request<MyVoteStatusDto>(`/rounds/${roundId}/me/vote-status`, { token }),
  castVote: (
    roundId: string,
    body: { idolId: string; method: VoteMethod },
    token: string,
  ) =>
    request<CastVoteResultDto>(`/rounds/${roundId}/votes`, {
      method: 'POST',
      body,
      token,
    }),
  getMyVoteTickets: (token: string) =>
    request<MyVoteTicketsDto>('/me/vote-tickets', { token }),
  listMyVotes: (token: string, opts: { page?: number; size?: number } = {}) =>
    request<PaginatedResponseDto<MyVoteEntryDto>>('/me/votes', {
      token,
      query: { page: opts.page, size: opts.size },
    }),

  // -- commerce -----------------------------------------------------------
  listProducts: () => request<PurchaseProductDto[]>('/commerce/products'),
  createPurchase: (body: CreatePurchaseDto, token: string) =>
    request<PurchaseTransactionDto>('/commerce/purchases', {
      method: 'POST',
      body,
      token,
    }),
  listMyPurchases: (token: string) =>
    request<PurchaseTransactionDto[]>('/me/purchases', { token }),

  // -- photocards (public + user) ---------------------------------------
  getPhotocardSet: (setId: string) =>
    request<PhotocardSetDto>(`/photocards/sets/${setId}`),
  listMyPhotocards: (token: string) =>
    request<UserPhotocardDto[]>('/me/photocards', { token }),
};
