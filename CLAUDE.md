# A-idol — Claude Code Project Context

This file is read automatically by Claude Code. It tells Claude how the project is organized, what conventions to follow, and what commands to use.

## TL;DR

A-idol is an AI idol fandom platform. End users interact via a **React Native mobile app**; operators use a **React CMS**. The backend is **NestJS + Prisma + PostgreSQL 16 + Redis 7**, structured around **Clean Architecture** (Entity → UseCase → Interface Adapter → Infrastructure).

- Owner: Gray Kim <gray.kim@amoeba.group>
- Repo: pnpm monorepo — `packages/{backend, shared, cms, mobile}`. `backend` + `shared` are wired; `cms` + `mobile` are empty workspace placeholders.
- Reference standards: [`docs/amb-starter-kit/`](docs/amb-starter-kit/) — Amoeba platform v2.0 standards, applied with the deviations listed at the bottom of this file.
- MVP GA target: **2026-08-01** (2026-04-27 조정 — 기존 2026-08-29에서 4주 단축)

**Stage (as of 2026-04-24)**
- Backend — 10 modules implemented (Phase 0/A/B/C, ~65–70% of WBS)
- Phase D (observability, security review, load test, a11y) — not started
- CMS / Mobile — scaffolded as empty workspace packages only

## Quick commands

Prefer the Makefile targets — they chain docker/prisma/pnpm correctly.

```bash
make bootstrap    # first-time setup (install → docker up → migrate → seed)
make dev          # run backend in watch mode (http://localhost:3000)
make migrate      # new Prisma migration after schema edit
make seed         # re-seed local data
make test         # run unit tests
make smoke        # curl health + signup + login + me end-to-end
make typecheck    # tsc --noEmit across workspace
make lint         # eslint across workspace
make studio       # Prisma Studio (http://localhost:5555)
make reset        # destroy DB volume and start fresh (⚠️ wipes local data)
```

Or with pnpm directly:

```bash
pnpm install
pnpm db:up
pnpm migrate
pnpm seed
pnpm dev
```

## Repo layout

```
a-idol/
├─ packages/
│  ├─ shared/                     # @a-idol/shared — domain entities + DTO contracts
│  ├─ backend/                    # @a-idol/backend — NestJS + Prisma
│  ├─ cms/                        # (placeholder) React CMS
│  └─ mobile/                     # (placeholder) React Native app
├─ docs/                          # SDLC artifacts + reference conventions
│  ├─ analysis/                   # Requirements analysis
│  ├─ design/                     # Architecture, ERD, sequence, policy, UI spec
│  ├─ implementation/             # Dev plan, WBS, phase checklists
│  ├─ adr/                        # Architecture Decision Records (ADR-010~019)
│  ├─ ops/                        # Runbook, perf baseline, dependency approval
│  ├─ legal/                      # Legal briefs (youth payment limit, …)
│  ├─ support/                    # FAQ
│  ├─ reference/                  # Snapshots of external references
│  └─ amb-starter-kit/            # Amoeba platform v2.0 standards (deviation table below)
├─ sql/                           # Full-DDL reference (do NOT run directly; use Prisma)
├─ .claude/commands/              # Slash-command templates
├─ docker-compose.yml             # postgres (5433) + redis (6379) + adminer (8080)
├─ Makefile
└─ pnpm-workspace.yaml
```

## Backend modules (current)

Each module under `packages/backend/src/modules/*` follows the 4-layer Clean Architecture:

```
<context>/
├─ domain/                  # (uses @a-idol/shared entities; context-specific value objects live here)
├─ application/
│  ├─ interfaces.ts         # Ports (repository, service contracts) + DI tokens
│  └─ *.usecase.ts          # Use cases
├─ infrastructure/
│  ├─ prisma-*.repository.ts   # Prisma adapters
│  └─ *.service.ts             # External service adapters (JWT, bcrypt, …)
└─ presentation/
   ├─ *.controller.ts       # HTTP controllers (public + admin-* variants where applicable)
   ├─ *.gateway.ts          # WebSocket gateways (chat only)
   └─ dto/*.dto.ts          # class-validator DTOs
```

