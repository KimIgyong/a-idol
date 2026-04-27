# [RPT-260424-E] A-idol 현재 구조 & 스펙 리포트

## Report Metadata (리포트 정보)

| 항목 | 값 |
|---|---|
| **리포트 ID** | RPT-260424-E |
| **제목** | A-idol 백엔드 현재 개발 상태 — 구조 · API · 서비스 · 기술 스택 · 포트 종합 스펙 |
| **작성일** | 2026-04-24 |
| **작성자** | Gray Kim <gray.kim@amoeba.group> |
| **분류** | 현황 스냅샷 (Status Snapshot) |
| **스냅샷 시점** | 2026-04-24 (코드베이스 기준) |
| **분석 범위** | `packages/backend`, `packages/shared`, `docker-compose.yml`, `.env.example`, `prisma/schema.prisma` |

---

## Executive Summary (요약)

A-idol은 **NestJS 10 + Prisma 5 + PostgreSQL 16 + Redis 7** 기반 B2C 백엔드로, Phase 0/A/B/C 완료 상태 (WBS ~65-70%):

| 항목 | 수치 |
|---|---|
| **백엔드 모듈** | 10개 |
| **Prisma 모델 (DB 테이블)** | 32개 |
| **HTTP API 엔드포인트** | **95개** |
| **WebSocket 이벤트** | 6개 |
| **로컬 Docker 서비스** | 4개 (backend, postgres, redis, adminer) |
| **사용 포트** | 3000, 5433, 6379, 8080, (5555) |
| **테스트 인프라** | Jest 단위 + 통합 + k6 부하 (scaffolded) |
| **CMS / Mobile** | ⏸ placeholder (빈 workspace 패키지) |

**가용 상태**:
- ✅ 로컬 개발 완전 동작 (`make bootstrap` / `make dev`)
- ⏸ 스테이징/프로덕션 미구축 (Phase D)
- ⏸ CMS / Mobile 앱 미구현

---

## 1. 아키텍처 개요 (Architecture Overview)

```
┌─────────────────────────────────────────────────────────────────┐
│                       Clients (계획)                             │
│  ┌──────────────────┐  ┌────────────────┐  ┌────────────────┐   │
│  │  Mobile App (RN) │  │  CMS (React)   │  │  Integration   │   │
│  │  iOS / Android   │  │  Vite + SPA    │  │  Tests (k6)    │   │
│  │  (placeholder)   │  │  (placeholder) │  │                │   │
│  └────────┬─────────┘  └────────┬───────┘  └────────┬───────┘   │
└───────────┼────────────────────┼───────────────────┼────────────┘
            │ HTTPS / JWT        │ HTTPS / Admin JWT │
            │ WebSocket          │                   │
            ▼                    ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                  @a-idol/backend (NestJS 10)                     │
│                       (port :3000)                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Presentation Layer                                        │  │
│  │  · 17 HTTP Controllers (public + admin-*)                 │  │
│  │  · 1 WebSocket Gateway (chat)                             │  │
│  │  · Swagger UI (/docs), Health (/health)                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Application Layer — Use Cases (Clean Architecture)       │  │
│  │  · 10 modules: identity · catalog · fandom · chat ·       │  │
│  │    commerce · audition · vote · photocard · admin-ops ·   │  │
│  │    health                                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Infrastructure Layer                                      │  │
│  │  · Prisma Repositories (32 models)                        │  │
│  │  · Services: JWT, bcrypt, IAP (Apple/Google/sandbox)      │  │
│  │  · Queue: BullMQ (auto-message, ranking snapshot, quota)  │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────┬────────────────┘
                           │                      │
                ┌──────────▼─────────┐  ┌────────▼──────────┐
                │   PostgreSQL 16    │  │     Redis 7       │
                │   (port :5433)     │  │   (port :6379)    │
                │   · 32 tables      │  │   · Leaderboard   │
                │   · UUID PKs       │  │     (ZSET)        │
                │   · TIMESTAMPTZ    │  │   · BullMQ jobs   │
                └────────────────────┘  │   · Chat presence │
                ┌────────────────────┐  └───────────────────┘
                │    Adminer 4      │  (DB browser GUI)
                │    (port :8080)    │
                └────────────────────┘
```

