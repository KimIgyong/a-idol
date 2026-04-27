---
document_id: A-IDOL-DEVPLAN-2.0.0
version: 2.0.0
status: Draft
created: 2026-04-18
updated: 2026-04-18
author: Gray Kim
reviewers: []
change_log:
  - version: 1.0.0
    date: 2026-04-18
    author: Gray Kim
    description: Initial draft — high-level schedule + environments
  - version: 2.0.0
    date: 2026-04-18
    author: Gray Kim
    description: >
      전면 개정 v2. 아키텍처 결정사항(ADR-001..009)과 Tech Stack 채택 근거 정리,
      Sprint(2주) × 10회 구조로 일정 재편, Critical Path·Milestone Exit Criteria 강화,
      Risk 레지스터 확장, Bilingual(KR/EN) 병기.
---

# A-idol — Development Plan v2 (A-아이돌 개발계획서)

> 본 문서는 **무엇을 언제 어떻게 만들 것인가 (What / When / How)** 를 요약한다.
> 상세 테스트·운영 규정은 별도 문서(테스트 계획, 릴리즈 플레이북)로 관리.
> This document answers **what, when, and how** we build A-idol.
> Detailed test plans and release playbooks are maintained separately.

---

## 1. Overview (개요)

| 항목 | 내용 |
|------|------|
| **Project** | A-idol — AI 아이돌 팬덤 플랫폼 (Mobile + Admin CMS) |
| **Owner** | Gray Kim ([gray.kim@amoeba.group](mailto:gray.kim@amoeba.group)) |
| **Development Window** | **2026-04-20 ~ 2026-08-01** (약 14주, 2026-04-27 4주 단축 조정 — 기존 19주/10 sprint) |
| **GA Target (상용)** | **2026-08-01** (M5; 기존 2026-08-29에서 단축) |
| **Team (Target)** | 총 8명 — PM 1, Backend 2, Mobile(RN) 2, CMS(React) 1, QA 1, DevOps 1 |
| **Delivery Channels** | iOS (App Store), Android (Google Play), Admin CMS (web) |
| **Primary Docs** | Analysis → Design(Req-Def / Func / ERD v2 / Sequence / Policy) → Dev Plan + WBS |

---

## 2. Technical Architecture Decisions (기술·아키텍처 결정사항)

### 2.1 Architecture Style

**Clean Architecture (Hexagonal)** 을 백엔드·모바일 공통 원칙으로 채택한다.
- 의존성 규칙: `Entity (domain) → UseCase (application) → Interface Adapter → Infrastructure`.
- 프레임워크(NestJS / React Native / Prisma)는 **가장 바깥 레이어**에만 존재.
- UseCase 는 in-memory fake repository 만으로 **단위 테스트 가능**해야 한다.

Rationale (채택 이유):
- MVP 이후 Phase 2(라이브 스트리밍, LLM 채팅) 확장 시 infrastructure 교체 비용 최소화.
- 핵심 도메인 로직이 플랫폼(모바일·웹·CMS)에 독립 → `@a-idol/shared` 패키지로 공유 가능.

### 2.2 Tech Stack (기술 스택 요약)

