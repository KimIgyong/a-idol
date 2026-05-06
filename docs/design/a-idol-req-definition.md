---
document_id: A-IDOL-REQ-DEF-2.0.0
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
    description: Initial draft — narrative FR definition
  - version: 2.0.0
    date: 2026-04-18
    author: Gray Kim
    description: >
      전면 개정. Reference 자료(ERD v2.0.0, Level Policy, Event Scenarios SC-001..008,
      Func-Definition, UI-Spec)와 FR 체계 통합. Bilingual (KR/EN), FR-001..163 재정렬,
      팬 레벨 시스템(FR-080..084) 추가, ERD v2 테이블(`aidol_*`)과의 매핑 명시.
---

# A-idol — Requirements Definition (A-아이돌 요구사항 정의서) / v2.0

> **Purpose (목적)**
> — 분석서(`a-idol-requirements.md`)의 FR 항목을 구현 가능한 수준까지 상세화한다.
> — 각 FR은 Input / Output / Business Rules / Acceptance Criteria / 매핑(FN·SCR·SEQ·Table·Policy) 을 갖는다.
> — Refines FR items from the analysis into developer- and tester-ready specifications,
>   each row specifying acceptance criteria, I/O, constraints, and trace links.

**Conventions (규칙)**
- FR-001 ~ FR-099 → Fan App (Mobile), FR-100 ~ FR-199 → Admin CMS.
- ID는 Reference 문서(`docs/reference/a-idol-requirements.md`)의 번호 체계와 일치한다.
- DB 테이블은 Amoeba Code Convention v2 (`aidol_*`, `colPrefix_` 컬럼).
- Priority: **P0** = GA 필수, **P1** = 선호, **P2** = Phase 2 이월.

---

## 0. Traceability Header (상위 추적표)

| Layer | Artifact | Location |
|-------|----------|----------|
| Analysis (분석) | Requirements Analysis | `docs/analysis/a-idol-requirements.md` |
| Design (설계) | **This document** | `docs/design/a-idol-req-definition.md` |
| Design (설계) | Functional Spec | `docs/design/a-idol-func-definition.md` |
| Design (설계) | Architecture | `docs/design/a-idol-architecture.md` |
| Design (설계) | ERD v2.0.0 | `docs/design/a-idol-erd.md`, `sql/a-idol-schema.sql` |
| Design (설계) | Sequence Diagrams | `docs/design/a-idol-sequence.md` |
| Design (설계) | Policy | `docs/design/a-idol-policy.md` |
| Design (설계) | Event Scenario | `docs/reference/a-idol-event-scenario.md` |
| Design (설계) | UI Spec / Wireframes | `docs/reference/a-idol-ui-spec.md`, `a-idol-mobile-wireframes.html` |
| Impl (구현) | Dev Plan | `docs/implementation/a-idol-dev-plan.md` |
| Impl (구현) | WBS | `docs/implementation/a-idol-wbs.md`, `a-idol-wbs.xlsx` |
| Impl (구현) | ADRs | `docs/adr/ADR-001..ADR-014` |

### 0.1 Implementation Status (구현 현황 · 2026-04-23 · Phase C 업데이트)

Legend: ✅ 구현·E2E 검증 완료 · 🟡 부분 구현 · ⬜ 미구현 · ➖ Phase 2 이월