---

## 2. 서비스 구성 및 포트 (Services & Ports)

### 2.1 로컬 개발 서비스 (4 + 1)

| # | 서비스 | 프로세스 | 호스트 포트 | 컨테이너 포트 | 역할 | 구동 방법 |
|---|---|---|---|---|---|---|
| 1 | **Backend (NestJS)** | Node 20 | `3000` | — | HTTP/WS API 서버 | `make dev` or `pnpm dev` |
| 2 | **PostgreSQL 16** | Docker container `a-idol-postgres` | `5433` | `5432` | 데이터 영구 저장 | `make up` (docker compose) |
| 3 | **Redis 7** | Docker container `a-idol-redis` | `6379` | `6379` | 캐시 + 큐 + 리더보드 | `make up` (docker compose) |
| 4 | **Adminer 4** | Docker container `a-idol-adminer` | `8080` | `8080` | DB browser (선택) | `make up` (docker compose) |
| 5 | **Prisma Studio** | Node (on-demand) | `5555` | — | Prisma GUI | `make studio` |

### 2.2 접속 주소 (Local Dev Endpoints)

| 서비스 | URL | 인증 | 비고 |
|---|---|---|---|
| Backend HTTP API | http://localhost:3000 | JWT (Bearer) | `/api/v1/auth/login` 으로 토큰 발급 |
| Swagger UI (OpenAPI) | http://localhost:3000/docs | 없음 | 인터랙티브 API 문서 |
| Health Check | http://localhost:3000/health | 없음 | DB + Redis 상태 |
| WebSocket (chat) | ws://localhost:3000 | JWT (query param or header) | Socket.IO 프로토콜 |
| Adminer | http://localhost:8080 | DB 자격증명 | server=`postgres`, user=`aidol`, pwd=`aidol_dev`, db=`aidol` |
| Prisma Studio | http://localhost:5555 | 없음 | `make studio` 후 기동 |
| PostgreSQL (직접) | postgresql://aidol:aidol_dev@localhost:5433/aidol | 계정 | `psql` / JDBC 등 |
| Redis (직접) | redis://localhost:6379/0 | (dev: no auth) | `redis-cli` 등 |

### 2.3 Docker Compose 서비스 상세

```yaml
services:
  postgres: image=postgres:16-alpine        # 데이터 볼륨: a_idol_pg_data
  redis:    image=redis:7-alpine            # AOF 활성화, 볼륨: a_idol_redis_data
  adminer:  image=adminer:4                 # 무상태, postgres healthy 대기
```

- **Healthcheck**: postgres(`pg_isready`) 5s 간격 10회 재시도 · redis(`PING`) 5s 간격 10회
- **자동 재시작**: `unless-stopped`
- **볼륨 영구화**: `a_idol_pg_data`, `a_idol_redis_data` (make reset으로 파기)

---

## 3. 기술 스택 상세 (Technology Stack)

### 3.1 런타임 & 빌드

| 계층 | 기술 | 버전 |
|---|---|---|
| JavaScript Runtime | Node.js | **≥20.10** |
| Package Manager | pnpm | **9.12.0** |
| Workspace | pnpm workspaces (monorepo) | — |
| TypeScript | | **5.5.4** (strict, ES2022) |
| Container Runtime | Docker Compose v2 | — |

### 3.2 백엔드 프레임워크 (NestJS 10 생태계)

