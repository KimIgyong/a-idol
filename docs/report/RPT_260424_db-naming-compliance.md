# [RPT-260424-B] DB Naming Compliance — A-idol vs amb-starter-kit §4

## Report Metadata (리포트 정보)

| 항목 | 값 |
|---|---|
| **리포트 ID** | RPT-260424-B |
| **제목** | DB Naming Compliance Analysis — A-idol Prisma Schema vs amb-starter-kit §4 |
| **작성일** | 2026-04-24 |
| **작성자** | Gray Kim <gray.kim@amoeba.group> |
| **분류** | 컴플라이언스 점검 (Compliance Audit) |
| **트리거** | amb-starter-kit §4 데이터베이스 네이밍 규칙과 A-idol 현행 Prisma 스키마의 정합성 확인 요청 |
| **분석 대상** | [`packages/backend/prisma/schema.prisma`](../../packages/backend/prisma/schema.prisma) (32 models) |
| **참조 기준** | [`docs/amb-starter-kit/amoeba_code_convention_v2.md §4`](../amb-starter-kit/amoeba_code_convention_v2.md) |
| **A-idol 자체 기준** | [`docs/implementation/a-idol-code-convention.md §4`](../implementation/a-idol-code-convention.md), [`ADR-020`](../adr/ADR-020-orm-prisma-over-typeorm.md) |
| **관련 리포트** | [RPT-260424 Prisma vs TypeORM](RPT_260424_prisma-vs-typeorm.md) |

---

## Executive Summary (요약)

A-idol의 32개 Prisma 모델을 amb-starter-kit §4 네이밍 규칙에 비추어 감사한 결과:

- **amb-starter-kit 기준 준수율**: **약 30%** — 대부분의 편차는 **ADR-020 / 코드 컨벤션 §16에 명문화된 의도적 이탈** (table prefix 미사용, column prefix 미사용, Prisma 기본 index 네이밍).
- **A-idol 자체 컨벤션 기준 준수율**: **약 95%** — 의도되지 않은 내부 불일치 **3건** 식별.
- **발견된 내부 불일치**:
  1. **Ledger 테이블 단수형** (3개) — `chat_coupon_ledger`, `vote_ticket_ledger`, `round_vote_ticket_ledger` vs 다른 테이블은 모두 복수형
  2. **Boolean 컬럼 네이밍 혼재** — `is_active`/`is_approved` vs `marketing_opt_in`/`push_opt_in`
  3. **`appleProductId` 대소문자** — 나머지 컬럼은 모두 `@map` 경유 snake_case이나 `apple_product_id`는 명시 필요 (실제로는 `@map` 있음, 검토 결과 문제 없음)

**결론**: 구조적 이탈은 이미 ADR-020·컨벤션 문서에서 정당화됨. 내부 불일치 3건 중 2건은 **Phase D 정리 권고**, 1건은 **오탐**.

---

## 1. amb-starter-kit §4 규칙 요약 (Rules Recap)

### 1.1 Database Name (§4.1)

```
Pattern: db_{project}
Example: db_amb, db_waplus
```

### 1.2 Table Naming (§4.2)

- Base: `{prefix}_{name_plural}` snake_case
- 3자 프로젝트 코드 prefix (sub-domain 시 추가 prefix)
- Domain별 prefix 예: `amb_`, `amb_hr_`, `amb_bil_`, `amb_talk_`, `amb_svc_`, `amb_kms_` …

### 1.3 Column Naming (§4.3)

