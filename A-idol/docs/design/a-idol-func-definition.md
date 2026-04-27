---
document_id: A-IDOL-FUNC-DEF-1.0.0
version: 1.0.0
status: Draft
created: 2026-04-18
updated: 2026-04-18
author: Gray Kim
---

# A-idol — Functional Specification (A-아이돌 기능 정의서)

모듈/컴포넌트 단위로 기능(Function, FN)의 계약을 정의한다. 각 FN은 1개 이상의 FR을 구현한다.

---

## Module: Identity (인증/회원)

### FN-011: `AuthenticateUserUseCase`
- **FR**: FR-001
- **Pre**: 제공된 credential이 유효
- **Post**: AuthSession 저장, access/refresh 발급
- **Input**: `{ provider, credential, deviceId }`
- **Output**: `{ user, accessToken, refreshToken }`
- **Logic**:
  1. provider 별 credential 검증 (OAuth provider 호출 또는 bcrypt 비교)
  2. User upsert (최초 로그인 시 가입)
  3. 약관 동의 스냅샷 저장 (first login only)
  4. AuthSession 생성, refresh token rotation 준비
  5. JWT signing
- **Errors**: `INVALID_CREDENTIAL` 401, `UNDER_AGE` 422, `OAUTH_PROVIDER_ERROR` 502

### FN-012: `RefreshAccessTokenUseCase`
- **FR**: FR-001 (속성)
- **Input**: `{ refreshToken }`
- **Output**: 신규 access + 회전된 refresh
- **Logic**: 만료/재사용 탐지(detection) → 탐지 시 모든 세션 revoke.

---

## Module: Catalog (아이돌 카탈로그)

### FN-021: `ListIdolsUseCase`
- **FR**: FR-003
- **Input**: `{ page, size, sort: 'popularity'|'name'|'new' }`
- **Output**: `{ items: IdolCardView[], nextCursor }`
- **Logic**: Redis cache (`catalog:idols:{sort}:{page}`, TTL 60s). 캐시 miss 시 PostgreSQL `SELECT ... FROM idols WHERE published_at <= now()`

### FN-022: `HeartIdolUseCase`
- **FR**: FR-004
- **Input**: `{ userId, idolId, op: 'heart'|'unheart' }`
- **Output**: `{ hearted: boolean, heartCount: number }`
- **Logic**:
  1. `hearts (user_id, idol_id) UNIQUE` 삽입/삭제
  2. `idols.heart_count` 증감 (트랜잭션)
  3. Redis invalidate catalog caches tagged with this idol

### FN-023: `FollowIdolUseCase`
- **FR**: FR-005
- **유사 FN-022 구조, `follows` 테이블**

---

## Module: Fandom (팬클럽)

### FN-031: `JoinFanClubUseCase`
- **FR**: FR-006
- **Input**: `{ userId, fanClubId }`
- **Output**: `{ membership }`
- **Logic**:
  1. FanClub 존재 확인 (아이돌당 1개 공식)
  2. 이미 가입 여부 확인 (409 if yes)
  3. Membership 생성
  4. Event `MembershipJoined` 발행 → Chat 모듈이 ChatRoom 자동 생성

---

## Module: Chat (채팅)

### FN-041: `SendChatMessageUseCase`
- **FR**: FR-007, FR-009
- **Pre**: 유저가 해당 아이돌 팬클럽 멤버, 쿠폰 잔여 > 0
- **Input**: `{ userId, roomId, text }`
- **Output**: `{ message: ChatMessage, remainingCoupons }`
- **Logic**:
  1. 멤버십 검증
  2. 어휘 필터 (POL-005) 통과
  3. 쿠폰 1매 차감 (UPDATE ... RETURNING, 음수 방지 WHERE balance > 0)
  4. 메시지 삽입, WS broadcast
  5. AI 응답 요청 큐잉 (BullMQ `chat-response`)

