---
document_id: A-IDOL-WBS-1.0.0
version: 1.0.0
status: Draft
created: 2026-04-18
updated: 2026-04-18
author: Gray Kim
---

# A-idol — WBS (작업분해구조)

Excel 포맷: [`../../a-idol-wbs.xlsx`](../../a-idol-wbs.xlsx) (필터/정렬/간트 조회 편의 용도).

## Task Convention (작업 규칙)

- ID: `T-XXX` (3자리 증가). 하위 태스크는 `T-XXX.n`.
- 각 Task → GitHub Issue, 라벨: `task`, `stage:{phase}`, `area:{module}`, `priority:{P0|P1|P2}`.
- Branch: `feature/{gh-issue}-{kebab}`.
- Effort: 이상적 개발일 단위(1d = 1 person-day).

## Phases & Top-level Tasks (Top-level만 요약, 상세는 xlsx 참조)

### Phase 0 — Setup (W1-W2)

| ID | Task | Area | Priority | Effort | Depends |
|----|------|------|----------|--------|---------|
| T-001 | Monorepo scaffolding (pnpm workspace) | infra | P0 | 1d | - |
| T-002 | Shared domain package (`@a-idol/domain`) | shared | P0 | 2d | T-001 |
| T-003 | NestJS backend skeleton + config/logging | backend | P0 | 2d | T-001 |
| T-004 | PostgreSQL + Redis docker-compose, Prisma init | backend | P0 | 1d | T-003 |
| T-005 | RN app scaffolding + TS strict + nav | mobile | P0 | 2d | T-001 |
| T-006 | CMS (Vite/React) scaffolding + auth shell | cms | P0 | 2d | T-001 |
| T-007 | GitHub Actions CI (lint/test/build) | devops | P0 | 2d | T-003,T-005,T-006 |
| T-008 | Environments + secrets mgmt + ECS skeleton | devops | P0 | 3d | T-004,T-007 |
| T-009 | Identity module — signup/login (email+social) | backend | P0 | 4d | T-004 |
| T-010 | Mobile auth screens + keychain | mobile | P0 | 3d | T-005,T-009 |
| T-011 | CMS auth + RBAC base | cms | P0 | 2d | T-006,T-009 |

### Phase A — Catalog & Fandom (W3-W6)

| ID | Task | Area | Priority | Effort | Depends |
|----|------|------|----------|--------|---------|
| T-020 | Catalog module (idols, agencies, media, schedules) | backend | P0 | 4d | T-009 |
| T-021 | Fandom module (hearts, follows) | backend | P0 | 2d | T-020 |
| T-022 | Fan club + membership domain | backend | P0 | 3d | T-020 |
| T-023 | Mobile idol list & detail screens | mobile | P0 | 4d | T-020 |
| T-024 | Mobile heart/follow interactions | mobile | P0 | 2d | T-021 |
| T-025 | Mobile fan club join flow | mobile | P0 | 3d | T-022 |
| T-026 | CMS Idol/Agency CRUD | cms | P0 | 5d | T-020 |
| T-027 | CMS Auto-message template manager | cms | P0 | 3d | T-022 |
| T-028 | Seed data: 99 idols + 1 agency | content | P0 | 2d | T-026 |

### Phase B — Chat & Commerce (W7-W11)

| ID | Task | Area | Priority | Effort | Depends |
|----|------|------|----------|--------|---------|
| T-040 | Chat module (rooms, messages) + WS gateway | backend | P0 | 5d | T-022 |
| T-041 | Chat coupon logic + daily reset job | backend | P0 | 3d | T-040 |
| T-042 | Auto-message dispatcher (BullMQ cron) | backend | P0 | 3d | T-041 |
| T-043 | Mobile chat room UI + WS client | mobile | P0 | 5d | T-040 |
| T-044 | Commerce module (orders, receipts, IAP verify) | backend | P0 | 5d | T-009 |
| T-045 | Photo card module (sets, items, draw) | backend | P0 | 3d | T-044 |
| T-046 | Mobile IAP integration (StoreKit/Billing) | mobile | P0 | 4d | T-044 |
| T-047 | Mobile photo card shop + draw + collection | mobile | P0 | 4d | T-045,T-046 |
| T-048 | Instagram share + watermark generator | backend+mobile | P1 | 3d | T-047 |
| T-049 | CMS Photo Card Sets manager | cms | P0 | 3d | T-045 |

