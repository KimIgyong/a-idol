# [RPT-260424-C] Naming Prefix 도입 Trade-off 분석

## Report Metadata (리포트 정보)

| 항목 | 값 |
|---|---|
| **리포트 ID** | RPT-260424-C |
| **제목** | Table prefix `idol_` + Column 3-letter prefix (e.g., `usr_`) 도입 시 장단점 분석 |
| **작성일** | 2026-04-24 |
| **작성자** | Gray Kim <gray.kim@amoeba.group> |
| **분류** | 네이밍 정책 의사결정 분석 (Naming Policy Decision Analysis) |
| **트리거** | [RPT-260424-B](RPT_260424_db-naming-compliance.md) §3.2–3.3에서 "의도적 비준수" 판정된 두 항목을 retrofit할 경우의 비용/이득 재검토 |
| **선행 리포트** | [RPT-260424](RPT_260424_prisma-vs-typeorm.md), [RPT-260424-B](RPT_260424_db-naming-compliance.md) |
| **관련 결정** | [ADR-020](../adr/ADR-020-orm-prisma-over-typeorm.md) (Prisma 채택, naming 편차의 근원) |

---

## Executive Summary (요약)

**검토 대상 두 가지 변경**:

1. **Option A** — 모든 테이블에 `idol_` prefix 추가 (amb-starter-kit §4.2 정렬)
2. **Option B** — 모든 컬럼에 테이블 기반 3자 prefix 추가 (amb-starter-kit §4.3 정렬, 예: `users.id` → `users.usr_id`)

**결론**:

| Option | 권고 | 핵심 사유 |
|---|---|---|
| **A (`idol_` prefix)** | ❌ **미권고** | `idol_idols`, `idol_idol_schedules` 등 **치명적 충돌** (프로젝트명 = 도메인 엔티티명) + 단일 프로젝트 DB에서 이득 낮음 |
| **A (대안 `aid_`)** | ⚠️ **조건부 가능** | 충돌 해소되나 단일 DB에서 실질 이득 여전히 낮음. 반기+ 마이그레이션 비용 대비 미미 |
| **B (컬럼 3자 prefix)** | ❌ **미권고** | ~320 `@map` 선언 추가 + 전체 raw SQL 갱신 + prefix 할당 체계 구축 → **5-10 engineer-days 비용**, 이득은 DBA/분석 직군에 한정 |
| **C (A+B 동시)** | ❌ **미권고** | 비용 누적 (7-12 engineer-days) + ADR-020 Prisma 채택 근거와 상충 |

**대신 권고**: 현 정책 유지 + **서브도메인 묵시적 prefix 활용도 검증** (§5.3).

---

## 1. 현황 및 제안 시나리오 (Status Quo & Scenarios)

### 1.1 현재 상태 (2026-04-24)

- 32 Prisma 모델, 32 DB 테이블
- 테이블명: 프로젝트 prefix **없음** (`users`, `idols`, `fan_clubs`, …)
- 컬럼명: 3자 prefix **없음** (`id`, `email`, `avatar_url`, `created_at`, …)
- Prisma `@map` / `@@map`이 DB snake_case ↔ TS camelCase 경계 처리

### 1.2 제안 시나리오

| Option | 테이블 예 | 컬럼 예 |
|---|---|---|
| **현재** | `users` | `id`, `email`, `avatar_url` |
| **A — `idol_` prefix** | `idol_users` | `id`, `email`, `avatar_url` |
| **B — 컬럼 3자 prefix** | `users` | `usr_id`, `usr_email`, `usr_avatar_url` |
| **C — A+B 동시** | `idol_users` | `usr_id`, `usr_email`, `usr_avatar_url` |

---

## 2. Option A — Table prefix `idol_` 분석

### 2.1 적용 시 Before / After (샘플)