**Dependency rule**: `presentation → application → domain`. Infrastructure also depends inward only. Never import infrastructure from application.

| Module | Purpose | Surfaces |
|---|---|---|
| `identity` | Signup/login/refresh; email + OAuth (Kakao/Apple/Google) | `identity.controller.ts` |
| `catalog` | Idols, agencies, schedules, images | public + admin controllers |
| `fandom` | Hearts, follows, fan clubs, memberships | `fandom.controller.ts`, `fan-club.controller.ts` |
| `chat` | Rooms, messages, quota/coupon, auto-message dispatch, WebSocket | public + admin + gateway + balance |
| `commerce` | Products, purchase transactions, IAP verification (Apple/Google + dev sandbox) | public + admin |
| `audition` | Auditions, rounds, entries, vote rules | public + admin |
| `vote` | Vote casting (heart/ticket/SMS weights), leaderboard, ranking snapshots | public + admin |
| `photocard` | Template sets, gacha draw mechanics, user collection | public + admin |
| `admin-ops` | CMS authentication + analytics dashboards | `admin-auth.controller.ts`, `admin-analytics.controller.ts` |
| `health` | Liveness / readiness | built-in |

Coming per WBS: `notification`.

## Conventions

### Naming

Adapted from [`docs/amb-starter-kit/amoeba_code_convention_v2.md`](docs/amb-starter-kit/amoeba_code_convention_v2.md):