| FR | Title | Status | WBS | Backend path | Client |
|----|-------|--------|-----|--------------|--------|
| FR-001 | Email sign-up/login | 🟡 | T-009 | `POST /api/v1/auth/signup`·`/auth/login` | mobile login/signup screens |
| FR-002 | JWT session + refresh rotation | ✅ | T-009 | `POST /api/v1/auth/refresh` · `GET /api/v1/me` | `AuthContext` (mobile) · `useAuthStore` (cms) |
| FR-003 | Profile setup | ⬜ | — | — | — |
| FR-004 | Account deletion | ⬜ | — | — | — |
| FR-010 | Idol list | ✅ | T-020 | `GET /api/v1/idols?page=&size=&sort=` | mobile home · infinite scroll + sort |
| FR-011 | Idol detail | ✅ | T-020 | `GET /api/v1/idols/:id` | mobile detail screen |
| FR-012 | Idol search/filter — P1 | ⬜ | — | — | — |
| FR-013 | Like idol (heart) | ✅ | T-021 | `POST/DELETE /api/v1/idols/:id/heart` | mobile detail heart button |
| FR-014 | Follow idol | ✅ | T-021 | `POST/DELETE /api/v1/idols/:id/follow` | mobile detail follow button |
| FR-015 | My likes & follows | ✅ | T-021 | `GET /api/v1/me/hearts`·`/me/follows` | (mobile UI pending) |
| FR-020 | Fan club model (1:1) | ✅ | T-022 | `GET /api/v1/idols/:id/fan-club` | mobile detail fan-club card |
| FR-021 | Join fan club | ✅ | T-022 | `POST /api/v1/idols/:id/fan-club/join` | mobile join button · ADR-012 gates paid |
| FR-022 | Leave fan club — P1 | ✅ | T-022 | `POST /api/v1/idols/:id/fan-club/leave` | mobile leave button · ADR-011 soft leave |
| FR-023 | My fan clubs | ✅ | T-022 | `GET /api/v1/me/memberships` | (mobile UI pending) |
| FR-024 | Chat gate check | ✅ | T-040 | `ChatMembershipChecker` on open/send | mobile 403 → fan-club 가입 유도 |
| FR-030 | Chat init (room open) | ✅ | T-040 | `POST /api/v1/chat/rooms/:idolId/open` + WS `/chat` ns | mobile `useChatRoom.open()` |
| FR-031 | Send message | ✅ | T-040/T-041 | `POST /api/v1/chat/rooms/:roomId/messages` · WS `message:send` · quota/coupon charge | mobile chat input + idol auto-reply · ADR-013 |
| FR-032 | Auto message | ✅ | T-042 | `POST /api/v1/admin/chat/auto-messages` · BullMQ delayed dispatch · WS broadcast | CMS `/announcements` page |
| FR-033 | Daily quota enforcement | ✅ | T-041 | `ChatQuota` + lazy KST reset + BullMQ `0 0 * * *` safety cron | mobile "무료 N회 남음" badge |
| FR-034 | Coupon fallback & deduction | ✅ | T-041 | `ConsumeQuotaOrCouponUseCase` atomic tx · `NO_COUPON` → 402 | mobile `useChatBalance` refresh after send |
| FR-035 | Chat history persist | ✅ | T-040 | `GET /api/v1/chat/rooms/:roomId/messages?take=&before=` (leftAt-agnostic) | mobile history load + WS de-dupe |
| FR-036 | Report & block — P1 | ⬜ | — | — | Phase 2 |
| FR-040 | Coupon product list | ✅ | T-044 / ADR-015 | `GET /api/v1/commerce/products` (public, active only) · 관리자 `GET/POST/PATCH /api/v1/admin/commerce/products` (4 kind 공통 CRUD + JSON deliveryPayload) | mobile 상점 탭 3종 · CMS `/commerce` 페이지 (kind 필터 + JSON payload 편집 + 활성 토글) |
| FR-041 | IAP purchase verify | ⬜ | T-044 / ADR-015 follow-up | MVP는 `DEV_SANDBOX`만 수락 · APPLE_IAP / GOOGLE_IAP / STRIPE는 `PROVIDER_NOT_SUPPORTED` (HTTP 400) · AppleReceiptVerifier / Stripe webhook은 ADR-015 activation plan | — |
| FR-042 | Coupon balance | ✅ | T-041 | `GET /api/v1/me/chat-balance` (free + coupons + nextResetAt) | mobile badge · CMS could surface later |
| FR-050 | Active audition list | ✅ | T-060 | `GET /api/v1/auditions` (ACTIVE만) | mobile `auditions/index.tsx` |
| FR-051 | Round detail | ✅ | T-060 | `GET /api/v1/auditions/:id` (rounds + entries) | mobile `auditions/[id].tsx` |
| FR-052 | Purchase voting ticket | ✅ | T-062/T-066/T-062b | `VOTE_TICKET` product kind · `VoteTicketFulfiller` (Commerce) — payload `{ticketAmount}` → 글로벌 버킷 / `{ticketAmount, roundId}` → 라운드-스코프 버킷 (T-062b) · `GET /api/v1/me/vote-tickets` → `{balance, roundBalances[]}` · DEV_SANDBOX fulfills inline, HTTP 402 on empty both buckets · `CastTicketVoteUseCase`는 **round 먼저 소진 후 global 대체** | mobile `shop.tsx` 탭 (상점) — VOTE_TICKET 구매 UI |
| FR-053 | Cast vote (HEART / TICKET) | ✅ | T-063/T-062 | `POST /api/v1/rounds/:id/votes` with `method: 'HEART'` or `'TICKET'` · `@Throttle(30/min)` · ADR-014 · ticket은 `ticketWeight` 적용 + 글로벌 balance 원자 차감 | mobile `rounds/[id]/vote.tsx` 에 ❤ / 🎟 버튼 2종 (T-066) |
| FR-054 | Vote ranking feed (real-time) | ✅ | T-063/T-064 | `GET /api/v1/rounds/:id/leaderboard` (Redis ZREVRANGE) · BullMQ 5-min snapshot | mobile 투표 화면 실시간 rank |
| FR-055 | My vote history — P1 | 🟡 | T-063 | `GET /api/v1/rounds/:id/me/vote-status` (daily counter) — full history 미구현 | — |
| FR-056 | Final weighted score formula | ✅ | T-061/T-063 | `score = Σ method_count × weight`, VoteRule 저장 + Vote row weight snapshot | — |
| FR-070 | Photocard sets per idol | ✅ | T-045 | `GET /api/v1/photocards/sets` · `GET /api/v1/photocards/sets/:id` (공개) · 관리자 `GET/POST/PATCH /api/v1/admin/photocards/sets` + `POST /:id/templates` | mobile 상점 탭 · CMS `/photocards` 페이지 (세트 리스트 + 상세 모달: 템플릿 추가 · 활성 토글 · 확률 % 표시) |
| FR-071 | Pull photocard (가차) | ✅ | T-045 / ADR-016 | `PHOTOCARD_PACK` 상품 kind · `PhotocardPackFulfiller` → `grantFromSet({setId,count})` · 가중 랜덤 (`dropWeight`), `$transaction` 원자성 · `dropPercent` 서버 계산 공개 (ADR-016, 게임산업법 + Apple §3.1.1 준수) | mobile 상점 포토카드 탭에 "📊 확률 공개" 토글 (확률 리스트 펼침) |
| FR-072 | My photocard collection | ✅ | T-045 / T-046 / T-046b | `GET /api/v1/me/photocards` (최대 100장) · **T-046b: templateId groupBy 집계** — `count / firstObtainedAt / lastObtainedAt` 제공, `take`는 distinct 템플릿 기준 · rarity / set 메타 포함 · 최근 획득 순 정렬 | mobile `collection.tsx` (프로필 → 📇 내 포토카드) · rarity 필터 카운트 (count-weighted) · 타일에 `×N` 뱃지 (중복 소유) · 빈 상태 상점 CTA |
| FR-073 | Photocard social share | ⬜ | T-046/047 | — | — |
| FR-074 | Photocard refund | ⬜ | T-046/047 | — | — |
| FR-075 | Photocard trade / gift | ➖ | — | **MVP 범위 외 (ADR-018)** — 게임산업법 §32.1.7 환전 금지 조항 검토 전까지 보류, trade · gift · burn · 마켓 모두 미구현. 중복 카드는 컬렉션에서 `×N`으로 노출만 | 지원 FAQ 문구 pending |
| FR-080..084 | Gamification (XP/level) | ⬜ | T-090..095 | — | — |
| FR-090..092 | Push notification | ⬜ | — | — | — |
| FR-095..096 | Purchase history | ⬜ | — | — | — |
| FR-100 | Admin login | ✅ | T-011 | `POST /api/v1/admin/auth/login`·`/refresh`·`/me` | CMS login page · ADR-010 |
| FR-101 | RBAC (admin/operator/viewer) | ✅ | T-011 | `AdminJwtAuthGuard + RolesGuard + @Roles` | CMS `RequireRole` gate |
| FR-102 | Admin user lifecycle (create / role-change) | ✅ (backend) / ⬜ (CMS) | REQ-260506 | `POST /api/v1/admin/operators` · `PATCH /api/v1/admin/operators/:id/role` (admin only). 정책: admin ≤ 3, 자기 자신 변경 금지, 마지막 admin 강등 금지, 이메일 unique. 이메일 초대 미사용 — 운영자 직접 입력. ErrorCodes: `ADMIN_NOT_FOUND`/`ADMIN_EMAIL_DUPLICATE`/`ADMIN_LIMIT_EXCEEDED`/`ADMIN_SELF_MODIFICATION_FORBIDDEN`/`ADMIN_LAST_ADMIN_DEMOTION` | SCR-CMS-OPS-LIST/CREATE/ROLE-CHANGE — 와이어프레임만 PLN-260506 §1, 코드는 후속 CMS PLN |
| FR-103 | Issue 강화 (메뉴 재구성 + admin-only / 작성자 표시 / 시작일 / 리치에디터+첨부) | ✅ | REQ-260507 | 메뉴: `/project/{docs,deliverables,wbs,tasks}` admin only · 이슈 두 번째 위치. `Issue.startAt` 필드 + `start_at` body. `description` sanitized HTML(tiptap). 첨부 `attachment_ids`. ErrorCodes: `ISSUE_INVALID_DATE_RANGE` | CMS `/project/issues` 리스트/칸반 카드/모달에 reporter+startAt 노출 + RichEditor + AttachmentList |
| FR-104 | 프로젝트 노트/게시판 (자유 양식 자료 보관) | ✅ | REQ-260507 | `GET/POST/PATCH/DELETE /api/v1/admin/project-notes` (admin/operator). 권한: 작성자 또는 admin. 카테고리 NOTE/MEETING/DECISION/LINK/OTHER + pinned. body 동일 RichEditor + sanitize. ErrorCodes: `NOTE_NOT_FOUND`/`NOTE_FORBIDDEN` | CMS `/project/notes` 카드 그리드 + 핀 그룹 + 카테고리 필터 |
| FR-INFRA-MEDIA | 첨부 업로드 (이미지/파일) | ✅ | REQ-260507 | `POST /api/v1/admin/attachments` (multipart) · `GET/DELETE /:id`. LocalDiskStorage(uploads/attachments) 우선, S3 어댑터 슬롯. MIME 화이트리스트(SVG 금지), 20MB 한도. ErrorCodes: `ATTACHMENT_NOT_FOUND`/`ATTACHMENT_TOO_LARGE`/`ATTACHMENT_MIME_NOT_ALLOWED` | RichEditor 툴바 (📷 이미지 inline / 📎 파일 첨부) |
| FR-110 | Agency CRUD | ✅ | T-020ext/T-026 | `GET/POST/PATCH/DELETE /api/v1/admin/catalog/agencies` | CMS `/agencies` page |
| FR-111 | Idol profile CRUD | ✅ | T-020ext/T-026 | `/api/v1/admin/catalog/idols[:id,publish,unpublish]` | CMS `/idols` page + create/edit modal |
| FR-112 | Idol schedule | ✅ | T-020ext/T-026 | `/api/v1/admin/catalog/idols/:id/schedules` · `DELETE /schedules/:id` | CMS edit-modal schedule section |
| FR-113 | Activate/deactivate idol | ✅ | T-020ext | publish / unpublish endpoints (FR-111) | CMS toggle button |
| FR-120 | Daily chat quota admin config | 🟡 | — | `ChatQuota.dailyLimit` column exists (per-user override), no admin UI | — |
| FR-121 | Auto message templates admin | ✅ | T-027/T-042 | `POST/GET/DELETE /api/v1/admin/chat/auto-messages` + `/:id/dispatch` | CMS `/announcements` page (status filter + create modal + cancel/dispatch) |
| FR-122 | Chat coupon products | ⬜ | T-044 | — | depends on Commerce |
| FR-123 | Manual coupon grant | ✅ | T-041 | `POST /api/v1/admin/users/:userId/chat-coupons/grant` (+ ledger audit) | CMS could surface in user drawer later |
| FR-130..139 | Audition/Round/VoteRule admin | ✅ | T-067 | `/api/v1/admin/auditions/*` (CRUD + transitions + entries + rounds + vote-rule) | CMS `/auditions` (list + detail modal + rounds + per-round vote-rule editor) |
| FR-124..129 | Chat coupon products admin | ⬜ | T-044 의존 | — | — |
| FR-140..199 | Analytics · commerce admin | ⬜ | T-049/T-068 | — | — |

