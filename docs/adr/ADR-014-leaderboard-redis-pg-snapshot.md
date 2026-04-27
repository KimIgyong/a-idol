---
id: ADR-014
title: Redis sorted-set is the live leaderboard; Postgres snapshots are the backup
status: Accepted
date: 2026-04-23
author: Gray Kim
related_tasks: [T-063, T-064]
related_context: Audition / Vote
---

## Context

Audition voting (T-063) needs a leaderboard that can:

1. Serve a public read (`GET /rounds/:id/leaderboard`) on every page load of
   the vote screen in the mobile app — hot path under load-test target
   50k concurrent (R-02).
2. Accept heart-vote writes from authenticated users during the round window
   (target ~1,000 TPS under peak, R-02 again).
3. Enforce a per-user daily limit with strict race-safety.
4. Produce a final, durable ranking at the moment the round closes.
5. Survive a cache loss without losing the history of what was voted.

A naive "recompute-from-`votes`-table-on-every-read" approach satisfies (4)
and (5) but fails (1)/(2) — aggregate queries over a large audit table are
several hundred milliseconds at best, far from the p95 < 100ms NFR.

## Decision

**Two tiers**:

- **Redis sorted-set** is the source of truth for the live leaderboard.
  - Key: `vote:leaderboard:r:{roundId}` → `ZINCRBY {weight} {idolId}` on every vote.
  - Read path: `ZREVRANGE … WITHSCORES` returns ranked (idol, score) pairs
    in one round trip. `O(log n + m)` where `m` = requested limit.
  - Daily limit uses a second key `vote:daily:{yyyymmdd-KST}:u:{userId}:r:{roundId}:m:HEART`
    with `INCR` → rollback `DECR` on overage. First `INCR` sets TTL to next
    KST midnight.

- **Postgres** holds two durable artifacts:
  - `votes` — append-only audit row per cast vote. Not read on hot paths.
    Primary uses: Commerce reconciliation (post T-044), admin investigation,
    full recount on cache loss.
  - `round_ranking_snapshots` — `(roundId, snapshotAt, idolId, rank, score)`
    rows inserted every 5 minutes by the BullMQ `ranking-snapshot` cron
    (T-064). Also inserted as a "final" snapshot when the round closes
    (hook to be added in T-067 CMS close action).

## Consequences

**Positive**

- Hot read/write paths stay in sub-10ms Redis land. Load-test headroom.
- DB writes are bounded: one append per vote + one bulk insert every 5 min
  per ACTIVE round. No contention on `UPDATE votes SET count = …` patterns.
- Daily limit is race-safe (atomic `INCR`).
- Final results and historical rankings survive Redis eviction because we
  can replay from the latest snapshot + any post-snapshot `votes` rows.

**Negative**

- **Two sources, two invariants.** If `votes` insert fails after Redis
  `ZINCRBY` succeeds the Redis leaderboard drifts from the audit log. We
  accept this skew for MVP (logged `warn` in `CastHeartVoteUseCase`), and
  plan a T-080 reconciliation job that compares snapshot sum against
  `votes` per round.
- **Cache loss needs a rebuild step.** If Redis disappears we have to run
  a one-shot "rebuild from latest `round_ranking_snapshots` + `votes` since"
  script. Not automated yet; acceptable because staging/prod will use a
  managed Redis with persistence.

## Rejected alternatives

1. **Postgres-only with materialized view refreshed on timer.** Rejected.
   The "refresh every minute" gap is visible on the client (scores freeze
   for up to 60s under active voting). Our UX assumes scores tick up on
   every tap.

2. **Postgres-only with a counter table (`round_idol_counts`) incremented
   per vote.** Rejected. Every vote becomes `UPDATE row WHERE (roundId, idolId)`
   which row-locks under 1,000 TPS per popular idol. Redis `ZINCRBY` is
   lock-free.

3. **Client-side leaderboard aggregation.** Rejected. No way to
   authoritatively rank across users; also fails for users who aren't
   connected (push/email summaries).

## Activation / follow-ups

- Final snapshot on round-close: **shipped** via `RoundClosedListener` →
  `SnapshotRankingUseCase` (event-driven, `round.closed` on EventEmitter2).
- Manual reconciliation: **shipped 2026-04-23** as
  `ReconcileLeaderboardUseCase` behind `POST /api/v1/admin/rounds/:id/reconcile-leaderboard`.
  Reads `GROUP BY idolId, SUM(weight)` from the `votes` audit table and
  overwrites the Redis ZSET in a single `MULTI { DEL ; ZADD }`. Tested
  end-to-end: wipe ZSET → 0 entries → reconcile → scores match pre-wipe.
  The `votes` row weight snapshot means this recovers HEART + TICKET
  contributions identically.
- Automated reconciliation cron: **shipped 2026-04-23** as
  `LeaderboardAuditProcessor` (hourly). `AuditLeaderboardUseCase` sums the
  Redis ZSET (`ZRANGE WITHSCORES`) and compares against
  `SELECT idolId, SUM(weight) FROM votes GROUP BY idolId`; divergence
  greater than 5% is logged at WARN with both numbers. The processor does
  NOT auto-correct partial divergence — silently resyncing would mask
  real bugs. Manual `/admin/rounds/:id/reconcile-leaderboard` is still the
  answer when investigation confirms the fix is needed.
- Cache warmup on redeploy: **shipped 2026-04-23**. `LeaderboardAuditProcessor`
  fires one immediate tick on `onApplicationBootstrap`. For every ACTIVE
  round whose ZSET is empty but whose `votes` table has rows, it invokes
  `ReconcileLeaderboardUseCase` automatically. Verified live: wipe ZSET,
  restart backend, leaderboard score=3 restored without operator action.
  Empty-ZSET-with-votes is the one case where auto-reconcile is
  unambiguous — partial drift stays manual (see above).
- Migration to T-062 (paid tickets) and SMS votes: `VoteCounterRepository.incrIdolScore`
  port — T-062 **shipped** (weighted TICKET votes land in the same ZSET),
  SMS still stub.

## Status of implementation

- Redis wrapper: `RedisVoteCounterRepository` in
  `packages/backend/src/modules/vote/infrastructure/redis-vote-counter.repository.ts`.
- Audit log: `PrismaVoteAuditRepository` writing to `votes`.
- Snapshot cron: `RankingSnapshotProcessor` + `SnapshotRankingUseCase`
  registered by `VoteModule`.
- Leaderboard read: `GetLeaderboardUseCase` goes directly to Redis with
  idol name hydration from Postgres.
- Reconcile endpoint: `AdminVoteController.postReconcile` →
  `ReconcileLeaderboardUseCase` in `packages/backend/src/modules/vote/application/reconcile-leaderboard.usecase.ts`.
- Audit cron + bootstrap warmup: `LeaderboardAuditProcessor` in
  `packages/backend/src/modules/vote/infrastructure/leaderboard-audit.processor.ts`,
  using `AuditLeaderboardUseCase`. Queue name `leaderboard-audit`, cron
  pattern `0 * * * *`, warn threshold 5%.
- Health check: `GET /health` now returns `{status, db, redis}` so ops
  tooling can distinguish a degraded cache layer (`status: "degraded"`)
  from a total outage.