| Layer | Convention | Example |
|---|---|---|
| DB table | snake_case, plural (Prisma `@map`) | `users`, `idols`, `fan_clubs` |
| DB column | snake_case (Prisma `@map`) | `created_at`, `avatar_url` |
| Prisma model | PascalCase | `User`, `FanClub` |
| Prisma field | camelCase | `createdAt`, `avatarUrl` |
| Entity class (shared) | PascalCase + domain noun | `User`, `Idol`, `FanClub` |
| **Request DTO fields** | **snake_case** | `device_id`, `start_at`, `idol_ids` |
| **Response DTO fields** | **camelCase** | `avatarUrl`, `createdAt`, `heartCount` |
| Controller / service / DTO file | `*.controller.ts`, `*.service.ts`, `*.dto.ts` (kebab-case) | `identity.controller.ts`, `signup.dto.ts` |
| React component file | `PascalCase.tsx` | `IdolCard.tsx` |
| React hook file | `usePascalCase.ts` | `useIdolList.ts` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_HEART_PER_DAY` |
| Query parameters | snake_case on the wire | `?sort_by=popularity&page_size=20` |

> **Migration gap**: existing backend Request DTOs (e.g., `SignupDto.deviceId`, `CreateAuditionBody.startAt`) currently use camelCase. All **new** Request DTOs MUST use snake_case; migrate existing DTOs during Phase D stabilization (file a dedicated ADR when scheduled).

### Code rules

- **Language**: English in code/comments/commits. Korean welcome in specs and user-facing strings.
- **Commits**: Conventional Commits with scope (A-idol deviation from amb-starter-kit — scope kept for module clarity). `feat(chat): …`, `fix(identity): …`, `docs(wbs): …`.
- **Branches**: `feature/<issue>-<desc>`, `bugfix/<issue>-<desc>`, `docs/<issue>-<desc>`.
- **Migrations**: Always via `pnpm --filter @a-idol/backend prisma:migrate -- --name <short-name>`. Commit the generated SQL under `packages/backend/prisma/migrations/`.
- **Errors**: Throw `DomainError(ErrorCodes.XXX)` for business rule violations; let the global filter map to HTTP.
- **DI tokens**: Provide ports via string tokens (e.g., `USER_REPOSITORY`) so use cases are testable with plain objects.
- **Tests**: Use-case tests are plain Jest with hand-rolled fakes — no Nest `Test.createTestingModule` in unit tests (keep them pure).
- **No `any`** on module boundaries. Interior unknowns can use `unknown`.
- **Money**: `NUMERIC(14,2)` in Postgres → `Decimal` in Prisma → `number` (KRW — integer in practice) at the edge.
- **Time**: Always `TIMESTAMPTZ` / UTC in DB; format with `.toISOString()` on the wire.
- **Prisma casing**: DB columns `snake_case`, Prisma fields `camelCase` (via `@map`).
- **Mapper pattern**: Static methods for Entity → Response DTO conversion (e.g., `UserMapper.toResponseDto(user)`). Keep wire shapes out of domain.
- **Domain isolation**: Modules MUST NOT import each other's Prisma repositories or infrastructure adapters directly. Cross-module communication goes through `@a-idol/shared` contracts or explicit ports.

### Authentication model

A-idol uses **2-level RBAC** (A-idol-specific, simplified from amb-starter-kit's 4-level):

- `User` — mobile app end users (email + OAuth: Kakao / Apple / Google).
- `AdminUser` — CMS operators with roles `admin / operator / viewer`. Served by the `admin-ops` module; the mobile app never authenticates against this.

See [`docs/adr/ADR-010-admin-user-separation.md`](docs/adr/ADR-010-admin-user-separation.md) for rationale.

### i18n (4 languages)

Supported user-facing languages:

| Code | Language |
|---|---|
| `ko` | Korean (default) |
| `en` | English |
| `vi` | Vietnamese |
| `zh-CN` | Chinese (Simplified / 간체) |

- Namespace per domain (e.g., `fandom`, `chat`, `commerce`, `audition`).
- **No hardcoded user-facing strings** in mobile / CMS components — route via translation files.
- Backend error messages default to `en`; consumer apps translate via error code.

### External integrations (MVP scope)

- **IAP**: Apple App Store, Google Play. Dev sandbox adapter exists ([`ADR-015`](docs/adr/ADR-015-commerce-dev-sandbox.md), [`ADR-019`](docs/adr/ADR-019-apple-iap-adapter.md)).
- **SMS**: vote-weight authentication (vendor TBD).
- **OAuth**: Kakao, Apple, Google.
- **Not in MVP scope**: Claude API direct, Popbill, NICEPAY, Slack bridge, Redmine sync.

## Traceability

Requirements → code mapping lives in `docs/design/a-idol-req-definition.md` (section "Traceability Matrix"). When you implement `FR-XXX`, update that matrix.

ID prefixes: `FR-` requirement, `NFR-` non-functional requirement, `FN-` function spec, `SCR-` screen, `SEQ-` sequence, `POL-` policy, `T-` WBS task, `TC-` test case, `ITC-` integration test, `ADR-` architecture decision.

## When adding a new feature

1. Check `docs/design/a-idol-req-definition.md` for the FR definition.
2. Add/verify Prisma models, run `pnpm migrate -- --name <feature>`.
3. Create the module under `src/modules/<context>/` with the 4-layer structure above.
4. Add ports + use case(s) + infrastructure adapters + controller (split `<name>.controller.ts` and `admin-<name>.controller.ts` if both surfaces are needed).
5. Request DTOs: **snake_case**. Response DTOs: **camelCase**. Use a Mapper for the conversion.
6. Write at least one unit test per use case.
7. If a non-trivial architecture choice is made, draft an ADR under `docs/adr/ADR-0XX-<slug>.md`.
8. Update `docs/design/a-idol-req-definition.md` traceability matrix and the WBS test cases sheet.
9. Register i18n strings under the 4 supported namespaces (`ko` / `en` / `vi` / `zh-CN`).

See `.claude/commands/new-feature.md` for an opinionated template.

## Do / Don't

- ✅ Keep domain classes in `@a-idol/shared` — backend and mobile will both consume them.
- ✅ Surface business errors as `DomainError`; map HTTP status centrally in `AppExceptionFilter`.
- ✅ Prefer explicit interfaces over leaking Prisma types into application code.
- ✅ Consult `docs/amb-starter-kit/` as the source of truth for any rule not restated here; the table below lists the A-idol-specific deviations.
- ❌ Don't call `prisma` from a controller or a use case — go through a repository adapter.
- ❌ Don't skip `pnpm prisma:generate` after schema edits; TS errors in Prisma types mean it wasn't run.
- ❌ Don't commit `.env`; only `.env.example` is versioned.
- ❌ Don't apply TypeORM-specific amb-starter-kit rules (`synchronize:true`, nullable explicit `type:`) — A-idol uses Prisma.
- ❌ Don't introduce Entity/Cell/Unit multi-tenancy, `OwnEntityGuard`, or 4-level RBAC — A-idol is B2C single-tenant with a 2-level split.
- ❌ Don't add `amb_*` table prefixes or 3-letter column prefixes — Prisma `@map` already handles DB casing.

## Useful URLs (local dev)

- Backend API: http://localhost:3000
- Swagger UI: http://localhost:3000/docs
- Adminer: http://localhost:8080 (server=postgres, user=aidol, password=aidol_dev, db=aidol; host port 5433)
- Prisma Studio: `make studio` → http://localhost:5555

## Reference docs

### Project SDLC

- Requirements: [`docs/analysis/a-idol-requirements.md`](docs/analysis/a-idol-requirements.md)
- Architecture: [`docs/design/a-idol-architecture.md`](docs/design/a-idol-architecture.md)
- Requirements definition (FR detail): [`docs/design/a-idol-req-definition.md`](docs/design/a-idol-req-definition.md)
- Functional spec (use cases): [`docs/design/a-idol-func-definition.md`](docs/design/a-idol-func-definition.md)
- Sequence diagrams: [`docs/design/a-idol-sequence.md`](docs/design/a-idol-sequence.md)
- ERD + DDL: [`docs/design/a-idol-erd.md`](docs/design/a-idol-erd.md) + [`sql/a-idol-schema.sql`](sql/a-idol-schema.sql)
- Policies: [`docs/design/a-idol-policy.md`](docs/design/a-idol-policy.md)
- UI spec: [`docs/design/a-idol-ui-spec.md`](docs/design/a-idol-ui-spec.md)
- Dev plan: [`docs/implementation/a-idol-dev-plan.md`](docs/implementation/a-idol-dev-plan.md)
- WBS: [`docs/implementation/a-idol-wbs.md`](docs/implementation/a-idol-wbs.md) (+ `a-idol-wbs.xlsx`)
- **Code convention**: [`docs/implementation/a-idol-code-convention.md`](docs/implementation/a-idol-code-convention.md) — A-idol 전용 코드 컨벤션 (amb-starter-kit v2.0 기반, Prisma/Clean Architecture/2-level RBAC/4-language i18n 적용)

### Architecture Decision Records

- [`ADR-010`](docs/adr/ADR-010-admin-user-separation.md) — User vs AdminUser separation
- [`ADR-011`](docs/adr/ADR-011-fandom-soft-leave.md) — Fandom soft-leave semantics
- [`ADR-012`](docs/adr/ADR-012-paid-fanclub-mvp.md) — Paid fan club for MVP
- [`ADR-013`](docs/adr/ADR-013-chat-reply-engine-mvp.md) — Chat reply engine (MVP)
- [`ADR-014`](docs/adr/ADR-014-leaderboard-redis-pg-snapshot.md) — Leaderboard: Redis + Postgres snapshot
- [`ADR-015`](docs/adr/ADR-015-commerce-dev-sandbox.md) — Commerce dev sandbox
- [`ADR-016`](docs/adr/ADR-016-photocard-gacha-disclosure.md) — Photocard gacha odds disclosure
- [`ADR-017`](docs/adr/ADR-017-correlation-id.md) — Correlation ID propagation
- [`ADR-018`](docs/adr/ADR-018-photocard-trade-deferred.md) — Photocard P2P trade deferred
- [`ADR-019`](docs/adr/ADR-019-apple-iap-adapter.md) — Apple IAP adapter
- [`ADR-020`](docs/adr/ADR-020-orm-prisma-over-typeorm.md) — Adopt Prisma as the ORM (deviating from amb-starter-kit's TypeORM standard)
- [`ADR-021`](docs/adr/ADR-021-phase-c-perf-levers.md) — Phase C performance levers (compression / select narrowing / Redis meta cache / ETag 304)
- [`ADR-022`](docs/adr/ADR-022-api-versioning-policy.md) — Standardize API path on `/api/v1/...` (URI versioning)

### amb-starter-kit (Amoeba platform v2.0) — applied with deviations

Source: [`docs/amb-starter-kit/`](docs/amb-starter-kit/)

| amb-starter-kit rule | A-idol status |
|---|---|
| DTO case (Request=snake_case, Response=camelCase) | ✅ Applied (new code); existing backend Request DTOs use camelCase — migrate during Phase D |
| File naming (kebab-case / PascalCase / `use*.ts`) | ✅ Applied |
| Constants `SCREAMING_SNAKE_CASE` | ✅ Applied |
| Mapper static pattern (Entity → Response DTO) | ✅ Applied |
| Domain isolation (no cross-module Entity/Repository import) | ✅ Applied |
| i18n — multi-language, no hardcoding | ✅ Applied; A-idol supports **`ko` / `en` / `vi` / `zh-CN`** (extends amb-starter-kit's 3 by adding Simplified Chinese) |
| SDLC ID traceability (FR → FN → T → TC) | ✅ Applied |
| Commit messages | ⚠️ A-idol deviation — **scope retained** (`feat(chat): …`) rather than amb-starter-kit's `feat: …` |
| Git branches (`production` + `main` + `feature/*`) | ⚠️ A-idol currently uses `feature/<issue>-<desc>`; production/main alignment TBD when CI is added |
| 4-level RBAC (ADMIN/USER/CLIENT/PARTNER) | ❌ Not applied — A-idol is 2-level (User + AdminUser) |
| Entity/Cell/Unit multi-tenancy + `OwnEntityGuard` | ❌ Not applied — B2C single-tenant |
| DB table prefix `amb_*` + 3-letter column prefix | ❌ Not applied — sub-domain prefix pattern used instead (`chat_*`, `vote_*`, `photocard_*`, `purchase_*`, `audition_*`, `idol_*`, `round_*`, `auto_message_*`); bare noun for core aggregates (`users`, `idols`, `hearts`). `idol_` collides with `idols` entity; `aid_` re-examined and rejected (7 risks incl. PostgreSQL 63-char identifier limit). If multi-project isolation arises, prefer PostgreSQL schema namespace. Trade-off: [RPT-260424-C](docs/report/RPT_260424_naming-prefix-tradeoff.md) · `aid_` re-exam: [RPT-260424-D](docs/report/RPT_260424_aid-prefix-reexamination.md) · compliance audit: [RPT-260424-B](docs/report/RPT_260424_db-naming-compliance.md) |
| TypeORM rules (`synchronize:true`, nullable explicit `type:`) | ❌ Not applied — Prisma is the ORM |
| External integrations (Claude API direct, Popbill, NICEPAY, Slack, Redmine) | ❌ Not in MVP scope — IAP (Apple/Google), SMS, OAuth only |
| Web style guide (Basic-A-1/2-R/2-L, Indigo #6366F1, Pretendard, WCAG 2.1 AA) | ⏸ Deferred — adopt when CMS scaffolding starts |
