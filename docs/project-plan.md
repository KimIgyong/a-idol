# A-idol 프로젝트 수행 계획서

**문서번호**: A-IDOL-PLAN-001  
**작성일**: 2026년 4월 27일  
**프로젝트명**: A-idol (AI Idol Fandom Platform)  
**책임자**: Gray Kim <gray.kim@amoeba.group>

---

## 1. 프로젝트 개요

### 1.1 프로젝트 목적
AI 아이돌 팬덤 플랫폼 구축을 통한 차세대 엔터테인먼트 서비스 제공

### 1.2 프로젝트 목표
- **비즈니스 목표**: AI 아이돌 기반 팬덤 생태계 조성 및 수익화
- **기술적 목표**: 확장 가능한 Clean Architecture 기반 MVP 개발
- **사용자 목표**: 직관적이고 몰입감 있는 팬덤 경험 제공

### 1.3 프로젝트 범위
- **포함 범위**: Backend API, Mobile App, CMS, 핵심 팬덤 기능 10개 모듈
- **제외 범위**: 고급 AI 기능, 3rd party 복잡 연동, 글로벌 결제 시스템

### 1.4 성공 기준
- **기능적**: 모든 MVP 요구사항 구현 완료
- **품질**: 버그 0개, 성능 기준 달성, 보안 검증 완료
- **일정**: 2026년 8월 1일 GA 출시

---

## 2. 프로젝트 일정 및 마일스톤

### 2.1 전체 일정
- **프로젝트 기간**: 2026년 4월 ~ 8월 (4개월)
- **개발 방법론**: Agile 기반 단계별 개발
- **작업 단위**: WBS 기반 태스크 관리

### 2.2 주요 마일스톤

| Phase | 기간 | 주요 산출물 | 완료 기준 |
|-------|------|-------------|-----------|
| **Setup** | 4월 1~3주 | Backend Core + Identity + Catalog | T-001~T-011 완료 |
| **Phase A** | 4월 4주~5월 2주 | Fandom + Chat + Mobile Base | T-020~T-028 완료 |
| **Phase B** | 5월 3주~6월 2주 | Commerce + PhotoCard + Mobile UI | T-030~T-049 완료 |
| **Phase C** | 6월 3주~7월 2주 | Audition + Vote + CMS Complete | T-060~T-068 완료 |
| **Phase D** | 7월 3주~8월 1주 | Security + Performance + GA Ready | T-080~T-095 완료 |

### 2.3 상세 일정 (WBS 기반)

#### Setup Phase (완료 예정: 4월 27일)
```
T-001 ✅ Repo + pnpm workspace setup (0.5d)
T-002 ✅ Shared domain entities (1d)  
T-003 ✅ NestJS + Clean Architecture skeleton (2d)
T-004 ✅ Prisma + PostgreSQL + ERD mapping (2d)
T-005 ✅ Docker Compose + local dev env (1d)
T-006 📋 CMS (Vite/React) scaffolding + auth shell (2d)
T-007 📋 React Native setup + navigation (2d)
T-008 📋 CI/CD GitHub Actions (1d)
T-009 ✅ Identity module (auth/signup/JWT) (3d)
T-010 ✅ Catalog module (idol/agency CRUD) (2d)
T-011 📋 CMS auth + RBAC base (2d)
```

#### Phase A: Core Fandom (5월 1~14일)
```
T-020 📋 Fandom module (heart/follow/fanclub) (3d)
T-021 📋 Chat base (rooms/messages/quota) (3d)  
T-022 📋 Auto-message dispatch engine (2d)
T-023 📋 Mobile Home + Profile screens (3d)
T-024 📋 Mobile Idol Detail + Heart/Follow UI (2d)
T-025 📋 Mobile Chat UI + WebSocket (3d)
T-026 📋 CMS Idol/Agency CRUD (5d)
T-027 📋 CMS Auto-message template manager (3d)
T-028 📋 Local seed data + E2E smoke test (1d)
```

#### Phase B: Commerce & Collection (5월 15일~6월 14일)  
```
T-030~T-049: Commerce, PhotoCard, Mobile UI 구현
```

#### Phase C: Voting & Competition (6월 15일~7월 14일)
```
T-060~T-068: Audition, Vote, CMS 운영 도구
```

#### Phase D: Production Ready (7월 15일~8월 1일)
```
T-080~T-095: Security, Performance, Observability
```

---

## 3. 조직 및 역할

### 3.1 프로젝트 조직도
```
프로젝트 매니저: Gray Kim
├── Backend 개발: Gray Kim (Lead)
├── Frontend 개발: TBD (CMS/Mobile)  
├── DevOps/인프라: Gray Kim
├── QA/테스트: TBD
└── 기획/디자인: TBD
```

### 3.2 역할 및 책임

| 역할 | 담당자 | 주요 책임사항 |
|------|--------|---------------|
| **Project Manager** | Gray Kim | 전체 일정 관리, 의사결정, 품질 관리 |
| **Backend Lead** | Gray Kim | NestJS API, DB 설계, 아키텍처 |  
| **Frontend Dev** | TBD | React Native App, React CMS |
| **DevOps** | Gray Kim | CI/CD, 배포, 모니터링 |

### 3.3 의사소통 체계
- **일일 스탠드업**: 매일 오전 10시 (15분)
- **주간 진도 회의**: 매주 금요일 오후 4시 (1시간)  
- **마일스톤 리뷰**: Phase 완료 시점
- **이슈 에스컬레이션**: Slack #a-idol-dev 채널

---

## 4. 기술 아키텍처 및 개발 방법론

### 4.1 기술 스택