| Layer | Technology | Version / Note | 채택 근거 |
|-------|-----------|----------------|----------|
| **Mobile** | React Native | 0.74 LTS, TS strict | iOS/Android 단일 코드, 기존 팀 경험, Hermes JIT |
| Mobile Nav | `@react-navigation/native` | v7 | RN 표준 |
| Mobile State | `zustand` + `@tanstack/react-query` | v5 | UI state 는 Zustand, 서버 캐시는 RQ — 명확한 분리 |
| Mobile Styling | **NativeWind** | Tailwind based | Tamagui vs NW 비교(ADR-001) → NW 선택: CMS(Tailwind)와 스타일 토큰 공유 용이 |
| Mobile IAP | `react-native-iap` | v13 | Apple/Google 단일 래퍼, 영수증 송수신 최신 호환 |
| Mobile WS | `socket.io-client` | v4 | NestJS gateway 와 쌍, Redis 어댑터 지원 |
| **CMS** | React 18 + Vite | TS strict | HMR 성능, ESM |
| CMS UI | shadcn/ui + Tailwind | | 접근성 기본 제공, 커스터마이징 용이 |
| CMS Data | `@tanstack/react-query` + `react-hook-form` + `zod` | | 폼 + 서버 상태 관리 표준 |
| **Backend** | NestJS 10 | Node 20 LTS | 모듈러 DI, TS-first, decorator 기반 — Clean Arch 매핑 용이 |
| Backend ORM | **Prisma 5** | PG 16 | ADR-003: 타입 안전성 우선, Kysely/TypeORM 대비 마이그레이션 편의성 |
| Backend Auth | Passport + JWT(15m) + Refresh(14d rotating) | | OAuth 2.0 + 토큰 회전, reuse detection |
| Backend WS | `@nestjs/websockets` + socket.io + Redis 어댑터 | | 수평 확장 |
| Backend Queue | **BullMQ** on Redis | | 푸시, 결제 검증, 투표 집계 배치 |
| Backend Obs | OpenTelemetry + Datadog + Sentry | | 표준 분산 추적 |
| **Data** | PostgreSQL 16 + Redis 7 | | 트랜잭션 + 정합성 투표용 DB, 랭킹·캐시·pubsub 에 Redis |
| **Object Storage** | S3 + CloudFront | Pre-signed upload | Lambda 리사이즈(ADR-005) |
| **Infra** | ECS Fargate | ADR-002: EKS 대비 운영 부담↓ | DevOps 합류 후 재검토 가능 |
| **CI/CD** | GitHub Actions + EAS Build (RN) + ECR/ECS Blue-Green | | 프론트·백엔드·모바일 세 파이프라인 분리 |
| **External** | Kakao/Apple/Google OAuth, FCM+APNS, App Store IAP, Google Play Billing, (Phase 2) SMS gateway | | ADR-004: MVP 문자 투표 스텁 |

### 2.3 Architecture Decision Records (ADR 요약)

| ID | Title | Status | Decision Summary |
|----|-------|--------|------------------|
| **ADR-001** | Mobile Styling — NativeWind vs Tamagui | **Accepted** | NativeWind 채택. Web(Tailwind) 과 토큰 공유, 런타임 성능 동등, 팀 숙련도. |
| **ADR-002** | Orchestration — ECS Fargate vs EKS | **Accepted** | ECS Fargate. MVP 운영 인력(DevOps 1명) 제약 하 운영 비용 최저. Phase 2 에서 EKS 재평가. |
| **ADR-003** | ORM — Prisma vs Kysely | **Accepted** | Prisma 5 채택. 타입 생성/마이그레이션 편의성, 팀 경험. |
| **ADR-004** | SMS Vote — MVP 스텁 처리 | **Accepted** | 결선 이전에 통신사 연동 확정 전까지 `SMS` 타입은 데이터 모델에만 존재(가중치 0 or 실구현 전까지 집계 제외). |
| **ADR-005** | Image Pipeline — S3 원본 + Lambda 리사이즈 | **Accepted** | 원본 보관 + `eager/lazy` 썸네일 Lambda 생성. CloudFront 캐싱. |
| **ADR-006** | AI Chat Engine (MVP → Phase 2) | **Pending** | MVP: 룰 기반 응답 풀 + 키워드 매칭. Phase 2: Anthropic Claude API 연동 평가(OI-002). |
| **ADR-007** | Photocard Share Method | **Pending** | Phase 1: OS Share Sheet + 워터마크 이미지. Phase 2: Instagram Basic Display API 검토. |
| **ADR-008** | Monorepo Tooling — pnpm workspaces | **Accepted** | Turborepo 은 도입 보류(캐시 이점 작음), pnpm 네이티브만으로 충분. |
| **ADR-009** | DB Naming Convention — Amoeba v2 | **Accepted** | `aidol_` prefix + `{colPrefix}_name` — `docs/reference/amoeba_code_convention.md` 참조. Prisma `@map` 로 JS 사이드 camelCase 유지. |

