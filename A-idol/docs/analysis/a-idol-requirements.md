---
document_id: A-IDOL-REQ-ANALYSIS-1.0.0
version: 1.0.0
status: Draft
created: 2026-04-18
updated: 2026-04-18
author: Gray Kim
reviewers: []
change_log:
  - version: 1.0.0
    date: 2026-04-18
    author: Gray Kim
    description: Initial draft (MVP scope definition)
---

# A-idol — Requirements Analysis (A-아이돌 요구사항 분석서)

## 1. Project Overview (프로젝트 개요)

- **Project**: A-idol (AI 아이돌 팬덤 플랫폼)
- **Version**: 1.0.0 (MVP)
- **Date**: 2026-04-18
- **Background & Purpose (배경 및 목적)**:
  99명의 AI 아이돌 아티스트로 구성된 가상 아이돌 IP를 팬에게 제공하고,
  "덕질의 풀사이클(프로필 탐색 → 팔로우 → 팬클럽 가입 → 1:1 채팅 → 포토카드 수집 → 오디션 투표)"을
  하나의 모바일 앱에서 통합 경험하게 한다.
  관리자는 Web CMS로 아이돌/콘텐츠/오디션/투표/통계를 전담 운영한다.

- **Expected Benefits (기대 효과)**:
  1. 팬 참여도(DAU, 채팅 사용, 투표 참여) 중심의 지표 기반 서비스 운영
  2. 팬클럽 가입 → 채팅 쿠폰 → 포토카드 / 투표권 구매로 이어지는 자연스러운 매출 구조
  3. 예선 10차 + 결선의 장기 오디션 포맷으로 지속적 리텐션 확보

## 2. Stakeholders (이해관계자)

| Role | Person/Team | Responsibility |
|------|-------------|----------------|
| Product Owner | Gray Kim | 기획·설계·QA·운영 총괄 |
| Mobile Dev (RN) | TBD | React Native iOS/Android 개발 |
| CMS Dev (React) | TBD | 관리자 웹 개발 |
| Backend Dev (NestJS) | TBD | API, 도메인 서비스, WebSocket |
| DBA | TBD | PostgreSQL 설계/튜닝 |
| DevOps | TBD | CI/CD, 인프라 |
| Agency (소속사) | TBD | 아이돌 IP 제공, 콘텐츠 공급 |
| Payment | TBD | IAP(앱스토어/플레이스토어) + PG |

## 3. Requirements (요구사항 목록)

### 3.1 Functional Requirements (기능 요구사항)

| ID | Requirement | Priority | Scope | Note |
|----|-------------|----------|-------|------|
| FR-001 | 회원가입/로그인(이메일, 소셜 — Apple, Google, Kakao) | P0 | Mobile | 만 14세 이상 |
| FR-002 | 프로필 관리(닉네임, 프로필 이미지, 인스타 계정 연동) | P0 | Mobile | |
| FR-003 | 99명 아이돌 프로필 열람(목록/상세/미디어 갤러리) | P0 | Mobile | |
| FR-004 | 아이돌 좋아요(하트) 등록/해제 | P0 | Mobile | 중복 불가 |
| FR-005 | 아이돌 팔로우 등록/해제 + 팔로우 피드 | P0 | Mobile | |
| FR-006 | 팬클럽 가입/탈퇴 (아이돌 1인당 공식 팬클럽 1개) | P0 | Mobile | 유료/무료 결정은 POL-003 |
| FR-007 | 1:1 아이돌 채팅 (팬클럽 가입자 한정) | P0 | Mobile | 1일 쿠폰 기반 |
| FR-008 | 채팅 자동 메시지 (굿모닝/굿나잇/뭐해요? 등 3회) | P0 | Mobile+CMS | 쿠폰 미차감 |
| FR-009 | 채팅 쿠폰 1일 5매 기본 제공 + 추가 구매 | P0 | Mobile | IAP |
| FR-010 | 포토카드 랜덤 구매 (1세트 12종 중 1종 랜덤) | P0 | Mobile | IAP |
| FR-011 | 포토카드 컬렉션 관리(갤러리, 중복 확인) | P0 | Mobile | |
| FR-012 | 포토카드 인스타그램 공유 (Share API) | P1 | Mobile | |
| FR-013 | 오디션 예선 1~10차 투표 | P0 | Mobile | 회차당 n일 |
| FR-014 | 오디션 결선 투표(온라인+문자+인기도 가중치 합산) | P0 | Mobile+CMS | |
| FR-015 | 투표권 구매 (패키지별 수량 차이) | P0 | Mobile | IAP |
| FR-016 | 투표 현황/순위 보기 | P0 | Mobile | 실시간/집계 주기 선택 |
| FR-017 | 푸시 알림(굿모닝/투표/공지) | P0 | Mobile | FCM/APNS |
| FR-018 | 결제 이력/영수증 | P0 | Mobile | |
| FR-101 | [CMS] 소속사 등록/관리 | P0 | CMS | |
| FR-102 | [CMS] 아이돌 프로필 등록/수정(이미지, 캐릭터, 스케줄) | P0 | CMS | |
| FR-103 | [CMS] 아이돌 자동 메시지 템플릿 관리 | P0 | CMS | |
| FR-104 | [CMS] 오디션 회차 기획(시작/종료/진출 조건) | P0 | CMS | |
| FR-105 | [CMS] 투표 종류/가중치 설정 (온라인/문자/인기도) | P0 | CMS | |
| FR-106 | [CMS] 포토카드 세트/이미지/수량 관리 | P0 | CMS | |
| FR-107 | [CMS] 투표/매출/유저 통계 대시보드 | P0 | CMS | |
| FR-108 | [CMS] 관리자 계정·권한(RBAC) | P0 | CMS | |
| FR-109 | [CMS] 팬클럽 공지/콘텐츠 발행 | P1 | CMS | |
| FR-110 | [CMS] 신고/제재 처리 | P1 | CMS | |

