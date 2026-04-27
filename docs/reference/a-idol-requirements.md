---
document_id: A-IDOL-REQ-1.0.0
version: 1.0.0
status: Draft
created: 2026-04-15
updated: 2026-04-15
author: Project Owner (Claude)
reviewers: []
change_log:
  - version: 1.0.0
    date: 2026-04-15
    author: Project Owner
    description: Initial draft — full project requirements definition
---

# A-idol — Requirements Analysis (요구사항 분석서)

---

## 1. Project Overview (프로젝트 개요)

- **Project Name**: A-idol (아이돌 팬덤 플랫폼)
- **Project Type**: New service — Mobile-First Fan Engagement Platform
- **Background**:
  K-pop fandom culture requires a dedicated digital space where fans can discover idol artists,
  participate in official audition voting, join fan clubs, collect photocards, and interact with
  their favorite idols via AI-powered chat — all from a single mobile application.
- **Service Scope**:
  - **Mobile App** (React Native) — Primary channel; all fan-facing features
  - **CMS Web** (React + NestJS) — Admin-only; content management, audition operation, statistics

---

## 2. Stakeholders (이해관계자)

| Role | Description | Key Concern |
|------|-------------|-------------|
| Fan User (팬 유저) | App end-user; K-pop fan | Idol discovery, voting, photocard, chat |
| Platform Admin (플랫폼 운영자) | Operates the entire platform | Idol/content registration, audition management |
| Idol Agency (소속사) | Registers and manages idol profiles | Idol profile, schedule, content accuracy |
| Project Owner (PO) | Defines product, manages delivery | Scope, timeline, quality |

---

## 3. Technology Stack (기술 스택)

| Layer | Technology | Note |
|-------|-----------|------|
| Mobile (사용자앱) | React Native | iOS + Android; mobile-only for end users |
| Web CMS (관리자) | React | Admin/CMS frontend; web-only |
| Backend | NestJS (Node.js) | REST + WebSocket API |
| Database | PostgreSQL | Primary RDBMS |
| Real-time Chat | WebSocket (Socket.io via NestJS) | Idol ↔ Fan chat |
| Architecture | Clean Architecture | Domain / Application / Infrastructure / Interface layers |
| Push Notification | FCM (Firebase Cloud Messaging) | iOS + Android |
| Payment | TBD (PG integration — e.g., KG이니시스, Toss Payments) | In-app purchase |
| Storage | S3-compatible (AWS S3 or equivalent) | Photo cards, idol images |
| Cache | Redis | Session, chat rate-limiting, vote counters |
| Version Control | Git / GitHub | |

---

## 4. Architecture Principle (아키텍처 원칙)

Clean Architecture를 적용하며 레이어 경계를 엄격하게 유지한다.

```
┌─────────────────────────────────────────────────┐
│              Interface Layer                    │
│  (REST Controllers, WebSocket Gateways,         │
│   React Native Screens, React CMS Pages)        │
├─────────────────────────────────────────────────┤
│              Application Layer                  │
│  (Use Cases: VoteUseCase, ChatUseCase,          │
│   PhotocardUseCase, FanClubUseCase)             │
├─────────────────────────────────────────────────┤
│              Domain Layer                       │
│  (Entities: Idol, User, Vote, Photocard,        │
│   FanClub, Coupon, Audition)                    │
│  (Domain Services, Repository Interfaces)       │
├─────────────────────────────────────────────────┤
│              Infrastructure Layer               │
│  (PostgreSQL Repositories, Redis, S3,           │
│   FCM, Payment Gateway, WebSocket)              │
└─────────────────────────────────────────────────┘
```

---

## 5. User Roles & Access (사용자 역할 및 접근 범위)

| Role | Access Channel | Auth Method |
|------|---------------|-------------|
| Fan User | Mobile App only | Email / Social login (Kakao, Apple, Google) |
| Platform Admin | CMS Web only | Email + 2FA |
| Agency Manager | CMS Web only (sub-admin) | Email + 2FA; restricted to own idol data |

---

## 6. Functional Requirements — Fan User (기능 요구사항 — 팬 유저)

### 6-1. Authentication & Onboarding (인증/온보딩)

| ID | Requirement | Priority | Note |
|----|-------------|----------|------|
| FR-001 | User registers via email or social login (Kakao, Apple, Google) | P0 | |
| FR-002 | User logs in and receives JWT-based session | P0 | Access token + Refresh token |
| FR-003 | User completes profile setup on first login (nickname, profile image) | P0 | |
| FR-004 | User can delete account and all personal data (GDPR/PIPA compliance) | P1 | |

