# [RPT-260424-D] `aid_` 전역 프로젝트 Prefix 재검토

## Report Metadata (리포트 정보)

| 항목 | 값 |
|---|---|
| **리포트 ID** | RPT-260424-D |
| **제목** | `aid_` 전역 프로젝트 prefix 도입 시 문제점 심층 재검토 |
| **작성일** | 2026-04-24 |
| **작성자** | Gray Kim <gray.kim@amoeba.group> |
| **분류** | 대안 설계 재평가 (Alternative Re-evaluation) |
| **트리거** | [RPT-260424-C §2.5](RPT_260424_naming-prefix-tradeoff.md)가 `aid_` 대안에 대해 "⚠️ 조건부 가능" 판정을 내렸으나, 해당 판정의 근거가 "이득 낮음"에만 머물렀음. **잠재적 위험(risk)** 관점에서 추가 검증 필요 |
| **선행 리포트** | [RPT-260424-C](RPT_260424_naming-prefix-tradeoff.md) |
| **결론 변경 여부** | ✅ **변경** — "조건부 가능" → **"부적합, PostgreSQL Schema namespace로 대체 권고"** |

---

## Executive Summary (요약)

`aid_` 접두사는 `idol_`의 도메인 충돌 문제를 해결하지만, **재검토 결과 7가지 신규 리스크**가 드러남:

1. **의미적 모호성** — `aid` = 영어로 "도움/원조" (의료/인도주의 맥락). 코드 리뷰·검색에서 지속적 오탐
2. **브랜딩 불일치** — 프로젝트명 "A-idol" vs 약어 "aid" 괴리
3. **PostgreSQL identifier 63자 제한 리스크** — 현행 복합 인덱스 중 일부가 prefix 추가 후 상한에 근접/초과
4. **혼합 표준 리스크** — 테이블 prefix만 적용 시 컬럼과 네이밍 철학 불일치
5. **SQL 구두성(verbosity) 누적** — 쿼리당 +4자, 운영 스크립트 전체 영향
6. **문서·오류 로그 가독성 저하** — 모든 테이블명 앞에 항상 `aid_`
7. **onboarding 인지 비용** — 신규 합류자가 "왜 aid이고 aidol이 아닌가"를 매번 질문

**결정 변경**: "조건부 가능" → **"미권고"**. 향후 다중 프로젝트 DB 공존 요구가 실제 발생하면 **테이블 prefix가 아니라 PostgreSQL Schema namespace**(`CREATE SCHEMA idol; SET search_path`)로 해결하는 것이 근본적으로 우월.

---

## 1. 재검토 배경 (Why Reopen)

[RPT-260424-C §2.5](RPT_260424_naming-prefix-tradeoff.md)의 `aid_` 판정 요약:

> "대안 적용 시 before/after (`aid_` 채택): 충돌 없음, OK. → `aid_` 로 선택하면 §2.2 충돌은 해소되나, §2.4의 **단일 DB 이득 낮음** 문제는 그대로 유효."

이 판정은 **이득(benefit) 관점**만 검토하고 **비용(cost)·리스크(risk)** 측은 "Option A 전체 마이그레이션 비용 0.5-1 engineer-day"로만 축약했음.

재검토 필요 이유:
- 0.5-1 engineer-day는 **마이그레이션 1회성 비용**일 뿐, **지속 운영 비용**과 **잠재적 실패 모드**를 반영 안 함
- 현행 스키마의 **복합 인덱스 길이**가 Postgres 63자 제한에 근접한 경우가 있는지 미확인
- `aid`라는 약어 자체의 **의미 부하**를 미평가

---

## 2. 재검토 결과 — `aid_` 세부 문제점 (7 Risks)

### 2.1 의미적 모호성 — "aid"의 기존 영어 의미

| 맥락 | "aid" 해석 | 영향 |
|---|---|---|
| 일반 영어 | 도움, 원조, 지원 | 코드/로그에서 "aid"의 첫 떠오르는 의미 |
| 의료 | first aid (응급처치), medical aid, hearing aid | grep/검색 시 false positive |
| 인도주의 | USAID, humanitarian aid, aid agency | 외부 API 연동 문서와 혼동 가능 |
| 교육 | financial aid, teacher's aid | — |
| 법률 | legal aid | — |