| 현재 | Option A 적용 후 | 비고 |
|---|---|---|
| `users` | `idol_users` | OK |
| `admin_users` | `idol_admin_users` | OK |
| `agencies` | `idol_agencies` | OK |
| **`idols`** | **`idol_idols`** | ⚠️ 충돌 — 단어 중복 |
| **`idol_schedules`** | **`idol_idol_schedules`** | ⚠️ 명백한 중복 |
| **`idol_images`** | **`idol_idol_images`** | ⚠️ 명백한 중복 |
| `hearts` | `idol_hearts` | OK |
| `follows` | `idol_follows` | OK |
| `fan_clubs` | `idol_fan_clubs` | OK |
| `chat_rooms` | `idol_chat_rooms` | OK |
| `auditions` | `idol_auditions` | OK |
| `photocard_sets` | `idol_photocard_sets` | OK |

### 2.2 🚨 치명적 문제 — `idol_` 선택 부적합

**근본 원인**: 프로젝트명(`A-idol`)과 **핵심 도메인 엔티티명**(`idol`)이 동일.

| 문제 테이블 | 현재 | `idol_` 적용 | 영향 |
|---|---|---|---|
| `idols` | 아이돌 엔티티 | `idol_idols` | 의미 중복, 가독성 악화 |
| `idol_schedules` | 아이돌 일정 | `idol_idol_schedules` | 3회 반복 "idol_idol" |
| `idol_images` | 아이돌 이미지 | `idol_idol_images` | 동일 |

이는 **`idol_`을 프로젝트 prefix로 쓰지 말라는 강한 신호**. amb-starter-kit의 prefix 패턴은 프로젝트 코드와 도메인 용어가 겹치지 않는 일반적 경우를 전제함 (e.g., `amb_` + `users` — `amb`는 회사 약어, 도메인 용어 아님).

### 2.3 장점 (Pros)

1. **amb-starter-kit §4.2 완전 정렬** — 플랫폼 표준 준수 명목상 확보
2. **다중 프로젝트 DB 공존 시 구별 용이** — 하나의 PostgreSQL 인스턴스에 `amb_*`, `wpl_*`, `idol_*` 테이블이 섞여 있을 때 `SELECT * FROM idol_*`로 프로젝트 범위 격리
3. **크로스 프로젝트 SQL 감사 시 즉시 식별** — 로그/에러 스택에 테이블명만 있어도 어느 서비스인지 추적 가능
4. **백업/스냅샷 파일명 구분** — `pg_dump` 결과물에서 기원 프로젝트 인식 용이

### 2.4 단점 (Cons)

1. **🚨 `idol_` 선택 시 3개 테이블 단어 중복** (위 §2.2)
2. **단일 프로젝트 DB 구조에서 이득 0** — A-idol은 전용 RDS 인스턴스 예정 (Phase D). 다른 프로젝트와 테이블 공존 시나리오 없음
3. **마이그레이션 전면 영향** — 32개 테이블 rename
4. **Prisma `@@map` 32건 수정** — 1대1 대응이므로 단순하나 검토 필요
5. **Raw SQL / 운영 스크립트 영향** — 시드, Adminer 직접 쿼리, 분석 대시보드 SQL 모두 갱신
6. **Prisma 모델 이름 vs 테이블 이름 간극 증가** — `prisma.user.findMany()` → `idol_users`. 이미 `@@map`으로 격차 있으나 더 벌어짐
7. **ORM 추상화 장점 희석** — Prisma의 "모델명 = 테이블명 기본"을 깨고 명시 매핑 의존도 증가

### 2.5 대안 prefix

`idol_` 충돌을 피하면서 3자 규칙을 따르려면:

| 대안 | 의미 | 충돌 여부 | 평가 |
|---|---|---|---|
| `aid_` | **A-idol 약어 (3자)** | 없음 | ✅ 가장 자연스러움 |
| `adl_` | a-dol 음절 | 없음 | OK |
| `idl_` | idol 단축 | `idols` → `idl_idols`? 여전히 어색 | ⚠️ |
| `ai_` | a-idol | 2자 (규칙 위배) + AI 오해 소지 | ❌ |

**대안 적용 시 before/after** (`aid_` 채택):

