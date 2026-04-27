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
