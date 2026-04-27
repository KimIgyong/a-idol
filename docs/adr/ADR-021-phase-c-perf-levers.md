---
id: ADR-021
title: Phase C performance levers — four axes (compression, select narrowing, Redis meta cache, ETag 304)
status: Accepted
date: 2026-04-24
author: Gray Kim
related_tasks: [T-081]
related_context: Performance, Observability
related_decisions: [ADR-014, ADR-017]
---

## Context

Phase C entered with a single autocannon baseline (`/health`, `/idols`,
`/commerce/products`, `/leaderboard`) and no actionable plan for the
50k-concurrent target in T-081. Over 2026-04-23 to 2026-04-24 four
orthogonal performance levers landed, each shipped as an independently
measurable slice and documented in [perf-baseline-ko.md](../ops/perf-baseline-ko.md).

This ADR consolidates those decisions so a future on-call engineer can see
the whole picture in one place without reading 9 commits + a changelog.

## Decision

Accepted: keep all four levers in the production path. Staleness trade-offs
+ non-applied paths are documented below. Default answer for "should we
cache X?" in Phase D is **"yes, which lever fits"**.

### Lever 1 — Response compression

- `compression` Express middleware, `threshold: 1024` bytes
- Wired in [main.ts](../../packages/backend/src/main.ts#L22), before other middleware so error bodies are covered
- Impact: `/idols?size=20` 4 KB → 1.5 KB wire (−63%), `/commerce/products` −54%
- Local RPS penalty (~10%) because gzip CPU has no network latency to offset;
  real mobile 4G/5G users see a clear win (3–16 ms transfer + 30–80 ms RTT
  → ~4× smaller payload saves the slow-path dominates)
- No staleness concern — byte-for-byte identical semantics

### Lever 2 — Prisma `select` narrowing

Applied to 4 repos:
- [prisma-idol.repository.ts#listPublished](../../packages/backend/src/modules/catalog/infrastructure/prisma-idol.repository.ts)
- [prisma-heart.repository.ts#listHeartedIdols](../../packages/backend/src/modules/fandom/infrastructure/prisma-heart.repository.ts)
- [prisma-follow.repository.ts#listFollowedIdols](../../packages/backend/src/modules/fandom/infrastructure/prisma-follow.repository.ts)
- [prisma-admin-idol.repository.ts](../../packages/backend/src/modules/catalog/infrastructure/prisma-admin-idol.repository.ts) (5 paths via `ADMIN_IDOL_SELECT` constant)

Biggest field excluded: `Idol.profileJson` (AI-generated persona, ~10 KB
JSONB per row). Payload didn't change (view mappers already filtered), but
PG→Node hydration cost dropped.

- Impact: `/idols` +12% RPS, `/me/hearts` +5%, `/me/follows` +7%. Admin
  ≒ noise on 99-idol seed — kept on principle (wins emerge at scale).
- No staleness — select is a server-side optimization

### Lever 3 — Redis idol metadata cache + write-through invalidation

- Port: [IdolMetaCache](../../packages/backend/src/modules/catalog/application/idol-meta-cache.interface.ts)
  (getMany / invalidate)
- Impl: [RedisIdolMetaCache](../../packages/backend/src/modules/catalog/infrastructure/redis-idol-meta.cache.ts)
  — MGET → Prisma miss fallback → pipeline SET with EX=300s
- Consumer: [GetLeaderboardUseCase](../../packages/backend/src/modules/vote/application/leaderboard.usecase.ts)
  — replaces N-row Prisma findMany with a single MGET
- Write-through: `UpdateIdolUseCase` / `SoftDeleteIdolUseCase` call
  `cache.invalidate([id])` after successful repo mutation

Impact: `/leaderboard` 5,117 → 6,454 RPS (+26%), p50 9→7 ms.

**Staleness contract**:
- TTL 5 minutes (cap on the "someone forgot to call invalidate" failure mode)
- Write-through from admin edit paths → zero staleness on the happy path
- Failure paths (IDOL_NOT_FOUND / AGENCY_NOT_FOUND) do not touch the cache
  — locked in by unit tests TC-AC005–008

### Lever 4 — ETag / 304 conditional GET

Applied to 3 public endpoints using two sub-patterns:

**Cheap identity probe** (list endpoints — skip the main fetch on hit):
- `/api/v1/idols` — [catalog.controller.ts](../../packages/backend/src/modules/catalog/presentation/catalog.controller.ts), cache hit +110% RPS
- `/api/v1/commerce/products` — [commerce.controller.ts](../../packages/backend/src/modules/commerce/presentation/commerce.controller.ts), cache hit +63% RPS

**Loaded-data ETag** (single-resource endpoint — compute after fetch):
- `/api/v1/auditions/:id` — [public-audition.controller.ts](../../packages/backend/src/modules/audition/presentation/public-audition.controller.ts), bytes −66% on hit, modest RPS gain (+7%) because DB fetch is still on the critical path

ETag shape (weak):
- List:   `W/"<resource>-<total>-<maxUpdatedAt>-<filter-shape>"`
- Detail: `W/"audition-<id>-<maxStamp>-r<roundCount>-e<entryCount>"`

Hit ratio assumptions (informed guesses — to be validated in Phase D):
- `/idols` — 30–60% during active homepage scrolling (high churn from
  heartCount bumps invalidates often)
- `/commerce/products` — 70–90% (admin edits rare)
- `/auditions/:id` — 60–80% (round transitions periodic)

**Staleness caveats**:
- ~~`/auditions/:id` uses `audition.updatedAt` as the dominant signal; round
  status changes don't always bump audition → risk of serving stale round
  status.~~ — **2026-04-24 resolved** via `AuditionRepository.touchUpdatedAt`
  hook in `CreateRoundUseCase` / `UpdateRoundUseCase` /
  `TransitionRoundUseCase` / `DeleteRoundUseCase` / `AddEntriesUseCase` /
  `RemoveEntryUseCase`. Every round + entry mutation now bumps the parent
  audition. Regression covered by TC-ETAG-AUD-004.
- All ETags are weak — we don't promise byte-for-byte equality under
  compression / proxy rewrites. Clients MUST treat them as equivalence.

## Trade-offs

### Cost on cache-miss paths
Levers 3–4 each add a small cost on misses: Lever 3's `MGET` is a Redis
roundtrip before the Prisma fallback; Lever 4's list-endpoint probe is two
extra small PG queries. Acceptable if hit ratio > ~30%. Validated for
`/idols` (+110% on hits easily dominates 28% miss regression at > 30% hits).

### Added module surface
Lever 3 introduces a cross-module dependency: VoteModule now imports
CatalogModule. Acceptable — the alternative (duplicating a Redis cache
inside VoteModule) would fragment the idol metadata source of truth.

### Memory footprint
Lever 3 caches up to N idol metadata entries (N ≈ seed count, ~99 today,
likely <500 at GA). Each entry ~200 bytes JSON → <100 KB Redis memory.
No eviction policy needed at this scale.

## Non-applied paths (Phase D backlog)

- ~~**ETag on** `/idols/:id` detail, `/me/hearts`, `/me/follows`~~ —
  **2026-04-24 landed**. `/idols/:id`: loaded-data ETag
  `W/"idol-<id>-<updatedAt>-i<imageCount>"`. `/me/hearts` + `/me/follows`:
  cheap per-user identity probe, `Vary: Authorization` header, userId
  embedded in the ETag so a stray token can't cross-match. Accepted
  staleness: heartCount/followCount drift on listed idols from *other*
  users' activity is not invalidated until the owner toggles their own
  heart/follow — HTTP refresh gives fresh data. Coverage:
  TC-ETAG-DETAIL-001..003 + TC-ETAG-ME-001..004.
- **Leaderboard payload caching** (not just idol meta) — whole response
  is cacheable for ~5 seconds during active rounds. Redis key per round,
  short TTL. Defer until 50k-concurrent k6 run shows the hydrate path is
  still the bottleneck. **Design sketch**:
  [design-leaderboard-full-cache-ko.md](../ops/design-leaderboard-full-cache-ko.md)
  (2026-04-24 — frozen for fast implementation once k6 signals go).
- ~~**Round status write-through**~~ — **2026-04-24 landed**. See
  Staleness caveats resolution above + TC-ETAG-AUD-004.
- ~~**CMS `If-None-Match` fetcher**~~ — **2026-04-24 landed**. `apiFetch`
  now auto-stores ETag + body per path on GETs, forwards `If-None-Match`
  on subsequent calls, returns cached body on 304, and drops the entry
  on any write to the same path. `/api/v1/admin/catalog/idols` now also
  emits ETag (admin-list flavour). Integration covered by
  TC-ETAG-ADMIN-001..003. **2026-04-24 follow-up**: centralized
  TanStack Query invalidation helpers ([query-keys.ts](../../packages/cms/src/lib/query-keys.ts)
  + [query-invalidation.ts](../../packages/cms/src/lib/query-invalidation.ts))
  retrofitted into **7 CMS surfaces** — agencies-page, idols-page,
  audition-detail-modal, commerce-page, photocards-page,
  photocard-set-detail-modal, auto-messages-page, round-vote-rule-section.
  Cross-entity staleness (agency rename → idol list; vote-rule upsert →
  audition detail) now handled at a single point. Helpers also call
  `invalidateEtagCache()` so the apiFetch layer doesn't hold stale
  bodies either. **2026-04-25 mobile parity**: same module-level
  `etagCache` pattern ported into [mobile/src/api/client.ts](../../packages/mobile/src/api/client.ts)
  — cache key is `${path}${qs}` so paginated reads (`/me/hearts?page=N`)
  share entries cleanly, 304 short-circuits without parsing the body,
  non-GET writes drop the same-path entry, `invalidateEtagCache(key?)`
  exported for cross-entity invalidation. 6 new tests
  ([api-etag.spec.ts](../../packages/mobile/src/hooks/__tests__/api-etag.spec.ts)).
  **2026-04-26 mobile cross-entity invalidation**: `useIdolFandom`
  toggleHeart/toggleFollow now call `invalidateEtagPrefix('/me/hearts')` /
  `'/me/follows'` + `'/idols'` after a successful mutation. Closes the
  "stale paginated cache after toggle" gap noted in v1 of the mobile
  port (heart toggle would otherwise leave `?page=N` cache entries stale
  until natural ETag mismatch). 2 new tests in
  [useFandom.spec.ts](../../packages/mobile/src/hooks/__tests__/useFandom.spec.ts).

## Consequences

- Future perf work should first identify which lever's contract changes
  (e.g., "new cache" = lever 3 pattern; "new public read" = lever 4).
- New admin mutations that touch `Idol.name` / `stageName` / `heroImageUrl`
  MUST call `IdolMetaCache.invalidate([id])` or they will serve stale data
  for up to 5 minutes.
- Regression floor: perf-baseline-ko.md "재측정 방법" section — a PR that
  pushes any RPS below ±20% needs justification in its description.
- k6 harness under `packages/backend/test/load/` is the new measurement
  tool of record; autocannon single-endpoint measurements are no longer
  sufficient signal.

## References

- [perf-baseline-ko.md](../ops/perf-baseline-ko.md) — measurement detail + change history
- [phase-c-checklist.md](../implementation/phase-c-checklist.md) T-081 row
- ADR-014 — leaderboard reconciliation (sibling context for Lever 3)
- ADR-017 — correlation id (complementary ops infra)
