---
document_id: A-IDOL-SEQ-1.0.0
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
    description: Initial draft — 8 core sequence diagrams
---

# A-idol — Sequence Diagrams (시퀀스 다이어그램)

> **Participants legend**:
> - **App** — React Native mobile client
> - **CMS** — React admin web client
> - **GW** — NestJS API Gateway (HTTP Controllers)
> - **WS** — NestJS WebSocket Gateway (Socket.io)
> - **UC** — Application Use Case layer
> - **DB** — PostgreSQL
> - **Redis** — Redis cache / rate limiter
> - **SYS** — Background scheduler / BullMQ worker
> - **Ext** — External services (Kakao, Apple, Google Play, App Store, FCM)

---

## SEQ-001 — Kakao Social Login (카카오 소셜 로그인)

```mermaid
sequenceDiagram
  participant App
  participant GW as API Gateway (NestJS)
  participant UC as AuthUseCase
  participant DB
  participant Ext as Kakao OAuth

  App->>Ext: Open Kakao OAuth consent screen
  Ext-->>App: Return authorization code
  App->>GW: POST /auth/kakao { code }
  GW->>UC: login(provider='KAKAO', code)
  UC->>Ext: Exchange code for access_token (server-to-server)
  Ext-->>UC: { access_token, kakao_id, email, profile_image_url }
  UC->>DB: SELECT * FROM users WHERE provider='KAKAO' AND provider_id=$1
  alt New user
    DB-->>UC: null
    UC->>DB: INSERT users (provider, provider_id, email, nickname=temp)
    DB-->>UC: { user_id, is_new_user: true }
  else Existing user
    DB-->>UC: { user_id, is_new_user: false }
  end
  UC->>DB: INSERT refresh_tokens (user_id, token_hash, expires_at=+30d)
  UC-->>GW: { access_token (JWT 1h), refresh_token, user, is_new_user }
  GW-->>App: 200 OK { access_token, refresh_token, is_new_user }
  alt is_new_user = true
    App->>App: Navigate to SCR-004 Profile Setup
  else
    App->>App: Navigate to SCR-005 Home
  end
```

---

## SEQ-002 — Idol List & Like Toggle (아이돌 목록 조회 + 좋아요)

```mermaid
sequenceDiagram
  participant App
  participant GW
  participant UC as IdolUseCase
  participant Redis
  participant DB

  App->>GW: GET /idols?page=1&limit=20 [JWT]
  GW->>Redis: GET idol:list:page:1
  alt Cache hit
    Redis-->>GW: cached JSON
    GW-->>App: 200 OK (cached)
  else Cache miss
    Redis-->>GW: null
    GW->>UC: getIdolList(page=1, user_id)
    UC->>DB: SELECT idols + LEFT JOIN likes/follows WHERE user_id=$1
    DB-->>UC: idol list with is_liked_by_me, is_followed_by_me
    UC->>Redis: SET idol:list:page:1 EX 60
    UC-->>GW: idol list
    GW-->>App: 200 OK { idols[], total }
  end

  Note over App: User taps ❤️ on idol card (optimistic update)
  App->>App: Immediately toggle heart UI (optimistic)
  App->>GW: POST /idols/:id/like [JWT]
  GW->>UC: toggleLike(user_id, idol_id)
  UC->>DB: BEGIN TRANSACTION
  UC->>DB: SELECT FROM user_idol_likes WHERE user_id=$1 AND idol_id=$2 FOR UPDATE
  alt Like exists → Unlike
    DB-->>UC: row found
    UC->>DB: DELETE user_idol_likes; UPDATE idols SET like_count -= 1
    DB-->>UC: { liked: false, like_count: N-1 }
  else No like → Like
    DB-->>UC: null
    UC->>DB: INSERT user_idol_likes; UPDATE idols SET like_count += 1
    DB-->>UC: { liked: true, like_count: N+1 }
  end
  UC->>DB: COMMIT
  UC->>Redis: DEL idol:list:page:* (cache invalidation)
  UC-->>GW: { liked, like_count }
  GW-->>App: 200 OK { liked, like_count }
  App->>App: Confirm UI (or revert if server disagrees)
```