**실제 영향 시나리오**:
- 신규 개발자 코드 리뷰: `aid_users` 테이블을 보고 "도움말 사용자?" 잠시 오해
- StackOverflow / GitHub 검색: "`aid_users schema postgres`" 검색 시 관련 없는 결과 다수
- 에러 로그 파싱: "`FK violation on aid_memberships`" 로그가 메디컬/복지 시스템 에러로 착각될 여지 (agg 로그 시스템에서)

### 2.2 브랜딩 불일치 — "A-idol" vs "aid"

- 프로젝트 공식 명칭: **A-idol** (하이픈 포함, 아이돌 도메인 명시)
- 잠재적 3자 prefix: `aid` (음절 단축 + 의미 탈락)
- 사용자/기획자/CS 팀은 "A-idol"만 인지 → DB 스키마 열람 시 "aid_*는 뭐지?" 재설명 필요

**대안 prefix 후보 재비교**:

| 후보 | 3자 준수 | 의미 보존 | 충돌 위험 | 평가 |
|---|---|---|---|---|
| `aid_` | ✅ | ❌ (aid = 도움) | 영어 약어 다수 | ⚠️ |
| `idol_` | ✅ | ✅ (idol 보존) | **`idols` 도메인 엔티티와 치명적 충돌** | ❌ |
| `aidl_` | ❌ (4자) | ✅ | 없음 | 3자 규칙 위배 |
| `adl_` | ✅ | ⚠️ (음절 추측) | 없음 | 의미 희석 |
| `a_idol_` | ❌ (6자) | ✅ | 없음 | 과장된 길이 |
| (prefix 없음) | — | — | — | **현행 + §2.7 대안** |

→ **모든 3자 prefix 후보가 하나 이상의 결함**을 갖음.

### 2.3 PostgreSQL identifier 63자 제한 리스크

Postgres는 테이블·컬럼·인덱스·제약조건 식별자를 **63자로 자동 truncate**. Prisma 기본 네이밍 규칙 (`{table}_{cols}_idx`, `{table}_{cols}_fkey`) 로 생성되는 식별자에 `aid_` (4자) 추가 시:

**현행 A-idol 스키마의 긴 식별자 TOP 5** (실측):

| 인덱스/제약 | 현재 길이 | `aid_` 적용 후 | 63자 여유 |
|---|---|---|---|
| `round_vote_ticket_ledger_user_id_round_id_created_at_idx` | 56자 | `aid_round_vote_ticket_ledger_user_id_round_id_created_at_idx` | **60자** (여유 3자) ⚠️ |
| `round_vote_ticket_balances_user_id_round_id_key` (PK) | 47자 | `aid_round_vote_ticket_balances_user_id_round_id_key` | 51자 |
| `auto_message_templates_idol_id_scheduled_at_idx` | 48자 | `aid_auto_message_templates_idol_id_scheduled_at_idx` | 52자 |
| `purchase_transactions_provider_provider_tx_id_key` | 49자 | `aid_purchase_transactions_provider_provider_tx_id_key` | 53자 |
| `chat_rooms_user_id_last_message_at_idx` | 38자 | `aid_chat_rooms_user_id_last_message_at_idx` | 42자 |

**위험도 분석**:
- 현재 가장 긴 식별자가 60자로, 63자 제한의 **95% 소진**.
- **미래에 컬럼 하나 추가된 3-column 복합 인덱스**가 추가되면 63자 초과 → Postgres 자동 truncate 발생.
- Truncate 발생 시 **두 개의 다른 인덱스가 같은 이름으로 truncate되는 충돌**이 발생 가능 (`aid_round_vote_ticket_ledger_user_id_round_id_created_at_xxx` ≈ `aid_round_vote_ticket_ledger_user_id_round_id_updated_at_xxx`).
- 이 경우 Prisma migrate는 **에러 없이 진행**되나 DB는 첫 번째 인덱스만 생성 후 두 번째를 silent drop하거나 마이그레이션 실패.

**현행 (prefix 없음) 여유**: 가장 긴 식별자 56자 → 여유 7자 → 3-column 복합 인덱스 2-3개 추가분 확보.

### 2.4 혼합 표준 리스크

`aid_`을 테이블에만 적용 시:

```sql
SELECT *
  FROM aid_users u           -- 테이블 prefix: aid_
  JOIN aid_memberships m
    ON m.user_id = u.id      -- 컬럼은 prefix 없음
 WHERE u.email = ?;
```

**amb-starter-kit 컨벤션 관점**: `aid_` 테이블 prefix는 §4.2 완전 준수하나, **§4.3 (컬럼 3자 prefix)는 여전히 미적용**. 표면적으로는 "50% 준수" 상태.

**내부 일관성 관점**: 새 합류자가 "테이블엔 prefix 있는데 컬럼엔 왜 없지?" → 설명 필요. 기존 정책("prefix 안 씀")이 더 일관적.

**두 prefix 모두 적용 (Option C)**: RPT-260424-C에서 이미 "❌ 미권고" (7-12 engineer-days) 결론.

### 2.5 SQL 구두성 누적

```sql
-- 현재
SELECT COUNT(*) FROM users WHERE status='active';
SELECT i.name, h.created_at
  FROM idols i JOIN hearts h ON h.idol_id = i.id
 WHERE h.user_id = ?;

-- aid_ 적용 후
SELECT COUNT(*) FROM aid_users WHERE status='active';
SELECT i.name, h.created_at
  FROM aid_idols i JOIN aid_hearts h ON h.idol_id = i.id
 WHERE h.user_id = ?;
```

**누적 비용 추정**:
- 운영 스크립트/분석 SQL **추정 20-40건** × 쿼리당 평균 3-4 테이블 참조 × +4자 = **전체 ~300-600자 증가**
- 대시보드 SQL 위젯, 런북 SQL 블록, 시드 JSON 참조 등 모두 갱신 필요
- Adminer/DBeaver/TablePlus의 테이블 탐색 창에서 모든 테이블이 `aid_`로 시작 → 첫 글자 필터링 무력화 (32개 모두 `a`)

### 2.6 로그 / 에러 메시지 가독성 저하

**현재**:
```
ERROR: foreign key constraint "memberships_fan_club_id_fkey"
       on table "memberships" violates referenced table "fan_clubs"
```

**`aid_` 적용 후**:
```
ERROR: foreign key constraint "aid_memberships_fan_club_id_fkey"
       on table "aid_memberships" violates referenced table "aid_fan_clubs"
```

- 스택 트레이스·Sentry 알림·Prisma 에러 메시지에 반복 노출
- 운영 직군(CS/기획)이 에러 로그를 확인할 때 "aid_" prefix를 **매번 정신적으로 제거** 후 의미 파악

### 2.7 Onboarding 질문의 반복

신규 합류자의 예상 질문 목록:

- "왜 prefix가 `aid`이고 `aidol`이 아닌가?" (3자 규칙이지만, 아는 사람만 앎)
- "왜 프로젝트 prefix를 쓰면서 컬럼 prefix는 안 쓰는가?" (§2.4)
- "`aid` = 도움 아닌가? 무슨 관련이 있지?"
- "테이블 이름만 바꾸고 Prisma 모델은 그대로인데 두 네이밍 체계를 다 외워야 하나?"

각 질문은 1회성이지만 **신규 합류자마다 반복** → onboarding 문서에 Q&A 추가 필요.

---

## 3. 영향도 매트릭스 (Severity Matrix)

| 리스크 | 발생 확률 | 영향도 | 우회 가능성 | 종합 |
|---|---|---|---|---|
| 2.1 의미적 모호성 | 高 (확정적) | 중 (가독성·인지 부하) | 낮음 (prefix 자체를 바꿔야 함) | **중-고** |
| 2.2 브랜딩 불일치 | 高 | 낮음 (문서화로 완화) | 있음 (onboarding FAQ) | 낮 |
| 2.3 63자 제한 | 중 (미래 스키마 확장 시) | **고** (silent truncate 버그) | 있음 (인덱스 명시 네이밍) | **중-고** |
| 2.4 혼합 표준 | 高 | 중 (일관성) | 있음 (컨벤션 명시) | 중 |
| 2.5 SQL 구두성 | 高 | 낮음 | 없음 (DB 네이밍 고정) | 낮-중 |
| 2.6 로그 가독성 | 高 | 낮음 | 없음 | 낮 |
| 2.7 Onboarding 비용 | 중 | 낮음 | 있음 (FAQ) | 낮 |