ADR 변경/추가는 `docs/adr/ADR-XXX-<slug>.md` 로 관리.

### 2.4 Bounded Contexts (도메인 경계 맥락)

| Context | 책임 | 핵심 Aggregates |
|---------|------|----------------|
| **Identity** | 회원·인증·세션·약관동의 | `User`, `AuthSession`, `ConsentLog` |
| **Catalog** | 아이돌 프로필·소속사·스케줄·미디어 | `Idol`, `Agency`, `IdolSchedule`, `IdolPhoto` |
| **Fandom** | 좋아요·팔로우·팬클럽·멤버십 | `Heart`, `Follow`, `FanClub`, `Membership` |
| **Chat** | 1:1 아이돌 채팅·쿠폰·자동메시지·모더레이션 | `ChatRoom`, `ChatMessage`, `ChatCoupon`, `AutoMessageTemplate` |
| **Audition** | 예선/결선·투표권·집계·진출자 결정 | `Audition`, `Round`, `Vote`, `VoteRule`, `IdolAuditionEntry` |
| **Commerce** | IAP 영수증 검증·포토카드 판매·환불 | `PurchaseTransaction`, `PhotoCardSet`, `PhotoCardItem`, `UserInventory` |
| **Gamification** | 팬 레벨·XP·스트릭 | `UserLevelStats`, `XpTransaction`, `FanLevel` |
| **Notification** | FCM/APNS 푸시·인앱 알림 | `DeviceToken`, `Notification` |
| **AdminOps** | CMS — RBAC, 통계, 감사로그, 리포트 | `AdminUser`, `Role`, `AuditLog`, `ModerationReport` |

> ERD v2.0.0(`docs/design/a-idol-erd.md`)의 테이블 `aidol_*` 은 위 컨텍스트로 귀속된다.

---

## 3. Repository & Development Environment (레포·개발 환경)

### 3.1 Monorepo Layout

```
a-idol/
├─ packages/
│  ├─ shared/              # @a-idol/shared — 도메인 엔티티 + DTO (플랫폼 무관)
│  ├─ backend/             # @a-idol/backend — NestJS API
│  ├─ mobile/              # @a-idol/mobile — React Native app (예정, Sprint 1)
│  └─ cms/                 # @a-idol/cms — React CMS SPA (예정, Sprint 1)
├─ docs/                   # SDLC artifacts (analysis / design / implementation / reference)
├─ sql/                    # DDL 참조 (실행은 Prisma migrate 로)
├─ .claude/commands/       # 슬래시 커맨드 템플릿
├─ docker-compose.yml
├─ Makefile
└─ pnpm-workspace.yaml
```

### 3.2 Branch Strategy (Git Flow 변형)

```
main       ← production — 릴리즈 태그만
develop    ← integration — PR merge 시 dev 자동 배포
feature/{gh-issue}-{kebab}     # 기능
bugfix/{gh-issue}-{kebab}      # 버그 수정
hotfix/{version}-{kebab}       # 운영 핫픽스
docs/{gh-issue}-{kebab}        # 문서 변경
```

- Conventional Commits. Scope 는 context: `feat(chat)`, `fix(identity)`, `docs(wbs)`.
- PR 머지: squash. 2 approval + CI green + 문서 업데이트 체크.

### 3.3 Environments

