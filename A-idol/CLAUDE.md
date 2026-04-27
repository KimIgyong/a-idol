# A-idol — Claude Code Project Context

This file is read automatically by Claude Code. It tells Claude how the project is organized, what conventions to follow, and what commands to use.

## TL;DR

A-idol is an AI idol fandom platform. End users only interact via a **React Native mobile app**. Admins use a **web-only React CMS**. The backend is **NestJS + Prisma + PostgreSQL 16 + Redis 7**, structured around **Clean Architecture** (Entity → UseCase → Interface Adapter → Infrastructure).

The current repo is a **monorepo in early scaffolding** — only `packages/backend` and `packages/shared` are wired up. Mobile/CMS come next.

- Owner: Gray Kim <gray.kim@amoeba.group>
- Stage: MVP scaffolding (T-001 to T-011 of the WBS)
- MVP GA target: **2026-08-29**

## Quick commands

Prefer the Makefile targets — they chain docker/prisma/pnpm correctly.

```bash
make bootstrap    # first-time setup (install → docker up → migrate → seed)
make dev          # run backend in watch mode (http://localhost:3000)
make migrate      # new Prisma migration after schema edit
make seed         # re-seed local data
make test         # run unit tests
make smoke        # curl health + signup + login + me end-to-end
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
│  ├─ shared/               # @a-idol/shared — pure domain entities + DTOs
│  └─ backend/              # @a-idol/backend — NestJS API
├─ docs/                    # SDLC artifacts (requirements, design, WBS…)
├─ sql/                     # Full-DDL reference (do NOT run directly; use Prisma)
├─ .claude/commands/        # Slash-command templates
├─ docker-compose.yml       # postgres + redis + adminer
├─ Makefile
└─ pnpm-workspace.yaml
```

### Backend Clean Architecture layout

Each bounded context under `packages/backend/src/modules/*` follows:

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
   ├─ *.controller.ts       # HTTP controllers
   └─ dto/*.dto.ts          # class-validator DTOs
```

**Dependency rule**: `presentation → application → domain`. Infrastructure also depends inward only. Never import infrastructure from application.

Already implemented: `identity`, `catalog`, `health`.
Coming (per WBS): `fandom` (hearts, follows, fan clubs), `chat`, `commerce`, `audition`, `notification`.

## Conventions

- **Language**: English is primary in code/comments/commits. Korean is welcome in specs and user-facing strings.
- **Commits**: Conventional Commits. Scope by context: `feat(chat): …`, `fix(identity): …`, `docs(wbs): …`.
- **Branches**: `feature/<issue>-<desc>`, `bugfix/<issue>-<desc>`, `docs/<issue>-<desc>`.
- **Migrations**: Always via `pnpm --filter @a-idol/backend prisma:migrate -- --name <short-name>`. Commit the generated SQL under `packages/backend/prisma/migrations/`.
- **Errors**: Throw `DomainError(ErrorCodes.XXX)` for business rule violations; let the global filter map to HTTP.
- **DI tokens**: Provide ports via string tokens (e.g., `USER_REPOSITORY`) so use cases are testable with plain objects.
- **Tests**: Use-case tests are plain Jest with hand-rolled fakes — no Nest `Test.createTestingModule` in unit tests (keep them pure).
- **No `any`** on module boundaries. Interior unknowns can use `unknown`.
- **Money**: `NUMERIC(14,2)` in Postgres, represented as `Decimal` in Prisma, convert to `number` (KRW — integer in practice) at the edge.
- **Time**: Always `TIMESTAMPTZ` / UTC in DB; format with `.toISOString()` on the wire.
- **Prisma casing**: DB columns are `snake_case`, TypeScript/Prisma model fields are `camelCase` (handled via `@map`).

## Traceability

Requirements → code mapping lives in `docs/design/a-idol-req-definition.md` (section "Traceability Matrix"). When you implement `FR-XXX`, update that matrix.

ID prefixes: `FR-` requirement, `FN-` function spec, `SCR-` screen, `SEQ-` sequence, `POL-` policy, `T-` WBS task, `TC-` test case, `ITC-` integration test.

## When adding a new feature

1. Check `docs/design/a-idol-req-definition.md` for the FR definition.
2. Add/verify Prisma models, run `pnpm migrate -- --name <feature>`.
3. Create the module under `src/modules/<context>/` with the 4-layer structure above.
4. Add ports + use case(s) + infrastructure adapters + controller.
5. Write at least one unit test per use case.
6. Update `docs/design/a-idol-req-definition.md` traceability matrix and the WBS test cases sheet.
7. Add slash command or extend seed if relevant for devs.

See `.claude/commands/new-feature.md` for an opinionated template.

## Do / Don't

- ✅ Keep domain classes in `@a-idol/shared` — both backend and mobile will consume them later.
- ✅ Surface business errors as `DomainError`; map HTTP status centrally in `AppExceptionFilter`.
- ✅ Prefer explicit interfaces over leaking Prisma types into application code.
- ❌ Don't call `prisma` from a controller or a use case — go through a repository adapter.
- ❌ Don't skip `pnpm prisma:generate` after schema edits; TS errors in Prisma types mean it wasn't run.
- ❌ Don't commit `.env`; only `.env.example` is versioned.

## Useful URLs (local dev)

- Backend API: http://localhost:3000
- Swagger UI: http://localhost:3000/docs
- Adminer: http://localhost:8080 (server=postgres, user=aidol, password=aidol_dev, db=aidol)
- Prisma Studio: `make studio` → http://localhost:5555

## Reference docs

- Requirements: `docs/analysis/a-idol-requirements.md`
- Architecture: `docs/design/a-idol-architecture.md`
- Requirements definition (FR detail): `docs/design/a-idol-req-definition.md`
- Functional spec (use cases): `docs/design/a-idol-func-definition.md`
- Sequence diagrams: `docs/design/a-idol-sequence.md`
- ERD + DDL: `docs/design/a-idol-erd.md` + `sql/a-idol-schema.sql`
- Policies: `docs/design/a-idol-policy.md`
- Dev plan: `docs/implementation/a-idol-dev-plan.md`
- WBS: `docs/implementation/a-idol-wbs.md` (+ `a-idol-wbs.xlsx`)