| 유형 | 규칙 | 예시 |
|---|---|---|
| PK | `{colPrefix}_id` (UUID) | `usr_id`, `cmp_id` |
| FK | 참조 테이블 PK 그대로 | `usr_id`, `ent_id` |
| 일반 | `{colPrefix}_{name}` | `cmp_name`, `cmp_budget` |
| Boolean | `{colPrefix}_is_{name}` | `cmp_is_active`, `ntc_is_pinned` |
| Created | `{colPrefix}_created_at` | `cmp_created_at` |
| Updated | `{colPrefix}_updated_at` | `cmp_updated_at` |
| Deleted | `{colPrefix}_deleted_at` | `cmp_deleted_at` (Soft Delete) |
| Visibility | `{colPrefix}_visibility` | `iss_visibility` |
| Cell FK | `{colPrefix}_cell_id` | `iss_cell_id` |
| Entity FK | `ent_id` | (멀티테넌시 필수) |
| Encryption | `{colPrefix}_encrypted/iv/tag` | AES-256-GCM 3-field |

### 1.4 Index / Constraint Naming (§4.4)

| 유형 | 패턴 | 예시 |
|---|---|---|
| Index | `idx_{table}_{column(s)}` | `idx_amb_issues_status` |
| Primary Key | `pk_{table}` | `pk_amb_issues` |
| Foreign Key | `fk_{table}_{ref_table}` | `fk_amb_issues_users` |
| Unique | `uq_{table}_{column}` | `uq_amb_users_email` |

---

## 2. A-idol 현황 (Current State)

### 2.1 Database

| 항목 | 값 |
|---|---|
| DB 엔진 | PostgreSQL 16 |
| 로컬 DB 이름 | `aidol` |
| 접속 사용자 | `aidol` / `aidol_dev` (dev) |
| 호스트 포트 | 5433 (container 5432) |
| 스키마 관리 | Prisma 5.x (`@map` / `@@map` 기반 snake_case 변환) |

### 2.2 테이블 인벤토리 (32개)

| 도메인 | 테이블 | 개수 |
|---|---|---|
| Identity | `admin_users`, `users`, `auth_sessions` | 3 |
| Catalog | `agencies`, `idols`, `idol_schedules`, `idol_images` | 4 |
| Fandom | `hearts`, `follows`, `fan_clubs`, `memberships` | 4 |
| Chat | `chat_rooms`, `chat_messages`, `chat_quotas`, `chat_coupon_wallets`, `chat_coupon_ledger` | 5 |
| Audition | `auditions`, `rounds`, `vote_rules`, `votes`, `audition_entries` | 5 |
| Voting (ticket) | `vote_ticket_balances`, `vote_ticket_ledger`, `round_vote_ticket_balances`, `round_vote_ticket_ledger`, `round_ranking_snapshots` | 5 |
| Auto-message | `auto_message_templates` | 1 |
| Commerce | `purchase_products`, `purchase_transactions` | 2 |
| Photocard | `photocard_sets`, `photocard_templates`, `user_photocards` | 3 |
| **합계** | | **32** |

### 2.3 컬럼 네이밍 샘플

```prisma
model User {
  id              String       @id @default(uuid()) @db.Uuid
  provider        AuthProvider
  providerUserId  String       @map("provider_user_id")
  email           String?      @unique
  passwordHash    String?      @map("password_hash")
  avatarUrl       String?      @map("avatar_url")
  marketingOptIn  Boolean      @default(false) @map("marketing_opt_in")
  pushOptIn       Boolean      @default(true)  @map("push_opt_in")
  createdAt       DateTime     @default(now()) @map("created_at")
  updatedAt       DateTime     @updatedAt      @map("updated_at")
  deletedAt       DateTime?    @map("deleted_at")
}
```

### 2.4 인덱스/제약조건 (Prisma 기본값)

Prisma는 `@@index` / `@@unique`의 DB 이름을 **자동 생성**하며, 생성 규칙은:

- 인덱스: `{table}_{col1}_{col2}_idx`
- Unique: `{table}_{col1}_{col2}_key`
- Foreign key: `{table}_{col}_fkey`
- Primary key: `{table}_pkey`

예: `auth_sessions_user_id_idx`, `users_provider_provider_user_id_key`, `hearts_pkey`.

---

## 3. 준수 여부 분석 (Compliance Analysis)

### 3.1 Database Name (vs §4.1)