| Env | 목적 | DB | 배포 |
|-----|------|-----|------|
| **local** | 개발자 PC | docker-compose postgres/redis | `make dev` |
| **dev** | 통합 개발 | RDS dev (single-AZ) | CI auto-deploy on `develop` push |
| **staging** | QA + 부하/시나리오 | RDS staging (prod anonymized seed) | RC 태그 수동 승격 |
| **prod** | 상용 | RDS prod (multi-AZ + read replica) | Release 태그 + 2인 승인 수동 |

### 3.4 CI/CD

- **Mobile**: GitHub Actions → `pnpm lint` → `pnpm test` → EAS Build → TestFlight(Apple) / Internal Track(Google).
- **CMS**: GHA → build → S3 sync → CloudFront invalidation.
- **Backend**: GHA → docker build → ECR → ECS Blue/Green via CodeDeploy (staging 자동, prod 수동 승인).
- **DB Migration**: `prisma migrate deploy` — staging 자동, prod 수동(슬래시 커맨드 `make migrate:prod`).

### 3.5 Coding Standards

- ESLint + Prettier + commitlint.
- Husky pre-commit: `typecheck` + `lint` + 변경 파일 unit test.
- PR 템플릿: Summary / Test plan / Screenshots / Refs 이슈 / 트레이서빌리티 (FR/FN 링크).

---

## 4. Schedule — Sprints & Milestones (일정)

총 **15주 = Setup(2w) + Phase A(4w) + Phase B(5w) + Phase C(2w) + GA Hardening(2w)**.
2026-04-27 GA 단축으로 sprint replan: Phase D 별도 sprint 분리 대신 critical
path 작업만 추출하여 GA Hardening 2주에 집중. Sprint 2주 단위.

### 4.1 High-Level Roadmap (2026-04-27 replan)

| Phase | Sprint | Weeks | Dates | Focus | Milestone |
|-------|--------|-------|-------|-------|-----------|
| **0. Setup** | S0 | W1–W2 | 2026-04-20 ~ 2026-05-02 | Repo / CI / Identity / CMS skeleton / Mobile scaffolding | **M1 Setup Complete** |
| **A. Catalog & Fandom** | S1 | W3–W4 | 2026-05-04 ~ 2026-05-16 | Catalog API, 아이돌 CRUD(CMS), Mobile List/Detail | — |
| | S2 | W5–W6 | 2026-05-18 ~ 2026-05-30 | Hearts / Follows / Fan Club + Mobile interaction | **M2 Catalog & Fandom** |
| **B. Chat & Commerce** | S3 | W7–W8 | 2026-06-01 ~ 2026-06-13 | Chat WS gateway + Coupon + Auto-message + CMS | — |
| | S4 | W9–W10 | 2026-06-15 ~ 2026-06-27 | IAP verify + Photocard module + Mobile shop | — |
| | S5 | W11 | 2026-06-29 ~ 2026-07-04 | 통합 · Instagram share · 버그 bash | **M3 Chat & Shop** |
| **C. Audition** | S6 | W12–W13 | 2026-07-06 ~ 2026-07-18 | Audition / Round / VoteRule 도메인 + Vote cast + Redis counter + CMS 대시보드 (S6+S7 통합 압축) | **M4 Audition Ready** (2026-07-18) |
| **GA Hardening** | S7 | W14 | 2026-07-20 ~ 2026-07-25 | k6 50k staging 본 측정 · App Store/Play 1차 제출 (07-15부터 자료 준비) · Privacy Policy 법무 finalize · OAuth provider 등록 | — |
| | S8 | W15 | 2026-07-27 ~ 2026-08-01 | 스토어 심사 통과(buffer) · prod 인프라 · 통합 QA · GA 출시 | **M5 GA (Release)** 2026-08-01 |

**핵심 변경 사항**:
- S6+S7 통합 (4주 → 2주) — Vote/Redis counter 작업이 이미 phase D 진행 중인 metrics + lockout과 병렬 진행 중
- ~~원 S8 Stabilization~~: Phase D 95% 완료 상태 → GA Hardening 2주에 critical path만
- M4 → M5 buffer 2주 (스토어 심사 1주 + 추가 1주)