### FN-042: `DispatchAutoMessageJob`
- **FR**: FR-008
- **Trigger**: Cron (CMS 설정한 스케줄 — 기본 아침 9시/밤 10시/오후 3시)
- **Logic**:
  1. `auto_message_templates` 조회
  2. 대상 유저(해당 아이돌 팬클럽 멤버) batch
  3. 쿠폰 미차감으로 `chat_messages` 삽입
  4. 푸시 발송(FCM/APNS)

### FN-043: `PurchaseChatCouponUseCase`
- **FR**: FR-009
- **Input**: `{ userId, packageId, receipt }`
- **Output**: `{ couponsAdded, newBalance }`
- **Logic**: Commerce.VerifyReceipt → 성공 시 쿠폰 잔액 증가.

---

## Module: Commerce (결제/포토카드)

### FN-051: `VerifyAppReceiptUseCase`
- **FR**: FR-010, FR-015 공용
- **Input**: `{ platform, receipt }`
- **Output**: `{ orderId, productCode, amount }`
- **Logic**:
  1. 플랫폼별 검증 API 호출 (Apple `verifyReceipt` sandbox→prod fallback, Google `purchases.products.get`)
  2. 중복 영수증 방지 (`receipts.transaction_id UNIQUE`)
  3. Order 생성 + Commerce 이벤트 발행

### FN-052: `DrawPhotoCardUseCase`
- **FR**: FR-010
- **Input**: `{ userId, setId, orderId }`
- **Output**: `{ ownedCardId, cardItem }`
- **Logic**:
  1. 해당 세트의 12개 카드 중 균등 랜덤 1개 선정(시드: `crypto.randomInt`)
  2. `user_cards` INSERT
  3. duplicate 검사하여 중복 counter 반영

### FN-053: `ShareCardUseCase`
- **FR**: FR-012
- **Logic**: 서버에서 워터마크 포함 PNG 생성(sharp + composite), pre-signed URL 반환, 앱이 OS Share API로 게시.

---

## Module: Audition (오디션/투표)

### FN-061: `OpenRoundUseCase` (CMS)
- **FR**: FR-104
- **Logic**: 새 Round 생성, 이전 Round close, VoteRule ref.

### FN-062: `CastVoteUseCase`
- **FR**: FR-013, FR-014
- **Pre**: Round.active, 유저가 투표권 amount 이상 보유
- **Input**: `{ userId, roundId, idolId, amount }`
- **Output**: `{ remaining }`
- **Logic**:
  1. `vote_tickets.balance >= amount` 트랜잭션 차감
  2. `votes (user_id, round_id, idol_id, amount)` INSERT + 부분 UNIQUE (user_id, round_id)? — 중복 투표 허용(복수 투표권) 시 UNIQUE는 쓰지 않고 `SUM`으로 집계
  3. Redis `vote:round:{id}:idol:{id}` INCRBY (실시간 순위용)

### FN-063: `AggregateRankingJob`
- **Trigger**: 5분 cron
- **Logic**: 온라인/SMS/인기도 가중 합산 → `rankings_{round_id}` 뷰/테이블 갱신.

### FN-064: `CloseRoundUseCase`
- **Logic**: 종료 시각 경과 또는 수동 트리거 → 상위 N 진출자 확정, 다음 회차 활성화.

---

## Module: Notification (알림)

### FN-071: `RegisterPushTokenUseCase`
- **Input**: `{ userId, platform, token }`
- **Logic**: 동일 userId의 이전 토큰 invalidate, 신규 저장.

### FN-072: `DispatchPushJob`
- **Trigger**: 이벤트(결제완료/투표공지/채팅) 또는 마케팅 스케줄
- **Logic**: FCM/APNS batch 발송, 실패 토큰 정리.

---

## Module: AdminOps (CMS 관리)

### FN-101: RBAC 가드
### FN-102: `UpsertIdolProfileUseCase` (FR-102)
### FN-104: `ManageAuditionUseCase` (FR-104)
### FN-105: `SetVoteRuleUseCase` (FR-105)
### FN-107: `QueryAnalyticsUseCase` (FR-107)

공통 입출력 패턴: 모든 CMS 쓰기 유즈케이스는 `AuditLog`에 행 단위 변경 이력을 남긴다.
