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
| Target MVP | 2026-08-29 (약 19주) |
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
- `../a-idol-wbs.xlsx` — WBS & Test Cases (Excel)

### Stage 4 — Test (테스트)
- Test cases are tracked inside `a-idol-wbs.xlsx` → sheet `TestCases`

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