> **Non-FR infra delivered**: Monorepo scaffolding (T-001/T-002/T-003), Docker Compose + Prisma (T-004), RN + CMS scaffolding (T-005/T-006), GitHub Actions CI (T-007), backend/CMS Dockerfile (T-008 partial — AWS deferred), 99-idol seed (T-028).

---

## 1. Authentication & Account (인증·회원)

### FR-001 — Social & Email Sign-up / Login (소셜·이메일 회원가입/로그인)
- **Description (설명)**: 신규 사용자는 이메일 또는 Kakao / Apple / Google 로 가입·로그인한다.
  New users register or log in via Email or Kakao / Apple / Google OAuth 2.0.
- **Input**: `{ provider: 'EMAIL'|'KAKAO'|'APPLE'|'GOOGLE', credential, deviceId }` + 약관동의 스냅샷.
- **Output**: `{ user: { id, nickname, avatarUrl }, accessToken, refreshToken, isNewUser }`.
- **Business Rules (비즈니스 규칙)**:
  1. 만 14세 미만 가입 불가 (POL-006).
  2. 동일 `(provider, providerId)` 중복 불가 → 409.
  3. 이메일 가입은 인증 메일 수신 후 6h 내 링크 클릭 필요.
  4. 탈퇴 후 30일 내 동일 이메일 재가입 시 "기존 ID 복원" 선택 가능 (POL-008).
- **Acceptance Criteria (수락 조건)**:
  - [ ] 신규 가입 → 바로 로그인 성공 (토큰 유효·서명 검증).
  - [ ] 중복 이메일 → 409 `E-USR-DUPLICATE`.
  - [ ] 만 14세 미만 생년월일 → 422 `E-USR-UNDERAGE`.
  - [ ] 소셜 OAuth 취소 → 400 `E-AUTH-OAUTH-CANCEL`.
- **Related**: NFR-005/006/008, POL-006, SC-001, SEQ-001, Tables: `aidol_users`, `aidol_refresh_tokens`.

### FR-002 — JWT Session & Refresh Rotation (세션·토큰 회전)
- **Description**: Access token 15m, Refresh token 14d(rotating). 재사용 탐지 시 전체 세션 revoke.
- **Input**: `{ refreshToken }` → `POST /auth/refresh`.
- **Output**: `{ accessToken, refreshToken }` (new pair).
- **Business Rules**:
  - Refresh token rotation (한 번 쓴 토큰은 invalid).
  - 재사용 탐지(reuse detection) 시 해당 유저의 모든 `aidol_refresh_tokens` 삭제.
  - Web(CMS) 은 HttpOnly + Secure 쿠키, Mobile 은 Keychain/Keystore 저장.
- **Acceptance**:
  - [ ] 유효 refresh → 새 페어 발급, 이전 refresh 비활성화.
  - [ ] 만료·재사용 refresh → 401 + 모든 세션 로그아웃.
- **Related**: NFR-005/008, SEQ-001b.

### FR-003 — Profile Setup (프로필 초기 설정)
- **Description**: 최초 로그인 후 닉네임·프로필 이미지 등록.
- **Input**: `{ nickname (2–20, 영문/한글/숫자, 비속어 필터), avatarFile? (≤5MB, JPEG/PNG) }`.
- **Output**: 업데이트된 User DTO.
- **Rules**:
  - 닉네임 unique(플랫폼 전체), 비속어 사전 필터.
  - 프로필 이미지는 S3 Pre-signed upload + Lambda 리사이즈 (ADR-005).
- **Acceptance**:
  - [ ] 닉네임 중복 → 409 `E-USR-NICK-TAKEN`.
  - [ ] 용량 초과/미지원 포맷 → 400 `E-USR-AVATAR-INVALID`.
- **Related**: POL-005(금칙어 필터), Table: `aidol_users`.

### FR-004 — Account Deletion (계정 탈퇴)
- **Description**: 유저 탈퇴 요청 시 30일 후 완전 파기, 법정 보관 항목만 마스킹 유지.
- **Rules**:
  - 탈퇴 즉시 soft-delete + PII anonymize.
  - 결제 이력은 5년 유지(세법), 채팅 메시지 2년 후 마스킹(POL-008).
  - 탈퇴 후 30일 내 재가입 시 복원 선택.
- **Acceptance**: [ ] 30일 경과 후 PII 필드 NULL 처리, 결제 이력은 보존.
- **Related**: POL-008, NFR-007, Tables: `aidol_users`, `aidol_purchase_transactions`.

---

## 2. Idol Discovery (아이돌 탐색)

### FR-010 — Idol List (아이돌 목록)
- **Description**: 최대 99명의 활성 아이돌을 목록/카드 형태로 조회.
- **Input**: `{ page, size (default 20), sort: 'POPULAR'|'NEW'|'NAME', agencyId? }`.
- **Output**: `{ items: [{ idolId, stageName, agencyName, thumbnailUrl, heartCount, isLiked, isFollowed }], nextCursor }`.
- **Rules**:
  - 최대 99명 활성 제한 (BR-001).
  - 정렬 기본 `display_order ASC` (CMS 설정).
  - Redis cache `catalog:idols:{sort}:{page}` TTL 60s.