### 4.2 Milestones & Exit Criteria (마일스톤·출시 요건)

| ID | Name | Target Date | Exit Criteria |
|----|------|-------------|---------------|
| **M1** | Setup Complete | 2026-05-02 | CI/CD 3축(Backend·Mobile·CMS) green; email/social 로그인 E2E; dev 환경 자동 배포; `make smoke` 통과 |
| **M2** | Catalog & Fandom | 2026-05-30 | FR-010..024 완료; 99 아이돌 시드; 모바일 프로필/하트/팔로우/팬클럽 가입 E2E; CMS Idol CRUD |
| **M3** | Chat & Shop | 2026-07-04 | FR-030..042 + FR-070..073 완료; 채팅 WS 10k 동시성 부하 통과; IAP sandbox 검증; 포토카드 가차 E2E |
| **M4** | Audition Ready | 2026-07-25 (조정) | FR-050..056 + FR-140..150 완료; 예선 1개 라운드 운영 시뮬레이션 성공; Redis counter ≤50ms; 가중치 검증 자동화 |
| **M5** | GA (Release) | **2026-08-01** (4주 단축) | ITC-001~ 전체 PASS; App Store + Google Play 심사 통과; 개인정보 처리방침/환불 정책 공개; 운영 런북 검수 완료 |

### 4.3 Critical Path (크리티컬 패스)

병렬 진행이 불가능한 선형 의존 — 슬립 시 GA 에 직접 영향:

```
T-001 monorepo
 → T-003 NestJS skeleton
 → T-009 Identity usecase
 → T-020 Catalog API        ──┐
 → T-022 FanClub/Membership  ─┤
 → T-040 Chat WS             ─┤
 → T-044 Commerce / IAP verify ─┤
 → T-063 Vote cast + Redis    ─┤
 → T-081 Load test 50k      ────┘
 → T-084 Integration QA
 → T-085 Store submission
 → GA
```

> 크리티컬 패스 작업은 최소 2인 커버리지 유지 (bus factor ≥ 2).

### 4.4 Sprint Composition (Sprint 구성 원칙)

- 스프린트 1회 = **2주 (10 working days)**, 80% 목표 완주, 20% 버퍼.
- 각 스프린트 출력물:
  1. PR → develop 머지 + dev 배포
  2. 해당 FR 의 단위/통합 테스트
  3. 사용자 시나리오 데모 (Weekly Demo 금 15:00)
  4. 문서 업데이트 (FR 트레이서빌리티 매트릭스)
- **Definition of Ready (DoR)**: 요구사항 FR/FN ID 매핑 완료, 수락 기준, 디자인 링크, 테스트 데이터 정의.
- **Definition of Done (DoD)**: 단위 테스트 통과, 코드 리뷰 2 approvals, 문서 업데이트, 스테이징 smoke 통과, AC 체크 완료.

---

## 5. Work Breakdown (WBS 연동)

상세 작업은 별도 문서 → [`a-idol-wbs.md`](a-idol-wbs.md) + `a-idol-wbs.xlsx`.

### 5.1 Phase → Top-Level Tasks (요약)

| Phase | Task Range | 요약 |
|-------|------------|------|
| Setup | T-001 .. T-011 | Repo, Shared domain, NestJS/RN/CMS skeleton, CI, Identity |
| A. Catalog & Fandom | T-020 .. T-028 | Catalog + Fandom 모듈, Mobile Home/Profile, CMS Idol CRUD, Seed |
| B. Chat & Commerce | T-040 .. T-049 | Chat WS + Coupon + Auto message, Commerce(IAP), Photocard, Mobile 쇼핑 |
| C. Audition | T-060 .. T-068 | Audition/Round/VoteRule + 집계 + Mobile Audition + CMS 운영 |
| D. Stabilization | T-080 .. T-087 | Gamification (Level/XP), Observability, Load test, Security, Accessibility, Store submission |
| **(New) Gamification** | **T-090 .. T-095** | Fan Level (FR-080..084) — XP grant, streak, level dashboard, benefit activation |