---

## SEQ-003 — Fan Club Join & Chat Init (팬클럽 가입 + 채팅 시작)

```mermaid
sequenceDiagram
  participant App
  participant GW
  participant WS as WebSocket Gateway
  participant UC as ChatUseCase
  participant DB
  participant Redis

  App->>GW: POST /fan-clubs/:id/join [JWT]
  GW->>UC: joinFanClub(user_id, fan_club_id)
  UC->>DB: INSERT fan_club_memberships (user_id, fan_club_id)
  UC->>DB: UPDATE fan_clubs SET member_count += 1
  DB-->>UC: { joined: true, member_count }
  UC-->>GW: OK
  GW-->>App: 200 { joined: true, member_count }

  Note over App, WS: User navigates to chat screen
  App->>WS: connect({ fan_club_id, token: JWT })
  WS->>WS: verifyJWT(token) → user
  WS->>DB: SELECT fan_club_memberships WHERE user_id=$1 AND fan_club_id=$2
  alt Not a member
    DB-->>WS: null
    WS-->>App: emit('error', { code: 'FANCLUB_GATE' })
    WS->>WS: socket.disconnect()
  else Member confirmed
    DB-->>WS: membership row
    WS->>WS: socket.join('room:fanclub:{id}:user:{uid}')
    WS->>DB: SELECT chat_messages LIMIT 100 ORDER BY created_at DESC
    WS->>Redis: GET quota:{user_id}:{idol_id}:{today}
    Redis-->>WS: current usage count (or 0)
    WS->>DB: SELECT idol_chat_configs WHERE idol_id=$1
    DB-->>WS: { daily_quota, auto_messages }
    WS-->>App: emit('chat_init', { history[], quota_remaining, coupon_balance, auto_messages_today[] })
  end
```

---

## SEQ-004 — Send Chat Message + Quota Check (메시지 전송 + 쿼터 처리)

```mermaid
sequenceDiagram
  participant App
  participant WS
  participant UC as ChatUseCase
  participant DB
  participant Redis
  participant SYS as AI Worker (BullMQ)

  App->>WS: emit('send_message', { fan_club_id, content })
  WS->>UC: sendMessage(user_id, idol_id, fan_club_id, content)

  UC->>Redis: GET quota:{user_id}:{idol_id}:{today}
  Redis-->>UC: current_usage

  alt Quota remaining (current_usage < daily_quota)
    UC->>Redis: INCR quota:{user_id}:{idol_id}:{today}
    UC->>Redis: EXPIREAT [midnight KST]
    UC->>DB: INSERT chat_messages (type=USER, excluded_from_quota=false)
    DB-->>UC: message_id
    WS-->>App: emit('message_received', { sender:'USER', content, quota_remaining })

    UC->>SYS: enqueue AI reply job { idol_id, user_message, message_id }
    SYS->>SYS: Build prompt from character_traits
    SYS->>SYS: Generate reply (rule-based Phase1 / LLM Phase2)
    SYS->>DB: INSERT chat_messages (type=IDOL_AI)
    SYS->>WS: trigger broadcast to 'room:fanclub:{id}:user:{uid}'
    WS-->>App: emit('message_received', { sender:'IDOL', content, timestamp })

  else Quota exhausted → check coupon
    UC->>DB: SELECT coupon_balance FROM users WHERE id=$1 FOR UPDATE
    alt coupon_balance > 0
      UC->>DB: UPDATE users SET coupon_balance -= 1
      DB-->>UC: { coupon_balance: N-1 }
      UC->>DB: INSERT chat_messages (type=USER)
      WS-->>App: emit('message_received', { sender:'USER', quota_remaining: 0, coupon_balance: N-1 })
      Note over SYS: Same AI reply flow as above
    else No coupons
      WS-->>App: emit('quota_exhausted', { coupon_balance: 0 })
      App->>App: Show "쿠폰 구매" overlay
    end
  end
```