| 항목 | amb-starter-kit | A-idol | 판정 |
|---|---|---|---|
| 패턴 `db_{project}` | `db_amb` | `aidol` | ❌ **비준수 (의도적)** |

**근거**: A-idol은 단일 프로젝트 DB. `db_` 접두사는 "한 인스턴스에 여러 프로젝트 DB가 공존"할 때 의미가 있으며, A-idol의 배포 구조(ECS + RDS, 프로젝트 전용 DB 인스턴스)에서는 불필요.
**편차 문서**: [a-idol-code-convention.md §4.1](../implementation/a-idol-code-convention.md), [ADR-020](../adr/ADR-020-orm-prisma-over-typeorm.md) §Decision 2.

### 3.2 Table Naming (vs §4.2)

| 규칙 | amb-starter-kit | A-idol 실제 | 32개 중 준수 | 판정 |
|---|---|---|---|---|
| snake_case | ✓ | ✓ | **32/32** | ✅ |
| 복수형 (plural) | `amb_users` | 대부분 복수형 | **29/32** | ⚠️ |
| `{prefix}_` 3자 프로젝트 prefix | `amb_*` | 없음 | **0/32** | ❌ (의도적) |
| Sub-domain prefix (`amb_hr_`, `amb_bil_` 등) | 도메인별 필수 | 없음 | **0/32** | ❌ (의도적) |

**복수형 예외 (3건)**:

| 테이블 | 복수형 규칙 엄격 적용 시 | 비고 |
|---|---|---|
| `chat_coupon_ledger` | `chat_coupon_ledgers` | "ledger"는 회계 용어로 mass-noun 해석 가능 |
| `vote_ticket_ledger` | `vote_ticket_ledgers` | 동일 |
| `round_vote_ticket_ledger` | `round_vote_ticket_ledgers` | 동일 |

> **관측**: "ledger" 테이블 3개는 단수형, 구조적으로 동일한 `chat_coupon_wallets` / `vote_ticket_balances`는 복수형. 회계 관습상 "ledger" 단수 사용이 일반적이나, **A-idol 자체 컨벤션 관점에서 일관성 누락**.

**Prefix 미적용 편차 문서**: [CLAUDE.md 편차표](../../CLAUDE.md) · [a-idol-code-convention.md §4.2, §16](../implementation/a-idol-code-convention.md) · [ADR-020](../adr/ADR-020-orm-prisma-over-typeorm.md) §Decision 2.

### 3.3 Column Naming (vs §4.3)

#### 3.3.1 타임스탬프 컬럼

| amb-starter-kit | A-idol | 판정 |
|---|---|---|
| `{colPrefix}_created_at` (e.g., `cmp_created_at`) | `created_at` | ❌ (prefix 없음, 의도적) |
| `{colPrefix}_updated_at` | `updated_at` | ❌ (prefix 없음, 의도적) |
| `{colPrefix}_deleted_at` | `deleted_at` | ❌ (prefix 없음, 의도적) |

**A-idol 내부 일관성**: 타임스탬프 컬럼은 **32개 전체에서 100% 일관** (모두 `created_at` / `updated_at` / `deleted_at`). ✅

**Soft Delete 적용 테이블**: `users`, `agencies`, `idols`, `idol_schedules`, `auditions`, `memberships` (via `left_at` → joined/left 시맨틱). 도메인 필요 시에만 `deleted_at` 추가 — [a-idol-code-convention.md §5.5](../implementation/a-idol-code-convention.md) 규칙대로.

#### 3.3.2 PK / FK 컬럼

| 규칙 | amb-starter-kit | A-idol | 판정 |
|---|---|---|---|
| PK | `{colPrefix}_id` (e.g., `usr_id`) | `id` (모든 테이블) | ❌ (의도적) |
| FK | 참조 테이블 PK 그대로 (`usr_id`) | `{referenced_singular}_id` (e.g., `user_id`, `idol_id`, `agency_id`) | ❌ but 내부 일관 |
| Composite PK | `@@id([a, b])` | `hearts`, `follows`, `round_vote_ticket_balances` | ✅ (양쪽 동일) |