### 5.2 Added Tasks — Gamification (신규 태스크 블록)

> FR-080..084 를 별도 섹션으로 명시(M5 근접에 배치). 기존 T-001..T-087 구조 유지.

| ID | Task | Area | Priority | Effort | Depends |
|----|------|------|----------|--------|---------|
| T-090 | XP domain + grant use case (`GrantXpUseCase`) | backend | P0 | 3d | T-009, T-020 |
| T-091 | XP activity config 로딩 + 쿨다운 캐시 | backend | P0 | 2d | T-090 |
| T-092 | Streak tracker + 마일스톤 보상 지급 | backend | P0 | 2d | T-090 |
| T-093 | Mobile Level Badge + MyPage Level Widget | mobile | P1 | 3d | T-090 |
| T-094 | CMS XP Config + Level Distribution dashboard | cms | P1 | 3d | T-090 |
| T-095 | Level Benefit Activation (채팅 쿼터 보너스 등) | backend | P0 | 2d | T-090, T-041 |

### 5.3 Effort Summary (공수 요약, 이상적 개발일)

| Phase | Person-days |
|-------|-------------|
| Setup | 26 |
| A. Catalog & Fandom | 28 |
| B. Chat & Commerce | 38 |
| C. Audition | 30 |
| Gamification (신규) | 15 |
| D. Stabilization | 24 |
| **Total** | **161 pd** (≒ 6 FTE × 27 일 ≒ 5.4개월) |

> 팀 규모 8명 중 엔지니어링 인원 6명 + QA/DevOps 에 의한 병행 작업을 가정.

---

## 6. Risk Management (리스크 관리)

### 6.1 Risk Register (리스크 레지스터)

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|----|------|-----------|--------|-----------|-------|
| **R-01** | 앱스토어 / Play 심사 지연 | H | H | 제출 2주 전 TestFlight/Alpha 사전 심사. 개인정보 처리방침 / 환불 정책 선제 작성. 가이드라인 위반 리스크 사전 체크. | PM |
| **R-02** | 오디션 마감 시점 트래픽 폭주 | M | H | Redis counter + async DB write + BullMQ 집계. k6 부하테스트(W16). 투표 엔드포인트 `@Throttle(20/min)`. | Backend Lead |
| **R-03** | 결제 영수증 위조/재사용 | M | H | `purchase_transactions(platform, transaction_id) UNIQUE` + 서버 재검증 + idempotency-key. Apple/Google API 이중 확인. | Backend Lead |
| **R-04** | AI 채팅 응답 품질 불만 (룰 기반 한계) | M | M | MVP = 사전 정의 응답 풀 + 템플릿. Phase 2 LLM 전환(ADR-006). CMS 에서 응답 튜닝 가능. | PM |
| **R-05** | 99명 초기 시딩 지연 (소속사 콘텐츠) | M | M | 샘플(placeholder) 데이터로 개발 병행. 콘텐츠 계약/납품을 S0 말까지 확정. | PO |
| **R-06** | RN 버전 호환성 이슈 | L | M | RN 0.74 고정. 업그레이드는 Phase 2. 서드파티 라이브러리 호환성 매트릭스 사전 검증. | Mobile Lead |
| **R-07** | 문자투표 외부 연동 미확정 | H | M | ADR-004 — 스텁 처리. 결선(2026-08) 전 통신사 계약 확정 필요 시만 Phase 2 로 재정의. | PO |
| **R-08** | DevOps 1인 구성 → 인프라 bottleneck | H | M | 일부 스크립트(SaaS IaC, Terraform) 표준화. ECS/RDS 는 관리형으로 복잡도 최소화(ADR-002). | DevOps |
| **R-09** | WebSocket 10k 동시접속 scalability | M | H | socket.io Redis adapter, sticky session, ALB WS routing 검증. S3 단계 부하테스트. | Backend Lead |
| **R-10** | 팬레벨 남용(어뷰징) | M | L | 쿨다운 + 일일 상한 + 이상탐지 배치(R-02 와 동일 infra). 관리자 수동 개입 경로. | Backend |
| **R-11** | 아이돌 초상권 / IP 클리어런스 지연 | L | H | 법무 검토 S0 시작. 소속사 계약서 상 사용 범위 명시. | PO / Legal |
| **R-12** | Store 정책 변동 (IAP 강제, 수수료) | L | M | 변동 알림 모니터링. Stripe 웹 결제는 B2B·환불에 한정. | PM |