- **Acceptance**:
  - [ ] 1,000 RPS 조회 시 p95 < 300ms (NFR-001).
  - [ ] 비활성·삭제 아이돌은 목록에서 제외.
- **Related**: SCR-MOB-020, SEQ-002, Table: `aidol_idols`, `aidol_idol_photos`.

### FR-011 — Idol Detail (아이돌 상세)
- **Input**: `{ idolId }`.
- **Output**: 전체 프로필 — `{ stageName, realName, agency, birthday, debutDate, conceptTags[], bioKr, photos[], schedules[], fanClubId, heartCount, followCount, isLikedByMe, isFollowedByMe, characterTraits }`.
- **Rules**:
  - soft-delete 상태는 404.
  - `characterTraits` 는 AI 채팅 페르소나 입력으로도 사용 (읽기 전용 노출은 없음).
- **Acceptance**: [ ] 미가입 유저도 공개 프로필 열람 가능.
- **Related**: SCR-MOB-021, Table: `aidol_idols`, `aidol_idol_schedules`.

### FR-012 — Idol Search / Filter (검색·필터) — P1
- **Input**: `{ q, agencyId?, tags? }`.
- **Rules**: Elastic-like full-text 없이 PG `ILIKE` + Trigram GIN 인덱스. Phase 2에 OpenSearch 이관 검토.

### FR-013 — Like Idol (좋아요 / 하트)
- **Input**: `{ idolId }`, toggle POST.
- **Output**: `{ liked: bool, heartCount }`.
- **Rules**:
  - `UNIQUE(user_id, idol_id)` → 중복 시 멱등.
  - 카운터는 `aidol_idols.idl_heart_count` non-atomic 증감 + 5분 주기 재집계.
- **Acceptance**: [ ] 중복 호출은 같은 응답 (idempotent).
- **Related**: Table: `aidol_user_idol_likes`, SCR-MOB-021.

### FR-014 — Follow Idol (팔로우)
- **Input**: `{ idolId }` toggle.
- **Output**: `{ followed: bool }` + FCM topic subscribe.
- **Rules**:
  - 팔로우 수 제한 없음. 피드는 최근 30일 포스트를 시간순 정렬.
  - FCM topic = `idol_{idolId}_{lang}`.
- **Acceptance**: [ ] 팔로우 → 피드 등장 / 언팔로우 → 제거.
- **Related**: Table: `aidol_user_idol_follows`.

### FR-015 — My Page: Likes & Follows (내 좋아요·팔로우 목록)
- **Output**: `{ likedIdols[], followedIdols[] }` paginated.
- **Acceptance**: [ ] 좋아요 해제 시 목록에서 실시간 제거.

---

## 3. Fan Club (팬클럽)

### FR-020 — Fan Club Model (1:1)
- **Rule**: 아이돌 생성 시 시스템이 공식 팬클럽 1개를 자동 생성 (BR-002).
- **Auto-create**: `aidol_fan_clubs.fcl_name = "{stage_name} 공식 팬클럽"` (CMS 에서 편집 가능).

### FR-021 — Join Fan Club (가입)
- **Input**: `{ fanClubId }`.
- **Output**: `{ membershipId, joinedAt, memberCount }`.
- **Rules**:
  - 한 팬클럽 당 유저 1회 가입. 이미 가입 → 409 `E-FC-ALREADY-MEMBER`.
  - 여러 팬클럽 동시 가입 가능 (BR-007).
  - MVP 무료(POL-003). 가입 시 기본 채팅 쿠폰 5매 자동 지급(POL-001-①).
  - 가입 시 XP +50 지급 (FR-080 연계, `FANCLUB_JOIN`).
- **Acceptance**:
  - [ ] 가입 후 채팅 탭에서 해당 아이돌 채팅방 활성.
  - [ ] 재가입 횟수 제한 없음.

### FR-022 — Leave Fan Club (탈퇴) — P1
- **Rule**: Soft-delete, 채팅 이력 유지. 보유 쿠폰은 유효기간까지 사용 가능.

### FR-023 — My Fan Clubs (가입한 팬클럽)
- **Output**: `{ joinedFanClubs[] with { idolThumbnail, unreadCount, lastMessageAt } }`.

### FR-024 — Chat Gate Check (채팅 진입 가드)
- **Rule**: REST 및 WS connection 모두 `fcm_is_active = TRUE` 검증. 탈퇴자 → 403.

---

## 4. Idol Chat (아이돌 채팅)

### FR-030 — Chat Init (채팅 초기화)
- **Input**: WS connection `{ fanClubId, authToken }`.
- **Output**: `{ chatHistory[<=100], quotaRemaining, couponBalance, autoMessagesToday[] }`.
- **Rules**:
  - 히스토리 최신 100건(페이지네이션 지원).
  - 연결 시 gate 체크(FR-024).
- **Performance**: WS handshake p95 < 500ms.
- **Related**: SEQ-005, Table: `aidol_chat_messages`.

### FR-031 — Send Message (메시지 발송)
- **Input**: `{ roomId, text (≤300 chars) }` WS event `chat:send`.
- **Output**: `{ messageId, sentAt, remainingCoupons, idolReply? }`.
- **Rules**:
  - quota 체크 → 소진 시 쿠폰 차감 (FR-034).
  - quota·쿠폰 모두 0 → WS event `chat:paywall` + 402.
  - 금칙어(POL-005) 필터. 위반 시 거절 + `E-CHAT-BADWORD`.
  - AI 아이돌 응답 (MVP: 사전 정의 풀, Phase 2: LLM — OI-002) 은 필터 통과 후 전송.
  - 발송당 XP +5 (쿨다운 5분, FR-080).
- **Acceptance**:
  - [ ] 배달 지연 < 1s (NFR-002).
  - [ ] quota=0·coupon=0 → 402 Paywall + 구매 모달 유도.
- **Related**: POL-001, POL-005, SEQ-005.

### FR-032 — Auto Message (자동 메시지)
- **Description**: 스케줄 시각(08:00 / 15:00 / 22:00 KST, CMS 조정 가능)에 WS + FCM 푸시로 모든 멤버에게 발송.
- **Rules**:
  - 쿠폰·쿼터 차감 X.
  - 하루 최대 3건, 각 200자.
  - 템플릿은 CMS `aidol_idol_chat_configs` 에서 관리(FR-121).
- **Related**: SEQ-005b.

### FR-033 — Daily Quota Enforcement (일일 쿼터)
- **Default**: 5 회/일/아이돌 (CMS 조정 가능 1~99, FR-120).
- **Reset**: 00:00 KST (cron + Redis 키 TTL).
- **Related**: POL-001, Table: (in-memory Redis counter + `aidol_chat_quota_daily` append log, derived view).

### FR-034 — Coupon Fallback & Deduction (쿠폰 대체 차감)
- **Order**: 'purchased' → 'daily' (짧은 유효기간 우선 — POL-001-④).
- **Rule**: AI 응답 성공 확정 후 차감(승인 후 원자적 트랜잭션).
- **Refund**: AI 응답 실패 → 자동 복원.

### FR-035 — Chat History Persist (채팅 이력 보관)
- **Rule**: 2년 영구 저장 후 마스킹(POL-008). 탈퇴 시 soft-delete.

### FR-036 — Report & Block (신고/차단) — P1
- **Rule**: 채팅 메시지 신고 시 `aidol_chat_reports` 로 큐잉, 3건 → 임시 차단 24h (POL-005).