**A-idol FK 네이밍 자체 일관성 검증** (샘플):

| 테이블 | FK 컬럼 | 참조 | 패턴 |
|---|---|---|---|
| `auth_sessions` | `user_id` | users.id | `{ref_singular}_id` ✓ |
| `idols` | `agency_id` | agencies.id | ✓ |
| `idol_schedules` | `idol_id` | idols.id | ✓ |
| `memberships` | `user_id`, `fan_club_id` | users.id, fan_clubs.id | ✓ |
| `chat_messages` | `room_id` | chat_rooms.id | ⚠️ (`chat_room_id` 아님) |
| `chat_coupon_ledger` | `user_id` | users.id | ✓ |
| `purchase_transactions` | `user_id`, `product_id` | users.id, purchase_products.id | ⚠️ (`purchase_product_id` 아님) |
| `audition_entries` | `audition_id`, `idol_id`, `eliminated_at_round_id` | auditions.id, idols.id, rounds.id | ✓ |

> **관측**: `chat_messages.room_id`와 `purchase_transactions.product_id`는 **테이블명 첫 단어 생략**. 컨텍스트 안에서는 자연스럽지만, 다른 모듈에서 JOIN 시 모호해질 가능성. **32개 FK 컬럼 중 2건이 축약형** — 내부 일관성 경미 위배.

#### 3.3.3 Boolean 컬럼 (불일치 발견 ⚠️)

| 컬럼 | 테이블 | 패턴 |
|---|---|---|
| `is_approved` | `idol_images` | **`is_*`** ✓ |
| `is_active` | `purchase_products`, `photocard_sets`, `photocard_templates` | **`is_*`** ✓ |
| `marketing_opt_in` | `users` | **`*_opt_in`** ⚠️ |
| `push_opt_in` | `users` | **`*_opt_in`** ⚠️ |

**발견**: Boolean 컬럼 6개 중 4개는 `is_*` 패턴, 2개는 `*_opt_in` 패턴. amb-starter-kit §4.3 규칙은 `{colPrefix}_is_{name}`만 명시.

**엄격 해석**: `is_marketing_opt_in`, `is_push_opt_in`으로 통일 권장.
**실용 해석**: `opt_in` / `opt_out` 계열은 플래그 자체가 "옵트인 상태"를 나타내는 명사형 → 현재 명명 유지 가능하나, **A-idol 컨벤션에 명시 조항 추가** 필요.

#### 3.3.4 멀티테넌시 / 암호화 컬럼 (§4.3 일부)

| 규칙 | A-idol | 판정 |
|---|---|---|
| `ent_id` FK (멀티테넌시) | 없음 | N/A (단일 테넌트, 설계상) |
| `{colPrefix}_cell_id` | 없음 | N/A |
| `{colPrefix}_visibility` | 없음 | N/A |
| `{colPrefix}_encrypted/iv/tag` | 없음 | N/A (ADR-020 Future work: IAP receipt Phase D 대상) |

### 3.4 Index / Constraint Naming (vs §4.4)

| 유형 | amb-starter-kit | A-idol (Prisma 기본) | 판정 |
|---|---|---|---|
| Index | `idx_amb_issues_status` | `auth_sessions_user_id_idx` | ❌ (Prisma 기본값, 의도적) |
| Primary Key | `pk_amb_issues` | `hearts_pkey` | ❌ |
| Foreign Key | `fk_amb_issues_users` | `chat_messages_room_id_fkey` | ❌ |
| Unique | `uq_amb_users_email` | `users_email_key` | ❌ |