#### Backend
- **Framework**: NestJS v10+ (Node.js 20+)
- **Database**: PostgreSQL 16 + Redis 7
- **ORM**: Prisma v5+  
- **Authentication**: JWT + OAuth (Kakao/Apple/Google)
- **API**: REST + WebSocket + Swagger

#### Frontend  
- **Mobile**: React Native + Expo
- **CMS**: React + Vite + TypeScript
- **State**: Context API / Zustand
- **UI**: React Native Elements / Ant Design

#### Infrastructure
- **Container**: Docker + Docker Compose
- **CI/CD**: GitHub Actions  
- **Monitoring**: Pino Logging + Health Checks
- **Deployment**: TBD (AWS/GCP 검토 중)

### 4.2 개발 방법론
- **아키텍처**: Clean Architecture (4-layer)
- **코드 품질**: ESLint + Prettier + TypeScript Strict
- **테스트**: Jest Unit Tests + E2E Smoke Tests  
- **버전 관리**: Git Flow (main + feature/*)
- **패키지 관리**: pnpm Workspace Monorepo

### 4.3 품질 관리
- **Code Review**: 모든 PR 필수 리뷰  
- **Testing**: 80%+ 커버리지 목표
- **Security**: OWASP 기준 보안 검토
- **Performance**: 응답시간 < 200ms, 동시사용자 1000명

---

## 5. 리스크 관리

### 5.1 식별된 리스크

| 리스크 | 발생 확률 | 영향도 | 대응 방안 |
|--------|-----------|--------|-----------|
| **인력 부족** | 중 | 고 | 외부 개발자 투입 계획 |
| **기술적 복잡도** | 중 | 중 | POC를 통한 사전 검증 |
| **일정 지연** | 중 | 고 | 버퍼 시간 확보, 범위 조정 |
| **성능 이슈** | 낮 | 중 | 초기 성능 테스트, 모니터링 |
| **보안 취약점** | 낮 | 고 | 보안 검토, 펜테스트 |

### 5.2 리스크 모니터링
- **주간 리스크 리뷰**: 매주 금요일 진도 회의에서 검토
- **에스컬레이션 절차**: 고위험 이슈 발생 시 24시간 내 보고
- **완화 조치**: 각 리스크별 구체적 대응책 사전 수립

---

## 6. 품질 보증 계획

### 6.1 품질 목표
- **기능 품질**: 모든 요구사항 100% 구현
- **성능 품질**: API 응답 < 200ms, 앱 로딩 < 3초
- **보안 품질**: OWASP Top 10 취약점 0개  
- **사용성 품질**: 사용자 만족도 4.5/5.0 이상

### 6.2 품질 활동
- **설계 검토**: 아키텍처 결정 시 ADR 문서화
- **코드 검토**: Pull Request 기반 동료 검토  
- **테스트**: Unit Test + Integration Test + E2E Test
- **성능 검토**: 정기적 성능 프로파일링
- **보안 검토**: 코드 정적 분석 + 동적 테스트

### 6.3 품질 측정 지표
- **결함률**: 배포당 < 1건  
- **테스트 커버리지**: > 80%
- **코드 품질**: SonarQube Quality Gate 통과
- **성능**: 99%ile 응답시간 < 500ms

---

## 7. 변경 관리 및 구성 관리

### 7.1 변경 관리 프로세스
1. **변경 요청** → GitHub Issue 등록
2. **영향도 분석** → 일정/비용/품질 영향 검토  
3. **승인** → 프로젝트 매니저 승인
4. **구현** → 개발 및 테스트  
5. **배포** → CI/CD 파이프라인 통한 배포

### 7.2 구성 관리
- **소스코드**: Git (GitHub)  
- **문서**: Markdown (docs/ 폴더)
- **이슈 추적**: GitHub Issues + Projects
- **빌드 산출물**: GitHub Actions Artifacts

---

## 8. 의사소통 및 보고

### 8.1 의사소통 채널
- **공식**: 주간 진도 보고서 (이메일)
- **일상**: Slack #a-idol-dev  
- **문서**: GitHub Wiki + README
- **회의**: Google Meet (녹화 보관)

### 8.2 보고 체계
- **일일**: 스탠드업 (구두)
- **주간**: 진도 보고서 (문서)  
- **월간**: 마일스톤 리뷰 (프레젠테이션)
- **임시**: 이슈/리스크 발생시 (즉시)

### 8.3 문서 관리
- **기술 문서**: docs/ 폴더 (Markdown)
- **API 문서**: Swagger (자동 생성)  
- **사용자 문서**: README + 설치 가이드
- **프로젝트 문서**: GitHub Projects + Issues

---

## 9. 예산 및 자원

### 9.1 인력 자원
- **현재**: Gray Kim (Full-time)
- **추가 필요**: Frontend Developer 1명, QA 1명
- **총 인력**: 3명 × 4개월 = 12 Person-Month

### 9.2 기술 자원  
- **개발 환경**: MacBook Pro, Docker, Cloud IDE
- **클라우드**: AWS/GCP (배포 시)
- **도구**: GitHub, Slack, Figma, Notion

### 9.3 예상 비용
- **인건비**: TBD (외부 인력 투입시)
- **클라우드**: 월 $200 (예상)  
- **도구/라이선스**: 월 $100
- **총 예산**: TBD

---

## 10. 승인 및 서명

| 구분 | 성명 | 직책 | 서명 | 날짜 |
|------|------|------|------|------|  
| **작성자** | Gray Kim | Project Manager | [서명] | 2026.04.27 |
| **검토자** | TBD | Technical Lead | [서명] | 2026.04.27 |
| **승인자** | TBD | Project Sponsor | [서명] | 2026.04.27 |

---

**문서 이력**
- v1.0 (2026.04.27): 초기 작성 - Gray Kim
- 다음 버전: 마일스톤별 업데이트 예정