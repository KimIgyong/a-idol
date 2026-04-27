---
id: ADR-011
title: Soft-leave for fan club memberships (same row, leftAt flag)
status: Accepted
date: 2026-04-22
author: Gray Kim
related_tasks: [T-022]
related_context: Fandom
---

## Context

`Membership` joins `(user_id, fan_club_id)` and Postgres enforces
`@@unique([userId, fanClubId])`. We need two behaviors that interact:

1. **Leaving** a fan club should not erase the user's history — analytics want
   to know "how many members ever joined", "churn over time", etc.
2. **Re-joining** a fan club must feel instantaneous to the end user (no "you
   already joined this on 2025-03" error) and must leave a predictable row in
   the DB.

Naively issuing `DELETE` on leave + `INSERT` on re-join violates the uniqueness
constraint if history rows linger, and a second join after a hard delete makes
"ever member" analytics impossible.

## Decision

Use **soft leave**: `Membership.leftAt = now()` on leave; on re-join, `UPSERT`
the same `(userId, fanClubId)` row — set `leftAt = null` and refresh `joinedAt`.

- `memberCount` is computed as `COUNT(*) WHERE leftAt IS NULL`.
- `POST /api/v1/idols/:id/fan-club/join` is idempotent (join again → still member, count unchanged).
- `POST /api/v1/idols/:id/fan-club/leave` is idempotent (leave twice → still not a member, count unchanged).

## Consequences

**Positive**
- Never trips the unique constraint; no dead rows to clean up.
- History preserved: `joinedAt` + `leftAt` pairs answer tenure / churn
  questions directly.
- Client UX is simple — the same endpoint on double-tap does the right thing.

**Negative**
- "Last joined at" overrides the first join date. A separate `memberships_history` table would be needed if analytics ever wants the original join timestamp.
  For MVP, refreshing `joinedAt` is acceptable (events will be captured by
  audit/event-log once Phase D observability lands).
- Relies on callers querying `leftAt IS NULL` everywhere active membership is checked.

## Alternatives considered

1. **Hard delete on leave.** Rejected: destroys history needed for analytics
   and complicates "has this user ever been a member?" queries.
2. **Separate `membership_events` append-only log + `membership_status` row.**
   Correct long-term, but overkill for MVP. Revisit under T-080 observability.

## Status of implementation

- `packages/backend/src/modules/fandom/infrastructure/prisma-fan-club.repository.ts`
  — `join()` uses `prisma.membership.upsert` to clear `leftAt` and set
  `joinedAt = new Date()` on re-join. `leave()` only flips `leftAt`.
- `packages/backend/src/modules/fandom/application/join-fan-club.usecase.ts`
  — `GetFanClubStatusUseCase` + `JoinFanClubUseCase` + `LeaveFanClubUseCase`.
- Verified by `join-fan-club.usecase.spec.ts` + live E2E "leave → rejoin"
  returning the same row with `leftAt` cleared.