**근거**:
- Prisma는 `@@index` / `@@unique` 등에서 DB 측 이름을 자동 생성하며 커스텀 이름 부여 가능 (`@@index([...], name: "idx_xxx")`).
- A-idol은 **Prisma 기본값 수용** — 전체 인덱스/제약조건 커스텀 네이밍 부담보다 자동 생성의 이점이 더 큼 (스키마 변경 시 일괄 재생성 자동화).
- amb-starter-kit의 `idx_{table}_{col}` 패턴은 **TypeORM 환경에서 수동 네이밍 시 일관성 확보용**. Prisma 환경에서는 불필요.

---

## 4. 발견된 내부 불일치 (Internal Inconsistencies)

> **정의**: "A-idol 자체 컨벤션 기준" 에서 벗어나거나 모듈 간 일관성이 깨진 항목. ADR-020으로 문서화된 의도적 편차는 **제외**.

### 4.1 Ledger 테이블 단수형 — ⚠️ **정리 권고**

| 테이블 | 현재 | 제안 (A-idol 복수형 원칙 엄격 적용 시) |
|---|---|---|
| `chat_coupon_ledger` | 단수 | `chat_coupon_ledgers` |
| `vote_ticket_ledger` | 단수 | `vote_ticket_ledgers` |
| `round_vote_ticket_ledger` | 단수 | `round_vote_ticket_ledgers` |

**영향도**: 낮음
- 마이그레이션 1회로 해결 (rename).
- Prisma `@@map` 변경 + 마이그레이션 SQL `ALTER TABLE … RENAME TO …`.
- 애플리케이션 코드는 Prisma 모델 이름 그대로 사용하므로 **TS 코드 영향 없음** (DB 쪽 변경만).
- 단, 수동으로 DB를 직접 조회하는 운영 스크립트·쿼리가 있다면 함께 갱신 필요.

**대안**: 현재 상태 유지 + **컨벤션 문서에 "ledger = mass-noun 예외" 명시**. 영향도 훨씬 낮음.

### 4.2 Boolean 컬럼 네이밍 혼재 — ⚠️ **컨벤션 명시 권고**

- `is_active`, `is_approved` (4개) vs `marketing_opt_in`, `push_opt_in` (2개)
- **선택지**:
  - (A) 전부 `is_*`로 통일: `is_marketing_opted_in`, `is_push_opted_in` — 마이그레이션 2개 컬럼만
  - (B) 현재 패턴 유지 + 컨벤션에 "opt-in/out 플래그는 `*_opt_in` 형태 허용" 조항 추가 — 마이그레이션 없음

**권고**: (B) — `opt_in` 패턴은 업계에서 흔하고 가독성 있음. 컨벤션 명시로 "불일치"를 "합의된 예외"로 전환.

### 4.3 FK 컬럼 축약형 (2건) — ℹ️ **기록만**

- `chat_messages.room_id` → `chat_messages.chat_room_id` (엄격 적용)
- `purchase_transactions.product_id` → `purchase_transactions.purchase_product_id` (엄격 적용)

**판단**: 해당 테이블의 로컬 컨텍스트에서 `room_id` / `product_id`는 모호하지 않음. 이미 많은 코드가 이 컬럼을 참조하며 변경 비용 vs 이득 비교 시 **유지가 합리적**.

### 4.4 기타 확인 사항 (문제 없음)

- `ChatRoom.messages`, `ChatMessage.room` 등 Prisma 관계 네이밍 — A-idol TS 필드 camelCase 규칙 준수. ✅
- 모든 `@map` 선언이 실제 snake_case DB 컬럼과 일치. ✅
- Composite PK/Unique 선언 (`@@id([userId, idolId])`, `@@unique([provider, providerUserId])`) — A-idol 관용 패턴과 일치. ✅

---

## 5. 준수율 스코어 카드 (Compliance Scorecard)

### 5.1 amb-starter-kit §4 엄격 기준