---

## 5. Chat Coupon (채팅 쿠폰)

### FR-040 — Coupon Product List (쿠폰 상품 목록)
- **Output**: `[{ sku, label, quantity, priceKrw }]`. Apple/Google Store Connect 에도 동일 SKU 등록.
- **Related**: Table: `aidol_purchase_transactions`, POL-001.

### FR-041 — IAP Purchase Verify (영수증 검증)
- **Input**: `{ sku, platform, receipt | purchaseToken }`.
- **Output**: `{ success, couponBalance }`.
- **Rules**:
  - 서버사이드 Apple/Google 검증 (5s 이내, NFR-012).
  - `idempotencyKey = purchaseToken` (UNIQUE) 로 중복 수용 불가.
  - 성공 시 `aidol_purchase_transactions.ptr_status = COMPLETED` + 쿠폰 지급.
  - XP +20 (FR-080, `VOTE_TICKET_BUY` 와 별개 키).
- **Acceptance**: [ ] 동일 receipt 재요청 → 멱등 200, 지급 중복 없음.
- **Related**: SEQ-006a, NFR-012.

### FR-042 — Coupon Balance (쿠폰 잔액)
- **Output**: `{ couponBalance: int }` (글로벌, 아이돌 무관).

---

## 6. Audition & Voting (오디션·투표)

### FR-050 — Active Audition (진행 중 오디션)
- **Output**: `{ auditionId, name, currentRound, endsAt, topIdols[3] }` or `null`.
- **Rule**: 1개만 ACTIVE. 없으면 null.

### FR-051 — Round Detail (회차 상세)
- **Output**: `{ roundNo, type: 'PRELIMINARY'|'FINAL', voteTypes[], ranking[], endsAt, userTicketBalance }`.
- **Ranking**: Redis ZSET `vote:round:{roundId}` 기반, 30s 폴링 또는 WS broadcast.
- **Related**: Table: `aidol_audition_rounds`, `aidol_votes`, SEQ-007.

### FR-052 — Purchase Voting Ticket (투표권 구매)
- **Input**: `{ sku, receipt, roundId }`.
- **Output**: `{ ticketBalanceForRound }`.
- **Rule**: 투표권은 **round-specific**, 라운드 종료 시 만료.
- **Related**: Table: `aidol_voting_ticket_balances`, `aidol_round_ticket_configs`.

### FR-053 — Cast Vote (투표 행사)
- **Input**: `{ roundId, idolId, voteCount, voteType: 'ONLINE'|'SMS'|'POPULARITY' }`.
- **Output**: `{ success, remainingTickets, idolRank }`.
- **Business Rules**:
  - Round 상태 `ACTIVE` 이고 마감 미도래.
  - 보유 ticket ≥ voteCount.
  - 회차 `aidol_vote_type_configs` 에 voteType 허용 여부 확인.
  - Redis ZINCRBY 즉시 반영 + 5분 주기 DB 집계 배치 (NFR-004).
  - XP +10/표 (일 최대 100, FR-080).
- **Acceptance**:
  - [ ] 마감 1초 전 투표 수용, 마감 후 409 `E-AUD-CLOSED`.
  - [ ] 원자적 차감 → 실패 시 ticket 복구.
- **Related**: POL-002, POL-004, SEQ-007, NFR-004.

### FR-054 — Vote Ranking Feed (실시간 랭킹)
- **Output**: `[{ idolId, name, thumbnail, voteCount, rank, rankDelta }]`. `rankDelta` = 1h snapshot 대비.

### FR-055 — Vote History (내 투표 내역) — P1
- **Output**: `[{ roundId, idolId, voteCount, voteType, votedAt }]` paginated.

### FR-056 — Final Weighted Score Formula (결선 가중 합산)
- **Rule**: `final_score = Σ(voteCount[type] × weight[type])` (POL-004).
- **Round close**: 스케줄러가 `endsAt` 에 `round.status = CLOSED` 처리, admin 최종 확정(FR-148).

---

## 7. Photocard (포토카드)

### FR-070 — Photocard Sets per Idol (세트 목록)
- **Output**: `[{ setId, name, cardCount=12, pricePerPull, previewImages[3] }]` (ACTIVE 만).
- **Related**: Table: `aidol_photocard_sets`, `aidol_photocards`.

### FR-071 — Pull Photocard (가차 뽑기)
- **Input**: `{ setId, receipt }`.
- **Output**: `{ photocard: { id, name, imageUrl, rarity } }`.
- **Rules**:
  - Server-side `crypto.randomInt(0, 11)` (BR-006).
  - 중복 허용. Phase 2 에서 컬렉션 포인트 적립.
  - XP +30 (일 최대 150, FR-080).
- **Acceptance**: [ ] 영수증 검증 통과 후에만 뽑기 발생, 원자성 보장.

### FR-072 — My Collection (컬렉션)
- **Output**: `[{ photocardId, idolId, cardName, imageUrl, rarity, countOwned, acquiredAt }]` — 12슬롯 전부 노출, 미보유는 silhouette(`imageUrl=null`).

### FR-073 — Social Share (인스타 공유) — P1
- **Rule**: Phase 1 은 native OS Share Sheet (OI-004). 워터마크 = 아이돌명 + A-idol 로고.

### FR-074 — Photocard Refund (환불) — P2
- **Rule**: 디지털 상품 특성상 환불 불가(POL-009). 예외는 CMS 승인.

---

## 8. Fan Level / Gamification (팬 레벨·게임화)

> 출처: `docs/reference/a-idol-level-policy.md` (v1.0.0) — 10단계, XP 곡선 `500 × (n-1) × 1.35^(n-2)`.

### FR-080 — XP Grant on Activity (XP 지급)
- **Input (internal)**: `{ userId, activity: XpActivityType, refId? }`.
- **Activities & Limits (활동·한도)**:

  | activity | xp/action | daily limit | cooldown |
  |----------|-----------|-------------|----------|
  | `DAILY_LOGIN` | 10 | 10 | — |
  | `LOGIN_STREAK` | +5/day | +50 | — |
  | `CHAT_MESSAGE` | 5 | 50 | 300s |
  | `VOTE_TICKET_BUY` | 20 | 100 | — |
  | `VOTE_CAST` | 10 | 100 | — |
  | `PHOTOCARD_PULL` | 30 | 150 | — |
  | `FANCLUB_JOIN` | 50 | once per idol | — |
  | `PROFILE_COMPLETE` | 100 | once | — |
  | `IDOL_LIKE` | 2 | 20 | — |
  | `IDOL_FOLLOW` | 5 | 25 | — |
- **Rules**:
  - 일일 상한 초과분은 silent drop(로그 `xpt_note='DAILY_CAP'`).
  - 쿨다운은 Redis `cooldown:{userId}:{activity}` 키로 관리.
  - CMS (FR-170) 에서 계수·한도·쿨다운 동적 조정.
- **Related**: Tables: `aidol_xp_transactions`, `aidol_user_level_stats`, `aidol_xp_activity_configs`.

### FR-081 — My Level / XP / Streak (내 레벨)
- **Output**: `{ currentLevel, totalXp, nextLevelXp, loginStreak, maxStreak, badgeImageUrl }`.
- **Displays**: 채팅 상단, 마이페이지, 팬클럽 목록, 투표 완료 화면 (UI Spec §6).