---

## SEQ-005 — Auto-Message Delivery (자동 메시지 발송)

```mermaid
sequenceDiagram
  participant SYS as CronJob (NestJS)
  participant DB
  participant WS
  participant Ext as FCM
  participant App

  Note over SYS: 08:00 KST — Morning auto-message trigger
  SYS->>DB: SELECT idol_chat_configs WHERE auto_messages->>'MORNING' IS NOT NULL
  DB-->>SYS: [{ idol_id, fan_club_id, content: "굿모닝! 오늘도 힘내세요 ☀️" }]

  loop For each idol with morning message
    SYS->>DB: INSERT chat_messages (type=AUTO, excluded_from_quota=TRUE, idol_id, fan_club_id)
    DB-->>SYS: message_id

    SYS->>WS: broadcast to all 'room:fanclub:{fan_club_id}' connections
    WS-->>App: emit('auto_message', { sender:'IDOL', content, is_auto:true, timestamp })

    SYS->>DB: SELECT device_token FROM user_device_tokens WHERE user_id IN (fan_club members)
    DB-->>SYS: device_tokens[]
    SYS->>Ext: FCM send({ tokens[], title: "아이돌명", body: content, data: { fan_club_id } })
    Ext-->>SYS: { success_count, failure_count }
    Note over SYS: Remove invalid tokens on failure
  end
```

---

## SEQ-006 — IAP Voting Ticket Purchase + Vote Cast (투표권 구매 + 투표)

```mermaid
sequenceDiagram
  participant App
  participant GW
  participant UC as PurchaseUseCase
  participant VoteUC as VoteUseCase
  participant DB
  participant Redis
  participant Ext as App Store / Google Play

  Note over App: User selects "5표 패키지" → triggers StoreKit 2
  App->>Ext: IAP purchase request (sku: 'vote_5')
  Ext-->>App: signed Transaction (iOS) / purchaseToken (Android)

  App->>GW: POST /purchases/verify-iap { platform:'ios', signed_transaction, sku, context:{ round_id } }
  GW->>UC: verifyAndCredit(signed_transaction, sku, round_id, user_id)

  UC->>DB: SELECT id FROM purchase_transactions WHERE idempotency_key=$1
  alt Duplicate (already processed)
    DB-->>UC: existing row
    UC-->>GW: 200 { already_processed: true, ticket_balance }
    GW-->>App: 200 OK (idempotent)
  else New purchase
    DB-->>UC: null
    UC->>Ext: Verify receipt with Apple/Google API
    Ext-->>UC: { valid: true, product_id, quantity: 5 }
    UC->>DB: BEGIN TRANSACTION
    UC->>DB: INSERT purchase_transactions (idempotency_key, product_type=VOTE_TICKET, consumed=false)
    UC->>DB: INSERT voting_ticket_balances (user_id, round_id, qty=5) ON CONFLICT DO UPDATE qty += 5
    UC->>DB: COMMIT
    UC-->>GW: { success: true, ticket_balance: 5 }
    GW-->>App: 200 OK { success, ticket_balance }
    App->>App: Update UI — "내 투표권: 5매"
  end

  Note over App: User selects idol + 3 votes → tap "투표하기"
  App->>GW: POST /auditions/rounds/:round_id/vote { idol_id, vote_count:3, vote_type:'ONLINE' }
  GW->>VoteUC: castVote(user_id, round_id, idol_id, count:3, type:'ONLINE')

  VoteUC->>DB: SELECT status FROM audition_rounds WHERE id=$1
  DB-->>VoteUC: status='ACTIVE' ✓
  VoteUC->>DB: SELECT qty FROM voting_ticket_balances WHERE user_id=$1 AND round_id=$2 FOR UPDATE
  DB-->>VoteUC: qty=5 ≥ 3 ✓

  VoteUC->>DB: BEGIN TRANSACTION
  VoteUC->>DB: INSERT votes (user_id, idol_id, round_id, count=3, vote_type='ONLINE')
  VoteUC->>DB: UPDATE voting_ticket_balances SET qty -= 3
  VoteUC->>DB: COMMIT
  VoteUC->>Redis: ZINCRBY idol_rank:{round_id} 3 idol:{idol_id}
  VoteUC->>Redis: ZINCRBY idol_rank:{round_id}:ONLINE 3 idol:{idol_id}
  VoteUC-->>GW: { success, remaining_tickets:2, idol_current_rank:1 }
  GW-->>App: 200 OK
  App->>App: Show confetti + "투표 완료" overlay
```