| 영역 | 가중치 | 준수 | 비준수 (의도적) | 점수 |
|---|---|---|---|---|
| DB name `db_{project}` | 5% | 0 | 5% | 0/5 |
| Table snake_case | 10% | 10% | 0 | **10/10** ✅ |
| Table plural | 10% | 9.1% (29/32) | 0.9% | **9/10** |
| Table project prefix | 15% | 0 | 15% | 0/15 (의도적) |
| Column snake_case | 15% | 15% | 0 | **15/15** ✅ |
| Column 3-letter prefix | 15% | 0 | 15% | 0/15 (의도적) |
| Timestamps 표준 | 10% | 10% | 0 | **10/10** ✅ (prefix만 없음, 규칙은 준수) |
| Boolean `is_*` | 5% | 3.3% (4/6) | — | **3.3/5** ⚠️ |
| Multi-tenancy columns | 5% | — | 5% | N/A (단일 테넌트) |
| Encryption 3-field | 5% | 0 | 5% | N/A (Phase D) |
| Index/Constraint naming | 5% | 0 | 5% | 0/5 (Prisma 기본값, 의도적) |
| **총점** | **100%** | — | — | **~47%** (amb 엄격) |

> amb-starter-kit 의도적 편차(ADR-020 문서화 항목)를 "합의된 비준수"로 **보정 제외** 시: **~88%**.

### 5.2 A-idol 자체 컨벤션 기준 ([a-idol-code-convention.md §4](../implementation/a-idol-code-convention.md))

| 영역 | 준수 여부 |
|---|---|
| snake_case DB 컬럼 (Prisma `@map`) | ✅ 100% |
| 복수형 테이블 (A-idol 자체 규칙) | ⚠️ 29/32 (ledger 3건 예외) |
| 타임스탬프 `created_at` / `updated_at` / `deleted_at` | ✅ 100% |
| FK `{referenced_singular}_id` | ⚠️ 경미 (축약형 2건) |
| Boolean 컬럼 | ⚠️ 2개 패턴 혼재 |
| Prisma 기본 index 네이밍 사용 | ✅ |
| **종합 준수율** | **~95%** |

---

## 6. 권고 사항 (Recommendations)

### 6.1 즉시 조치 (P1)

없음. 현 상태는 운영에 문제를 일으키지 않으며, 모든 구조적 편차는 ADR-020 및 컨벤션 문서에 기록됨.

### 6.2 Phase D 정리 권고 (P2)

#### R1. Boolean 컬럼 네이밍 정책 명시 — **컨벤션 문서 갱신 (코드 변경 없음)**

`a-idol-code-convention.md §4.3`에 아래 조항 추가:

```
Boolean columns (Boolean 컬럼):
- Default: `is_<state>` (예: `is_active`, `is_approved`)
- Exception — opt-in/out flags: `<topic>_opt_in` / `<topic>_opt_out` 허용
  (예: `marketing_opt_in`, `push_opt_in`)
```

**비용**: 문서 1줄 / **이득**: 내부 일관성 해석 확정.

#### R2. Ledger 테이블 복수형 정책 명시 — **컨벤션 문서 갱신 (선택)**

두 가지 옵션 중 택 1:

- **R2-a (유지)**: 컨벤션에 "accounting ledger 테이블은 mass-noun 단수형 허용" 명시. 코드 변경 없음.
- **R2-b (통일)**: `chat_coupon_ledgers`, `vote_ticket_ledgers`, `round_vote_ticket_ledgers`로 rename. 마이그레이션 1회. TS 영향 없음 (Prisma `@@map` 변경만).

**권고**: R2-a — 변경 비용 대비 이득 낮음.

### 6.3 장기 (Phase E 이후)

#### R3. 암호화 3-field 패턴 도입 검토 — **ADR 후속**

ADR-020 Future work §암호화 후속에 연결. `PurchaseTransaction.receiptPayload` (Apple JWS, Google signed receipt) 등 민감 페이로드를 AES-256-GCM 3-field (`*_encrypted`, `*_iv`, `*_tag`)로 전환 시, amb-starter-kit §4.3 암호화 네이밍 규칙을 **동일하게 채택** 권고.