| 현재 | `aid_` 적용 | 비고 |
|---|---|---|
| `users` | `aid_users` | OK |
| `idols` | `aid_idols` | OK, 충돌 없음 |
| `idol_schedules` | `aid_idol_schedules` | OK |
| `fan_clubs` | `aid_fan_clubs` | OK |

→ `aid_` 로 선택하면 §2.2 충돌은 해소되나, §2.4의 **단일 DB 이득 낮음** 문제는 그대로 유효.

### 2.6 마이그레이션 비용

| 작업 | 시간 |
|---|---|
| Prisma 스키마 32개 `@@map` 수정 | 30분 |
| `prisma migrate dev --name add-table-prefix` 생성 + 검토 | 1시간 |
| 마이그레이션 SQL 내 `ALTER TABLE … RENAME TO …` 32건 검증 (FK cascade 확인) | 1시간 |
| Seed 스크립트 검사 (Prisma Client 경유이므로 영향 적음) | 30분 |
| 운영 스크립트/분석 쿼리 검사 | 2-4시간 |
| Unit / integration 테스트 통과 확인 | 1-2시간 |
| **합계** | **0.5-1 engineer-day** |

→ 비교적 저비용. **하지만 이득이 낮다는 점이 결정적**.

---

## 3. Option B — Column 3-letter prefix 분석

### 3.1 적용 시 Before / After (샘플: `users` 테이블)

| Prisma 필드 | 현재 DB 컬럼 | Option B 적용 후 DB 컬럼 |
|---|---|---|
| `id` | `id` | `usr_id` |
| `provider` | `provider` | `usr_provider` |
| `providerUserId` | `provider_user_id` | `usr_provider_user_id` |
| `email` | `email` | `usr_email` |
| `passwordHash` | `password_hash` | `usr_password_hash` |
| `nickname` | `nickname` | `usr_nickname` |
| `avatarUrl` | `avatar_url` | `usr_avatar_url` |
| `marketingOptIn` | `marketing_opt_in` | `usr_marketing_opt_in` |
| `createdAt` | `created_at` | `usr_created_at` |
| `updatedAt` | `updated_at` | `usr_updated_at` |
| `deletedAt` | `deleted_at` | `usr_deleted_at` |

Prisma 모델:

```prisma
model User {
  id             String   @id @default(uuid()) @map("usr_id") @db.Uuid
  email          String?  @unique @map("usr_email")
  passwordHash   String?  @map("usr_password_hash")
  nickname       String   @map("usr_nickname") @db.VarChar(30)
  avatarUrl      String?  @map("usr_avatar_url")
  marketingOptIn Boolean  @default(false) @map("usr_marketing_opt_in")
  createdAt      DateTime @default(now()) @map("usr_created_at")
  updatedAt      DateTime @updatedAt @map("usr_updated_at")
  deletedAt      DateTime? @map("usr_deleted_at")
  @@map("users")
}
```

### 3.2 Prefix 할당 제안 (32개 전체) — 충돌 관리 이슈

amb-starter-kit §4.3은 "3-letter prefix"만 규정할 뿐 할당 방법 미정의. 32개 테이블에 고유 3자 prefix 부여 시 발생하는 할당표:

| 테이블 | 후보 prefix | 충돌 위험 |
|---|---|---|
| `admin_users` | `adm_`, `aus_` | — |
| `users` | `usr_` | — |
| `auth_sessions` | `ase_`, `ast_` | — |
| `agencies` | `agc_`, `agn_` | — |
| `idols` | `idl_` | — |
| `idol_schedules` | `ish_`, `isc_` | `isc_` ↔ `inactive_sessions_*` 같은 향후 충돌 가능 |
| `idol_images` | `iim_`, `idi_` | — |
| `hearts` | `hrt_` | — |
| `follows` | `flw_`, `fol_` | — |
| `fan_clubs` | `fcl_`, `fnc_` | — |
| `memberships` | `mbs_`, `mem_` | `mem_` ↔ 메모리/멤버 모호 |
| `chat_rooms` | `crm_`, `cro_` | `crm_` ↔ CRM 일반 약어 혼동 |
| `chat_messages` | `cmg_`, `cms_` | `cms_` ↔ 콘텐츠관리시스템 약어 혼동 (amb-starter-kit에도 `amb_cms_` 있음) |
| `chat_quotas` | `cqt_`, `cqo_` | — |
| `chat_coupon_wallets` | `ccw_` | — |
| `chat_coupon_ledger` | `ccl_` | — |
| `auditions` | `aud_` | — |
| `rounds` | `rnd_` | — |
| `vote_rules` | `vrl_`, `vru_` | — |
| `votes` | `vot_`, `vte_` | — |
| `vote_ticket_balances` | `vtb_` | — |
| `vote_ticket_ledger` | `vtl_` | — |
| `round_vote_ticket_balances` | `rvb_` | — |
| `round_vote_ticket_ledger` | `rvl_` | — |
| `round_ranking_snapshots` | `rrs_` | — |
| `audition_entries` | `aen_`, `aue_` | — |
| `auto_message_templates` | `amt_` | amb-starter-kit `amb_`와 한 글자 차이, 운영 중 오타 위험 |
| `purchase_products` | `ppr_`, `ppd_` | — |
| `purchase_transactions` | `ptx_`, `ptr_` | — |
| `photocard_sets` | `pcs_`, `pst_` | `pst_` ↔ PostgreSQL 약어 혼동 |
| `photocard_templates` | `pct_` | — |
| `user_photocards` | `upc_` | `upc_` ↔ UPC 바코드 표준 약어 혼동 |

> **관측**: 32개 테이블 중 **6개 이상이 외부 공용 약어와 충돌 위험** (`crm_`, `cms_`, `mem_`, `pst_`, `upc_`, `amt_`). 신규 모듈 도입(예: `notification`) 시마다 prefix 고유성 유지가 운영 비용.

### 3.3 장점 (Pros)

1. **amb-starter-kit §4.3 완전 정렬** — 플랫폼 표준 준수
2. **SQL JOIN 시 컬럼 출처 즉시 식별** — alias 없이도 읽힘:
   ```sql
   -- 현재 (alias 필수)
   SELECT u.id AS user_id, i.id AS idol_id, h.created_at
     FROM users u JOIN hearts h ON h.user_id = u.id JOIN idols i ON i.id = h.idol_id;
   -- Option B 적용 후
   SELECT usr_id, idl_id, hrt_created_at
     FROM users JOIN hearts ON hrt_user_id = usr_id JOIN idols ON idl_id = hrt_idol_id;
   ```
3. **컬럼명 충돌 방지** — 복수 테이블 JOIN 시 `id`, `created_at` 동명 컬럼 구분 용이
4. **DB 감사 로그에서 직관적** — 쿼리 로그에 `usr_email` 등 보면 소속 테이블 즉시 유추
5. **저장 프로시저 / 트리거 디버깅 편의** — raw SQL 다루는 직군(DBA, 분석팀)에 유의미
6. **ERD 문서 생성 시 가독성 향상** — 관계선이 얽혀도 prefix로 소속 식별

### 3.4 단점 (Cons)