| 패키지 | 버전 | 용도 |
|---|---|---|
| `@nestjs/core` | ^10.3.10 | DI 컨테이너 · 라이프사이클 |
| `@nestjs/common` | ^10.3.10 | 공통 데코레이터 |
| `@nestjs/platform-express` | ^10.3.10 | HTTP 플랫폼 (Express) |
| `@nestjs/platform-socket.io` | ^10.4.22 | WebSocket 플랫폼 |
| `@nestjs/websockets` | ^10.4.22 | `@SubscribeMessage` 등 |
| `@nestjs/config` | ^3.2.3 | 환경변수 관리 |
| `@nestjs/jwt` | ^10.2.0 | JWT 발급/검증 |
| `@nestjs/throttler` | ^6.2.1 | Rate limiting (투표 남용 방지) |
| `@nestjs/swagger` | ^7.4.0 | OpenAPI 자동 생성 → `/docs` |
| `@nestjs/serve-static` | ^4.0.2 | 정적 자원 서빙 |
| `@nestjs/event-emitter` | ^2.1.0 | 도메인 이벤트 버스 |
| `@nestjs/bullmq` | ^10.2.0 | BullMQ NestJS 어댑터 |

### 3.3 데이터 / 영속성

| 패키지 | 버전 | 용도 |
|---|---|---|
| `@prisma/client` | ^5.18.0 | ORM client (generated) |
| `prisma` (dev) | ^5.18.0 | CLI + migrate + studio |
| `bullmq` | ^5.12.0 | Redis 기반 잡 큐 |
| `socket.io` | ^4.8.3 | WebSocket 서버 |

### 3.4 인증 · 보안

| 패키지 | 버전 | 용도 |
|---|---|---|
| `bcrypt` | ^5.1.1 | 비밀번호 해싱 (BCRYPT_ROUNDS=10) |
| `class-validator` | ^0.14.1 | Request DTO 검증 |
| `class-transformer` | ^0.5.1 | DTO ↔ class 변환 |
| `zod` | ^3.23.8 | 외부 페이로드 (IAP 영수증 등) 검증 |

### 3.5 관측 · 품질

| 패키지 | 버전 | 용도 |
|---|---|---|
| `nestjs-pino` | ^4.1.0 | NestJS 로거 어댑터 |
| `pino` | ^9.3.2 | JSON 구조화 로거 |
| `pino-http` | ^10.2.0 | HTTP 요청 로깅 |
| `pino-pretty` | ^11.2.2 | 로컬 개발 시 컬러 출력 |
| `compression` | ^1.8.1 | HTTP gzip |
| `rxjs` | ^7.8.1 | NestJS 스트림 처리 |
| `reflect-metadata` | ^0.2.2 | 데코레이터 메타 |

### 3.6 테스트

| 패키지 | 버전 | 용도 |
|---|---|---|
| `jest` (dev) | ^29.7.0 | 단위 + 통합 테스트 |
| `@nestjs/testing` (dev) | ^10.3.10 | 통합 테스트 시 일부 사용 |
| `supertest` (dev) | ^7.0.0 | HTTP 통합 테스트 |
| `ts-jest` (dev) | ^29.2.4 | TS Jest 트랜스포머 |
| `k6` (외부 CLI) | — | 부하 테스트 (`test/load/*.js`) |

### 3.7 빌드 파이프라인

| 스크립트 (`packages/backend/package.json`) | 목적 |
|---|---|
| `dev` | `nest start --watch` (hot reload) |
| `build` | `nest build` → `dist/` |
| `start` | `node dist/main.js` (프로덕션) |
| `typecheck` | **3개 tsconfig** 동시 검증 (main / seed / integration) |
| `test` | `jest` — 단위 테스트 |
| `test:integration` | `jest --config jest.integration.config.js` |
| `test:load:smoke` | `k6 run test/load/smoke.js` |
| `test:load:mixed` | `k6 run test/load/mixed-read.js` |
| `lint` | ESLint (`@typescript-eslint` plugin) |
| `prisma:generate` / `prisma:migrate` / `prisma:deploy` / `prisma:studio` | Prisma CLI 래퍼 |
| `seed` | `ts-node prisma/seed.ts` |

