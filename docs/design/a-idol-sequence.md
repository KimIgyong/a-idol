---
document_id: A-IDOL-SEQ-1.0.0
version: 1.0.0
status: Draft
created: 2026-04-18
updated: 2026-04-18
author: Gray Kim
---

# A-idol — Sequence Diagrams (A-아이돌 시퀀스 다이어그램)

모든 주요 유즈케이스의 프론트↔백엔드↔외부시스템 상호작용을 Mermaid로 정의한다.

---

## SEQ-001 — Social Sign-in (소셜 로그인)

```mermaid
sequenceDiagram
    actor U as User
    participant M as Mobile (RN)
    participant OAuth as OAuth Provider
    participant API as NestJS API
    participant DB as PostgreSQL
    participant R as Redis

    U->>M: "Sign in with Kakao" tap
    M->>OAuth: OAuth dialog
    OAuth-->>M: id_token / access_token
    M->>API: POST /auth/social {provider, token, deviceId}
    API->>OAuth: verify token (userinfo)
    OAuth-->>API: providerId, email
    API->>DB: UPSERT users WHERE provider+providerId
    API->>DB: INSERT auth_sessions (refresh token hash)
    API->>R: SET session:{jti} ttl=15m
    API-->>M: {accessToken, refreshToken, user}
    M-->>U: Navigate to Home
```

---

## SEQ-002 — Browse Idol List (프로필 목록)

```mermaid
sequenceDiagram
    actor U
    participant M as Mobile
    participant API as NestJS API
    participant R as Redis (cache)
    participant DB as PostgreSQL

    U->>M: Idol 탭 열기
    M->>API: GET /idols?sort=popularity&page=1 (JWT)
    API->>R: GET catalog:idols:popularity:1
    alt cache hit
        R-->>API: items
    else miss
        API->>DB: SELECT idols WHERE published ORDER BY ... LIMIT
        DB-->>API: rows
        API->>R: SET catalog:idols:popularity:1 TTL=60s
    end
    API-->>M: {items, nextCursor}
    M-->>U: 그리드 렌더
```

---

## SEQ-003 — Heart / Follow Idol (좋아요·팔로우)

```mermaid
sequenceDiagram
    actor U
    participant M as Mobile
    participant API
    participant DB as PostgreSQL

    U->>M: 하트 버튼 탭
    M->>M: optimistic toggle + disable button
    M->>API: POST /idols/{id}/heart
    API->>DB: BEGIN
    API->>DB: INSERT hearts (user_id, idol_id) ON CONFLICT DO NOTHING
    API->>DB: UPDATE idols SET heart_count = heart_count + 1 WHERE id = :id
    API->>DB: COMMIT
    API-->>M: {hearted:true, heartCount}
    M-->>U: 아이콘 고정
```

---

## SEQ-004 — Join Fan Club (팬클럽 가입)

```mermaid
sequenceDiagram
    actor U
    participant M as Mobile
    participant API
    participant Chat as Chat Module
    participant DB

    U->>M: "팬클럽 가입" 탭
    M->>API: POST /fan-clubs/{id}/join
    API->>DB: check FanClub, check existing Membership
    DB-->>API: exists? no
    API->>DB: INSERT memberships
    API->>Chat: MembershipJoined event
    Chat->>DB: UPSERT chat_rooms (user_id, idol_id)
    Chat->>DB: INSERT chat_coupons (balance=5, valid_until=next_day)
    API-->>M: {membership}
    M-->>U: "가입 완료" 토스트
```

---

## SEQ-005 — Send Chat Message (채팅 전송)