1. **🚨 Prisma `@map` 추가 폭증** — 컬럼당 1건. 32 테이블 × 평균 10컬럼 = **~320 `@map` 선언** 추가. 유지보수 부담 급증
2. **🚨 TS 필드 vs DB 컬럼 인지 부담** — TS에서 `user.id`, DB에서 `usr_id`. 디버깅 시 **두 네이밍 시스템을 번갈아 사용**
3. **3자 prefix 할당 체계 운영 필요** — §3.2의 32개 할당표를 레지스트리 문서로 유지. 신규 테이블 추가 시마다 충돌 검사
4. **FK 네이밍 규칙 추가 결정 필요** — amb-starter-kit 규칙("참조 테이블 PK 그대로")상 `auth_sessions.user_id`는 `usr_id`가 되어야 하나, `auth_sessions` 관점에서는 `ase_user_id`가 자연스러움. **어느 쪽 prefix를 따를지 재결정** 필요
5. **IDE 자동완성 이중화** — `user.avatarUrl` (Prisma) vs `usr_avatar_url` (SQL 브라우저). 두 네이밍 모두 머리에 유지
6. **Seed 및 운영 raw SQL 전수 갱신** — 시드, Adminer 쿼리, 분석 대시보드, 인보이스, 백필 스크립트 등 **수십~수백 건의 SQL** 영향
7. **팀 온보딩 비용** — 신규 개발자가 "왜 테이블별로 컬럼 prefix가 다른가"를 학습 + 할당표 암기
8. **컬럼명 가독성 저하** — 예: `cmp_cell_id` (amb 예시)는 외부 문맥에서 `cmp`가 뭔지 즉시 모름. A-idol의 `cmg_sender_type`도 같은 문제
9. **Prisma 생성 타입의 이점 희석** — Prisma Client는 TS 필드명으로 쿼리 작성 → DB prefix의 실제 사용 접점이 raw SQL과 Adminer뿐. **이득 영역이 좁음**
10. **수백 건의 마이그레이션 SQL 라인** — `ALTER TABLE users RENAME COLUMN id TO usr_id; ...` 컬럼당 1행
11. **향후 스키마 변경 피로도 증가** — 신규 컬럼 추가마다 "어떤 prefix를 붙일지" 판단 단계 추가

### 3.5 마이그레이션 비용 (상세)

| 작업 | 시간 | 위험 |
|---|---|---|
| 3자 prefix 할당표 작성 + 리뷰 + 승인 | 0.5일 | 충돌 재협의 가능 |
| Prisma 스키마 `@map` 320여 선언 추가 | 0.5-1일 | 반복 작업 오타 |
| 마이그레이션 SQL 생성 (`prisma migrate dev`) | 0.5일 | |
| 마이그레이션 SQL 수동 검토 — FK cascade, constraint rename 확인 | 0.5-1일 | **높음** (PK/FK 이름도 Prisma 기본에서 벗어나면 일부 수동 교정 필요) |
| Seed 스크립트 갱신 (Prisma Client 경유면 영향 적음, raw SQL 있으면 많음) | 0.5일 | |
| 운영 스크립트 / 분석 SQL 일괄 교체 | 1-3일 | **매우 높음** (누락 시 장애) |
| Prisma Client 재생성 + TS 컴파일 오류 해소 | 2-4시간 | 일반적으로 적음 (모델명 변경 아니면) |
| Unit 테스트 갱신 (raw SQL 포함된 경우) | 0.5-1일 | |
| Integration / E2E 테스트 전수 통과 | 1-2일 | **중간** |
| 스테이징 배포 + 관찰 | 1일 | |
| **합계** | **5-10 engineer-days** | 누락 SQL 발견 시 **+1-3일 복구** |

### 3.6 실제 수혜자 분석 (Who Benefits)

| 역할 | Option B 이득 | 현재 대안 |
|---|---|---|
| 백엔드 개발자 | ❌ 낮음 — Prisma Client 사용 (prefix 미노출) | Prisma 타입 |
| DBA / 인프라 엔지니어 | ✅ 보통 — raw SQL JOIN 편의 | alias (`u.id AS user_id`) |
| 데이터 분석가 (BI) | ✅ 높음 — 복잡 조인에서 컬럼 소속 추적 용이 | alias, ERD 툴 |
| 모바일 / CMS 개발자 | ❌ 없음 — Response DTO는 camelCase | Swagger 문서 |
| 기획 / CS / 운영팀 | ⚠️ 보통 — Adminer 직접 조회 시 편의 | Prisma Studio |
| QA 엔지니어 | ⚠️ 낮음 — 대부분 API 레벨 테스트 | — |

→ **백엔드+프론트엔드 전체**가 부담을 지고, **일부 DBA/분석 직군**만 이득 수혜. A-idol 현재 조직 규모(~소수 백엔드 + 모바일 / CMS 팀) 고려 시 **ROI 낮음**.