### 6-2. Idol Discovery (아이돌 프로필 탐색)

| ID | Requirement | Priority | Note |
|----|-------------|----------|------|
| FR-010 | User views a list of up to 99 registered idol artists | P0 | Paginated or infinite scroll |
| FR-011 | User views detailed idol profile (name, agency, birthday, concept, schedule, photos) | P0 | |
| FR-012 | User searches/filters idols by name, agency, or category | P1 | |
| FR-013 | User can "Like" (좋아요) an idol | P0 | Toggle; stored per user |
| FR-014 | User can "Follow" (팔로우) an idol to receive updates/news | P0 | Push notification opt-in |
| FR-015 | User views their liked and followed idols in "My Page" | P0 | |

### 6-3. Fan Club (팬클럽)

| ID | Requirement | Priority | Note |
|----|-------------|----------|------|
| FR-020 | Each idol has exactly one official fan club | P0 | 1 idol : 1 fan club |
| FR-021 | User joins a fan club (membership registration) | P0 | May join multiple fan clubs |
| FR-022 | Fan club membership is required to access idol chat | P0 | Gate check on chat entry |
| FR-023 | User views list of fan clubs they have joined | P0 | |
| FR-024 | User leaves a fan club | P1 | |

### 6-4. Idol Chat (아이돌 채팅)

| ID | Requirement | Priority | Note |
|----|-------------|----------|------|
| FR-030 | Fan club member can chat with their idol | P0 | Requires fan club membership |
| FR-031 | System enforces daily chat quota per user per idol | P0 | Default: 5 exchanges/day |
| FR-032 | Automated idol messages are sent per day and do NOT consume quota | P0 | 3 messages: Good Morning / Good Night / What are you up to? (configurable by admin) |
| FR-033 | User purchases additional chat coupons (대화쿠폰) when quota is exhausted | P0 | In-app purchase |
| FR-034 | Chat coupon balance is displayed in chat screen | P1 | |
| FR-035 | Chat history is persisted and viewable on re-entry | P1 | |
| FR-036 | Admin can configure daily quota count per idol (default 5) | P0 | CMS setting |

### 6-5. Voting & Audition (투표 및 오디션)

| ID | Requirement | Priority | Note |
|----|-------------|----------|------|
| FR-040 | User views current audition program and its rounds | P0 | |
| FR-041 | User views idol rankings per audition round | P0 | Real-time or near-real-time |
| FR-042 | User purchases voting tickets (투표권) for a specific audition round | P0 | In-app purchase |
| FR-043 | Voting ticket purchase allows multiple votes per user based on admin-configured conditions | P0 | Not strictly 1-vote-per-person |
| FR-044 | User casts vote(s) for a chosen idol in an active audition round | P0 | |
| FR-045 | User views their voting history (which idol, which round, how many votes) | P1 | |
| FR-046 | User views overall vote rankings per round | P0 | |

### 6-6. Photocard (포토카드)

| ID | Requirement | Priority | Note |
|----|-------------|----------|------|
| FR-050 | Each idol has one or more photocard sets; each set contains 12 cards | P0 | |
| FR-051 | User purchases a random single photocard from a set (no card selection; random pick from 12) | P0 | Gacha mechanic |
| FR-052 | User views all photocards they own in "My Collection" | P0 | |
| FR-053 | User shares a photocard to Instagram (social sharing via Instagram account link) | P1 | |
| FR-054 | User links their Instagram account in profile for social sharing | P1 | |

---

## 7. Functional Requirements — Platform Admin / CMS (기능 요구사항 — 관리자 CMS)

### 7-1. Idol Management (아이돌 관리)

| ID | Requirement | Priority | Note |
|----|-------------|----------|------|
| FR-100 | Admin registers idol agency (소속사) — initially 1 agency | P0 | Agency: name, logo, contact |
| FR-101 | Admin registers idol profile (up to 99 idols) | P0 | Name, agency, birthday, concept, bio, photos |
| FR-102 | Admin edits and updates idol profile | P0 | |
| FR-103 | Admin registers idol-specific character traits and attributes | P1 | Used for AI chat persona |
| FR-104 | Admin registers idol schedules (방송, 콘서트, 팬미팅, etc.) | P1 | Displayed on idol profile |
| FR-105 | Admin activates or deactivates an idol profile | P0 | |

