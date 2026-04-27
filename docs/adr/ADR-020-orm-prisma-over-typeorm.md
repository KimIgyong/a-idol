---
id: ADR-020
title: Adopt Prisma as the ORM (deviating from amb-starter-kit's TypeORM standard)
status: Accepted
date: 2026-04-24
author: Gray Kim
related_tasks: [T-004]
related_context: Infrastructure
supersedes: null
related_reports: [RPT-260424]
---

## Context

The Amoeba Company platform standard [`docs/amb-starter-kit/amoeba_code_convention_v2.md`](../amb-starter-kit/amoeba_code_convention_v2.md) prescribes **TypeORM** as the canonical ORM across all Amoeba projects, together with supporting rules such as:

- `{colPrefix}_{name}` 3-letter column prefix (e.g., `cmp_name`, `usr_email`).
- `@Column({ type: 'varchar', nullable: true })` explicit type requirement for nullable union-type properties (MUST).
- `synchronize: true` in dev and manual SQL migration in staging/production.
- `OwnEntityGuard` + entity-scoped repositories for multi-tenancy.

A-idol's scaffolding (Phase 0, T-004 "Prisma 스키마 + 마이그레이션 초안") committed to **Prisma 5.x** before this ADR was written. As of 2026-04-24 the codebase has ~32 Prisma models, committed migrations under `packages/backend/prisma/migrations/`, seed scripts, and `@a-idol/shared` DTO contracts that consume generated Prisma types at the `infrastructure/` boundary. 10 backend modules (Phase 0/A/B/C) are implemented on top of this stack.

This ADR **retroactively records** the choice and its rationale so future contributors and reviewers can understand why A-idol deviates from the platform standard. It references the detailed comparison in [`RPT-260424 — Prisma vs TypeORM`](../report/RPT_260424_prisma-vs-typeorm.md).

## Decision

**A-idol adopts Prisma 5.x as the ORM for `packages/backend`, deviating from the amb-starter-kit TypeORM standard.**

Concrete implications:

1. **Schema source of truth**: `packages/backend/prisma/schema.prisma` — not TypeORM entity classes under `src/modules/*/`.
2. **Naming deviation from amb-starter-kit**: no `amb_*` table prefix, no 3-letter column prefix. DB columns are `snake_case` via Prisma `@map`; TS fields are `camelCase`. (See [`a-idol-code-convention.md §4`](../implementation/a-idol-code-convention.md).)
3. **Migration flow**: `prisma migrate dev --name <x>` locally, `prisma migrate deploy` in staging/production (Phase D). No `synchronize: true`. No `prisma db push` outside ad-hoc experimentation.
4. **NestJS integration**: custom `PrismaService` + module provider under `packages/backend/src/shared/prisma/`. No `@nestjs/typeorm`.
5. **Repository pattern**: Prisma Client usage confined to `infrastructure/prisma-*.repository.ts` files. Application-layer use cases depend on ports defined in `application/interfaces.ts`, not on Prisma types.
6. **TypeORM-specific rules are not applied**: nullable explicit `type:`, `forwardRef` circular-dependency TypeORM cases, `OwnEntityGuard` at the ORM layer — all N/A.

## Consequences

### Positive

- **Type safety at the monorepo boundary**: Prisma's generated types feed `@a-idol/shared` DTO contracts with precise field-level inference (`select`/`include` narrows result types). Mobile and CMS consume these types unchanged.
- **Migration trust**: Prisma's diff + committed `migration.sql` history avoids the "diff-and-patch" workflow that TypeORM migrations frequently require in practice. Across Phase A/B/C there have been no migration-related incidents.
- **Operational visibility via Prisma Studio**: ops/CS can inspect data without a separate Adminer or DBeaver setup; `make studio` is a one-liner.
- **Clean Architecture fit**: Prisma Client naturally stays confined to `infrastructure/` because use cases cannot trivially import Prisma types across layer boundaries.
- **Small domain, explicit relations**: A-idol's fandom domain has no polymorphism or tree structures that TypeORM handles more ergonomically. The "every N:M requires an explicit join model" Prisma constraint aligns with the domain — `Membership`, `UserPhotocard`, etc. are meaningful aggregates, not plumbing.
- **`createMany` / `$executeRaw` for batch work**: leaderboard snapshots and bulk seed operations avoid Entity-instantiation overhead.

### Negative

- **Deviation from platform standard** requires explicit documentation (this ADR + [CLAUDE.md deviation table](../../CLAUDE.md) + [a-idol-code-convention.md §16](../implementation/a-idol-code-convention.md)) so cross-project contributors don't expect TypeORM patterns.
- **No `@nestjs/typeorm` equivalent**: the custom provider pattern (`PrismaService` with `onModuleInit`/`onModuleDestroy`, transaction helpers) must be maintained in-house. Future contributors familiar with `@nestjs/typeorm` need an orientation pointer.
- **No `QueryBuilder`**: complex dynamic queries fall back to `$queryRaw` tagged templates. For A-idol specifically this is mitigated — round/audition aggregation uses Redis leaderboards ([ADR-014](ADR-014-leaderboard-redis-pg-snapshot.md)) rather than ad-hoc SQL.
- **Edge runtime limitations**: Prisma v5 requires Accelerate or Data Proxy for Cloudflare Workers / Vercel Edge. A-idol's deployment plan (ECS + RDS) is unaffected, but a future rearchitecture would incur friction.
- **Cold-start overhead**: the Prisma query engine adds ~50–200ms on cold start. Negligible for long-running ECS containers; would be material for serverless Lambdas (not planned).
- **No official rollback story**: `prisma migrate` has no `down` step. Operational playbook must include manual forward-fix migrations and documented revert patterns (to be captured in Phase D runbooks).

## Alternatives considered

### 1. Adopt amb-starter-kit's TypeORM standard as-is

Rejected. The entire amb-starter-kit TypeORM stance is built around **AMB Management's B2B multi-tenant enterprise domain** (Entity/Cell/Unit, `OwnEntityGuard`, 4-level RBAC, Oracle-compatible SQL, Popbill/NICEPAY/Slack integrations). A-idol has:

- No multi-tenancy (B2C single-tenant).
- 2-level RBAC only (User + AdminUser) — [ADR-010](ADR-010-admin-user-separation.md).
- Postgres only, no Oracle/SAP HANA target.
- Mobile-first type-sharing requirement that TypeORM's reflect-metadata-based types serve poorly.

Inheriting TypeORM would import constraints (nullable `type:` discipline, `OwnEntityGuard` subscribers, lazy-relation typing pitfalls) that pay for features A-idol does not need.

### 2. Drizzle ORM

Considered briefly. Strengths: SQL-first, excellent type inference, minimal runtime, strong edge-runtime story. Rejected for the A-idol MVP because:

- Younger ecosystem (2023+) with less operational track record than Prisma.
- Less mature migration tooling as of early 2026.
- No equivalent to Prisma Studio for ops-side data inspection.
- Switching would prolong Phase 0 scaffolding with no offsetting win for A-idol's stack.

Drizzle remains a candidate for a future rewrite if Prisma's edge limitations or cold-start costs become binding.

### 3. Raw SQL with a thin wrapper (`pg` + `sql-template-tag`)

Rejected. A-idol's 32-model domain is complex enough that manual SQL maintenance + hand-written DTO marshaling would slow Phase A/B/C delivery far more than Prisma's abstraction overhead costs. Acceptable for small services; not for a multi-module backend with a 19-week MVP deadline.

### 4. MikroORM

Considered briefly. Unit-of-work pattern and better type inference than TypeORM, with TypeORM-like entity classes. Rejected because it occupies an awkward middle ground: retains TypeORM's class+decorator duplication while lacking Prisma's generated-client simplicity and tooling depth. No decisive win for A-idol.

## Status of implementation

- **Schema**: `packages/backend/prisma/schema.prisma` — 32 models covering identity, catalog, fandom, chat, commerce, audition, voting, photocard, admin-ops.
- **Client**: generated to `@prisma/client`; wrapped as a NestJS provider in `packages/backend/src/shared/prisma/`.
- **Migrations**: committed under `packages/backend/prisma/migrations/<timestamp>_<name>/migration.sql`.
- **Seed**: `packages/backend/prisma/seed.ts` (1 agency + 99 idols + baseline fan clubs + admin user for dev).
- **Repositories**: `infrastructure/prisma-<aggregate>.repository.ts` per module, implementing ports from `application/interfaces.ts`.
- **Dev UX**: `make studio`, `make migrate`, `make seed`, `make reset` all wired to Prisma CLI via pnpm filter.
- **Shared types**: `@a-idol/shared/contracts/` consumes Prisma types indirectly (through domain entities) so DTO contracts reflect real DB shapes without leaking Prisma as a dependency to mobile/CMS.

## Future work

- **Document the Prisma+NestJS integration patterns** (custom `PrismaService`, transaction boundary helpers, soft-delete filter middleware) under `docs/implementation/` or a follow-up ADR once patterns stabilize. Currently scattered across `packages/backend/src/shared/prisma/`.
- **Phase D observability**: add query logging/tracing via Prisma middleware + OpenTelemetry (see [ADR-017](ADR-017-correlation-id.md)) so slow queries are visible in production.
- **EXPLAIN checks on hot endpoints**: idol list, chat room message fetch, vote casting — validate no unexpected JOIN plans introduced by `include` usage.
- **Rollback playbook**: since `prisma migrate` has no `down`, document the forward-fix migration pattern in a Phase D runbook (`docs/ops/`).
- **Re-evaluate on major milestones**:
  - If an Edge deployment target is added → revisit Prisma Accelerate / Data Proxy costs or Drizzle.
  - Prisma v5 → v6 upgrade → review breaking-change list, especially any impact on `@prisma/client` type inference for `@a-idol/shared`.
- **Request DTO casing migration** (cross-cutting, tracked separately): existing backend Request DTOs use camelCase; new DTOs MUST use snake_case per [a-idol-code-convention.md §5.4](../implementation/a-idol-code-convention.md). Not caused by ORM choice but shares the Phase D stabilization window.
