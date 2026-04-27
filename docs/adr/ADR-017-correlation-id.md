---
id: ADR-017
title: Clients generate per-request correlation IDs and surface them on errors
status: Accepted
date: 2026-04-23
author: Gray Kim
related_tasks: [T-080]
related_context: Observability
related_decisions: []
---

## Context

T-080 slice 2 landed `genReqId` in the backend: every request gets a
`reqId` on every log line and an `X-Request-ID` response header (honoring
the caller's header if present, minting a UUID otherwise). This is the
server side of the correlation story.

The client side is still missing:

1. **Support tickets are blind.** When a user hits "내가 산 투표권이 안 들어
   왔어요" in mobile, we have no way to jump straight to their request
   log. We'd have to timestamp + narrow by user id — and that assumes the
   incident even reached production logs.
2. **Retry-on-failure loses context.** Today's mobile client retries on
   network flakes without carrying a stable trace id, so a support
   engineer sees 3–4 different request ids for what the user perceived
   as "one failed purchase."
3. **CMS edits from multiple admins are indistinguishable** in the log
   stream unless we join on admin id + minute-precision timestamps.
   Correlation by the browser tab that initiated the edit is impossible.

The backend is already set up to accept a client-supplied id (`X-Request-ID`
header), keep it verbatim, and echo it back. We just need to:

- Generate an id on the client per logical request.
- Send it on the way in.
- Capture the echoed id on the way out — including on error responses.
- Expose the id to the error UI so users can copy-paste it into support.

## Decision

Both `packages/mobile` and `packages/cms` follow the same contract:

### Outbound

Every outbound request generates a fresh UUID v4 and sets
`X-Request-ID: <uuid>`. **Retries carry the same id** — the client decides
what counts as "a retry of the same logical operation." The backend
preserves the id, so retry loops land in a single log thread.

IDs are 36-char UUIDs; the backend cap is 128 chars, so any browser /
native crypto UUID implementation passes.

### Inbound

`ApiError` gains a `requestId` field populated from the
`X-Request-ID` response header on non-2xx responses. Successful
responses don't need it surfaced — the id is already in the server logs
under the happy path.

### UI surface

- **Mobile error toasts** render the id underneath the message in
  small-caps monospace, with a tap to copy to clipboard. Only for
  unexpected errors (HTTP 5xx or network failures) — expected 4xx errors
  from business rules (e.g. `NOT_ENOUGH_TICKETS`) don't show the id; the
  user's action is clear.
- **CMS error banners** show the id in the error card's metadata line.
- Both use the format `요청 ID: <short8>…<short8>` — first + last 8 chars,
  full UUID copied on tap.

### Scoping

Web frameworks typically generate a trace id per network request. We do
the same — one id per `fetch()` call. When a user action fans out into
multiple requests (e.g. vote + leaderboard refetch), each gets its own
id. That's fine: the common root is `userId + minute`, which the backend
log already captures.

Distributed tracing (per-span ids, propagating across services) is a
Phase-D concern and OpenTelemetry will replace this simpler scheme when
it lands. Until then, UUID-per-request is enough for support ticket UX.

## Consequences

**Positive**

- Support engineer copies the id from the user's screenshot → one log
  query reveals the entire request path, including any retries that
  shared the id.
- Retry loops debug as one coherent trace, not three unrelated requests.
- No server-side change required — the backend already accepts and
  echoes.
- ID generation uses `crypto.randomUUID()` (native in both React Native
  0.74+ and modern browsers) — no extra dependency.

**Negative**

- Every request now pays ~36 bytes of outbound header overhead. Invisible
  compared to the rest of the payload and JWT, but worth noting for
  ultra-constrained mobile networks.
- Client-generated UUIDs aren't globally coordinated. If a buggy client
  sends the same id for two different requests, the backend accepts it
  and the log thread will look confused. Acceptable — we treat the id as
  advisory, not an index.
- Retry-carries-same-id means if the server handled the first request
  and only the response was lost, the second request appears as a
  duplicate under the same id. That's desired — it's exactly the case
  where duplicate-detection (R-03, `(provider, providerTxId)` unique
  index) has to fire anyway.

## Rejected alternatives

1. **Server generates, client just displays.** Rejected — the client
   can't show the id until after the response returns, which means network
   failures (no response at all) have no id. Client-generated id is
   always available.

2. **Per-session id instead of per-request.** Rejected — a single session
   can span hours and hundreds of requests. That loses the "which
   specific purchase failed" granularity the support use case needs.

3. **OpenTelemetry propagation today (W3C `traceparent`).** Rejected for
   MVP — full OTel integration is a bigger project (collector, backend,
   sampling config). Deferred to Phase D. `X-Request-ID` is forward-
   compatible: when OTel arrives we set `X-Request-ID` from the root
   span's trace id, and the client API doesn't change.

## Activation / follow-ups

- Deep-link from support tooling: once we have a log aggregator, the
  copy button should hand over a pre-formed search URL instead of just
  the id string.
- Sentry integration (deferred, see T-080 slice 2 notes): when a DSN
  lands, attach `requestId` as a Sentry tag so Sentry events and
  backend logs join cleanly.
- Mobile retry policy: the one `useCastVote` / `usePurchase` hook reuses
  the same id within a retry cycle. Today retries are automatic only on
  network errors; we should audit the other hooks and decide per-call
  whether they should reuse the id on retry.

## Status of implementation

- Backend `genReqId` (`packages/backend/src/shared/logger/correlation.ts`):
  shipped T-080 slice 2 — accepts incoming header, falls back to UUID,
  echoes on response.
- Mobile `packages/mobile/src/api/client.ts`: generates UUID,
  sends `X-Request-ID`, captures echoed id on errors and exposes it via
  `ApiError.requestId`.
- CMS `packages/cms/src/lib/api.ts`: same treatment.