### 7-2. Fan Club Management (팬클럽 관리)

| ID | Requirement | Priority | Note |
|----|-------------|----------|------|
| FR-110 | System auto-creates a fan club when an idol is registered | P0 | 1:1 mapping |
| FR-111 | Admin views fan club member list and count | P1 | |
| FR-112 | Admin configures fan club settings (name, description, thumbnail) | P1 | |

### 7-3. Chat & Coupon Configuration (채팅/쿠폰 설정)

| ID | Requirement | Priority | Note |
|----|-------------|----------|------|
| FR-120 | Admin sets daily chat quota per idol (default: 5) | P0 | |
| FR-121 | Admin configures auto-message templates per idol (Good Morning, Good Night, etc.) | P0 | Up to 3 auto messages/day |
| FR-122 | Admin manages chat coupon product listing (price, quantity per package) | P0 | |

### 7-4. Photocard Management (포토카드 관리)

| ID | Requirement | Priority | Note |
|----|-------------|----------|------|
| FR-130 | Admin creates a photocard set for an idol (set of 12 cards) | P0 | Upload 12 card images |
| FR-131 | Admin sets photocard pricing | P0 | Per-card price |
| FR-132 | Admin activates/deactivates a photocard set | P1 | |

### 7-5. Audition Management (오디션 관리)

| ID | Requirement | Priority | Note |
|----|-------------|----------|------|
| FR-140 | Admin creates an audition program | P0 | Name, description, start/end date |
| FR-141 | Audition has preliminary rounds (예선): Round 1 through Round 10 | P0 | Sequential rounds |
| FR-142 | Admin activates each preliminary round and sets its voting window (start/end datetime) | P0 | |
| FR-143 | System calculates per-round rankings and eligible idols for next round | P0 | Pass/fail threshold set by admin |
| FR-144 | Admin configures finalist promotion criteria (결선 진출 기준) | P0 | e.g., top N idols per round |
| FR-145 | Admin creates the final audition (결선) with finalists auto-populated | P0 | |
| FR-146 | Final audition supports multiple vote types: online vote, SMS vote, popularity score | P0 | |
| FR-147 | Admin defines vote types and their weight values (가중치) | P0 | e.g., online=0.4, SMS=0.3, popularity=0.3 |
| FR-148 | System computes weighted final score = Σ(vote_count × weight) per idol | P0 | |
| FR-149 | Admin views real-time vote count and weighted ranking for each audition round | P0 | |
| FR-150 | Admin configures voting ticket purchase conditions (복수투표 조건) | P0 | e.g., price tiers, max per user per round |

### 7-6. Statistics & Reporting (통계 및 리포트)

| ID | Requirement | Priority | Note |
|----|-------------|----------|------|
| FR-160 | Admin views overall DAU/MAU, signups, and retention statistics | P1 | |
| FR-161 | Admin views voting statistics per audition round (total votes, per-idol count, ranking) | P0 | |
| FR-162 | Admin views photocard sales statistics (by idol, by set, revenue) | P1 | |
| FR-163 | Admin views chat coupon purchase and usage statistics | P1 | |
| FR-164 | Admin exports statistics data as CSV | P2 | |

---

## 8. Non-Functional Requirements (비기능 요구사항)

| ID | Category | Requirement | Target |
|----|----------|-------------|--------|
| NFR-001 | Performance | API response time (p95) | < 300ms |
| NFR-002 | Performance | Vote ranking update latency | < 5 seconds |
| NFR-003 | Scalability | Concurrent voting users during peak (live audition broadcast) | 10,000+ concurrent |
| NFR-004 | Availability | Service uptime | 99.5% monthly |
| NFR-005 | Security | All API endpoints require authentication | JWT-based |
| NFR-006 | Security | Payment data handling complies with PCI-DSS | PG gateway handles card data |
| NFR-007 | Privacy | User data handling complies with Korean Personal Information Protection Act (PIPA / 개인정보보호법) | |
| NFR-008 | Mobile | App supports iOS 15+ and Android 11+ | React Native |
| NFR-009 | Mobile | App is submitted to App Store and Google Play | |
| NFR-010 | Accessibility | Minimum tap target 44×44pt per platform guidelines | |
| NFR-011 | Localization | Initial release in Korean; English as Phase 2 | |

---

## 9. Domain Model Overview (도메인 모델 개요)