### 6.2 Go / No-Go Checklist (GA 판정 체크리스트, M5 용)

- [ ] 모든 P0 FR (≈ 60건) 의 AC 통과.
- [ ] 통합 테스트(ITC-001..) PASS, 회귀 테스트 모두 green.
- [ ] 부하 테스트: 50k concurrent, 1,000 TPS 투표 쓰기 조건 충족.
- [ ] 보안 리뷰 OWASP ASVS L2 이슈 0 high.
- [ ] 접근성 WCAG AA 수준 주요 화면 통과(axe scan + 수동).
- [ ] 개인정보 처리방침, 이용약관, 환불 정책 게시.
- [ ] Apple / Google 심사 통과 + TestFlight/Internal Track 사전 테스트 3일 안정 운영.
- [ ] 운영 런북, Incident 플레이북 작성 완료.

---

## 7. Team & Communication (조직·커뮤니케이션)

### 7.1 R&R (Roles & Responsibilities)

| Role | 인원 | 책임 |
|------|------|------|
| Product Owner | 1 | 기획·우선순위·이해관계자 — Gray Kim |
| Backend Lead / Dev | 1 + 1 | NestJS API, Prisma, WS, 결제/투표 도메인 |
| Mobile Lead / Dev (RN) | 1 + 1 | RN iOS/Android, IAP, 스토어 제출 |
| CMS Dev (React) | 1 | CMS SPA, 관리자 UX, 대시보드 |
| QA | 1 | ITC/TC 정의, 시나리오·부하·접근성 QA |
| DevOps | 1 | CI/CD, 인프라, 관측성, 보안 |

### 7.2 Cadence (커뮤니케이션 주기)

- Daily Standup: 10:30 KST, 15분.
- Sprint Kickoff: 월요일 W1 / W3 / W5 / ... (2주 cadence).
- Sprint Review + Demo: 격주 금요일 15:00, 이해관계자 공개.
- Retrospective: 격주 금요일 16:00.
- Channel: Slack `#a-idol-dev`, `#a-idol-release`, `#a-idol-cs`.
- Issue Tracker: GitHub Issues + Project "A-idol MVP" (칸반 + 로드맵).

### 7.3 Definition of Ready / Done (DoR / DoD)

- **DoR (Ready to Start)**
  1. 요구사항 ID 매핑 (FR·FN·SCR·SEQ)
  2. 수락 기준 명시 (체크리스트)
  3. 디자인/와이어프레임 링크
  4. 테스트 데이터/모의 응답 준비
- **DoD (Definition of Done)**
  1. 단위 테스트 + 커버리지 gate 통과 (NFR-016)
  2. 코드 리뷰 2 approvals, CI green
  3. 트레이서빌리티 매트릭스 갱신
  4. staging 배포 + smoke 테스트 통과
  5. 수락 기준(AC) 체크 완료 + QA 사인오프

---

## 8. Test Strategy (테스트 전략 — 요약)

> 상세 테스트 계획은 QA 가 별도 문서로 작성 (Sprint 3 까지 초안).