### 3.2 Non-Functional Requirements (비기능 요구사항)

| ID | Requirement | Criteria |
|----|-------------|----------|
| NFR-001 | API p95 응답시간 | < 300ms (조회 계열), < 800ms (쓰기 계열) |
| NFR-002 | 채팅 메시지 배달 지연 | < 1s (WebSocket) |
| NFR-003 | 가용성 (SLA) | 월 99.5% (운영 1년차) |
| NFR-004 | 동시 접속 (피크) | 50,000 concurrent users (오디션 마감 시점 대비) |
| NFR-005 | 결제 안정성 | 영수증 기반 idempotent 처리, 재시도 가능 |
| NFR-006 | 개인정보 | 개인정보보호법 / GDPR 대비 동의 저장, 탈퇴 시 30일 후 파기 |
| NFR-007 | 접근성 | iOS/Android 스크린리더 대응(WCAG AA 수준) |
| NFR-008 | 보안 | JWT + Refresh Token, HTTPS 강제, 앱 서명 키 분리 |
| NFR-009 | 국제화 | MVP 한국어 only, i18n 구조는 선제 적용 |
| NFR-010 | 코드 품질 | 테스트 커버리지 백엔드 70%+, 모바일 50%+ |

## 4. Scope Definition (범위 정의)

- **In-Scope (MVP)**:
  - Mobile 앱 (iOS 14+, Android 10+)
  - Web CMS (PC 브라우저 — Chrome/Edge 최신 2버전)
  - 백엔드 API + WebSocket
  - 아이돌 프로필/좋아요/팔로우, 팬클럽 + 채팅, 오디션 + 투표, 포토카드 + 소셜 공유

- **Out-of-Scope (Phase 2+)**:
  - 라이브 스트리밍, 화상 팬미팅
  - 팬아트 UGC, 팬 간 1:1 채팅
  - NFT/블록체인 포토카드
  - 해외 결제/다국어 동시 출시

- **MVP vs Full**:
  - MVP: 99명 프로필 + 아이돌 1인당 1개 공식 팬클럽 + 오디션 예선 1~3차 + 포토카드 3세트
  - Full: 예선 10차 + 결선 + 포토카드 시즌 지속 발매

## 5. Constraints and Assumptions (제약사항 및 가정)

- **Constraints**:
  - 모바일 전용 사용자 경험(관리자만 웹)
  - 인앱결제 정책(Apple/Google 30% 수수료) 고려
  - 99명 데이터 초기 시딩(Seed) 작업은 소속사 협조 필요

- **Assumptions**:
  - 초기에는 소속사 1곳(자회사)로 시작 후 외부 소속사 확장
  - 문자 투표는 통신사 연동 외주 (MVP에서는 온라인 투표 + 인기도 가중치만 실구현, 문자는 스텁)

## 6. Related Systems (연관 시스템)

| System | Purpose | Integration |
|--------|---------|-------------|
| Apple App Store / Google Play | 앱 배포 + IAP | StoreKit / Play Billing |
| FCM / APNS | 푸시 알림 | SDK |
| S3 / CloudFront | 이미지/동영상 스토리지 | Pre-signed URL |
| Sentry | 오류 추적 | SDK |
| Datadog / Grafana | APM/로그 모니터링 | Agent |
| Kakao / Apple / Google OAuth | 소셜 로그인 | OAuth 2.0 |
| PG (토스페이먼츠 등) | 웹 CMS 내 테스트 결제 및 보상 환불 | API |

## 7. Success Metrics (성공 지표)

| KPI | Measurement | Target (T+3mo) |
|-----|-------------|----------------|
| DAU | 일일 활성 사용자 | 20,000 |
| D30 Retention | 30일 재방문율 | 25% |
| 팬클럽 가입 전환율 | 가입 유저 / 로그인 유저 | 15% |
| ARPPU | 유료 결제자 평균 결제액 | ₩15,000/월 |
| 오디션 참여율 | 투표자 / MAU | 40% |
| 채팅 추가 쿠폰 구매율 | 구매자 / 팬클럽 가입자 | 10% |
