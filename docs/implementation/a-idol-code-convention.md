# A-idol Code Convention v1.0

## A-idol Project Code Convention (A-idol 프로젝트 코드 컨벤션)

**Document Version (문서버전):** v1.0
**Date (작성일):** 2026-04-24
**Author (작성):** Gray Kim <gray.kim@amoeba.group>
**Derived from (파생):** [`docs/amb-starter-kit/amoeba_code_convention_v2.md`](../amb-starter-kit/amoeba_code_convention_v2.md) (Amoeba Company v2.0)
**Scope (적용 범위):** A-idol monorepo (packages/backend, packages/shared, packages/cms, packages/mobile)

---

## Table of Contents (목차)

1. [Overview (개요)](#1-overview-개요)
2. [Core Principles (핵심 원칙)](#2-core-principles-핵심-원칙)
3. [Architecture Standards (아키텍처 표준)](#3-architecture-standards-아키텍처-표준)
4. [Database Naming Rules — Prisma edition (데이터베이스 네이밍 — Prisma 판)](#4-database-naming-rules--prisma-edition-데이터베이스-네이밍--prisma-판)
5. [Backend Rules — NestJS + Prisma + Clean Architecture (백엔드 규칙)](#5-backend-rules--nestjs--prisma--clean-architecture-백엔드-규칙)
6. [Frontend Common Rules (프론트엔드 공통 규칙)](#6-frontend-common-rules-프론트엔드-공통-규칙)
7. [Frontend Framework-Specific Guide (프론트엔드 프레임워크별 가이드)](#7-frontend-framework-specific-guide-프론트엔드-프레임워크별-가이드)
8. [API Design and Response Shape (API 설계 및 응답 구조)](#8-api-design-and-response-shape-api-설계-및-응답-구조)
9. [Validation and Error Handling (유효성 검증 및 에러 처리)](#9-validation-and-error-handling-유효성-검증-및-에러-처리)
10. [Naming Summary (네이밍 요약)](#10-naming-summary-네이밍-요약)
11. [ENUM and Constants Rules (ENUM 및 상수 규칙)](#11-enum-and-constants-rules-enum-및-상수-규칙)
12. [Access Control — 2-level RBAC (접근 제어 — 2단계 RBAC)](#12-access-control--2-level-rbac-접근-제어--2단계-rbac)
13. [Encryption Rules (암호화 규칙)](#13-encryption-rules-암호화-규칙)
14. [i18n Rules — 4 languages (i18n 규칙 — 4개 언어)](#14-i18n-rules--4-languages-i18n-규칙--4개-언어)
15. [Git Convention (Git 컨벤션)](#15-git-convention-git-컨벤션)
16. [Deviations from amb-starter-kit (amb-starter-kit 편차)](#16-deviations-from-amb-starter-kit-amb-starter-kit-편차)
17. [Checklist (체크리스트)](#17-checklist-체크리스트)

---

## 1. Overview (개요)

### 1.1 Purpose (목적)

This document defines the code convention applied to the **A-idol** project. It is **derived from** Amoeba Company's v2.0 standard but **adapted** to A-idol's stack: Prisma (not TypeORM), Clean Architecture (4-layer), B2C single-tenant model, and a 4-language i18n scope (ko / en / vi / zh-CN).

본 문서는 **A-idol** 프로젝트에 적용되는 코드 컨벤션을 정의합니다. Amoeba Company v2.0 표준을 **기반**으로 하되, A-idol의 기술 스택(Prisma, Clean Architecture 4계층, B2C 단일 테넌트, 4개 언어 i18n)에 맞게 **조정**했습니다.

### 1.2 Tech Stack (기술 스택)

| Area (영역) | A-idol Tech Stack (기술 스택) |
|------|----------|
| **Mobile (end users)** | React Native 0.74 + TypeScript 5.x |
| **CMS (admin web)** | Vite + React 18.x + TypeScript 5.x + TailwindCSS + shadcn/ui |
| **Backend (백엔드)** | NestJS 10.x + TypeScript 5.x |
| **ORM** | **Prisma 5.x** (not TypeORM) |
| **Database (데이터베이스)** | PostgreSQL 16.x |
| **Cache / Queue (캐시/큐)** | Redis 7.x |
| **Build (빌드)** | pnpm workspace (no Turbo yet) |
| **Architecture (아키텍처)** | Clean Architecture 4-layer (domain / application / infrastructure / presentation) |
| **Real-time (실시간)** | WebSocket (NestJS Gateway) — chat module |
| **Auth** | JWT (access + refresh) + OAuth (Kakao / Apple / Google) |

### 1.3 Rule Level Definitions (규칙 수준)

| Level (수준) | Meaning (의미) |
|------|------|
| **MUST** | Mandatory compliance. Code review MUST reject violations. (필수 준수. 코드 리뷰에서 반드시 반려) |
| **SHOULD** | Strongly recommended. Deviations require justification. (강력 권장. 이탈 시 근거 필요) |
| **MAY** | Flexible depending on context. (상황에 따라 선택) |

---

## 2. Core Principles (핵심 원칙)

### 2.1 Consistency (일관성)

All layers (Mobile / CMS / Backend / DB) maintain consistent naming, folder structure, and patterns.
(모든 레이어에서 네이밍, 폴더 구조, 패턴 통일)

### 2.2 Clean Architecture Layer Isolation (Clean Architecture 레이어 격리) (MUST)

Dependency direction (의존 방향): `presentation → application → domain`. Infrastructure depends inward only.

- **Presentation** (controller / gateway / DTO) MUST NOT import from `infrastructure/`.
- **Application** (use cases / ports) MUST NOT import Prisma types or Prisma Client.
- **Domain** (shared entities) MUST NOT import from any other layer.
- **Infrastructure** (Prisma repos, external services) implements ports defined in `application/interfaces.ts`.

### 2.3 Domain (Module) Isolation (도메인/모듈 격리) (MUST)

- Cross-module communication MUST go through `@a-idol/shared` contracts or explicit ports. (모듈 간 통신은 `@a-idol/shared` 계약 또는 명시적 포트 경유)
- Direct import of another module's Prisma repository or use case is **PROHIBITED**. (타 모듈의 Prisma repository / use case 직접 import 금지)
- Use `forwardRef(() => ModuleName)` when unavoidable circular dependency occurs (MUST). (불가피한 순환 의존성은 `forwardRef` 사용 필수)

### 2.4 Type Safety (타입 안정성) (MUST)

- Strict mode enabled (`"strict": true` in `tsconfig.base.json`). (strict 모드 필수)
- **No `any`** on module boundaries (exports, public function signatures). Interior unknowns MAY use `unknown`. (모듈 경계에서 `any` 금지. 내부는 `unknown` 허용)
- Prisma-generated types MUST NOT leak into the `application/` layer — convert to domain shapes at the repository boundary. (Prisma 생성 타입은 application 레이어로 누수 금지 — repository 경계에서 도메인 형태로 변환)

### 2.5 Explicitness (명시성)

- No magic values. Constants live in `*.constants.ts` (kebab-case filename) or at the top of the file with `const FOO = …;`. (매직 값 금지. 상수는 `*.constants.ts` 또는 파일 상단 `const` 선언)
- DI tokens use string constants (e.g., `USER_REPOSITORY`) — not class references — so use cases remain testable with hand-rolled fakes. (DI 토큰은 문자열 상수 사용)

### 2.6 Single-Tenant (not Multi-Tenant) (단일 테넌트)

A-idol is **B2C single-tenant**. No `ent_id` FK, no `OwnEntityGuard`, no Entity/Cell/Unit hierarchy. This is an intentional deviation from amb-starter-kit v2.0.
(A-idol은 B2C 단일 테넌트 — amb-starter-kit의 멀티테넌시 구조 미적용)

---

## 3. Architecture Standards (아키텍처 표준)

### 3.1 Monorepo Structure (Monorepo 구조)

```
a-idol/
├── packages/
│   ├── backend/         # @a-idol/backend — NestJS API
│   ├── shared/          # @a-idol/shared — domain entities + DTO contracts
│   ├── cms/             # @a-idol/cms — React CMS (placeholder)
│   └── mobile/          # @a-idol/mobile — React Native (placeholder)
├── docs/
│   ├── analysis/ design/ implementation/ adr/ ops/ legal/ support/ reference/
│   └── amb-starter-kit/ # Reference conventions (this doc derives from amoeba_code_convention_v2.md)
├── sql/                 # DDL reference (run Prisma migrations in practice)
├── .claude/commands/    # Claude Code slash commands
├── docker-compose.yml   # postgres:5433 · redis:6379 · adminer:8080
├── Makefile
├── CLAUDE.md
└── pnpm-workspace.yaml
```

> **Deviation (편차)**: amb-starter-kit uses `apps/` + `packages/` + `docker/<env>/`. A-idol uses `packages/*` only and a single `docker-compose.yml` (Phase D will introduce `docker/<env>/` when staging/production deployments are added).

### 3.2 Backend Module Structure — Clean Architecture (백엔드 모듈 구조)

Each module under `packages/backend/src/modules/<context>/` MUST follow the 4-layer structure:

```
<context>/
├── domain/
│   └── (context-specific value objects; domain entities live in @a-idol/shared)
├── application/
│   ├── interfaces.ts              # Ports (repository / service contracts) + DI tokens
│   ├── *.usecase.ts               # Use cases (one per user intent)
│   └── *.usecase.spec.ts          # Unit tests (Jest + hand-rolled fakes)
├── infrastructure/
│   ├── prisma-*.repository.ts     # Prisma adapters implementing application ports
│   └── *.service.ts               # External service adapters (bcrypt, JWT, IAP, …)
└── presentation/
    ├── *.controller.ts            # Public HTTP controller
    ├── admin-*.controller.ts      # Admin surface (routes under /admin/*, guarded by AdminUser)
    ├── *.gateway.ts               # WebSocket gateway (chat only)
    ├── dto/
    │   ├── *.dto.ts               # class-validator Request DTOs
    │   └── *-view.ts              # Response view functions (Entity → Response DTO)
    └── <context>.module.ts        # NestJS @Module() wiring
```

### 3.3 Layer Import Rules (레이어 import 규칙) (MUST)

| Layer (레이어) | Allowed imports (허용 import) | Prohibited (금지) |
|--------|------|------|
| `presentation/` | `application/`, `shared/` (backend infra), `@a-idol/shared` | Prisma types, other modules' infrastructure |
| `application/` | `@a-idol/shared`, local `domain/`, local `application/interfaces.ts` | Prisma Client, NestJS `@Module`, other modules' application code |
| `domain/` | Nothing cross-layer (pure TS) | Any infrastructure, any NestJS import |
| `infrastructure/` | `application/interfaces.ts`, `@a-idol/shared`, Prisma Client, NestJS DI | Other modules' infrastructure (use ports) |

---

## 4. Database Naming Rules — Prisma edition (데이터베이스 네이밍 — Prisma 판)

### 4.1 Database Name (데이터베이스 이름)

```
Local (로컬): aidol
Staging / Prod (스테이징/프로덕션): aidol_<env>   (TBD on Phase D)
```

### 4.2 Table Naming (테이블 네이밍)

- **DB tables**: snake_case, plural. (DB 테이블: snake_case 복수형)
- **No project-wide prefix** (no `amb_*` / `idol_*` / `aid_*`) — A-idol is a single-project database. Project-wide `idol_` collides with the `idols` domain entity (`idol_idols`, `idol_idol_schedules`); alternative `aid_` introduces 7 separate risks (semantic ambiguity with "aid" = help/assistance, PostgreSQL 63-char identifier limit at current top index length 56→60 chars, mixed-standard vs columns, SQL verbosity) — see [RPT-260424-D](../report/RPT_260424_aid-prefix-reexamination.md). If multi-project isolation is ever needed, **PostgreSQL schema namespace** (`CREATE SCHEMA idol; @@schema("idol")`) is preferred over any table-prefix approach. (전역 프로젝트 prefix 금지)
- **Sub-domain prefix is RECOMMENDED** when a table clearly belongs to a module. This disambiguates name clashes and mirrors amb-starter-kit's `amb_<subdomain>_*` pattern at near-zero cost. Current examples already in use: `chat_*` (rooms, messages, quotas, coupon_wallets, coupon_ledger), `vote_*` (rules, ticket_balances, ticket_ledger), `round_*` (vote_ticket_balances, vote_ticket_ledger, ranking_snapshots), `photocard_*` (sets, templates), `purchase_*` (products, transactions), `idol_*` (schedules, images), `audition_*` (entries), `auto_message_*` (templates). (서브도메인 prefix 권장 — 모듈 귀속이 명확한 경우)
- **Bare noun (no prefix)** for domain-central aggregates that are not scoped under another module — e.g., `users`, `admin_users`, `idols`, `agencies`, `hearts`, `follows`, `fan_clubs`, `memberships`, `auditions`, `rounds`, `votes`. (도메인 중심 aggregate는 prefix 없이)
- Prisma models use PascalCase singular; map to DB via `@@map("<table_name>")`.

```prisma
model FanClub {
  id        String   @id @default(uuid())
  idolId    String   @map("idol_id")
  @@map("fan_clubs")        // bare noun (core fandom aggregate)
}

model ChatRoom {
  id     String @id @default(uuid())
  @@map("chat_rooms")       // sub-domain prefix `chat_` (module-scoped)
}
```

> **Rationale (근거)**: Analyzed in [RPT-260424-C](../report/RPT_260424_naming-prefix-tradeoff.md) — project-wide prefix (`idol_`, `aid_`) costs a 5-10 engineer-day migration for near-zero benefit in a single-project DB, while sub-domain prefixes already achieve the disambiguation goal. Compliance audit in [RPT-260424-B](../report/RPT_260424_db-naming-compliance.md).

### 4.3 Column Naming (컬럼 네이밍)

| Type (유형) | Rule (규칙) | Example (예시) |
|------|------|------|
| **PK** | `id` (UUID) — **no 3-letter column prefix** | `id` |
| **FK** | `<referenced>Id` in Prisma, `<referenced>_id` in DB via `@map` | `userId` ↔ `user_id` |
| **General (일반)** | camelCase in Prisma, snake_case in DB via `@map` | `avatarUrl` ↔ `avatar_url` |
| **Boolean** | `is<Property>` / `has<Property>` in Prisma | `isApproved`, `hasPaid` |
| **Timestamps (시각)** | `createdAt`, `updatedAt`, `deletedAt` (soft delete) | maps to `created_at` etc. |
| **Time type** | `TIMESTAMPTZ` / UTC only. Serialize with `.toISOString()`. | |
| **Money** | `NUMERIC(14,2)` in Postgres → `Decimal` in Prisma → `number` (KRW integer) at the wire | |

> **Deviation (편차)**: amb-starter-kit uses 3-letter `{colPrefix}_` on every column (e.g., `cmp_name`). A-idol does **not** — Prisma's `@map` already handles the DB/TS casing boundary, and the prefix adds cost without benefit in a single-project DB.

### 4.4 Index / Constraint Naming (인덱스 / 제약조건)

Prisma auto-generates index and constraint names. Use explicit names only when:
- Debugging a specific query plan.
- Matching an existing manually-created SQL migration.

Pattern when explicit (명시 시 패턴): `idx_<table>_<column(s)>`, `uq_<table>_<column>`.

### 4.5 Schema Migration (스키마 마이그레이션) (MUST)

- **Local / CI**: `pnpm --filter @a-idol/backend prisma:migrate -- --name <short-name>`. Commit the generated SQL under `packages/backend/prisma/migrations/<timestamp>_<name>/`.
- **Staging / Production (Phase D)**: Same Prisma migration files applied via `prisma migrate deploy`. Never hand-edit a committed migration; add a new one instead.
- **`prisma db push`** is **PROHIBITED** outside ad-hoc local experimentation — it bypasses the migration history.

---

## 5. Backend Rules — NestJS + Prisma + Clean Architecture (백엔드 규칙)

### 5.1 File Naming (파일 네이밍)

| Layer (레이어) | Naming (네이밍) | Example (예시) |
|--------|-------------|------|
| Module | `<context>.module.ts` | `identity.module.ts` |
| Controller (public) | `<context>.controller.ts` | `catalog.controller.ts` |
| Controller (admin) | `admin-<context>.controller.ts` | `admin-catalog.controller.ts` |
| Gateway (WebSocket) | `<context>.gateway.ts` | `chat.gateway.ts` |
| Use case | `<verb-object>.usecase.ts` | `signup-with-email.usecase.ts`, `cast-vote.usecase.ts` |
| Use case test | `<verb-object>.usecase.spec.ts` | `signup-with-email.usecase.spec.ts` |
| Ports / interfaces | `interfaces.ts` (per module) | `application/interfaces.ts` |
| Prisma repository | `prisma-<aggregate>.repository.ts` | `prisma-user.repository.ts` |
| Service (external adapter) | `<purpose>.service.ts` | `bcrypt-password.service.ts`, `jwt-token.service.ts` |
| Request DTO | `<action>.dto.ts` (kebab-case) | `signup.dto.ts`, `send-message.dto.ts` |
| Response view | `<aggregate>-view.ts` | `user-view.ts`, `idol-view.ts` |
| Constants | `<purpose>.constants.ts` | `chat-quota.constants.ts` |

> **Deviation (편차)**: amb-starter-kit uses `<domain>.service.ts` as the **business service** and `<action>-<domain>.request.ts` as the Request DTO. A-idol splits **business logic into use cases** (`*.usecase.ts`) following Clean Architecture, and reserves `*.service.ts` for **external adapters** under `infrastructure/`. Request DTO files are `*.dto.ts`.

### 5.2 Class Naming (클래스 네이밍)

| Type (유형) | Rule (규칙) | Example (예시) |
|------|------|------|
| Controller | `<Context>Controller`, `Admin<Context>Controller` | `CatalogController`, `AdminCatalogController` |
| Use case | `<Verb><Object>UseCase` | `SignupWithEmailUseCase`, `CastVoteUseCase` |
| Port (interface) | `<Aggregate>Repository`, `<Purpose>Service` | `UserRepository`, `PasswordHashService` |
| Prisma repository impl | `Prisma<Aggregate>Repository` | `PrismaUserRepository` |
| External service impl | `<Vendor><Purpose>Service` | `BcryptPasswordService`, `JwtTokenService`, `AppleIapAdapter` |
| Request DTO | `<Action>Dto` | `SignupDto`, `LoginDto`, `SendMessageDto` |
| Response DTO (contract) | `<Aggregate>Dto` / `<Aggregate>ResponseDto` in `@a-idol/shared` | `UserDto`, `AuthResponseDto`, `IdolCardDto` |
| DI token | `SCREAMING_SNAKE_CASE` string const | `USER_REPOSITORY`, `PASSWORD_HASH_SERVICE` |

### 5.3 Controller Rules (Controller 규칙) (MUST)

- Controllers contain **no business logic** — they translate HTTP ↔ use case input/output only. (비즈니스 로직 금지)
- DTO transformation via **view functions** (`toUserDto(user)`) — see [§5.6](#56-mapper--view-rules-mapper--view-규칙). (DTO 변환은 view 함수 경유)
- Authentication: `@UseGuards(JwtAuthGuard)` for user routes; `@UseGuards(AdminJwtGuard)` for admin routes. (인증: User는 JwtAuthGuard, Admin은 AdminJwtGuard)
- Swagger decorators REQUIRED on every route: `@ApiTags`, `@ApiOperation`, `@ApiBearerAuth` when guarded. (Swagger 데코레이터 필수)
- HTTP status: default 201 for `@Post`; use `@HttpCode(200)` when a POST is idempotent (login/refresh). (POST 기본 201; 멱등 POST는 `@HttpCode(200)`)

```typescript
@ApiTags('auth')
@Controller()
export class IdentityController {
  constructor(
    private readonly signup: SignupWithEmailUseCase,
    private readonly getMe: GetMeUseCase,
  ) {}

  @Post('auth/signup')
  @ApiOperation({ summary: 'Email sign-up' })
  async postSignup(@Body() body: SignupDto): Promise<AuthResponseDto> {
    const result = await this.signup.execute({
      email: body.email,
      password: body.password,
      nickname: body.nickname,
      birthdate: new Date(body.birthdate),
      deviceId: body.device_id, // SHOULD migrate body naming to snake_case (§5.4)
    });
    return toAuthResponse(result.user, result);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current user profile' })
  async get(@CurrentUser() user: CurrentUserContext): Promise<UserDto> {
    const u = await this.getMe.execute(user.id);
    return toUserDto(u);
  }
}
```

### 5.4 DTO Rules (DTO 규칙) (MUST)

**Request DTO** — `snake_case` field names on the wire (validated via class-validator):

```typescript
export class SignupDto {
  @ApiProperty({ example: 'demo@a-idol.dev' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123', minLength: 8, maxLength: 64 })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password!: string;

  @ApiProperty({ example: '2000-01-01' })
  @IsDateString()
  birthdate!: string;

  @ApiProperty({ required: false, example: 'iphone-XYZ' })
  @IsOptional()
  @IsString()
  device_id?: string;
}
```

**Response DTO** — `camelCase` field names. Declared in `@a-idol/shared/contracts/` so mobile/CMS consume the same types:

```typescript
// packages/shared/src/contracts/index.ts
export interface UserDto {
  id: string;
  email: string | null;
  nickname: string;
  avatarUrl: string | null;
  provider: 'email' | 'apple' | 'google' | 'kakao';
  status: 'active' | 'suspended' | 'withdrawn';
  createdAt: string; // ISO 8601 UTC
}
```

> **Migration gap (마이그레이션 갭)**: as of 2026-04-24 several existing Request DTOs use camelCase (`deviceId`, `startAt`, `idolIds`). **All new** Request DTOs MUST use snake_case. Existing DTOs will be migrated during Phase D stabilization; file a dedicated ADR when scheduled.

### 5.5 Prisma Model Rules (Prisma 모델 규칙) (MUST)

- Model names: PascalCase singular. (모델명: PascalCase 단수)
- Field names: camelCase in TS, snake_case in DB via `@map` / `@@map`. (필드: TS camelCase, DB snake_case via @map)
- Every model SHOULD have `createdAt` and `updatedAt` (`@default(now())` and `@updatedAt`). (모든 모델은 createdAt/updatedAt 권장)
- Soft delete: add `deletedAt DateTime? @map("deleted_at")` when the domain requires it (e.g., `FanClub` memberships per [ADR-011](../adr/ADR-011-fandom-soft-leave.md)). (Soft delete는 도메인이 요구할 때만)
- Money: `Decimal @db.Decimal(14, 2)` — convert to `number` at the wire boundary. (금액 Decimal(14,2))
- JSON columns: type the shape via `@a-idol/shared` interfaces; validate at the edge. (JSON 컬럼은 @a-idol/shared 타입)

> **Deviation (편차)**: amb-starter-kit requires explicit `type: 'varchar'` on nullable TypeORM columns. **This rule does not apply** to A-idol — Prisma handles nullability via `Type?` natively without runtime metadata issues.

### 5.6 Mapper / View Rules (Mapper / View 규칙)

A-idol uses **function-style view modules** (not static-class Mappers) for Entity → Response DTO conversion. Files live under `presentation/dto/*-view.ts`:

```typescript
// packages/backend/src/modules/identity/presentation/dto/user-view.ts
import type { AuthResponseDto, UserDto } from '@a-idol/shared';
import type { User } from '@a-idol/shared';

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl ?? null,
    provider: user.provider,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toAuthResponse(user: User, tokens: AuthTokens): AuthResponseDto {
  return {
    ...tokens,
    user: toUserDto(user),
  };
}
```

Rules (규칙):
- View functions MUST be **pure** (no I/O, no side effects). (view 함수는 순수)
- View functions live in `presentation/dto/` — never in `application/` or `domain/`. (view는 presentation에만)
- One `*-view.ts` per aggregate. Compose via function calls (`toAuthResponse` calls `toUserDto`). (aggregate당 하나, 함수 합성으로 재사용)
- Do not expose Prisma types — accept `@a-idol/shared` domain entities only. (Prisma 타입 노출 금지 — @a-idol/shared 엔티티만 받음)

> **Deviation (편차)**: amb-starter-kit uses static class Mappers (`CampaignMapper.toResponse()`). A-idol prefers **named functions** — they compose naturally, work without class instantiation, and are trivial to tree-shake. The result shape rule (Entity → camelCase DTO) is identical.

### 5.7 Authentication Decorator Stack (인증 데코레이터)

A-idol uses a **2-level RBAC** — see [§12](#12-access-control--2-level-rbac-접근-제어--2단계-rbac) for full model.

| Decorator (데코레이터) | Combination (조합) | Usage (용도) |
|-----------|------|------|
| `@UseGuards(JwtAuthGuard)` + `@ApiBearerAuth()` | JWT (User) | Mobile app endpoints |
| `@UseGuards(AdminJwtGuard)` + `@ApiBearerAuth()` | JWT (AdminUser) | CMS endpoints under `/admin/*` |
| `@UseGuards(AdminJwtGuard, AdminRoleGuard)` + `@AdminRole('admin')` | JWT + role check | Admin-role-only CMS ops |
| (none) | Public | Health, signup, login |

> **Deviation (편차)**: amb-starter-kit exposes a single `@Auth()` macro that bundles JWT + `OwnEntityGuard` for multi-tenancy. A-idol does **not** use `OwnEntityGuard` (single-tenant), so the guard stack is expressed explicitly via `@UseGuards(...)`.

---

## 6. Frontend Common Rules (프론트엔드 공통 규칙)

> **Scope note (범위 공지)**: as of 2026-04-24 the `packages/cms` and `packages/mobile` packages are empty placeholders. This section defines the **target** convention for when those packages are scaffolded.

### 6.1 Architecture Principles (MUST)

1. Domain-based modularization — each domain is self-contained (pages, components, hooks, services, store, types). (도메인 기반 모듈화)
2. Separation of UI / logic / data fetching. (UI · 로직 · 데이터 패칭 분리)
3. TypeScript everywhere. No plain JS. (전 영역 TypeScript)
4. **API Layer separation** — components never import fetch/axios directly; go through a service. (컴포넌트에서 fetch/axios 직접 import 금지)
5. Per-domain store. Do not share stores across unrelated domains. (도메인별 store)
6. Naming consistency: frontend consumes `@a-idol/shared` Response DTOs as-is (camelCase). (FE는 shared Response DTO 그대로 소비)
7. Single responsibility per file. (파일당 단일 책임)
8. **All UI text via i18n** (no hardcoding). See [§14](#14-i18n-rules--4-languages-i18n-규칙--4개-언어). (UI 텍스트 i18n 필수)

### 6.2 File Naming (파일 네이밍)

| Type (유형) | Rule (규칙) | Example (예시) |
|------|------|------|
| Page | `PascalCase` + `Page` | `IdolDetailPage.tsx`, `FanClubListPage.tsx` |
| General component | `PascalCase` | `IdolCard.tsx`, `HeartButton.tsx` |
| Modal | `PascalCase` + `Modal` | `JoinFanClubModal.tsx` |
| Hook | `use` + `PascalCase` | `useIdolList.ts`, `useHeartMutation.ts` |
| Service (API layer) | `kebab-case` + `.service.ts` | `idol.service.ts`, `chat.service.ts` |
| Store | `kebab-case` + `.store.ts` | `auth.store.ts`, `fandom.store.ts` |
| Types | `kebab-case` + `.types.ts` (local only; contracts live in `@a-idol/shared`) | `idol.types.ts` |

### 6.3 State Management (상태 관리) (RECOMMENDED)

**CMS (React):**

| State Type | Tool | Notes |
|-----------|------|------|
| Server state | **TanStack Query (React Query)** | `staleTime: 30s`, `refetchOnWindowFocus: true`, `retry: 1` |
| Global state | **Zustand** | `auth`, `notification`, `locale` |
| Local state | `useState` | Component-specific |
| URL state | **React Router** | Query / path params |
| Form state | **React Hook Form + Zod** | Validation against `@a-idol/shared` schemas |

**Mobile (React Native):**
Same tooling as CMS. React Native uses React Navigation for URL-equivalent state.

### 6.4 Query Key Pattern (Query Key 패턴)

```typescript
// Domain-scoped, hierarchical. No entityId (A-idol is single-tenant).
export const idolKeys = {
  all: ['idols'] as const,
  lists: () => [...idolKeys.all, 'list'] as const,
  list: (filter: IdolFilter) => [...idolKeys.lists(), filter] as const,
  detail: (id: string) => [...idolKeys.all, 'detail', id] as const,
};
```

> **Deviation (편차)**: amb-starter-kit requires `entityId` in QueryKey for multi-tenancy. A-idol omits it — single-tenant.

---

## 7. Frontend Framework-Specific Guide (프론트엔드 프레임워크별 가이드)

### 7.1 CMS (React) — Import Order (import 순서)

1. React core (`react`)
2. Third-party libraries
3. React Router
4. Global (`@/global/`, `@/components/`, `@/hooks/`, `@/lib/`)
5. `@a-idol/shared` (contracts)
6. Domain-local (`../`)
7. Types (`type { … } from '…'`)

### 7.2 Mobile (React Native) — Import Order (import 순서)

1. React core (`react`, `react-native`)
2. Third-party libraries
3. React Navigation
4. Global (`@/global/`, `@/components/`, `@/hooks/`)
5. `@a-idol/shared` (contracts)
6. Domain-local
7. Types

### 7.3 Custom Hook Pattern — React Query (커스텀 훅 패턴)

```typescript
export const useIdolList = (filter: IdolFilter) =>
  useQuery({
    queryKey: idolKeys.list(filter),
    queryFn: () => idolService.list(filter),
  });

export const useToggleHeart = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: heartService.toggle,
    onSuccess: () => qc.invalidateQueries({ queryKey: idolKeys.all }),
  });
};
```

---

## 8. API Design and Response Shape (API 설계 및 응답 구조)

### 8.1 API Path Rules (API 경로 규칙)

```
Mobile / public: /<resource>                 e.g., /idols, /auth/login, /fan-clubs/:id/join
Admin (CMS):      /admin/<resource>           e.g., /admin/idols, /admin/auditions/:id/rounds
```

> A-idol does **not** use `/api/v1/` prefix as of v0.1.0. If API versioning is introduced (Phase D or beyond), an ADR MUST be filed.

### 8.2 HTTP Method Usage (HTTP 메서드)

| Method | Usage | Success status |
|--------|------|------|
| GET | Read (조회) | 200 |
| POST | Create, or idempotent action (login, refresh, heart-toggle) | 201 for create, 200 for idempotent (use `@HttpCode(200)`) |
| PATCH | Partial update (부분 수정) | 200 |
| DELETE | Delete (soft when the domain supports it) | 204 |

PUT is **not used** in A-idol — PATCH with explicit fields is always preferred.

### 8.3 Response Shape (응답 구조)

A-idol returns **DTOs directly** — no `BaseSingleResponse<T>` / `BaseListResponse<T>` wrapper.

```typescript
// Single — return the DTO directly
async postLogin(...): Promise<AuthResponseDto> {
  return toAuthResponse(...);
}

// List — return an object with { items, pagination }
interface ListResponseDto<T> {
  items: T[];
  pagination: {
    page: number;
    size: number;
    total: number;
    hasNext: boolean;
  };
}
```

> **Deviation (편차)**: amb-starter-kit wraps every response in `{ success, data, error?, timestamp }`. A-idol chose **lighter bodies** for mobile bandwidth — errors are conveyed via HTTP status + error body (see [§9](#9-validation-and-error-handling-유효성-검증-및-에러-처리)). Clients distinguish success/failure from HTTP status.

### 8.4 Request / Response Case Rules (Request / Response 케이스 규칙) (MUST)

| Category (구분) | Case (케이스) | Example (예시) |
|------|--------|------|
| **Request Body** | `snake_case` | `device_id`, `start_at`, `idol_ids` |
| **Response Body** | `camelCase` | `avatarUrl`, `createdAt`, `heartCount` |
| **Query Parameter** | `snake_case` | `?sort_by=popularity&page_size=20` |
| **Path Parameter** | `camelCase` identifier | `/idols/:idolId`, `/auditions/:auditionId/rounds/:roundId` |
| **Resource Segment** | `kebab-case` | `/fan-clubs`, `/chat-rooms`, `/auto-messages` |

---

## 9. Validation and Error Handling (유효성 검증 및 에러 처리)

### 9.1 Request Validation (요청 검증)

- All Request DTOs decorated with `class-validator` constraints (`@IsEmail`, `@IsString`, `@MinLength`, `@IsISO8601`, `@Matches(UUID_REGEX)`, etc.).
- Global `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`).
- On validation failure → HTTP 400 with error body `{ code: 'VALIDATION_ERROR', message, details }`.

### 9.2 Error Code System (에러 코드 체계)

A-idol uses **string-literal domain error codes** grouped by module. They live in `@a-idol/shared/domain/errors.ts`:

```typescript
export const ErrorCodes = {
  // identity
  INVALID_CREDENTIAL: 'INVALID_CREDENTIAL',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  UNDER_AGE: 'UNDER_AGE',
  // chat
  NO_COUPON: 'NO_COUPON',
  CHAT_GATE_NOT_MEMBER: 'CHAT_GATE_NOT_MEMBER',
  // audition
  ROUND_CLOSED: 'ROUND_CLOSED',
  VOTE_DAILY_LIMIT_EXCEEDED: 'VOTE_DAILY_LIMIT_EXCEEDED',
  // …
} as const;

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
    public readonly details?: Record<string, unknown>,
  ) { super(message ?? code); this.name = 'DomainError'; }
}
```

**Rules (규칙)** (MUST):
- Business rule violations throw `DomainError(ErrorCodes.XXX)`. (비즈니스 규칙 위반은 `DomainError`)
- System / unexpected failures throw `AppError(code, msg, cause)` — maps to 5xx. (시스템 에러는 `AppError` — 5xx)
- `AppExceptionFilter` (global) maps `DomainError` → HTTP 4xx by code table; unknown → 500. (전역 필터가 매핑)
- When adding a new code, append to `ErrorCodes` **and** list it in the use case spec docstring. (새 코드 추가 시 `ErrorCodes`와 use case 스펙 양쪽 등록)

> **Deviation (편차)**: amb-starter-kit uses numeric ranges (`E1xxx` / `E4010` / etc.). A-idol uses **descriptive string literals** because: (a) they're searchable without a lookup table, (b) mobile clients can localize via error code keys (§14), (c) SDK consumers get TypeScript autocomplete on `ErrorCode` union.

### 9.3 Mobile / CMS Error Handling (클라이언트 에러 처리)

- Parse `{ code, message }` from 4xx body.
- Look up localized message from i18n namespace `errors` with key == error code (e.g., `errors.INVALID_CREDENTIAL`).
- Fallback to backend's English `message` if no translation exists. (번역 없으면 백엔드 영문 메시지 fallback)

---

## 10. Naming Summary (네이밍 요약)

| Target (대상) | Rule (규칙) | Example (예시) |
|------|------|------|
| DB table | snake_case, plural, **no prefix** | `users`, `fan_clubs`, `chat_messages` |
| DB column | snake_case (Prisma `@map`) | `created_at`, `avatar_url`, `idol_id` |
| Prisma model | PascalCase singular | `User`, `FanClub`, `ChatMessage` |
| Prisma field | camelCase | `createdAt`, `avatarUrl`, `idolId` |
| Entity class (`@a-idol/shared`) | PascalCase + domain noun | `User`, `Idol`, `FanClub` |
| **Request DTO field** | `snake_case` | `device_id`, `start_at`, `idol_ids` |
| **Response DTO field** | `camelCase` | `avatarUrl`, `createdAt`, `heartCount` |
| Backend controller file | `kebab-case.controller.ts` | `identity.controller.ts`, `admin-catalog.controller.ts` |
| Backend use case file | `kebab-verb-object.usecase.ts` | `signup-with-email.usecase.ts` |
| Backend view file | `<aggregate>-view.ts` | `user-view.ts` |
| Frontend component file | `PascalCase.tsx` | `IdolCard.tsx`, `HeartButton.tsx` |
| Frontend hook file | `usePascalCase.ts` | `useIdolList.ts`, `useToggleHeart.ts` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_HEART_PER_DAY`, `CHAT_MESSAGE_MAX_LEN` |
| Env variables | `SCREAMING_SNAKE_CASE` | `JWT_ACCESS_SECRET`, `DATABASE_URL` |
| DI token | `SCREAMING_SNAKE_CASE` string const | `USER_REPOSITORY`, `PASSWORD_HASH_SERVICE` |
| Error code | `SCREAMING_SNAKE_CASE` string literal | `INVALID_CREDENTIAL`, `NO_COUPON` |

---

## 11. ENUM and Constants Rules (ENUM 및 상수 규칙)

### 11.1 Backend Enum (백엔드 Enum)

Prefer **TypeScript `const` object + union type** over native `enum` — they're tree-shakable and serialize predictably:

```typescript
export const AUDITION_STATUS = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
} as const;

export type AuditionStatus = (typeof AUDITION_STATUS)[keyof typeof AUDITION_STATUS];
```

For Prisma schema enums, match the const values 1:1:

```prisma
enum AuditionStatus {
  DRAFT
  ACTIVE
  CLOSED
  CANCELLED
}
```

### 11.2 Frontend Enum + Label Map (프론트엔드 Enum + 라벨 맵)

```typescript
import type { AuditionStatus } from '@a-idol/shared';
import { useTranslation } from 'react-i18next';

export function useAuditionStatusLabel() {
  const { t } = useTranslation('audition');
  return (status: AuditionStatus) => t(`status.${status}`);
}
```

Label **strings live in translation files**, never inline — see [§14](#14-i18n-rules--4-languages-i18n-규칙--4개-언어).

---

## 12. Access Control — 2-level RBAC (접근 제어 — 2단계 RBAC)

### 12.1 User Types (사용자 유형)

A-idol has **2 user types** (A-idol은 2개 사용자 유형):

| Type | Table | Who | Auth |
|------|------|------|------|
| `User` | `users` | Mobile app end users | Email + OAuth (Kakao/Apple/Google), JWT access+refresh |
| `AdminUser` | `admin_users` | CMS operators | Email/password + JWT; role = `admin` / `operator` / `viewer` |

- Mobile app **never** authenticates against `AdminUser`. (모바일 앱은 AdminUser 인증 불가)
- CMS `/admin/*` routes **never** accept `User` JWTs. (CMS는 User JWT 거부)
- See [ADR-010](../adr/ADR-010-admin-user-separation.md) for rationale.

### 12.2 Admin Roles (관리자 역할)

| Role (역할) | Capabilities (권한) |
|------|------|
| `admin` | All admin operations (user moderation, content publish, configuration) |
| `operator` | Content management, audition operations, no user moderation / no config |
| `viewer` | Read-only access to admin dashboards |

Enforced via `@AdminRole('admin')` on controller methods that require the role check beyond baseline admin auth.

> **Deviation (편차)**: amb-starter-kit uses 4-level RBAC (ADMIN / USER / CLIENT / PARTNER). A-idol has no B2B "client" or "partner" user type — all paying users are `User`s with fan-club membership or IAP receipts.

### 12.3 Data Isolation (데이터 격리)

- A-idol does **not** use per-tenant data isolation. (`ent_id` FK, `OwnEntityGuard`, cell visibility: all N/A)
- User data is isolated by `userId` FK on per-user resources (e.g., `UserPhotocard.userId`, `Heart.userId`). Repositories MUST filter by `userId` on mutations.

---

## 13. Encryption Rules (암호화 규칙)

A-idol's encryption surface is smaller than amb-starter-kit. Current needs:

| Target (대상) | Model (모델) | Fields (필드) | Notes |
|------|--------|------|------|
| OAuth refresh tokens (vendor-side) | `AuthSession` | stored as-is (non-sensitive JWT) | Already rotated on refresh |
| IAP receipts (Apple/Google) | `PurchaseTransaction.receiptPayload` | **SHOULD** encrypt at rest in Phase D | AES-256-GCM, 3-field pattern |
| User PII (email) | `User.email` | stored plaintext; hashed lookup TBD | Reviewed in [ADR-010](../adr/ADR-010-admin-user-separation.md) |

When encryption is needed, use the **AES-256-GCM 3-field pattern** from amb-starter-kit:

```
<field>Encrypted    # Encrypted data (base64)
<field>Iv           # Initialization vector (base64)
<field>Tag          # Authentication tag (base64)
```

Key derivation via `scryptSync`. Implementation goes under `packages/backend/src/shared/crypto/`.

> **Deviation (편차)**: amb-starter-kit encrypts API keys / SMTP / PG keys / custom-app keys. A-idol MVP has none of those external-service credential stores. Only IAP receipts are sensitive.

---

## 14. i18n Rules — 4 languages (i18n 규칙 — 4개 언어)

### 14.1 Supported Languages (지원 언어)

| Code | Language | Status |
|------|------|------|
| `ko` | Korean (한국어) | **Default / fallback** |
| `en` | English | Included |
| `vi` | Vietnamese (Tiếng Việt) | Included |
| `zh-CN` | Chinese, Simplified (简体中文) | **A-idol addition** (extends amb-starter-kit's 3 languages) |

### 14.2 Rules (규칙) (MUST)

1. **No hardcoded UI text** in components. Route all strings via `useTranslation()` / `t()`. (컴포넌트에 UI 텍스트 하드코딩 금지)
2. One namespace per domain: `common`, `auth`, `catalog`, `fandom`, `chat`, `commerce`, `audition`, `photocard`, `errors`. (도메인별 네임스페이스)
3. When adding a namespace, register it in `i18n.ts` (import + resources + ns array) for both CMS and Mobile. (새 네임스페이스는 i18n.ts에 등록)
4. Backend error messages default to **English** fixed strings. Clients translate by `code` lookup in the `errors` namespace. (백엔드 에러는 영문 고정, 클라이언트가 코드 기반 번역)
5. Date / number formatting uses `Intl.*` APIs with the active locale — not hardcoded formats. (날짜/숫자는 Intl API 경유)
6. All 4 translation files MUST exist per namespace before a PR merges (empty-string placeholders permitted with `TODO-i18n` annotation). (PR 머지 시점에 4개 번역 파일 모두 존재 필수)

### 14.3 File Layout (파일 배치)

```
packages/<cms|mobile>/src/i18n/
├── i18n.ts                          # namespace registration
├── ko/
│   ├── common.json   auth.json   fandom.json   …   errors.json
├── en/ …
├── vi/ …
└── zh-CN/ …
```

---

## 15. Git Convention (Git 컨벤션)

### 15.1 Branch Strategy (브랜치 전략)

| Branch (브랜치) | Purpose (용도) | Deploy Environment |
|--------|------|----------|
| `main` | Default integration branch | (staging — Phase D) |
| `feature/<issue>-<desc>` | Feature development | Local |
| `bugfix/<issue>-<desc>` | Bug fix | Local |
| `docs/<issue>-<desc>` | Documentation change | Local |
| `hotfix/<issue>-<desc>` | Urgent production fix | Production (Phase D) |

A `production` branch will be added in Phase D when staging / prod pipelines come online — at that point this section MUST be updated via PR.

> **Deviation (편차)**: amb-starter-kit requires `production` + `main` dual branches from day 1. A-idol defers `production` until Phase D because there is no live deploy target yet.

### 15.2 Development Flow (개발 플로우)

1. Branch `feature/<issue>-<desc>` from `main`. (main에서 feature 분기)
2. Commits use scoped Conventional Commits (§15.3). (scope 포함 커밋)
3. Open PR to `main` → **Squash Merge** (1 approval required once branch protection is enabled). (PR → Squash Merge)
4. Hotfix (post-Phase-D): branch from `production` → merge to both `production` and `main`. (핫픽스는 production에서 분기, 양쪽 머지)

### 15.3 Commit Messages (커밋 메시지) (MUST)

```
<type>(<scope>): <description in English>

types:  feat | fix | docs | style | refactor | test | chore | hotfix | perf | build | ci
scope:  module name (identity | catalog | fandom | chat | commerce | audition | vote | photocard | admin-ops | health | shared | infra | wbs | adr)

Examples (예시):
  feat(chat): add auto-message dispatch scheduler
  fix(audition): correct daily heart limit reset at KST midnight
  docs(adr): add ADR-017 for correlation ID propagation
  chore(infra): bump pnpm to 9.12.0
```

> **Deviation (편차)**: amb-starter-kit uses `<type>: <description>` without scope. A-idol **retains scope** — with 10+ modules, scope makes blame/log/release-notes readable without clicking into the diff.

---

## 16. Deviations from amb-starter-kit (amb-starter-kit 편차)

This table consolidates every deviation from [`amoeba_code_convention_v2.md`](../amb-starter-kit/amoeba_code_convention_v2.md) into one place for reviewer clarity. The CLAUDE.md file at the repo root carries a shorter version of this table for always-on context.

| amb-starter-kit rule | A-idol status | Rationale |
|---|---|---|
| ORM = TypeORM with nullable explicit `type:` | ❌ **Replaced** — Prisma 5.x (see [ADR-020](../adr/ADR-020-orm-prisma-over-typeorm.md)) | Prisma handles `Type?` nullability natively; no reflect-metadata edge cases |
| Monorepo `apps/` + `packages/` + `docker/<env>/` | ⚠️ **Reduced** — `packages/*` only | Single docker-compose; introduce `docker/<env>/` in Phase D |
| DB table prefix `amb_*`, 3-letter column prefix `cmp_*` | ❌ **Not applied** — sub-domain prefix used instead (see §4.2: `chat_*`, `vote_*`, `photocard_*`, `purchase_*`, `audition_*`, `auto_message_*`, `idol_*`, `round_*`) | Single-project DB; Prisma `@map` resolves casing. `idol_` collides with `idols` entity; `aid_` re-examined and rejected (semantic ambiguity + 63-char identifier limit + mixed-standard risks). If multi-project isolation arises, prefer PostgreSQL schema namespace. Trade-off: [RPT-260424-C](../report/RPT_260424_naming-prefix-tradeoff.md) · `aid_` re-examination: [RPT-260424-D](../report/RPT_260424_aid-prefix-reexamination.md) · compliance audit: [RPT-260424-B](../report/RPT_260424_db-naming-compliance.md) |
| Multi-tenancy (`ent_id` FK, `OwnEntityGuard`, Entity/Cell/Unit) | ❌ **Not applied** | A-idol is B2C single-tenant |
| 4-level RBAC (ADMIN / USER / CLIENT / PARTNER) | ❌ **Replaced** — 2-level (User / AdminUser) | No B2B surface in MVP |
| `@Auth()` macro decorator | ❌ **Replaced** — explicit `@UseGuards(JwtAuthGuard)` / `AdminJwtGuard` | No multi-tenancy guard to bundle |
| Static class `Mapper` | ⚠️ **Adapted** — function-style `*-view.ts` | Named functions compose + tree-shake better |
| Response wrapper `BaseSingleResponse<T>` / `BaseListResponse<T>` | ❌ **Not applied** — DTO returned directly | Lighter mobile payload; HTTP status distinguishes success/failure |
| Error codes `E1xxx` / `E4010` (numeric ranges) | ❌ **Replaced** — string literal codes grouped in `ErrorCodes` | Searchable, i18n-keyable, TS-union auto-complete |
| Business logic in `*.service.ts` | ⚠️ **Reclassified** — use cases (`*.usecase.ts`); `*.service.ts` is infrastructure adapters only | Clean Architecture use-case layer |
| Request DTO = snake_case, Response DTO = camelCase | ✅ **Applied** (new code); existing Request DTOs camelCase — Phase D migration | — |
| File naming (kebab-case / PascalCase / `use*.ts`) | ✅ **Applied** | — |
| Constants `SCREAMING_SNAKE_CASE` | ✅ **Applied** | — |
| QueryKey includes `entityId` | ❌ **Removed** | Single-tenant |
| i18n `ko / en / vi` (3 languages) | ⚠️ **Extended** — `ko / en / vi / zh-CN` (4 languages) | Added Simplified Chinese |
| Encryption AES-256-GCM (API keys, SMTP, PG keys, custom apps) | ⚠️ **Reduced scope** — IAP receipts only (Phase D) | A-idol stores no vendor API keys or PG credentials |
| Commit messages `<type>: <desc>` (no scope) | ⚠️ **Extended** — `<type>(<scope>): <desc>` | 10+ modules → scope clarifies blame / release notes |
| Git branches `production` + `main` from day 1 | ⏸ **Deferred to Phase D** | No live deploy target yet |
| External integrations (Claude API, Popbill, NICEPAY, Slack, Redmine) | ❌ **Not in MVP** — IAP / SMS / OAuth only | — |
| Web style guide (Basic-A-1/2-R/2-L, Indigo #6366F1, Pretendard, WCAG 2.1 AA) | ⏸ **Deferred to CMS scaffolding** | `packages/cms` is empty as of 2026-04-24 |

---

## 17. Checklist (체크리스트)

### Backend (백엔드)

- [ ] Module under `src/modules/<context>/` with 4-layer structure (`domain/` · `application/` · `infrastructure/` · `presentation/`). (4계층 구조)
- [ ] Controllers split into public (`<context>.controller.ts`) and admin (`admin-<context>.controller.ts`) when both surfaces exist. (public/admin 분리)
- [ ] Authentication via `@UseGuards(JwtAuthGuard)` or `@UseGuards(AdminJwtGuard)`. (인증 가드 적용)
- [ ] Business logic in `*.usecase.ts`, not in controllers or services. (비즈니스 로직은 usecase)
- [ ] Ports declared in `application/interfaces.ts` with `SCREAMING_SNAKE_CASE` DI tokens. (포트 + DI 토큰)
- [ ] **Request DTO uses `snake_case`** (class-validator decorated). (Request = snake_case)
- [ ] **Response DTO uses `camelCase`** (typed in `@a-idol/shared`). (Response = camelCase)
- [ ] `*-view.ts` function converts domain entity → Response DTO. (view 함수 사용)
- [ ] Swagger decorators (`@ApiTags`, `@ApiOperation`, `@ApiBearerAuth` when guarded). (Swagger 데코레이터)
- [ ] Prisma model + migration committed together. `prisma db push` NOT used. (Prisma 마이그레이션 커밋)
- [ ] Business rule violations throw `DomainError(ErrorCodes.XXX)`; new codes added to `@a-idol/shared/domain/errors.ts`. (DomainError + ErrorCodes)
- [ ] Unit test for each use case (Jest + hand-rolled fakes, no `Test.createTestingModule`). (usecase 단위 테스트)

### Frontend (CMS / Mobile)

- [ ] All UI text routed via `t()` — no hardcoded strings. (하드코딩 금지)
- [ ] 4 translation files (`ko / en / vi / zh-CN`) exist for every new namespace before PR merges. (4개 번역 파일)
- [ ] API calls go through `*.service.ts`; components do not import fetch / axios. (서비스 레이어 경유)
- [ ] React Query keys hierarchical per domain (no `entityId`). (쿼리 키 계층)
- [ ] Types imported from `@a-idol/shared` (Response DTOs) or local `*.types.ts` (view-model types). (타입 출처 명확)

### Database (데이터베이스)

- [ ] Table name `snake_case`, plural, **no project-wide prefix**. (전역 prefix 없음)
- [ ] **Sub-domain prefix applied** when the table belongs to a module (e.g., `chat_*`, `vote_*`, `photocard_*`, `purchase_*`, `audition_*`); bare noun only for domain-central aggregates (`users`, `idols`, `hearts`, …). See §4.2. (서브도메인 prefix 적용)
- [ ] Column `snake_case` via Prisma `@map` / `@@map`. (컬럼 snake_case)
- [ ] `createdAt` + `updatedAt` present; `deletedAt` added when soft delete is required by domain. (타임스탬프 + 선택적 soft delete)
- [ ] Timestamps are `TIMESTAMPTZ`; serialized with `.toISOString()`. (TIMESTAMPTZ + ISO)
- [ ] Money as `Decimal(14, 2)` in DB; `number` at the wire. (금액)
- [ ] Migration SQL under `packages/backend/prisma/migrations/` committed with the feature. (마이그레이션 커밋)

### Git

- [ ] Branch name matches `feature/<issue>-<desc>` / `bugfix/…` / `docs/…`. (브랜치 네이밍)
- [ ] Commits use `<type>(<scope>): <desc>` format. (scope 포함 커밋)
- [ ] PR description lists affected `FR-` / `T-` / `ADR-` IDs (traceability). (트레이서빌리티 ID 기재)

---

## Document History (문서 이력)

| Version | Date | Author | Changes |
|------|------|--------|-----------|
| v1.0 | 2026-04-24 | Gray Kim | Initial — derived from amoeba_code_convention_v2.md, adapted for A-idol's Prisma + Clean Architecture + 2-level RBAC + 4-language i18n + single-tenant model |
| v1.1 | 2026-04-24 | Gray Kim | §4.2 Table Naming: sub-domain prefix 권장 조항 명문화 + prefix 없음 정책의 `idol_` 충돌 근거 추가. §16 deviation 표에 RPT-260424-B / RPT-260424-C 참조 링크 추가. §17 Database checklist에 sub-domain prefix 체크 항목 추가. 근거: [RPT-260424-C Phase D 권고 §5.4](../report/RPT_260424_naming-prefix-tradeoff.md) |
| v1.2 | 2026-04-24 | Gray Kim | §4.2 + §16 갱신 — `aid_` 전역 prefix 재검토 결과(7 risks 식별, 결론 "조건부 가능" → "미권고") 반영. PostgreSQL schema namespace 대안 명시. 근거: [RPT-260424-D](../report/RPT_260424_aid-prefix-reexamination.md) |