### FR-082 — Level Benefits Activation (레벨 혜택 적용)
- **Rule**: 채팅 쿼터 보너스(+1/+2/+3), 투표/가차 할인 쿠폰, 얼리 액세스 등은 레벨업 시 자동 부여. 상세는 POL-011.

### FR-083 — Fan Streak Tracking (연속 출석 집계)
- **Rule**: 하루 첫 로그인(00:00 KST 경계) → streak +1. 공백 1일 → 0 리셋. 7/30/100/365 마일스톤 보상.

### FR-084 — Level Upgrade Notification (레벨업 알림) — P1
- **Rule**: FCM push + 인앱 토스트. Phase 1 에는 인앱만, Phase 2 에 푸시 추가.

---

## 9. Push Notification (푸시)

### FR-090 — Device Token Register (토큰 등록)
- **Input**: `{ token, platform: 'IOS'|'ANDROID' }`.
- **Rule**: 신규 토큰은 기존 `udt_is_active=FALSE` 처리.

### FR-091 — Notification Channels (채널)
- **Essential (필수)**: 결제 확인, 오디션 마감 임박, 자동 메시지. 수신 동의 무관(POL-007).
- **Marketing (마케팅)**: 공지, 이벤트. 야간 21:00–09:00 KST 금지, 수신 동의 OFF 시 skip.

### FR-092 — Quiet Hours & Opt-in (정숙시간·옵트인)
- **Acceptance**: [ ] 수신 동의 OFF 상태에서 결제 푸시는 발송, 마케팅은 미발송.

---

## 10. Purchase History & Receipts (결제 이력)

### FR-095 — Purchase History (결제 내역)
- **Input**: `{ range: { from, to }, type?: ProductType }`.
- **Output**: `[{ orderId, item, amount, status, receiptUrl }]`.
- **Rules**: 5년 보관(POL-008), 스토어 영수증 URL 병기.

### FR-096 — Receipt View (영수증 상세)
- **Output**: 스토어에서 발행한 receipt + 내부 `ptr_id`, verifier 서명 시각.

---

## 11. Admin CMS — Functional Requirements (관리자 CMS 기능)

### 11.1 Identity & RBAC

#### FR-100 — Admin Login with 2FA
- **Input**: `{ email, password, totpCode }`.
- **Rule**: MFA 필수(POL-010), 세션 JWT 4h, 실패 5회 → 30분 잠금.
- **Related**: Table: `aidol_admin_users`, `aidol_admin_roles`, NFR-005.

#### FR-101 — Role-Based Access Control (RBAC)
- **Roles**: `super_admin` / `content_admin` / `audition_admin` / `cs_admin`.
- **Rule**: `super_admin` ≤ 3명 유지. 모든 쓰기 `aidol_audit_logs` 기록.

### 11.2 Agency & Idol

#### FR-110 — Agency CRUD (소속사)
- **Form Fields**: `{ name, logoUrl, contactEmail, isActive }`.

#### FR-111 — Idol Profile CRUD (아이돌 CRUD)
- **Fields**:

  | Field | Type | Required | Validation |
  |-------|------|----------|-----------|
  | `stage_name` | string | ✓ | 1–50 |
  | `real_name` | string | | 1–50 |
  | `agency_id` | FK | ✓ | exists |
  | `birthday` | date | | past |
  | `debut_date` | date | | |
  | `concept_tags` | string[] | | ≤5 tags, 각 ≤20 chars |
  | `bio_kr` | text | | ≤1000 |
  | `profile_photos` | image[] | ✓ | 1–10, ≤5MB each |
  | `character_traits` | JSON | | `{ personality, speech_style, hobbies, catchphrases }` |
  | `display_order` | int | | 정렬 우선도 |
- **Rule**: 활성 아이돌 99명 제한(BR-001), `publish_at` 예약 가능. 저장 후 모바일 캐시 TTL 60s 내 반영.

#### FR-112 — Idol Schedule (일정)
- **Input**: `{ idolId, type: 'BROADCAST'|'CONCERT'|'FANMEETING'|'OTHER', title, startAt, endAt, location }`.
- **Rule**: `endAt > startAt`.

#### FR-113 — Activate/Deactivate Idol (활성화)
- **Rule**: 비활성화 아이돌은 모바일 목록에서 즉시 제외, 팬클럽·채팅은 유지(데이터 삭제 X).

### 11.3 Fan Club & Chat Configuration

#### FR-120 — Daily Chat Quota (쿼터 설정)
- **Input**: `{ idolId, quotaCount: 1..99 }` → 다음 00:00 KST 부터 적용.

#### FR-121 — Auto Message Templates (자동 메시지 템플릿)
- **Input**: `{ idolId, slot: 'MORNING'|'NIGHT'|'AFTERNOON', content (≤200), scheduledAt }`.
- **Rule**: 최대 3 슬롯/일.

#### FR-122 — Chat Coupon Products (쿠폰 상품 관리)
- **Input**: `{ sku, label, quantity, priceKrw, platformSkus }`.

#### FR-123 — Manual Coupon Grant (수동 지급)
- **Rule**: CS 보상용, audit log 필수(POL-001 예외).

### 11.4 Photocard Management

#### FR-130 — Photocard Set CRUD (세트 CRUD)
- **Input**: `{ idolId, setName, 12 × { cardName, imageFile, rarity: 'COMMON'|'RARE'|'EPIC' } }`.
- **Rule**: 정확히 12장 필수. 저장 시 세트 + 카드 트랜잭션 생성.

#### FR-131 — Photocard Pricing
- **Rule**: `pricePerPull` 은 IAP 상품가와 일치해야 함.

#### FR-132 — Activate Photocard Set
- **Rule**: 비활성 세트는 가차 불가.

### 11.5 Audition Operation

#### FR-140 — Create Audition (오디션 생성)
- **Input**: `{ name, description, startDate, participatingIdolIds[≥2] }`.
- **Output**: `audition + rounds (PENDING)`.

#### FR-141 — Preliminary Rounds 1–10 (예선 회차)
- **Rule**: 회차는 순차적, 다음 라운드 ACTIVE 는 이전 라운드 CLOSED 이후.

#### FR-142 — Activate Round (회차 활성화)
- **Input**: `{ roundId, startAt, endAt }` → `status = ACTIVE`.
- **Rule**: 동시에 ACTIVE 라운드 1개만 허용.

#### FR-143 — Advancement Rule (진출 규칙)
- **Input**: `{ roundId, topN | manualIdolIds[] }`.
- **Output**: 다음 라운드 `entry_status='ADVANCED'`.

#### FR-145 — Create Final (결선 생성)
- **Rule**: 예선 통과자가 자동 배치.

#### FR-146 — Final Vote Types (결선 투표 종류)
- **Rule**: ONLINE + SMS + POPULARITY 허용. SMS 는 외부 연동(Phase 2 스텁, ADR-004).

#### FR-147 — Vote Weight Config (가중치 설정)
- **Input**: `{ roundId, [{ voteType, weight }] }`. Σweights = 1.0 ± 0.001.
- **Rule**: 라운드 시작 이후 수정 금지. 수정 시 new version.
- **Related**: POL-004.

#### FR-148 — Finalize Round (마감·집계)
- **Rule**: 스케줄러가 `endAt` 에 자동 CLOSED → 관리자가 FINALIZED 확정. 가중 합산 스코어 저장.