| Level | Owner | Tool | Coverage 목표 |
|-------|-------|------|-------------|
| Unit (유닛) | Dev | Jest + RN Testing Library + Vitest | Backend 70% / Mobile 50% |
| Integration (API/DB) | Dev + QA | Supertest + Testcontainers PostgreSQL | 주요 UseCase ≥ 90% |
| E2E Mobile | QA | Detox (iOS/Android) | 핵심 시나리오 20개 (SC-001..008 기반) |
| E2E Web (CMS) | QA | Playwright | 관리자 CRUD/통계/오디션 운영 |
| Load | DevOps | k6 + Grafana | 50k concurrent, 1,000 TPS 투표, WS 10k |
| Security | QA + DevOps | OWASP ZAP + manual pen test | ASVS L2 |
| Accessibility | QA | axe-core + 수동 VoiceOver/TalkBack | WCAG 2.1 AA 주요 화면 |

---

## 9. Release & Post-GA (릴리즈·GA 이후)

### 9.1 Release Strategy

- Staging RC 2주 안정 운영 → Prod canary(10%) 24h → full rollout.
- RN 앱: EAS Build + TestFlight/Internal Track 사전 배포 → 스토어 심사 → phased release (iOS)/staged rollout (Android).
- Hotfix: `hotfix/{version}` 브랜치 → prod 직 배포 + develop 역머지.

### 9.2 Post-GA (Phase 2) Backlog Candidates

1. AI 채팅 엔진 LLM(Claude) 전환 (ADR-006)
2. 라이브 스트리밍 / 화상 팬미팅 (NFR-014 상향)
3. 팬 간 1:1 채팅 + 게시판 (UGC 정책 필요)
4. Photocard 트레이딩·NFT
5. 유료 팬클럽 구독 (POL-003 Phase 2)
6. SMS 투표 통신사 연동 (ADR-004 후속)
7. 해외 출시 + 다국어 (NFR-015 Full)

---

## 10. References (참조)

- Analysis: [`../analysis/a-idol-requirements.md`](../analysis/a-idol-requirements.md)
- Requirements Definition v2: [`../design/a-idol-req-definition.md`](../design/a-idol-req-definition.md)
- Functional Spec: [`../design/a-idol-func-definition.md`](../design/a-idol-func-definition.md)
- Architecture: [`../design/a-idol-architecture.md`](../design/a-idol-architecture.md)
- ERD v2.0.0: [`../design/a-idol-erd.md`](../design/a-idol-erd.md), `sql/a-idol-schema.sql`
- Sequence: [`../design/a-idol-sequence.md`](../design/a-idol-sequence.md)
- Policy: [`../design/a-idol-policy.md`](../design/a-idol-policy.md)
- Event Scenario: [`../reference/a-idol-event-scenario.md`](../reference/a-idol-event-scenario.md)
- Level Policy: [`../reference/a-idol-level-policy.md`](../reference/a-idol-level-policy.md)
- UI Spec: [`../reference/a-idol-ui-spec.md`](../reference/a-idol-ui-spec.md)
- WBS: [`./a-idol-wbs.md`](./a-idol-wbs.md) + `a-idol-wbs.xlsx`
- ADRs: `docs/adr/` (작성 예정)
- Amoeba Convention v2: [`../Project_Basic/amoeba_code_convention.md`](../Project_Basic/amoeba_code_convention.md)

---

> **다음 액션 (Next Actions)**
> 1. S0 kickoff (2026-04-20 월) — T-001 ~ T-011 착수.
> 2. ADR-006 (AI Chat Engine) 의사결정 — 2026-05-31 까지.
> 3. ITC(통합 테스트 케이스) 초안 — QA 가 Sprint 3 까지.
> 4. 부하테스트 환경 구축 — DevOps 가 Sprint 6 까지.
> 5. 스토어 심사 원서 준비 — Sprint 8 중.