---

## SEQ-007 — Photocard Gacha (포토카드 가챠)

```mermaid
sequenceDiagram
  participant App
  participant GW
  participant UC as PhotocardUseCase
  participant DB
  participant Ext as App Store

  App->>Ext: IAP purchase (sku: 'photocard_pull_1', set_id in metadata)
  Ext-->>App: signed Transaction

  App->>GW: POST /purchases/verify-iap { platform:'ios', signed_transaction, sku, context:{ set_id } }
  GW->>UC: verifyIAP → credit purchase_transaction (consumed=false)
  UC-->>GW: { transaction_id }
  GW-->>App: { transaction_id }

  App->>GW: POST /photocards/pull { set_id, purchase_transaction_id }
  GW->>UC: pullPhotocard(user_id, set_id, purchase_transaction_id)

  UC->>DB: SELECT * FROM photocards WHERE set_id=$1 ORDER BY slot_index
  DB-->>UC: [12 photocard records]
  UC->>DB: SELECT consumed FROM purchase_transactions WHERE id=$1 AND user_id=$2
  DB-->>UC: consumed=false ✓

  UC->>UC: selected_index = crypto.randomInt(0, 12) ← CSPRNG server-side
  UC->>DB: BEGIN TRANSACTION
  UC->>DB: UPDATE purchase_transactions SET consumed=true WHERE id=$1
  UC->>DB: INSERT user_photocards (user_id, photocard_id, count_owned=1) ON CONFLICT DO UPDATE count_owned += 1
  UC->>DB: COMMIT
  UC-->>GW: { photocard: { id, card_name, image_url, rarity, slot_index } }
  GW-->>App: 200 OK { photocard }

  App->>App: Play reveal animation (card flip → rarity glow)
  App->>App: Show result: card name, rarity badge, collection status
```

---

## SEQ-008 — Admin: Activate Round + Close & Calculate (오디션 회차 활성화 + 마감 집계)