#### FR-149 — Live Ranking & Weighted View (실시간·가중 랭킹)
- **Rule**: CMS 대시보드 30s 리프레시. CSV 내보내기.

#### FR-150 — Ticket Purchase Limit per User (회차별 상한)
- **Default**: 10/유저/라운드 (CMS 조정).

### 11.6 Statistics & Reporting

#### FR-160 — DAU / MAU / Retention (이용자 통계)
- **Output**: 차트 + CSV, 기본 30일 rolling.

#### FR-161 — Vote Statistics (투표 통계) — **P0**
- **Output**: `round × idol × voteType × count × weighted_score`.

#### FR-162 — Photocard Revenue (매출 통계)
- **Output**: gross/net(스토어 수수료 제외), pulls count, set-breakdown.

#### FR-163 — Chat Coupon Stats (쿠폰 통계)
- **Output**: 판매/소모/유저당 평균.

#### FR-164 — CSV Export — P2
- **Rule**: 최대 1년 범위.

### 11.7 Level & Gamification Admin

#### FR-170 — XP Activity Config (XP 활동 설정)
- **Input**: activity 별 `{ xpPerAction, dailyLimit, cooldownSeconds, isActive }`.
- **Rule**: 변경 시 audit log. 저장 직후 Redis 설정 캐시 invalidate.

#### FR-171 — Level Distribution Dashboard (레벨 분포)
- **Output**: `[{ level, userCount }]` + 히스토그램.

### 11.8 Report & Moderation — P1

#### FR-180 — Reports Queue (신고 처리 큐)
- **Input**: `{ targetType: 'MESSAGE'|'USER', targetId, reason }`.
- **Flow**: pending → reviewed → action (suspend / dismiss).

---

## 12. Non-Functional Requirements (비기능 요구사항)

| ID | Category | Requirement | Measurement | Priority |
|----|----------|-------------|-------------|----------|
| NFR-001 | Performance | 조회 API p95 ≤ 300ms / 쓰기 ≤ 800ms | APM (Datadog) | P0 |
| NFR-002 | Performance | WS 메시지 배달 지연 ≤ 1s | WS ping + delivery probe | P0 |
| NFR-003 | Scalability | 동시접속 50,000 (오디션 피크) | k6 부하테스트 | P0 |
| NFR-004 | Scalability | 투표 쓰기 1,000 TPS | Redis pipeline + async DB | P0 |
| NFR-005 | Security | JWT 필수 (except `/auth/*`) | Nest AuthGuard | P0 |
| NFR-006 | Security | Rate limit: `/auth/*` 10/min/IP, `/vote` 20/min/user | Redis 토큰 버킷 | P0 |
| NFR-007 | Privacy | 개인정보보호법/GDPR — 동의 저장, 30일 후 파기 | PII 칼럼 암호화 | P0 |
| NFR-008 | Security | HTTPS 강제, JWT + Refresh rotation, Keychain 저장 | — | P0 |
| NFR-009 | Availability | 월 99.5% uptime | 외부 uptime monitor | P0 |
| NFR-010 | Mobile | Cold start ≤ 3s on mid-range Android | RN 프로파일링 | P1 |
| NFR-011 | Mobile | App bundle ≤ 50MB | Hermes + 코드 스플리팅 | P1 |
| NFR-012 | Payment | IAP 영수증 검증 ≤ 5s | 구매-지급 간 측정 | P0 |
| NFR-013 | Accessibility | WCAG AA 준수, 터치 타겟 ≥44×44 | axe scan + 수동 | P1 |
| NFR-014 | Compat | iOS 15+ / Android 11+ | 호환성 매트릭스 | P0 |
| NFR-015 | i18n | MVP ko-KR, i18n 구조는 선제 적용 | translation json | P1 |
| NFR-016 | Quality | 백엔드 커버리지 ≥70%, 모바일 ≥50% | CI coverage gate | P0 |

---

## 13. API Endpoint Summary (엔드포인트 요약)

### Fan Mobile API

| Method | Endpoint | FR |
|--------|----------|----|
| POST | `/auth/kakao` \| `/auth/apple` \| `/auth/google` \| `/auth/email` | FR-001 |
| POST | `/auth/refresh` | FR-002 |
| PUT | `/users/me/profile` | FR-003 |
| DELETE | `/users/me` | FR-004 |
| GET | `/idols` | FR-010 |
| GET | `/idols/:id` | FR-011 |
| POST | `/idols/:id/like` | FR-013 |
| POST | `/idols/:id/follow` | FR-014 |
| GET | `/users/me/liked-idols` \| `/followed-idols` | FR-015 |
| GET | `/fan-clubs/:id` | FR-020 |
| POST | `/fan-clubs/:id/join` | FR-021 |
| DELETE | `/fan-clubs/:id/leave` | FR-022 |
| GET | `/users/me/fan-clubs` | FR-023 |
| WS | `/chat` (connect by `fanClubId`) | FR-030..035 |
| GET | `/products/chat-coupons` | FR-040 |
| POST | `/purchases/verify-iap` | FR-041 |
| GET | `/users/me/coupons` | FR-042 |
| GET | `/auditions/active` | FR-050 |
| GET | `/auditions/rounds/:id` | FR-051 |
| POST | `/auditions/rounds/:id/tickets/purchase` | FR-052 |
| POST | `/auditions/rounds/:id/vote` | FR-053 |
| GET | `/users/me/vote-history` | FR-055 |
| GET | `/idols/:id/photocard-sets` | FR-070 |
| POST | `/photocards/pull` | FR-071 |
| GET | `/users/me/photocards` | FR-072 |
| GET | `/users/me/level` \| `/xp-history` | FR-081 |
| POST | `/device-tokens` | FR-090 |
| GET | `/users/me/purchases` | FR-095 |

### Admin CMS API (prefix `/admin`)

| Method | Endpoint | FR |
|--------|----------|----|
| POST | `/admin/auth/login` | FR-100 |
| GET/POST/PUT | `/admin/agencies` | FR-110 |
| GET/POST/PUT | `/admin/idols` (`/activate`, `/deactivate`) | FR-111, FR-113 |
| PUT | `/admin/idols/:id/chat-config` | FR-120, FR-121 |
| GET/POST/PUT | `/admin/photocard-sets` | FR-130..132 |
| GET/POST | `/admin/auditions` | FR-140 |
| PUT | `/admin/auditions/rounds/:id/activate` | FR-142 |
| PUT | `/admin/auditions/rounds/:id/vote-config` | FR-147 |
| POST | `/admin/auditions/rounds/:id/finalize` | FR-148 |
| GET | `/admin/stats/votes` \| `/revenue` \| `/users` \| `/level-distribution` | FR-160..163, FR-171 |
| GET | `/admin/stats/export.csv` | FR-164 |
| GET/PUT | `/admin/xp-configs` | FR-170 |
| GET/POST | `/admin/reports` | FR-180 |

---

## 14. Traceability Matrix (추적성 매트릭스)

> 풀 트레이스: FR → FN → Screen(SCR) → Sequence(SEQ) → DB Table → Policy → Test Case(TC).