> **관측**: 단위/통합 테스트 외에 **k6 부하 테스트가 scaffolded**되어 있음 — 기존 "Phase D 관측·부하 테스트 미착수" 기술에서 **부분 수정 필요**. 실제 실행은 Phase D 관문.

---

## 4. 메뉴 구조도 — API 엔드포인트 맵 (API Route Map)

**합계**: **95 HTTP 엔드포인트** + **6 WebSocket 이벤트**

### 4.1 공개(Public) / 인증 사용자 / 관리자 구성 비율

| 분류 | 개수 | 비율 |
|---|---|---|
| 공개 (no guard) | 14 | 14.7% |
| 인증 사용자 (`JwtAuthGuard`) | 29 | 30.5% |
| 관리자 (`AdminJwtAuthGuard` + `RolesGuard`) | 52 | 54.7% |

### 4.2 HTTP 메서드 분포

| Method | 개수 | 비율 |
|---|---|---|
| GET | 45 | 47.4% |
| POST | 38 | 40.0% |
| PATCH | 7 | 7.4% |
| DELETE | 5 | 5.3% |
| PUT | 0 | 0% (A-idol은 PUT 미사용, PATCH 선호) |

### 4.3 모듈별 엔드포인트 구성

#### 4.3.1 `identity` (인증 · 4개)

| Method | Path | Guard | 설명 |
|---|---|---|---|
| POST | `/api/v1/auth/signup` | — | 이메일 가입 |
| POST | `/api/v1/auth/login` | — | 이메일 로그인 |
| POST | `/api/v1/auth/refresh` | — | Refresh 토큰 회전 |
| GET | `/api/v1/me` | JWT | 현재 사용자 프로필 |

#### 4.3.2 `admin-ops` (CMS 인증 + 대시보드 · 4개)

| Method | Path | Guard | 설명 |
|---|---|---|---|
| POST | `/api/v1/admin/auth/login` | — | 관리자 로그인 |
| POST | `/api/v1/admin/auth/refresh` | — | 관리자 Refresh |
| GET | `/api/v1/admin/me` | Admin JWT | 관리자 프로필 |
| GET | `/api/v1/admin/analytics/overview` | Admin+Role | 대시보드 KPI + 활성 라운드 TOP 3 |

#### 4.3.3 `catalog` (아이돌 · 소속사 · 스케줄 · 16개)

| 분류 | 개수 | 대표 라우트 |
|---|---|---|
| Public | 2 | `GET /idols`, `GET /idols/:id` |
| Admin — agency | 4 | `/api/v1/admin/catalog/agencies` (CRUD) |
| Admin — idol | 8 | `/api/v1/admin/catalog/idols` + `publish/unpublish` |
| Admin — schedule | 3 | `/api/v1/admin/catalog/idols/:id/schedules` |

#### 4.3.4 `fandom` (하트 · 팔로우 · 팬클럽 · 10개)

| Method | Path | Guard | 설명 |
|---|---|---|---|
| POST/DELETE | `/api/v1/idols/:id/heart` | JWT | 하트 토글 (idempotent) |
| POST/DELETE | `/api/v1/idols/:id/follow` | JWT | 팔로우 토글 |
| GET | `/api/v1/me/hearts`, `/api/v1/me/follows` | JWT | 내 활동 |
| GET | `/api/v1/idols/:id/fan-club` | JWT | 팬클럽 정보 + 멤버십 상태 |
| POST | `/api/v1/idols/:id/fan-club/join`, `.../leave` | JWT | 팬클럽 입/탈퇴 |
| GET | `/api/v1/me/memberships` | JWT | 활성 멤버십 목록 |

#### 4.3.5 `chat` (채팅 · 쿼터 · 자동메시지 · HTTP 9 + WS 6)

**HTTP:**