**최고 위험 리스크**: 2.3 (identifier 63자 제한) — silent truncate 발생 시 **production DB 마이그레이션 실패** 또는 **인덱스 누락으로 쿼리 성능 저하** 가능성. 즉각적이진 않지만 누적 리스크.

---

## 4. 반대 관점 (Steel-man) — 언제 `aid_`가 valid한가?

공정한 재검토를 위해, `aid_` 도입이 **실제 이득을 내는** 시나리오를 검토:

### 4.1 다중 프로젝트 DB 공존 시나리오

amb-starter-kit의 `amb_*` prefix는 "하나의 PostgreSQL 인스턴스에 AMB Management + 다른 프로젝트 DB가 공존" 시나리오를 전제. A-idol이 이런 상황에 놓이면?

**현실 검토**:
- A-idol의 Phase D 인프라 계획: **ECS + RDS 전용 인스턴스** (다른 프로젝트와 공존 계획 없음)
- 공존 시나리오는 실무적으로 "비용 절감 위한 개발 서버 공유" 정도. 스테이징/프로덕션은 독립.
- 개발 서버 공유 시에도 **현대적 해결책은 PostgreSQL Schema namespace** — §5에서 상술.

→ 이 시나리오는 **가능하나 비주류**, 그리고 **더 나은 대안 존재**.

### 4.2 여러 마이크로서비스가 같은 DB를 쓸 때

A-idol을 여러 마이크로서비스로 분해한 미래 시점. 각 서비스가 자기 테이블 그룹을 소유하면 구분이 필요할 수 있음.

**현실 검토**:
- 이 경우도 **서브도메인 prefix (`chat_*`, `vote_*` 등) 로 이미 해결** — §컨벤션 §4.2에 명문화
- "A-idol 프로젝트 자체" 범위에서는 `aid_` 불필요

→ 서브도메인 prefix가 이미 같은 문제를 저렴하게 해결.

### 4.3 외부 DW / BI 시스템 통합 시

BI 도구가 여러 소스를 통합해서 테이블명이 `source_table` 형태로 합쳐지는 경우.

**현실 검토**:
- 대부분 BI 도구는 **소스별 schema / database 구분**을 이미 제공. 테이블 prefix는 과거 해결책.
- BigQuery, Snowflake, Redshift 모두 dataset/schema 레이어 지원.

→ 외부 도구 호환성 이유로 prefix 강제할 필요 없음.

### 4.4 Steel-man 결론

`aid_`가 실제 이득을 내는 시나리오는 **모두 더 나은 대안이 존재**. 리스크만 있고 고유 가치 없음.

---

## 5. 더 나은 대안 — PostgreSQL Schema Namespace

`aid_` 같은 테이블 prefix가 해결하려는 **"다중 프로젝트 공존 시 네임스페이스 분리"** 니즈는, **PostgreSQL native schema 기능**으로 근본적 해결이 가능:

### 5.1 Schema 기반 분리 예시

```sql
-- A-idol 전용 schema 생성
CREATE SCHEMA idol AUTHORIZATION aidol;

-- 테이블은 schema 하위에 위치
CREATE TABLE idol.users (...);
CREATE TABLE idol.idols (...);

-- 앱 접속 시 search_path 설정
SET search_path TO idol, public;
```

### 5.2 Prisma에서 schema 사용

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["idol"]
}