### Phase C — Audition (W12-W15)

| ID | Task | Area | Priority | Effort | Depends |
|----|------|------|----------|--------|---------|
| T-060 | Audition + Round domain | backend | P0 | 3d | T-020 |
| T-061 | VoteRule + weight validator | backend | P0 | 2d | T-060 |
| T-062 | Vote ticket purchase flow | backend | P0 | 2d | T-044 |
| T-063 | Cast vote use case + Redis counter | backend | P0 | 3d | T-060,T-062 |
| T-064 | Ranking aggregation cron | backend | P0 | 3d | T-063 |
| T-065 | Mobile audition overview + round vote screens | mobile | P0 | 5d | T-063 |
| T-066 | Mobile vote ticket shop | mobile | P0 | 2d | T-062 |
| T-067 | CMS Audition/Round/VoteRule managers | cms | P0 | 5d | T-060,T-061 |
| T-068 | CMS Dashboard (votes/revenue/users) | cms | P0 | 5d | T-044,T-063 |

### Phase D — Stabilization (W16-W19)

| ID | Task | Area | Priority | Effort | Depends |
|----|------|------|----------|--------|---------|
| T-080 | Observability (OTel, Sentry, Datadog) | devops | P0 | 3d | T-008 |
| T-081 | Load test (JMeter/k6) — 50k concurrent | devops | P0 | 3d | T-080 |
| T-082 | Security review (OWASP ASVS L2) | qa | P0 | 4d | * |
| T-083 | Accessibility audit (WCAG AA) | qa | P0 | 2d | * |
| T-084 | Integration/regression test (ITC-001~) | qa | P0 | 5d | * |
| T-085 | App Store / Play Console submission prep | release | P0 | 3d | T-084 |
| T-086 | Go-live runbook + incident playbook | devops | P0 | 2d | T-080 |
| T-087 | Customer support workflow + FAQ | cs | P1 | 2d | * |
| T-088 | CMS 프로젝트 관리 메뉴 (ADR/설계/WBS/산출물 통합) | cms | P1 | 1d | T-086 |
| T-089 | Request DTO snake_case migration (ADR-023) | backend+cms+mobile | P1 | 5d | T-082 |

**Phase D 진행 상황 (2026-04-27 기준)**:

| ID | 진행 | 비고 |
|---|---|---|
| T-080 | 🟢 95% | Prometheus `/metrics` + 3 RED + 2 auth metrics + Node process metrics + **3축 Sentry SDK 통합** (Backend/CMS/Mobile 모두 graceful no-op). **남은 항목**: Sentry SaaS DSN 3개 발급(외부) → 환경변수 주입만 |
| T-081 | 🟡 50% | ab smoke + perf baseline + 5단계 k6 ramp 정의. **남은 항목**: staging 인프라 후 본 측정 (2026-07-08 ETA) |
| T-082 | 🟢 97% | helmet + CSP + global throttle + admin auth full audit + admin session DB + NIST password blocklist + HIBP + account lockout + unlock endpoint + 5xx capture + Sentry. **남은 항목**: OWASP ASVS L2 audit 회의 |
| T-083 | 🟢 70% | 모바일 모든 화면 5테마 토큰 + a11y 50+ Pressable + chat live region + contrast audit CI gate. **남은 항목**: 수동 VoiceOver/TalkBack + Dynamic Type · text3 토큰 정리 |
| T-084 | 🟢 99.5% | ITC 86 → **129** (+43) + backend unit **252** (+21: 10 photocard + 11 identity get-me/update-me/logout) + CMS Vitest+RTL 29 테스트. backend: audition state machine + parent guard, vote-weight validation, admin-ops 보안 (refresh rotation 7 reject + hash mismatch defensive revoke), chat 쿠폰/잔액/멤버십, catalog 비즈니스 룰, design-asset/project-doc CRUD+version+slug uniqueness, photocard defaults + GetSet 404, **identity get-me SESSION_NOT_FOUND, update-me partial/avatarUrl=null/empty patch, logout idempotent (verify fail/no session/already revoked/expired)**. CMS: WBS 마크다운 파서, react-markdown 렌더, zustand auth persist, apiFetch ETag 304 캐시. 합계 **281 unit + 129 ITC + 57 mobile = 467 tests pass**. |
| T-085 | 🟡 45% | [`store-submission-checklist-ko.md`](../ops/store-submission-checklist-ko.md) + **CMS 디자인 자산 관리 메뉴** (`/design-assets`, admin write / operator read, status workflow PLACEHOLDER → DRAFT → APPROVED → LEGAL_REVIEWED → SHIPPED, 10 placeholder asset seeded). **GA 단축으로 2026-07-15 1차 제출**. **남은 항목**: Apple/Play 가입 · Privacy Policy 법무 · 실제 스크린샷 자산 캡쳐 · EAS build 설정 |
| T-086 | 🟢 95% | runbook §1.4 메트릭 + §1.5 보안 + 배포 체크리스트 + **postmortem template** ([`postmortems/_TEMPLATE.md`](../ops/postmortems/_TEMPLATE.md)). **남은 항목**: 인계 미팅 |
| T-087 | 🟡 70% | cs-workflow doc + admin unlock-account endpoint + CMS unlock UI panel. **PO + 법무 검수 + Slack 채널 + support 메일함 미수행** |
| T-088 | 🟢 100% | `project_documents` 테이블 + `/api/v1/admin/project-docs` CRUD + CMS `/project` (개요·문서·산출물·WBS·태스크) + `react-markdown`. 39 문서 시드 (ADR 12 + DESIGN 7 + IMPL 6 + REPORT 9 + DELIVERABLE 5). admin 산출물 작성/편집/version 자동 증가. CRUD 스모크 통과 (201/200/204). |
| T-089 | 🟢 100% | **전체 10/10 모듈 완료**. identity / admin-ops / catalog / commerce / audition+vote / photocard / design-assets / project-docs 의 Request DTO 가 모두 snake_case (amb-starter-kit v2.0 표준). fandom + chat 은 단일 토큰 필드만이라 no-op. shared interface 9개 모두 wire shape 동기화. CMS 는 boundary transform (admin-api 가 camelCase 입력 → snake_case body) — UI form 변경 최소화. design-assets/project-docs 는 shared 타입을 직접 form state 로 사용하므로 form 도 snake_case. mobile useCommerce/useVote/AuthContext + 17 ITC spec atomic 갱신. 129/129 ITC + 57/57 mobile + 4 workspace typecheck pass. ADR-023 closed. |

## Milestones → Tasks

| Milestone | Required Tasks |
|-----------|----------------|
| M1 Setup | T-001..T-011 |
| M2 Catalog | T-020..T-028 |
| M3 Chat & Shop | T-040..T-049 |
| M4 Audition | T-060..T-068 |
| M5 GA | T-080..T-087 + regression pass |

## Estimate Summary (투입 공수 요약 — 이상적)

| Phase | Person-days |
|-------|-------------|
| Setup | 26 |
| A Catalog & Fandom | 28 |
| B Chat & Commerce | 38 |
| C Audition | 30 |
| D Stabilization | 24 |
| **Total** | **146 pd** (≒ 6명 · 24일 기준 ≒ 5개월 FTE) |