```mermaid
sequenceDiagram
  participant CMS as CMS (React Admin)
  participant GW
  participant UC as AuditionUseCase
  participant DB
  participant Redis
  participant SYS as Scheduler (NestJS Cron)
  participant Ext as FCM

  Note over CMS: Admin activates Round 3
  CMS->>GW: POST /admin/auditions/rounds/:id/activate { start_at, end_at } [Admin JWT]
  GW->>UC: activateRound(round_id, start_at, end_at)
  UC->>DB: UPDATE audition_rounds SET status='ACTIVE', start_at=$1, end_at=$2
  UC->>Redis: ZADD active_rounds {end_at_unix} {round_id} (schedule reference)
  UC->>DB: SELECT idol_audition_entries WHERE round_id=$1 AND status='PARTICIPATING'
  DB-->>UC: [participating idol_ids]
  UC->>DB: SELECT user_device_tokens FROM users who follow these idols
  UC->>Ext: FCM multicast: "3차 예선 투표가 시작되었습니다!"
  UC-->>GW: { activated: true, round }
  GW-->>CMS: 200 OK

  Note over SYS: Cron runs every 5 minutes
  loop Every 5 min
    SYS->>DB: SELECT * FROM audition_rounds WHERE status='ACTIVE' AND end_at <= NOW()
    alt Round expired
      DB-->>SYS: [expired rounds]
      SYS->>SYS: calculateFinalScores(round_id)
      SYS->>DB: SELECT idol_id, vote_type, SUM(count) FROM votes WHERE round_id=$1 GROUP BY idol_id, vote_type
      SYS->>DB: SELECT vote_type, weight FROM vote_type_configs WHERE round_id=$1
      SYS->>SYS: final_score = Σ(vote_count[type] × weight[type])
      SYS->>DB: UPDATE idol_audition_entries SET final_score, rank, status='ADVANCED'|'ELIMINATED'
      SYS->>DB: UPDATE audition_rounds SET status='CLOSED'
      SYS->>GW: WebSocket notify admin: "Round 3 closed — results ready"
    else No expired rounds
      DB-->>SYS: []
    end
  end

  Note over CMS: Admin reviews results and confirms
  CMS->>GW: POST /admin/auditions/rounds/:id/finalize [Admin JWT]
  GW->>UC: finalizeRound(round_id)
  UC->>DB: UPDATE audition_rounds SET status='FINALIZED'
  UC->>DB: SELECT advanced idol_ids (status='ADVANCED')
  UC->>Ext: FCM broadcast to all audition followers: "3차 예선 결과가 발표되었습니다!"
  UC-->>GW: { finalized: true, advanced_idols[] }
  GW-->>CMS: 200 OK
```

---

## SEQ-009 — JWT Refresh (JWT 갱신)

```mermaid
sequenceDiagram
  participant App
  participant GW
  participant UC as AuthUseCase
  participant DB

  Note over App: API call returns 401 (token expired)
  App->>App: Intercept 401 → trigger refresh flow
  App->>GW: POST /auth/refresh { refresh_token }
  GW->>UC: refreshToken(token)
  UC->>DB: SELECT * FROM refresh_tokens WHERE token_hash=hash($1) AND revoked_at IS NULL AND expires_at > NOW()
  alt Valid refresh token
    DB-->>UC: { user_id, token_id }
    UC->>DB: UPDATE refresh_tokens SET revoked_at=NOW() WHERE id=$1  ← rotate
    UC->>DB: INSERT refresh_tokens (user_id, new_hash, expires_at=+30d)
    UC-->>GW: { access_token (new 1h JWT), refresh_token (new) }
    GW-->>App: 200 OK { access_token, refresh_token }
    App->>App: Retry original failed request with new token
  else Invalid / expired refresh token
    DB-->>UC: null
    UC-->>GW: 401
    GW-->>App: 401 AUTH_002
    App->>App: Force logout → navigate to SCR-003 Login
  end
```

---

## Summary: Sequence ↔ Use Case Mapping (시퀀스 ↔ 유즈케이스 매핑)

| SEQ ID | Scenario | Use Case | Key Services |
|--------|----------|----------|-------------|
| SEQ-001 | Kakao login | AuthUseCase.login | Kakao OAuth, DB, JWT |
| SEQ-002 | Idol list + Like | IdolUseCase | Redis cache, DB transaction |
| SEQ-003 | Fan club join + Chat init | ChatUseCase | WS Gateway, DB gate check |
| SEQ-004 | Chat message + Quota | ChatUseCase | Redis quota, BullMQ, AI worker |
| SEQ-005 | Auto-message | AutoMessageScheduler | CronJob, FCM, WS broadcast |
| SEQ-006 | IAP + Vote cast | PurchaseUseCase, VoteUseCase | App Store API, Redis ZINCRBY |
| SEQ-007 | Photocard gacha | PhotocardUseCase | CSPRNG, S3, DB transaction |
| SEQ-008 | Admin round ops | AuditionUseCase | Scheduler, FCM, weighted score |
| SEQ-009 | JWT refresh | AuthUseCase.refresh | Token rotation, DB |