---

## 4. Option C — A+B 동시 적용 분석

### 4.1 적용 샘플

```prisma
model User {
  id             String   @id @default(uuid()) @map("usr_id") @db.Uuid
  email          String?  @unique @map("usr_email")
  // ...
  @@map("idol_users")   // or @@map("aid_users")
}
```

### 4.2 비용·이득

- **비용**: Option A (0.5-1일) + Option B (5-10일) + 상호작용 검증 = **7-12 engineer-days**
- **이득**: Option A + Option B 각각의 이득 누적. 단, **§2.2 `idol_` 충돌 문제 여전**

### 4.3 권고

❌ **미권고**. A-idol의 단일 DB + Prisma 생태계 맥락에서 두 변경의 비용 누적이 이득을 초과. ADR-020에서 명문화한 "Prisma 생태계 모범 사례 따름" 기조와도 상충.

---

## 5. 권고 (Recommendations)

### 5.1 Option A (Table prefix)

| 시나리오 | 권고 |
|---|---|
| `idol_` prefix 채택 | ❌ **절대 미권고** — §2.2 충돌 |
| `aid_` 대안 채택 | ⚠️ **조건부** — 반기+ 내 동일 PostgreSQL 인스턴스에 타 프로젝트 DB 공존 계획이 확정되면 재검토. 그 전에는 불요 |
| 현상 유지 (prefix 없음) | ✅ **권고** — 단일 프로젝트 DB + Prisma `@@map` 추상화로 충분 |

### 5.2 Option B (Column 3-letter prefix)

| 시나리오 | 권고 |
|---|---|
| 전면 적용 | ❌ **미권고** — 비용 5-10일 + 지속적 유지보수 부담 vs 이득은 특정 직군 한정 |
| 특정 테이블만 선택 적용 | ❌ **미권고** — 네이밍 일관성 깨져 오히려 혼란 가중 |
| 현상 유지 (prefix 없음) | ✅ **권고** |

### 5.3 대안 — 서브도메인 묵시적 prefix 활용

A-idol은 이미 **서브도메인 prefix를 자연스럽게 사용**하고 있음. amb-starter-kit의 `amb_hr_*`, `amb_bil_*`와 동일한 효과:

| A-idol 서브도메인 | 테이블 |
|---|---|
| **chat_** | `chat_rooms`, `chat_messages`, `chat_quotas`, `chat_coupon_wallets`, `chat_coupon_ledger` |
| **vote_** | `vote_rules`, `vote_ticket_balances`, `vote_ticket_ledger`, `votes` (짧은 형) |
| **round_** | `round_vote_ticket_balances`, `round_vote_ticket_ledger`, `round_ranking_snapshots` |
| **photocard_** | `photocard_sets`, `photocard_templates` (+ `user_photocards` 도메인 역소속) |
| **purchase_** | `purchase_products`, `purchase_transactions` |
| **idol_** | `idol_schedules`, `idol_images` (+ `idols` 본체) |
| **audition_** | `audition_entries` (+ `auditions` 본체) |
| **auto_message_** | `auto_message_templates` |

→ **이미 50% 이상 테이블이 도메인 서브-prefix 형태**. `a-idol-code-convention.md §4`에 이 사실을 **명시적으로 문서화**하면 "prefix 없음" 정책이 아니라 **"서브도메인 prefix를 권장, 전역 프로젝트 prefix는 불요"** 정책으로 정제됨.

### 5.4 즉시 조치 권고 (Phase D 문서 정리 범위)

1. **`a-idol-code-convention.md §4.2` 갱신** — "서브도메인 prefix 권장" 조항 추가:
   ```
   - Use a sub-domain prefix when a table clearly belongs to a module
     (e.g., `chat_*`, `vote_*`, `photocard_*`, `purchase_*`). Naming
     `chat_rooms` instead of `rooms` disambiguates global name clashes
     and mirrors amb-starter-kit's `amb_<subdomain>_*` pattern.
   - Do NOT add a project-wide prefix (`aid_*`, `idol_*`). A-idol is a
     single-project database; the project prefix adds cost without benefit.
   ```