| Method | Path | Guard | 설명 |
|---|---|---|---|
| POST | `/api/v1/chat/rooms/:idolId/open` | JWT | 1:1 채팅방 열기 (lazy create) |
| GET | `/api/v1/chat/rooms/:roomId/messages` | JWT | 메시지 목록 |
| POST | `/api/v1/chat/rooms/:roomId/messages` | JWT | REST fallback 메시지 전송 |
| GET | `/api/v1/me/chat-balance` | JWT | 일일 쿼터 + 쿠폰 잔액 |
| POST | `/api/v1/admin/users/:userId/chat-coupons/grant` | Admin+Role | 쿠폰 지급/차감 |
| POST/GET/DELETE | `/api/v1/admin/chat/auto-messages` (+ `:id`, `:id/dispatch`) | Admin+Role | 자동메시지 CRUD + 강제 발송 |

**WebSocket (chat.gateway.ts)**:

| 이벤트 | 방향 | 설명 |
|---|---|---|
| `room:open` | client → server | 1:1 채팅방 열기 |
| `room:opened` | server → client | 열기 응답 |
| `room:join` | client → server | 기존 방 입장 |
| `room:joined` | server → client | 입장 + 히스토리 |
| `message:send` | client → server | 메시지 전송 |
| `message:received` | server → client | 수신 브로드캐스트 |

#### 4.3.6 `commerce` (IAP · 상품 · 6개)

| Method | Path | Guard | 설명 |
|---|---|---|---|
| GET | `/api/v1/commerce/products` | — | 활성 상품 카탈로그 |
| POST | `/api/v1/commerce/purchases` | JWT | 구매 시작 (DEV_SANDBOX는 즉시 완료) |
| GET | `/api/v1/me/purchases` | JWT | 내 구매 이력 |
| GET/POST/PATCH | `/api/v1/admin/commerce/products` | Admin+Role | 상품 관리 |

#### 4.3.7 `audition` (오디션 · 라운드 · 엔트리 · 19개)

| 분류 | 개수 | 범위 |
|---|---|---|
| Public | 2 | ACTIVE 오디션 조회 |
| Admin — audition | 8 | CRUD + activate/finish/cancel + entries |
| Admin — round | 5 | CRUD + activate/close |
| Admin — vote rule | 3 | PUT/GET/DELETE |

#### 4.3.8 `vote` (투표 · 리더보드 · 6개)

| Method | Path | Guard | 설명 |
|---|---|---|---|
| POST | `/api/v1/rounds/:roundId/votes` | JWT + **Throttle** | HEART / TICKET 투표 |
| GET | `/api/v1/rounds/:roundId/leaderboard` | — | 리더보드 (Redis ZSET 스냅샷) |
| GET | `/api/v1/rounds/:roundId/me/vote-status` | JWT | 일일 하트 투표 카운터 |
| GET | `/api/v1/me/vote-tickets` | JWT | 글로벌 + 라운드 전용 티켓 잔액 |
| POST | `/api/v1/admin/rounds/:id/reconcile-leaderboard` | Admin+Role | Redis 리더보드 재구축 |
| POST | `/api/v1/admin/rounds/:id/snapshot` | Admin+Role | 즉시 스냅샷 (cron 우회) |

#### 4.3.9 `photocard` (포토카드 · 가챠 · 8개)

| 분류 | 개수 | 범위 |
|---|---|---|
| Public | 2 | `GET /photocards/sets`, `/api/v1/photocards/sets/:id` |
| 인증 사용자 | 1 | `GET /me/photocards` (보유 목록) |
| Admin | 5 | sets CRUD + templates 추가 |

#### 4.3.10 `health` (1개)

| Method | Path | Guard | 설명 |
|---|---|---|---|
| GET | `/health` | — | DB + Redis 상태 체크 |

---

## 5. 데이터 레이어 — Prisma 스키마 (32 Models)

### 5.1 모델 카테고리별 개수