```
User (유저)
 ├── likes → Idol (N:M)
 ├── follows → Idol (N:M)
 ├── joins → FanClub (N:M)  [via FanClubMembership]
 ├── owns → Photocard (N:M) [via UserPhotocard]
 ├── owns → ChatCoupon (1:N)
 ├── owns → VotingTicket (1:N)
 └── sends → ChatMessage (1:N)

Idol (아이돌)
 ├── belongs to → Agency (N:1)
 ├── has → FanClub (1:1)
 ├── has → PhotocardSet (1:N)
 ├── has → IdolSchedule (1:N)
 └── participates in → AuditionRound (N:M) [via IdolAuditionEntry]

FanClub (팬클럽)
 └── has → FanClubMembership (1:N)

Audition (오디션)
 ├── has → AuditionRound (1:N)  [예선 R1~R10, 결선]
 └── AuditionRound
      ├── has → VoteType (1:N)   [online, SMS, popularity]
      └── VoteType → weight (decimal)

PhotocardSet (포토카드 세트)
 ├── belongs to → Idol (N:1)
 └── has → Photocard (1:12)  [exactly 12 cards per set]

Purchase (구매)
 ├── type: CHAT_COUPON | VOTING_TICKET | PHOTOCARD
 └── links → PaymentTransaction
```

---

## 10. Key Business Rules (핵심 비즈니스 룰)

| ID | Rule | Detail |
|----|------|--------|
| BR-001 | Idol count cap | Maximum 99 registered idols on platform |
| BR-002 | Fan club uniqueness | Exactly 1 fan club per idol; auto-created on idol registration |
| BR-003 | Chat gate | Fan must be a fan club member to initiate chat with that idol |
| BR-004 | Daily chat quota | Default 5 user-initiated exchanges per user per idol per day; excludes auto-messages |
| BR-005 | Auto-messages excluded from quota | Up to 3 system-generated idol messages per day do not count against user quota |
| BR-006 | Photocard randomness | User cannot choose which of the 12 cards to receive; random assignment on purchase |
| BR-007 | Multiple fan clubs | A user may join fan clubs of multiple idols simultaneously |
| BR-008 | Multiple voting tickets | Voting is NOT one-vote-per-person; users may purchase multiple tickets per round per admin config |
| BR-009 | Weighted final score | Final audition score = Σ(vote_count_by_type × type_weight); weights defined and adjustable by admin |
| BR-010 | Preliminary round progression | Idols who meet the admin-set threshold advance to next round; admin manually triggers progression |

---

## 11. Out of Scope — Phase 1 (Phase 1 제외 범위)

- Live streaming (아이돌 라이브 스트리밍)
- Fan-to-fan community board (팬 커뮤니티 게시판)
- Merchandise (MD) e-commerce beyond photocards
- Multi-language (English/Japanese) localization
- Agency self-service CMS portal (agencies managed by platform admin in Phase 1)
- SMS voting infrastructure (SMS vote type defined in data model but external SMS gateway integration is Phase 2)
- Photocard trading between users

---

## 12. Open Issues & Decisions Needed (미결 이슈 및 결정 필요 사항)

| ID | Issue | Owner | Status |
|----|-------|-------|--------|
| OI-001 | Payment gateway selection (Toss Payments vs KG이니시스 vs other) | PO | Open |
| OI-002 | AI chat engine for idol auto-responses (rule-based vs LLM API like Claude) | PO | Open |
| OI-003 | Audition final round progression logic — automated or admin-manual trigger | PO | Open |
| OI-004 | Photocard social sharing — Instagram Basic Display API vs in-app screenshot share | Dev Lead | Open |
| OI-005 | Push notification frequency policy for followed idols | PO | Open |
| OI-006 | Agency sub-admin portal scope for Phase 1 | PO | Open |

---

## 13. Document References (참조 문서)

| Doc ID | Title | Location |
|--------|-------|----------|
| A-IDOL-REQ-1.0.0 | This document | `docs/analysis/a-idol-requirements.md` |
| (next) A-IDOL-EVENT-1.0.0 | Event Scenario | `docs/design/a-idol-event-scenario.md` |
| (next) A-IDOL-ERD-1.0.0 | ERD + SQL Schema | `docs/design/a-idol-erd.md` |
| (next) A-IDOL-SEQ-1.0.0 | Sequence Diagrams | `docs/design/a-idol-sequence.md` |
