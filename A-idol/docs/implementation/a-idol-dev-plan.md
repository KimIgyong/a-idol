---
document_id: A-IDOL-DEVPLAN-1.0.0
version: 1.0.0
status: Draft
created: 2026-04-18
updated: 2026-04-18
author: Gray Kim
---

# A-idol — Development Plan (A-아이돌 개발계획서)

## 1. Overview (개요)

- **Project**: A-idol (AI 아이돌 팬덤 플랫폼)
- **Development period**: 2026-04-20 ~ 2026-08-29 (약 19주)
- **Team size (target)**: 총 8명 — PM 1, Backend 2, Mobile(RN) 2, CMS(React) 1, QA 1, DevOps 1
- **Scope**: Mobile MVP (iOS/Android), Web CMS, Backend API, PostgreSQL, Redis, CI/CD
- **GitHub Project**: `org/a-idol` → Project board "A-idol MVP"

## 2. Technical Architecture (기술 아키텍처)

[`../design/a-idol-architecture.md`](../design/a-idol-architecture.md) 참조.

- Mobile: React Native 0.74 + TypeScript strict + Clean Architecture (shared `@a-idol/domain`)
- CMS: React 18 + Vite + shadcn/ui + Tailwind
- Backend: NestJS 10 + Prisma 5 + PostgreSQL 16 + Redis 7
- Infra: Docker + ECS Fargate (TBD) + CloudFront + S3 + RDS

## 3. Development Environment (개발 환경)

### Branch Strategy (Git Flow 변형)
```
main       ← production (태그로 릴리즈)
develop    ← integration
feature/{issue-number}-{kebab-desc}
bugfix/{issue-number}-{kebab-desc}
hotfix/{version}-{desc}
docs/{issue-number}-{desc}
```

### Environments
| Env | Purpose | DB | Build |
|-----|---------|----|-------|
| local | 개발자 PC | docker-compose postgres/redis | RN Metro / Vite dev / Nest dev |
| dev | 통합 개발 | RDS dev | CI auto-deploy (develop push) |
| staging | QA | RDS staging (anon prod seed) | RC 태그 |
| prod | 상용 | RDS prod (multi-AZ) | 릴리즈 태그 + 수동 승인 |

### CI/CD Pipeline
- **Mobile**: GitHub Actions → EAS Build(iOS/Android) → TestFlight / Internal Track
- **CMS**: GH Actions → build → S3 + CloudFront invalidation
- **Backend**: GH Actions → docker build → ECR → ECS Blue/Green via CodeDeploy
- **DB Migration**: Prisma migrate deploy — staging 자동, prod 수동 승인

### Coding Standards
- ESLint + Prettier + commitlint(Conventional Commits)
- Husky pre-commit: typecheck + lint + 변경파일 유닛 테스트
- PR 템플릿: Summary / Test plan / Screenshots / Refs 이슈

## 4. Schedule Summary (개발 일정)

총 19주 = Setup(2) + Phase A(4) + Phase B(5) + Phase C(4) + 안정화/QA(4)

| Phase | Weeks | Focus | Deliverable | Milestone |
|-------|-------|-------|-------------|-----------|
| Setup | W1-W2 | 레포/환경/CI, 도메인 공용 패키지, 인증/회원, CMS 기본 | 첫 HelloWorld 릴리즈 | M1 Setup |
| A. Catalog & Fandom | W3-W6 | 아이돌 프로필, 하트, 팔로우, 팬클럽 가입, CMS 콘텐츠 | P0 MVP1 | M2 Catalog |
| B. Chat & Commerce | W7-W11 | 채팅+쿠폰+자동메시지, 포토카드+공유, IAP | P0 MVP2 | M3 Chat/Shop |
| C. Audition | W12-W15 | 오디션 회차/투표/집계, CMS 관리 | P0 MVP3 | M4 Audition |
| Stabilization | W16-W19 | 성능/보안/접근성/통합QA/스토어 심사 | 상용 릴리즈 | M5 GA |

### Milestones (마일스톤)

| ID | Name | Target Date | Exit Criteria |
|----|------|-------------|---------------|
| M1 | Setup Complete | 2026-05-02 | CI/CD green, 로그인 E2E |
| M2 | Catalog Ready | 2026-05-30 | 프로필/하트/팔로우/팬클럽 E2E |
| M3 | Chat & Shop Ready | 2026-07-04 | 채팅+포토카드 결제까지 E2E |
| M4 | Audition Ready | 2026-08-01 | 예선 회차 + 투표 E2E |
| M5 | GA (Release) | 2026-08-29 | 통합테스트 PASS, 스토어 심사 통과 |

## 5. Risk Management (리스크 관리)

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|-----------|--------|-----------|
| R-01 | 앱스토어/플레이 심사 지연 | H | H | 제출 2주 전 사전 심사(TestFlight/Alpha) 대응, 개인정보 처리방침/환불 정책 선제 작성 |
| R-02 | 오디션 마감 시점 트래픽 폭주 | M | H | Redis counter + write buffer + BullMQ 집계 + DB 파티셔닝, 부하테스트 W16 |
| R-03 | 결제 영수증 위조/재사용 | M | H | `receipts(platform, transaction_id) UNIQUE` + 서버 검증 + idempotency-key |
| R-04 | 아이돌 AI 응답 품질 이슈 | M | M | MVP는 사전 정의 응답 풀 + 템플릿 기반, Phase 2 LLM 전환 |
| R-05 | 99명 초기 시딩 지연 | M | M | 소속사 콘텐츠 계약 조기 체결, 샘플 데이터로 개발 병행 |
| R-06 | RN 버전 호환성 | L | M | RN 0.74 고정, 업그레이드는 스프린트 외 작업 |
| R-07 | 문자 투표 외부 연동 미확정 | H | M | ADR-004 — MVP는 스텁, 결선 전 연동 확정 |

## 6. Communication Plan (커뮤니케이션)

- Daily standup 10:30 KST (15분)
- Weekly demo 금요일 15:00 (이해관계자 포함)
- Sprint: 2주 단위 (월요일 kickoff, 격주 금요일 review/retro)
- 채널: Slack `#a-idol-dev`, `#a-idol-release`, `#a-idol-cs`
- 이슈 트래커: GitHub Issues + Project "A-idol MVP"
- 문서: `/docs` (PR 리뷰 필수)

## 7. Definition of Ready / Done

**DoR (Ready)**: 요구사항 ID 매핑, 수락 조건, 디자인 링크, 테스트 데이터 정의.
**DoD (Done)**: 단위 테스트 통과, 코드 리뷰 2 approvals, 문서 업데이트, 스테이징 배포 + smoke 테스트 통과, AC 체크 완료.