| 도메인 | 모델 | 개수 |
|---|---|---|
| Identity | `AdminUser`, `User`, `AuthSession` | 3 |
| Catalog | `Agency`, `Idol`, `IdolSchedule`, `IdolImage` | 4 |
| Fandom | `Heart`, `Follow`, `FanClub`, `Membership` | 4 |
| Chat | `ChatRoom`, `ChatMessage`, `ChatQuota`, `ChatCouponWallet`, `ChatCouponLedger`, `AutoMessageTemplate` | 6 |
| Audition | `Audition`, `Round`, `VoteRule`, `AuditionEntry` | 4 |
| Vote | `Vote`, `VoteTicketBalance`, `VoteTicketLedger`, `RoundVoteTicketBalance`, `RoundVoteTicketLedger`, `RoundRankingSnapshot` | 6 |
| Commerce | `PurchaseProduct`, `PurchaseTransaction` | 2 |
| Photocard | `PhotocardSet`, `PhotocardTemplate`, `UserPhotocard` | 3 |
| **합계** | | **32** |

### 5.2 주요 특성

- **PK 전부 UUID** (`@default(uuid()) @db.Uuid`)
- **Timestamps**: 모든 모델이 `created_at` / `updated_at` (일부만 `deleted_at` 소프트 삭제)
- **Money**: `Decimal @db.Decimal(14, 2)` (KRW integer 사용 예정)
- **JSON 컬럼**: `Idol.profileJson`, `PurchaseProduct.deliveryPayload`, `PurchaseTransaction.deliverySnapshot`
- **Enum 15개**: `AuthProvider`, `UserStatus`, `AdminRole`, `AdminStatus`, `AuditionStatus`, `RoundStatus`, `VoteMethod`, `CouponReason`, `AutoMessageStatus`, `IdolScheduleType`, `ProductKind`, `PaymentProvider`, `TransactionStatus`, `PhotocardRarity`, `PhotocardSource`, `VoteTicketReason` (실제 16개)
- **Composite PK**: `Heart`, `Follow`, `RoundVoteTicketBalance`
- **네이밍**: 서브도메인 prefix 활용 (`chat_*`, `vote_*`, `round_*`, `photocard_*`, `purchase_*`, `idol_*`, `audition_*`, `auto_message_*`) — [컨벤션 §4.2](../implementation/a-idol-code-convention.md)

---

## 6. 환경 변수 (Environment Variables)

### 6.1 `.env.example` 전문