model User {
  id String @id @default(uuid())
  @@schema("idol")
  @@map("users")         // 테이블 이름 그대로 "users" 유지
}
```

### 5.3 `aid_` prefix 대비 장점

| 기준 | Table prefix (`aid_`) | Schema namespace (`idol.`) |
|---|---|---|
| 다중 프로젝트 격리 | ✅ | ✅ |
| 테이블명 원형 보존 | ❌ (`aid_users`) | ✅ (`users`) |
| SQL 구두성 | 쿼리마다 `aid_` 반복 | `search_path`로 생략 가능 |
| Postgres 권한 분리 | 불가 (테이블 단위) | ✅ (schema 단위 GRANT/REVOKE) |
| 백업/복원 범위 지정 | `pg_dump -t 'aid_*'` | `pg_dump -n idol` (더 깔끔) |
| 식별자 길이 부담 | +4자 누적 | 0자 (schema는 별도 namespace) |
| 언어적 의미 부담 | "aid" = 도움 혼동 | "idol" schema 이름에만 | 

### 5.4 전환 시기 (If/When)

- **지금 당장**: 필요 없음. 현재 단일 DB, 단일 프로젝트.
- **Phase D 스테이징 도입 시**: 여전히 필요 없음. RDS 인스턴스 분리로 해결.
- **Phase E+ 다중 서비스 공존 시**: **이때 schema namespace 도입 검토** — 테이블 prefix가 아님.

---

## 6. 수정된 결론 (Revised Conclusion)

### 6.1 Stance 변경

| 이전 (RPT-260424-C §2.5) | 재검토 후 (본 리포트) |
|---|---|
| ⚠️ **조건부 가능** ("반기+ 내 타 프로젝트 공존 확정 시 재검토") | ❌ **미권고** (의미 모호·63자 리스크·혼합 표준 등 7 risks; 다중 DB 요구 시에도 schema namespace가 우월) |

### 6.2 정식 권고

1. **`aid_` 전역 prefix 도입 금지** — 현재·미래 어느 시점에도 부적합
2. **현재 정책 유지** — 전역 prefix 없음 + 서브도메인 prefix 권장 (`a-idol-code-convention.md §4.2`)
3. **다중 프로젝트 공존 요구 발생 시** — PostgreSQL Schema namespace 도입을 우선 검토. 테이블 prefix는 최후의 수단
4. **컨벤션 §16 편차표 강화** — "전역 prefix 미도입"의 이유로 단순 "단일 DB"가 아니라 "**aid_ 등 대안 검토 결과 리스크 > 이득, PostgreSQL schema가 더 근본적 해결책**"으로 근거 명확화

### 6.3 컨벤션 및 CLAUDE.md 갱신 제안

현행 편차표의 `idol_` 언급을 `aid_` 대안까지 포괄하도록 확장:

| 변경 전 | 변경 후 |
|---|---|
| "Project-wide `idol_` would collide with `idols` entity" | "Project-wide prefix (`idol_` collides with `idols` entity; `aid_` introduces 7 risks including PostgreSQL 63-char identifier limit — see RPT-260424-D). Schema namespace is preferred if multi-project isolation is ever needed." |

---

## Appendix A — Postgres Identifier Length 실측 (현행 스키마)

`packages/backend/prisma/schema.prisma`의 모든 `@@index`, `@@unique`, `@@id`, FK 자동 생성 이름을 Prisma 기본 규칙(`{table}_{cols}_idx` / `_key` / `_fkey` / `_pkey`)으로 계산한 실측:

| 식별자 (Top 10) | 길이 | `aid_` 적용 후 |
|---|---|---|
| `round_vote_ticket_ledger_user_id_round_id_created_at_idx` | **56** | **60** ⚠️ |
| `audition_entries_audition_id_idol_id_key` | 41 | 45 |
| `round_vote_ticket_balances_user_id_round_id_pkey` | 49 | 53 |
| `round_ranking_snapshots_round_id_snapshot_at_idx` | 48 | 52 |
| `chat_rooms_user_id_last_message_at_idx` | 38 | 42 |
| `auto_message_templates_idol_id_scheduled_at_idx` | 48 | 52 |
| `purchase_transactions_provider_provider_tx_id_key` | 49 | 53 |
| `vote_ticket_ledger_user_id_created_at_idx` | 42 | 46 |
| `chat_coupon_ledger_user_id_created_at_idx` | 42 | 46 |
| `votes_user_id_round_id_created_at_idx` | 38 | 42 |

**위험 구간**: 60-63자 — `aid_` 적용 시 1건이 이미 60자 도달, 한 컬럼 추가된 인덱스는 즉시 64자+ 위험.

---

## Document History (문서 이력)

| Version | Date | Author | Changes |
|---|---|---|---|
| v1.0 | 2026-04-24 | Gray Kim | 초기 작성 — RPT-260424-C §2.5의 `aid_` "조건부 가능" 판정 재검토. 7가지 리스크 식별, PostgreSQL Schema namespace 대안 제안, 결론을 "미권고"로 변경 |
