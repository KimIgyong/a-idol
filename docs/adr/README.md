# Architecture Decision Records (ADR) — index

Each ADR captures one architectural choice + its trade-offs at the time of
acceptance. Newer ADRs may supersede older ones; superseding is noted in the
target file's frontmatter.

ADR-001..009 belong to the amb-starter-kit baseline (shared across Amoeba
projects); A-idol-specific decisions begin at ADR-010.

| ID | Title | Date | Status | Context | Related tasks |
|---|---|---|---|---|---|
| [ADR-010](ADR-010-admin-user-separation.md) | Separate AdminUser from User for CMS RBAC | 2026-04-22 | Accepted | AdminOps | T-011 |
| [ADR-011](ADR-011-fandom-soft-leave.md) | Soft-leave for fan club memberships (same row, leftAt flag) | 2026-04-22 | Accepted | Fandom | T-022 |
| [ADR-012](ADR-012-paid-fanclub-mvp.md) | Paid fan clubs deferred to Commerce (T-044); MVP free-only | 2026-04-22 | Accepted | Fandom, Commerce | T-022, T-044 |
| [ADR-013](ADR-013-chat-reply-engine-mvp.md) | Rule-based chat reply engine for MVP; pluggable port for Phase 2 LLM swap | 2026-04-23 | Accepted | Chat | T-040, T-042 |
| [ADR-014](ADR-014-leaderboard-redis-pg-snapshot.md) | Redis sorted-set is the live leaderboard; Postgres snapshots are the backup | 2026-04-23 | Accepted | Audition / Vote | T-063, T-064 |
| [ADR-015](ADR-015-commerce-dev-sandbox.md) | Commerce MVP is a dev-sandbox port; Apple/Google/Stripe land as adapters | 2026-04-23 | Accepted | Commerce | T-044 |
| [ADR-016](ADR-016-photocard-gacha-disclosure.md) | Photocard packs disclose per-template drop rates; pity is deferred | 2026-04-23 | Accepted | Photocard, Commerce | T-045 |
| [ADR-017](ADR-017-correlation-id.md) | Clients generate per-request correlation IDs and surface them on errors | 2026-04-23 | Accepted | Observability | T-080 |
| [ADR-018](ADR-018-photocard-trade-deferred.md) | Photocards do not trade, gift, or transfer in MVP | 2026-04-23 | Accepted | Photocard, Regulation | T-045, T-046b |
| [ADR-019](ADR-019-apple-iap-adapter.md) | Apple IAP adapter — StoreKit v2 JWS verification + server-to-server webhooks | 2026-04-23 | Accepted | Commerce, Payments | T-044, T-046 |
| [ADR-020](ADR-020-orm-prisma-over-typeorm.md) | Adopt Prisma as the ORM (deviating from amb-starter-kit's TypeORM standard) | 2026-04-24 | Accepted | Infrastructure | T-004 |
| [ADR-021](ADR-021-phase-c-perf-levers.md) | Phase C performance levers — four axes (compression, select narrowing, Redis meta cache, ETag 304) | 2026-04-24 | Accepted | Performance, Observability | T-081 |

## Reading order for new joiners

1. **ADR-010** sets the auth landscape (admin vs user).
2. **ADR-014** explains the live leaderboard data flow — referenced by ADR-021 lever 3.
3. **ADR-017** explains how errors carry a trace id end-to-end. Referenced by every controller.
4. **ADR-020** clarifies the ORM choice — relevant whenever schema or migration shows up.
5. **ADR-021** consolidates the four performance levers shipped in Phase C; the perf-baseline + design sketches sit under [docs/ops/](../ops/).

## Decisions parked as design sketches (not yet ADR)

- [docs/ops/design-leaderboard-full-cache-ko.md](../ops/design-leaderboard-full-cache-ko.md) — `/leaderboard` 전체 응답 Redis cache (Lever 5 후보). Promoted to ADR if k6 50k staging signals it as a bottleneck.

## Format

Each ADR follows the template:

```yaml
---
id: ADR-NNN
title: <one-line decision>
status: Proposed | Accepted | Superseded
date: YYYY-MM-DD
author: <name>
related_tasks: [T-...]
related_context: <bounded context or topic>
related_decisions: [ADR-...]
---
```

Sections (typical): **Context** → **Decision** → **Consequences** →
**References**. Trade-offs and non-applied paths belong in Consequences.

A new ADR is required whenever a choice constrains future code (data shape,
boundary contract, persistence, third-party integration, perf trade-off).
Implementation details that don't constrain anything live in code comments,
not in ADRs.
