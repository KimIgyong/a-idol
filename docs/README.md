# A-idol Project — Documentation Index (A-아이돌 프로젝트 문서 색인)

> AI 아이돌 팬덤 플랫폼 — 모바일(React Native) + CMS(React) + 백엔드(NestJS) + PostgreSQL
> Clean Architecture 기반 SDLC 산출물 모음

---

## 1. Project Snapshot (프로젝트 개요)

| Item | Value |
|------|-------|
| Project | A-idol (AI 아이돌 팬덤 플랫폼) |
| Owner | Gray Kim (gray.kim@amoeba.group) |
| Kick-off | 2026-04-18 |
| Target MVP | **2026-08-01** (약 14주, 2026-04-27 조정 — 기존 8-29에서 4주 단축) |
| Channels | Mobile App (iOS/Android via React Native) + Web CMS (React — admin only) |
| Backend | NestJS + PostgreSQL + Redis + WebSocket |
| Architecture | Clean Architecture (Entity / UseCase / Interface Adapter / Infrastructure) |
| Repo | `a-idol/` — monorepo (packages/mobile, packages/cms, packages/backend, packages/shared) |

---

## 2. Document Map (문서 구성)

### Stage 1 — Analysis (분석)
- [`analysis/a-idol-requirements.md`](analysis/a-idol-requirements.md) — Requirements Analysis (요구사항 분석서)

### Stage 2 — Design (설계)
- [`design/a-idol-architecture.md`](design/a-idol-architecture.md) — Clean Architecture & Tech Stack (아키텍처 정의서)
- [`design/a-idol-req-definition.md`](design/a-idol-req-definition.md) — Requirements Definition (요구사항 정의서)
- [`design/a-idol-func-definition.md`](design/a-idol-func-definition.md) — Functional Specification (기능 정의서)
- [`design/a-idol-ui-spec.md`](design/a-idol-ui-spec.md) — UI Specification (화면 기획서)
- [`design/a-idol-sequence.md`](design/a-idol-sequence.md) — Sequence Diagrams (시퀀스 다이어그램)
- [`design/a-idol-erd.md`](design/a-idol-erd.md) — ERD (데이터 모델)
- [`design/a-idol-policy.md`](design/a-idol-policy.md) — Policy Definition (정책 정의서)
- [`../sql/a-idol-schema.sql`](../sql/a-idol-schema.sql) — PostgreSQL DDL

### Stage 3 — Implementation (구현)
- [`implementation/a-idol-dev-plan.md`](implementation/a-idol-dev-plan.md) — Development Plan (개발 계획서)
- [`implementation/a-idol-wbs.md`](implementation/a-idol-wbs.md) — WBS (작업분해구조)
- [`implementation/a-idol-code-convention.md`](implementation/a-idol-code-convention.md) — Code Convention v1.0 (코드 컨벤션, amb-starter-kit 기반)
- `../a-idol-wbs.xlsx` — WBS & Test Cases (Excel)

### Stage 4 — Test (테스트)
- Test cases are tracked inside `a-idol-wbs.xlsx` → sheet `TestCases`
- Backend unit + integration suites in `packages/backend/test/integration/` — 현재 128 unit / 115 ITC

### Stage 5 — Operations (운영) · Phase D 산출물
- [`ops/runbook-ko.md`](ops/runbook-ko.md) — Go-live runbook + 메트릭 + 보안 헤더 + rate-limit + 변경이력 (T-086)
- [`ops/perf-baseline-ko.md`](ops/perf-baseline-ko.md) — 퍼포먼스 베이스라인 측정 (T-081)
- [`ops/k6-staging-runbook-ko.md`](ops/k6-staging-runbook-ko.md) — k6 staging 본 측정 절차 (T-081)
- [`ops/staging-infra-checklist-ko.md`](ops/staging-infra-checklist-ko.md) — staging 인프라 + Sentry 통합 + 50k 부하 측정 critical path (T-080/T-081)
- [`ops/a11y-mobile-baseline-ko.md`](ops/a11y-mobile-baseline-ko.md) — 모바일 a11y 1차 + 컬러 컨트라스트 audit + CI gate (T-083)
- [`ops/store-submission-checklist-ko.md`](ops/store-submission-checklist-ko.md) — Apple/Play 제출 체크리스트 + Privacy Manifest (T-085)
- [`ops/apple-developer-program-checklist-ko.md`](ops/apple-developer-program-checklist-ko.md) — Apple Developer Program 가입 절차 (T-085)
- [`ops/dependency-approval-jose-ko.md`](ops/dependency-approval-jose-ko.md) — `jose` 의존성 승인 brief (Apple IAP)
- [`ops/design-leaderboard-full-cache-ko.md`](ops/design-leaderboard-full-cache-ko.md) — Leaderboard full cache 설계
- [`support/cs-workflow-ko.md`](support/cs-workflow-ko.md) — 고객지원 워크플로우 (환불/탈퇴/복구/결제이상/신고/채팅차단) (T-087)
- [`support/faq-ko.md`](support/faq-ko.md) — 지원팀 응답 템플릿 (포토카드 / 결제 등)

### Legal (법무)
- [`legal/youth-payment-limit-brief-ko.md`](legal/youth-payment-limit-brief-ko.md) — 청소년 결제 한도 브리프 (POL-006)

### Reports (리포트)
- [`report/RPT_260424_prisma-vs-typeorm.md`](report/RPT_260424_prisma-vs-typeorm.md) — Prisma vs TypeORM 비교 분석 (amb-starter-kit 편차 사유)
- [`report/RPT_260424_db-naming-compliance.md`](report/RPT_260424_db-naming-compliance.md) — DB 네이밍 준수율 감사 (A-idol Prisma 스키마 vs amb-starter-kit §4)
- [`report/RPT_260424_naming-prefix-tradeoff.md`](report/RPT_260424_naming-prefix-tradeoff.md) — `idol_` 테이블 prefix + 컬럼 3자 prefix 도입 시 장단점 분석
- [`report/RPT_260424_aid-prefix-reexamination.md`](report/RPT_260424_aid-prefix-reexamination.md) — `aid_` 전역 prefix 재검토 (7 risks, 결론 변경: "조건부 가능" → "미권고")
- [`report/RPT_260424_current-structure-spec.md`](report/RPT_260424_current-structure-spec.md) — 현재 구조 · API(95) · 서비스 · 기술 스택 · 포트 종합 스펙 스냅샷

### Kickoff Deck (킥오프 자료)
- `../a-idol-kickoff.pptx`

---

## 3. ID Convention (식별자 규칙)

| Prefix | Meaning | Example |
|--------|---------|---------|
| `FR-` | Functional Requirement | FR-001 |
| `NFR-` | Non-Functional Requirement | NFR-001 |
| `FN-` | Function Specification | FN-011 |
| `SCR-` | Screen / UI | SCR-MOB-001 / SCR-CMS-001 |
| `SEQ-` | Sequence Scenario | SEQ-001 |
| `POL-` | Policy | POL-001 |
| `T-` | WBS Task | T-001 |
| `TC-` | Test Case | TC-001 |
| `ITC-` | Integration Test Case | ITC-001 |

Traceability runs `FR → FN → SCR / SEQ / ERD → T → TC → ITC`.