| 변수 | 기본값 (dev) | 용도 | 필수 여부 |
|---|---|---|---|
| `NODE_ENV` | `development` | 실행 환경 | ✅ |
| `PORT` | `3000` | HTTP 포트 | ✅ |
| `LOG_LEVEL` | `debug` | pino 로그 레벨 | ✅ |
| `DATABASE_URL` | `postgresql://aidol:aidol_dev@localhost:5433/aidol?schema=public` | Prisma DB 연결 | ✅ |
| `REDIS_URL` | `redis://localhost:6379/0` | BullMQ · 리더보드 · 캐시 | ✅ |
| `JWT_ACCESS_SECRET` | `change-me-access-secret-...` | Access 토큰 서명 | ✅ |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Access 만료 | ✅ |
| `JWT_REFRESH_SECRET` | `change-me-refresh-secret-...` | Refresh 토큰 서명 | ✅ |
| `JWT_REFRESH_EXPIRES_IN` | `14d` | Refresh 만료 | ✅ |
| `BCRYPT_ROUNDS` | `10` | 패스워드 해싱 비용 | ✅ |
| `KAKAO_CLIENT_ID` | — | OAuth Kakao (Phase 2) | ⏸ |
| `APPLE_CLIENT_ID` | — | OAuth Apple (Phase 2) | ⏸ |
| `GOOGLE_CLIENT_ID` | — | OAuth Google (Phase 2) | ⏸ |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:8081` | 허용 Origin (CMS:5173, RN Metro:8081) | ✅ |

> **CORS 예상 클라이언트 포트**: Vite 기본(5173), React Native Metro bundler(8081).

---

## 7. 테스트 인프라 (Test Infrastructure)

### 7.1 3단 테스트 피라미드

| 계층 | 도구 | 위치 | 현황 |
|---|---|---|---|
| **Unit** | Jest 29 + hand-rolled fakes | `src/**/*.spec.ts` | 모듈별 주요 use case 커버 |
| **Integration** | Jest (별도 config) + supertest | `jest.integration.config.js` 지정 | Scaffolded |
| **Load** | k6 | `test/load/smoke.js`, `test/load/mixed-read.js` | Scaffolded |

### 7.2 tsconfig 3-way split

- `tsconfig.json` — 메인 (NestJS 빌드)
- `tsconfig.seed.json` — seed.ts 전용 (Prisma 타입 필요)
- `tsconfig.integration.json` — 통합 테스트 전용

### 7.3 타입 안정성 점검

`pnpm typecheck`는 위 3개 tsconfig 전체를 순차 검증 → CI 게이트로 적합.

---

## 8. 배포 / 인프라 상태 (Deployment State)

### 8.1 현재 (로컬 전용)

| 자원 | 상태 |
|---|---|
| `docker-compose.yml` | ✅ 존재 (postgres / redis / adminer) |
| `Dockerfile` (backend) | ❌ 없음 — 로컬은 `nest start --watch` 직접 구동 |
| CI 파이프라인 | ❌ 없음 (`.github/workflows/` 추후) |
| 스테이징 인프라 | ❌ 미구축 |
| 프로덕션 인프라 | ❌ 미구축 |

### 8.2 Phase D 계획 (미착수)

- **이미지 빌드**: backend용 multi-stage Dockerfile 추가
- **CI**: GitHub Actions (lint · typecheck · test · prisma validate · build)
- **스테이징**: ECS + RDS (PostgreSQL) + ElastiCache (Redis)
- **관측성**: OpenTelemetry + Sentry + 구조화 로그 수집 ([ADR-017](../adr/ADR-017-correlation-id.md))
- **보안 리뷰**: 의존성 audit · OWASP Top 10 체크
- **접근성 감사**: WCAG 2.1 AA (CMS + Mobile)

---

## 9. WBS 진척도 재조정 (Actual Progress Reassessment)

이전 리포트 (RPT-260424의 가정)에서 "Phase D 관측/테스트 미착수 (~10%)"로 기재했으나, 실제 조사 결과:

| Phase | 이전 추정 | 실제 | 근거 |
|---|---|---|---|
| Phase 0 (Setup) | ~95% | **~95%** | Monorepo, Prisma, NestJS 스캐폴딩 완료 |
| Phase A (Catalog+Fandom) | ~90% | **~95%** | 모든 모듈 + 16+10 엔드포인트 구현 |
| Phase B (Chat+Commerce+Photocard) | ~85% | **~90%** | 9+6+8 엔드포인트 + WS 게이트웨이 + IAP 어댑터 |
| Phase C (Audition+Vote) | ~90% | **~90%** | 19+6 엔드포인트 + Redis 리더보드 + 스냅샷 cron |
| Phase D (Stabilization) | ~10% | **~25%** | 단위/통합/k6 부하 테스트 스캐폴드 존재, 관측성·CI·Dockerfile 미구축 |
| Phase E (Clients) | 0% | **0%** | CMS/Mobile 빈 패키지 |

**총 WBS 진척도**: 약 **~65% → ~70%** 로 소폭 상향.

---

## 10. 종합 요약 테이블 (Master Summary)

### 10.1 "한 페이지 치트시트"

| 축 | 값 |
|---|---|
| **프로젝트명** | A-idol (AI 아이돌 팬덤 플랫폼) |
| **MVP GA** | 2026-08-01 (2026-04-27 조정 — 기존 8-29에서 4주 단축) |
| **API path** | `/api/v1/<resource>` (URI versioning, [ADR-022](../adr/ADR-022-api-versioning-policy.md)) · probe(`/health`, `/metrics`) prefix 없음 |
| **아키텍처** | Clean Architecture 4-layer (domain → application → infrastructure → presentation) |
| **백엔드** | NestJS 10.3.10 + TypeScript 5.5.4 + Node ≥20.10 |
| **ORM** | Prisma 5.18.0 ([ADR-020](../adr/ADR-020-orm-prisma-over-typeorm.md)) |
| **DB** | PostgreSQL 16-alpine, port 5433, 32 tables |
| **Cache/Queue** | Redis 7-alpine, port 6379 (BullMQ 5.12) |
| **Realtime** | Socket.IO 4.8.3 (chat 모듈 전용) |
| **Auth** | JWT (access 15m / refresh 14d) + bcrypt (rounds 10) + OAuth placeholder (Kakao/Apple/Google) |
| **Rate limit** | `@nestjs/throttler` 6.2.1 (vote 등 주요 엔드포인트) |
| **API 문서** | Swagger UI → http://localhost:3000/docs |
| **로깅** | nestjs-pino 4.1 + pino 9.3 + pino-http |
| **모듈** | 10개 |
| **HTTP 엔드포인트** | **95개** (Public 14 / User 29 / Admin 52) |
| **WebSocket 이벤트** | 6개 |
| **Prisma 모델** | 32개 |
| **로컬 서비스 포트** | 3000 (backend), 5433 (postgres), 6379 (redis), 8080 (adminer), 5555 (prisma studio) |
| **CMS / Mobile** | ⏸ placeholder |
| **CI / Staging / Prod** | ⏸ Phase D |
| **i18n** | ⏸ 4개 언어 (ko/en/vi/zh-CN) 계획 ([컨벤션 §14](../implementation/a-idol-code-convention.md)) |

### 10.2 접속 시나리오 빠른 참조

```bash
# 0. 최초 1회
cp .env.example .env
make bootstrap      # install → docker up → migrate → seed