| FR | FN | Screen | Sequence | Tables (`aidol_*`) | Policy | TC |
|----|----|--------|----------|---------------------|--------|----|
| FR-001 | FN-011 | SCR-MOB-001, SCR-MOB-002 | SEQ-001 | `users`, `refresh_tokens` | POL-006 | TC-001..005 |
| FR-002 | FN-012 | — | SEQ-001b | `refresh_tokens` | POL-010 | TC-006 |
| FR-003 | FN-013 | SCR-MOB-003 | — | `users` | POL-005 | TC-007 |
| FR-004 | FN-014 | SCR-MOB-090 | — | `users` | POL-008 | TC-008 |
| FR-010 | FN-021 | SCR-MOB-020 | SEQ-002 | `idols`, `idol_photos` | — | TC-010..012 |
| FR-011 | FN-022 | SCR-MOB-021 | SEQ-002 | `idols`, `idol_schedules` | — | TC-013 |
| FR-013 | FN-023 | SCR-MOB-021 | SEQ-003 | `user_idol_likes`, `idols` | — | TC-015 |
| FR-014 | FN-024 | SCR-MOB-021 | SEQ-003 | `user_idol_follows` | — | TC-016 |
| FR-015 | FN-025 | SCR-MOB-080 | — | (view) | — | TC-017 |
| FR-020..024 | FN-031..034 | SCR-MOB-030, SCR-MOB-081 | SEQ-004 | `fan_clubs`, `fan_club_memberships` | POL-003 | TC-020..023 |
| FR-030..035 | FN-041..046 | SCR-MOB-040, SCR-MOB-041 | SEQ-005 | `chat_messages`, `idol_chat_configs` | POL-001, POL-005 | TC-030..036 |
| FR-040..042 | FN-051..053 | SCR-MOB-042 | SEQ-006a | `purchase_transactions` | POL-001 | TC-040..043 |
| FR-050..056 | FN-061..067 | SCR-MOB-050..053 | SEQ-007 | `auditions`, `audition_rounds`, `votes`, `voting_ticket_balances`, `vote_type_configs`, `round_ticket_configs` | POL-002, POL-004 | TC-050..057 |
| FR-070..074 | FN-071..074 | SCR-MOB-060..062 | SEQ-006b | `photocard_sets`, `photocards`, `user_photocards` | POL-009 | TC-070..074 |
| FR-080..084 | FN-081..084 | SCR-MOB-082 | SEQ-008 | `user_level_stats`, `xp_transactions`, `xp_activity_configs`, `fan_levels` | POL-011 | TC-080..084 |
| FR-090..092 | FN-091..092 | SCR-MOB-007 | SEQ-009 | `user_device_tokens` | POL-007 | TC-090..091 |
| FR-095..096 | FN-095..096 | SCR-MOB-083 | — | `purchase_transactions` | POL-008, POL-009 | TC-095 |
| FR-100..101 | FN-101 | SCR-CMS-001 | — | `admin_users`, `admin_roles`, `audit_logs` | POL-010 | TC-100 |
| FR-110 | FN-110 | SCR-CMS-010 | — | `agencies` | — | TC-110 |
| FR-111..113 | FN-111..113 | SCR-CMS-020..022 | — | `idols`, `idol_photos`, `idol_schedules` | — | TC-111..113 |
| FR-120..123 | FN-121..123 | SCR-CMS-030..031 | — | `idol_chat_configs`, `purchase_transactions` | POL-001 | TC-120..123 |
| FR-130..132 | FN-131..133 | SCR-CMS-040..041 | — | `photocard_sets`, `photocards` | — | TC-130..132 |
| FR-140..150 | FN-141..150 | SCR-CMS-050..054 | — | `auditions`, `audition_rounds`, `vote_type_configs`, `round_ticket_configs`, `idol_audition_entries` | POL-002, POL-004 | TC-140..150 |
| FR-160..164 | FN-161..164 | SCR-CMS-060..064 | — | (views / aggregates) | POL-008 | TC-160..164 |
| FR-170..171 | FN-170..171 | SCR-CMS-070..071 | — | `xp_activity_configs`, `user_level_stats` | POL-011 | TC-170..171 |
| FR-180 | FN-180 | SCR-CMS-080 | — | `chat_reports` | POL-005 | TC-180 |

---

## 15. Error Codes (에러 코드 — 발췌)

| Code | HTTP | Meaning |
|------|------|---------|
| `E-USR-DUPLICATE` | 409 | 이메일/닉네임 중복 |
| `E-USR-UNDERAGE` | 422 | 만 14세 미만 |
| `E-USR-NICK-TAKEN` | 409 | 닉네임 중복 |
| `E-AUTH-OAUTH-CANCEL` | 400 | 소셜 로그인 취소 |
| `E-AUTH-REFRESH-REUSE` | 401 | refresh 재사용 탐지 |
| `E-FC-ALREADY-MEMBER` | 409 | 팬클럽 이미 가입 |
| `E-CHAT-PAYWALL` | 402 | 쿼터·쿠폰 소진 |
| `E-CHAT-BADWORD` | 422 | 금칙어 |
| `E-IAP-DUPLICATE` | 409 | 영수증 중복 |
| `E-IAP-VERIFY-FAIL` | 502 | 스토어 검증 실패 |
| `E-AUD-CLOSED` | 409 | 라운드 마감 |
| `E-AUD-TICKET-INSUFFICIENT` | 402 | 투표권 부족 |
| `E-PCD-SET-INACTIVE` | 409 | 포토카드 세트 비활성 |
| `E-ADM-MFA-REQUIRED` | 401 | 2FA 미인증 |
| `E-XP-DAILY-CAP` | — | 내부 로그(무시) |

---

## 16. Open Issues (미결 이슈)

| ID | Issue | Owner | Status | Target Decision |
|----|-------|-------|--------|----------------|
| OI-001 | Payment gateway(Stripe + IAP) 세부 계약 | PO | Resolved (Stripe + App Store/Play) | 확정 |
| OI-002 | AI 채팅 엔진 — 사전 룰 vs LLM (Claude) | PO | Open | 2026-05-31 |
| OI-003 | 결선 진출 자동/수동 결정 | PO | Resolved (admin manual trigger) | 확정 |
| OI-004 | 포토카드 공유 — Basic Display API vs Share Sheet | Dev Lead | Open | 2026-06-15 |
| OI-005 | 팔로우 아이돌 푸시 빈도 정책 | PO | Open | 2026-06-30 |
| OI-006 | 소속사 sub-admin 포털 범위 | PO | Deferred to Phase 2 | — |

---

## 17. Glossary (용어집 — 발췌)

| 용어 | 설명 |
|------|------|
| Fan (팬) | 모바일 앱 유저. |
| Fan Club (팬클럽) | 아이돌 1인당 공식 1개. 가입자만 채팅 가능. |
| Chat Coupon (채팅 쿠폰) | 1매 = 1 메시지. 기본 5매/일 + 추가 구매. |
| Quota (쿼터) | 팬이 하루에 아이돌과 주고받을 수 있는 기본 채팅 횟수. |
| Voting Ticket (투표권) | 라운드별 귀속. 라운드 종료 시 만료. |
| Photocard Pull (가차) | 12종 중 1종 랜덤 취득. |
| Fan Level (팬 레벨) | 10단계 게임화 레벨. XP 누적. |
| Streak (스트릭) | 연속 로그인 일수 보너스. |

---

> **다음 문서 (Next)** : `a-idol-func-definition.md`(모듈별 FN 스펙) → `a-idol-sequence.md`(시퀀스 다이어그램) → `a-idol-erd.md`(DDL v2) → `a-idol-policy.md`(정책) → `a-idol-dev-plan.md`(개발계획).