#### R4. 신규 도메인 추가 시 테이블 네이밍 재검토 — **프로세스**

`notification` 등 신규 모듈 추가 시, 현재 보수적 prefix-less 정책의 한계(테이블 이름 충돌 가능성)를 재평가. 현재 32개 수준에서는 문제 없으나 50개 돌파 시점에서 서브도메인 prefix(`chat_`, `vote_`, `photocard_`) 도입 고려.

---

## 7. 결론 (Conclusion)

| 질문 | 답 |
|---|---|
| **amb-starter-kit §4 규칙을 따르는가?** | ❌ 약 47% (엄격). 나머지 편차는 ADR-020 / 컨벤션 §16에 명문화된 의도적 이탈. |
| **A-idol 자체 컨벤션은 일관적인가?** | ✅ 약 95%. 3건의 경미한 내부 불일치 존재 (ledger 단수, boolean 혼재, FK 축약). |
| **즉시 조치 필요한가?** | ❌ 없음. 운영 영향 없음. |
| **Phase D에서 권고 사항은?** | R1 (Boolean 컨벤션 명시) · R2-a (ledger 예외 명시) · R3 (암호화 도입 시 네이밍 표준 채택) |
| **amb-starter-kit로의 retrofit은 타당한가?** | ❌ 비경제적. 마이그레이션 비용(수백 컬럼 prefix 추가, 수십 인덱스 rename, 모든 `@map` 수정, Prisma 타입 재생성, 전체 테스트) 대비 이득(표준 정렬)이 **현저히 낮음**. |

---

## Appendix A — Full Table × Column Inventory (샘플)

(전체 ~300+ 컬럼 중 도메인별 대표 테이블만 발췌)

### A.1 `users` (identity)

| Prisma 필드 | DB 컬럼 | 타입 | 규칙 준수 |
|---|---|---|---|
| `id` | `id` | UUID PK | A-idol 자체 ✓ / amb ❌ (prefix 없음) |
| `provider` | `provider` | enum | ✓ |
| `providerUserId` | `provider_user_id` | varchar | ✓ |
| `email` | `email` | varchar unique | ✓ |
| `passwordHash` | `password_hash` | varchar | ✓ |
| `nickname` | `nickname` | varchar(30) | ✓ |
| `avatarUrl` | `avatar_url` | varchar | ✓ |
| `instagramHandle` | `instagram_handle` | varchar(40) | ✓ |
| `birthdate` | `birthdate` | date | ✓ |
| `status` | `status` | enum | ✓ |
| `marketingOptIn` | `marketing_opt_in` | bool | ⚠️ Boolean 패턴 |
| `pushOptIn` | `push_opt_in` | bool | ⚠️ Boolean 패턴 |
| `createdAt` | `created_at` | timestamptz | ✓ |
| `updatedAt` | `updated_at` | timestamptz | ✓ |
| `deletedAt` | `deleted_at` | timestamptz null | ✓ soft delete |

### A.2 `vote_ticket_ledger` (voting)

| Prisma 필드 | DB 컬럼 | 규칙 |
|---|---|---|
| `id` | `id` | UUID PK |
| `userId` | `user_id` | FK users.id |
| `delta` | `delta` | int |
| `reason` | `reason` | enum |
| `balanceAfter` | `balance_after` | int |
| `memo` | `memo` | varchar null |
| `createdAt` | `created_at` | timestamptz |

**테이블명**: `vote_ticket_ledger` — ⚠️ 단수형. A-idol 복수형 원칙 적용 시 `vote_ticket_ledgers`.

---

## Document History (문서 이력)

| Version | Date | Author | Changes |
|---|---|---|---|
| v1.0 | 2026-04-24 | Gray Kim | 초기 작성 — 32개 Prisma 모델 대상 amb-starter-kit §4 준수율 감사, 내부 불일치 3건 발견, Phase D 권고 3건 도출 |