# 1. 개발 서버 기동
make dev            # → http://localhost:3000

# 2. 동작 확인
make smoke          # health + signup + login + me 자동 실행

# 3. 브라우저 접근
open http://localhost:3000/docs   # Swagger
open http://localhost:8080        # Adminer (DB 계정: aidol / aidol_dev / aidol)
make studio                       # Prisma Studio → http://localhost:5555

# 4. DB 초기화 (⚠️ 로컬 데이터 삭제)
make reset && make migrate && make seed
```

---

## Appendix A — Backend 파일 통계 (참고)

| 항목 | 수치 |
|---|---|
| `src/modules/*` 하위 하위폴더 | 10 (모듈) |
| Controller 파일 | 17 (public + admin) |
| WebSocket Gateway | 1 (chat) |
| Use case 파일 (`*.usecase.ts`) | 120+ (모듈별 10~15) |
| Prisma Repository (`prisma-*.repository.ts`) | 20+ |
| DTO 파일 (`*.dto.ts`) | 30+ |
| View 함수 파일 (`*-view.ts`) | 25+ |
| Unit test (`*.spec.ts`) | 20+ |

---

## Document History (문서 이력)

| Version | Date | Author | Changes |
|---|---|---|---|
| v1.0 | 2026-04-24 | Gray Kim | 초기 작성 — 95 HTTP 엔드포인트 · 6 WS 이벤트 · 32 Prisma 모델 · 4 Docker 서비스 · 4 포트 전수 조사. 기술 스택 25개 라이브러리 버전 명시. WBS 진척도 65% → 70% 상향 조정 (k6 부하 테스트 scaffolded 발견) |
| v1.1 | 2026-04-27 | Gray Kim | API 경로 표준화 — §4 95개 라우트 표 모두에 `/api/v1/` prefix 명시 (기존엔 prefix 누락). §10.1 "한 페이지 치트시트"에 API path 행 추가 + MVP GA 날짜 동기화 (2026-08-01). 근거: [ADR-022](../adr/ADR-022-api-versioning-policy.md) |