```mermaid
sequenceDiagram
    actor U
    participant M as Mobile
    participant WS as NestJS Gateway
    participant UC as SendChatMessageUseCase
    participant DB
    participant Q as BullMQ
    participant AI as AI Response Worker

    U->>M: 메시지 작성 후 Send
    M->>WS: chat:send {roomId, text}
    WS->>UC: execute(userId, roomId, text)
    UC->>DB: SELECT membership + coupon (FOR UPDATE)
    UC->>DB: UPDATE chat_coupons SET balance = balance - 1 WHERE balance > 0
    alt balance was 0
        UC-->>WS: DomainError NO_COUPON
        WS-->>M: 402 Paywall
    else success
        UC->>DB: INSERT chat_messages (sender='user')
        UC->>Q: enqueue chat-response {roomId, userMessageId}
        UC-->>WS: {message, remaining}
        WS-->>M: chat:sent
        Q-->>AI: job
        AI->>DB: INSERT chat_messages (sender='idol')
        AI->>WS: chat:receive {message}
        WS-->>M: chat:receive
    end
```

---

## SEQ-006 — Draw Photo Card (포토카드 랜덤 구매)

```mermaid
sequenceDiagram
    actor U
    participant M as Mobile
    participant StoreKit as App Store / Play
    participant API
    participant Com as Commerce UseCase
    participant DB

    U->>M: 세트 구매 버튼
    M->>StoreKit: purchase(productId)
    StoreKit-->>M: receipt
    M->>API: POST /orders/verify {platform, receipt, setId}
    API->>StoreKit: verify receipt
    StoreKit-->>API: receipt OK, transactionId
    API->>DB: BEGIN
    API->>DB: INSERT orders / receipts (UNIQUE tx_id)
    API->>Com: DrawPhotoCardUseCase(userId, setId, orderId)
    Com->>DB: SELECT card_items WHERE set=:id → 12 rows
    Com->>Com: random pick 1
    Com->>DB: INSERT user_cards (user_id, card_item_id, drawn_at)
    Com-->>API: {cardItem}
    API->>DB: COMMIT
    API-->>M: {cardItem}
    M-->>U: 결과 연출 + 공유 유도
```

---

## SEQ-007 — Cast Vote (오디션 투표)

```mermaid
sequenceDiagram
    actor U
    participant M as Mobile
    participant API
    participant DB
    participant R as Redis
    participant Cron as AggregateRankingJob

    U->>M: 투표 amount 선택 → Confirm
    M->>API: POST /audition/rounds/{id}/vote {idolId, amount}
    API->>DB: BEGIN
    API->>DB: UPDATE vote_tickets SET balance = balance - :amount WHERE user_id = :u AND balance >= :amount
    alt not enough
        DB-->>API: 0 rows affected
        API-->>M: 402 NOT_ENOUGH
    else ok
        API->>DB: INSERT votes (user_id, round_id, idol_id, amount)
        API->>DB: COMMIT
        API->>R: INCRBY vote:round:{id}:idol:{idol} :amount
        API-->>M: {remaining}
    end

    Note over Cron,DB: Every 5 min
    Cron->>DB: SELECT weighted sum by rule
    Cron->>DB: UPSERT round_rankings
    Cron->>R: PUBLISH rankings:updated:{roundId}
```

---

## SEQ-008 — Push Notification (푸시 발송)

```mermaid
sequenceDiagram
    participant Trigger as Event/Cron
    participant Q as BullMQ notification
    participant W as Notification Worker
    participant FCM as FCM/APNS
    participant M as Mobile

    Trigger->>Q: enqueue (topic, audience, payload)
    Q-->>W: job
    W->>W: audience fan-out (chunks of 500)
    W->>FCM: send batch
    FCM-->>W: success / failed tokens
    W->>W: invalidate failed tokens
    FCM-->>M: Push
```

---

## SEQ-009 — CMS: Open Audition Round (회차 개시)

```mermaid
sequenceDiagram
    actor A as Admin
    participant CMS as React CMS
    participant API
    participant DB
    participant R as Redis

    A->>CMS: 회차 생성/개시
    CMS->>API: POST /admin/audition/rounds {auditionId, startAt, endAt, ruleId}
    API->>DB: check prior round closed
    API->>DB: INSERT rounds (status=scheduled)
    A->>CMS: "개시" 버튼
    CMS->>API: PATCH /admin/audition/rounds/{id}/open
    API->>DB: UPDATE rounds SET status='active', activated_at=now()
    API->>R: SET round:{id}:active=1
    API-->>CMS: {round}
```