2. **현재 네이밍 정책의 정당성 기록** — 본 리포트를 편차표(CLAUDE.md, `a-idol-code-convention.md §16`)에서 직접 링크하여 "왜 prefix 없는가"를 미래 합류자에게 추적 가능하게 함
3. **신규 모듈 추가 시 체크리스트** — `docs/implementation/a-idol-code-convention.md §17` 백엔드 체크리스트에 "서브도메인 prefix 적용했는가" 추가

---

## 6. 결론 (Conclusion)

| 질문 | 답 |
|---|---|
| **`idol_` 테이블 prefix 적용?** | ❌ 도메인 엔티티명과 충돌 (`idol_idols`). 대안 `aid_`도 단일 DB에서 이득 낮음 |
| **컬럼 3자 prefix 적용?** | ❌ 5-10일 마이그레이션 비용 + 320여 `@map` 추가 + 할당표 운영 부담. 이득은 DBA/BI 직군 한정 |
| **A+B 동시?** | ❌ 비용 누적만 7-12일, ADR-020 Prisma 채택 기조와 상충 |
| **어떻게 해야 하나?** | 현재 정책 유지 + **서브도메인 prefix 권장 조항 명문화** (실질적으로 이미 적용 중) |
| **amb-starter-kit 정렬은 포기하나?** | 아니오 — **편차는 이미 ADR-020 + 컨벤션 §16에 문서화됨**. 본 리포트로 "왜 retrofit 안 하는가" 근거 추가 보강 |

---

## Appendix A — 의사결정 플로우차트

```
[amb-starter-kit §4 준수 압력이 증가]
              │
              ▼
    ┌─────────────────────┐
    │ 같은 PG 인스턴스에   │  Yes → Option A (`aid_`) 재검토
    │ 타 프로젝트 DB 공존?  │
    └──────────┬──────────┘
               │ No
               ▼
    ┌─────────────────────┐
    │ 분석팀 raw SQL이      │  Yes → Option B 부분 적용 재검토
    │ 상시적이고 많은가?     │       (일반적으로 아님 — Prisma Studio / BI 툴로 대체)
    └──────────┬──────────┘
               │ No
               ▼
    ┌─────────────────────┐
    │ 현재 정책 유지:        │
    │ - 테이블 prefix 없음   │
    │ - 컬럼 prefix 없음     │
    │ - 서브도메인 prefix    │
    │   묵시적 활용         │
    │ - 편차 문서화 유지     │
    └─────────────────────┘
```

## Appendix B — 참고 계산 근거

### B.1 `@map` 선언 증분 추정

- 32 테이블 평균 컬럼 수: `schema.prisma` 집계상 약 10개 (FK 포함)
- 현재 `@map` 선언 수 (카멜→스네이크 변환용): ~130건 (2단어+ 컬럼만)
- Option B 적용 시 모든 컬럼에 `@map` 필요: **32 × 10 = 320건**
- 순 증가: **+190건**

### B.2 Raw SQL 영향 추정

- 시드 `prisma/seed.ts`: Prisma Client 기반, 영향 ≤ 5%
- 마이그레이션 SQL: 자동 생성 (영향 0)
- `sql/a-idol-schema.sql` (참조 DDL): **전수 갱신** 필요
- 운영 런북/분석 쿼리: `docs/ops/` 기반 추정 — **20-40건** 대상
- 계: 반나절~1.5일

---

## Document History (문서 이력)

| Version | Date | Author | Changes |
|---|---|---|---|
| v1.0 | 2026-04-24 | Gray Kim | 초기 작성 — `idol_` 테이블 prefix + 컬럼 3자 prefix 도입 시 장단점 분석, 32개 테이블/컬럼 전수 검토, 서브도메인 prefix 대안 제안, Phase D 문서 정리 권고 3건 도출 |
