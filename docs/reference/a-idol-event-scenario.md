---
document_id: A-IDOL-EVENT-1.0.0
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
    description: Initial draft — all 8 core event scenarios
---

# A-idol — Event Scenario (이벤트 시나리오)

> **Purpose**: Documents all meaningful user journeys and system events as narrative flows.
> Each scenario maps to Functional Requirements (FR) and feeds into Sequence Diagrams and the Functional Spec.

---

## Resolved Issues (미결 이슈 확정)

| ID | Issue | Decision |
|----|-------|----------|
| OI-001 | Payment gateway | **Stripe** (Singapore entity). Digital goods (chat coupon, voting ticket, photocard) via **App Store IAP / Google Play Billing** (store policy). Stripe handles web-side settlement, refunds, B2B. |
| OI-002 | AI chat engine | ⏳ Open — LLM API (Claude) vs rule-based. Idol persona data registered in CMS. Phase 1 may start rule-based. |

---

## Actors (액터)

| Actor | Abbreviation | Description |
|-------|-------------|-------------|
| Fan User | U | Authenticated mobile app user |
| Guest | G | Unauthenticated visitor (app downloaded, not logged in) |
| Platform Admin | A | CMS operator; full access |
| Agency Manager | AM | CMS sub-admin; restricted to own idol data |
| System | SYS | Automated background processes |
| Payment Gateway | PG | App Store IAP / Google Play Billing / Stripe |

---

## Scenario Index (시나리오 목록)

| ID | Scenario | Primary Actor | Related FR |
|----|----------|--------------|------------|
| SC-001 | User Registration & Login (회원가입/로그인) | G → U | FR-001~003 |
| SC-002 | Idol Discovery & Engagement (아이돌 탐색·좋아요·팔로우) | U | FR-010~015 |
| SC-003 | Fan Club Join & Idol Chat (팬클럽 가입·채팅) | U | FR-020~036 |
| SC-004 | Chat Coupon Purchase (채팅 쿠폰 구매) | U | FR-033, FR-122 |
| SC-005 | Voting Ticket Purchase & Vote Cast (투표권 구매·투표) | U | FR-040~046 |
| SC-006 | Photocard Purchase — Gacha (포토카드 구매) | U | FR-050~052 |
| SC-007 | Admin: Idol & Audition Setup (아이돌·오디션 등록) | A | FR-100~150 |
| SC-008 | Admin: Audition Round Operation (오디션 회차 운영) | A, SYS | FR-141~149 |

---

## SC-001 — User Registration & Login (회원가입 / 로그인)

### Trigger (트리거)
Guest opens the A-idol app for the first time after installation.

### Happy Path (정상 흐름)

```
G  → App: Launch app
App → G: Show splash screen → onboarding carousel (3 screens)
G  → App: Tap "시작하기"
App → G: Show auth screen (Email / Kakao / Apple / Google)

[Path A — Social Login (Kakao)]
G    → App: Tap "카카오로 시작"
App  → Kakao OAuth: Request authorization
Kakao → G: Show Kakao consent screen
G    → Kakao: Grant consent
Kakao → App: Return authorization code
App  → Backend (NestJS): POST /auth/kakao { code }
Backend → Kakao: Exchange code → access_token + user profile
Backend → DB: Upsert User record (kakao_id, email, nickname, profile_img)
Backend → App: Return { access_token (JWT), refresh_token, is_new_user: true }

[New User — Profile Setup]
App → G: Show profile setup screen (nickname, profile image)
G   → App: Enter nickname, upload profile image
App → Backend: POST /users/me/profile { nickname, profile_image }
Backend → S3: Upload profile image
Backend → DB: Update user profile
Backend → App: 200 OK
App → G: Navigate to Home screen (99 idols feed)
```

### Alternative Paths (대안 흐름)

| Condition | Flow |
|-----------|------|
| Existing user (returning login) | Backend finds existing record → skip profile setup → go to Home |
| Email signup | G enters email + password → Backend sends verification email → G verifies → profile setup |
| Apple login | Same OAuth flow via Apple Sign-In |
| Nickname duplicate | Backend returns 409 → App shows inline error "이미 사용 중인 닉네임입니다" |

### Exception Paths (예외 흐름)

| Condition | Handling |
|-----------|----------|
| Kakao OAuth timeout | App shows retry toast |
| Network error during signup | App shows error → retry button; no partial user record saved |
| JWT expired on next session | App uses refresh_token → Backend reissues access_token silently |

### Post-Condition (사후 조건)
- User record exists in DB with verified identity
- User holds valid JWT access_token + refresh_token
- User is on the Home (idol list) screen

---

## SC-002 — Idol Discovery & Engagement (아이돌 탐색 · 좋아요 · 팔로우)

### Trigger
Authenticated user opens the Home screen or browses the idol list.

### Happy Path

```
U   → App: Home screen loads
App → Backend: GET /idols?page=1&limit=20
Backend → DB: Query active idols ordered by display_order
Backend → App: Return idol list (id, name, agency, thumbnail, like_count, is_liked_by_me)
App → U: Render idol card grid

U   → App: Scroll down (infinite scroll)
App → Backend: GET /idols?page=2&limit=20
... (paginate)

U   → App: Tap idol card
App → Backend: GET /idols/:id
Backend → App: Return full idol profile
  (name, birthday, agency, concept, bio, schedule list, photo gallery, fan_club_id, follow_count)
App → U: Show idol detail screen

[Like]
U   → App: Tap ❤️ (좋아요)
App → Backend: POST /idols/:id/like
Backend → DB: Upsert user_idol_likes (user_id, idol_id)
Backend → App: { liked: true, like_count: 1024 }
App → U: Heart fills red; count updates optimistically

[Follow]
U   → App: Tap "팔로우"
App → Backend: POST /idols/:id/follow
Backend → DB: Upsert user_idol_follows
Backend → SYS: Register FCM topic subscription for idol updates
Backend → App: { followed: true }
App → U: Button changes to "팔로잉"; user receives push notifications for idol news
```

### Alternative Paths

| Condition | Flow |
|-----------|------|
| Unlike | Tap filled heart → DELETE /idols/:id/like → heart unfills |
| Unfollow | Tap "팔로잉" → DELETE /idols/:id/follow → FCM unsubscribe |
| Search / filter | U enters search query → GET /idols?search=이름&agency_id=1 |

### Post-Condition
- like/follow state persisted in DB
- Followed idol's push notifications active on device

---

## SC-003 — Fan Club Join & Idol Chat (팬클럽 가입 · 채팅)

### Trigger
User taps "팬클럽 가입" on idol detail screen or tries to enter chat without membership.

### Happy Path

```
[Fan Club Join]
U   → App: Tap "팬클럽 가입" on idol detail
App → Backend: POST /fan-clubs/:fan_club_id/join
Backend → DB: Insert fan_club_memberships (user_id, fan_club_id, joined_at)
Backend → App: { joined: true, member_count: 4821 }
App → U: "팬클럽에 가입했습니다!" toast; button changes to "채팅하기"

[Enter Chat]
U   → App: Tap "채팅하기"
App → Backend: GET /fan-clubs/:fan_club_id/chat/init
Backend → DB: Check fan_club_memberships — confirmed ✓
Backend → DB: Get today's chat_quota_usage (user_id, idol_id, date=today)
Backend → App: {
    chat_history: [...last 50 messages],
    quota_remaining: 5,          ← default 5, minus used
    auto_messages: [scheduled msgs for today],
    coupon_balance: 0
  }
App → U: Render chat screen with history

[Send Message — within quota]
U   → App: Type message → tap Send
App → Backend (WebSocket): SEND_MESSAGE { fan_club_id, content }
Backend → DB: Insert chat_messages (user_id, idol_id, content, type=USER, timestamp)
Backend → DB: Increment quota_usage by 1
Backend → SYS: Enqueue AI response generation (idol persona + message)
SYS → Backend: AI-generated idol reply
Backend → DB: Insert chat_messages (type=IDOL_AI, content, timestamp)
Backend → App (WebSocket): RECEIVE_MESSAGE { sender: idol, content, timestamp }
App → U: Display idol reply in chat bubble
App → U: Update quota counter: "남은 대화: 4회"

[Auto-Message delivery — system scheduled]
SYS → Backend: Trigger daily auto-messages (e.g., 08:00 "굿모닝!")
Backend → DB: Insert chat_messages (type=AUTO, excluded_from_quota=true)
Backend → App (WebSocket / FCM push): deliver message
App → U: Show idol message (does NOT decrement quota)
```

### Alternative Paths

| Condition | Flow |
|-----------|------|
| User tries chat without fan club membership | Backend returns 403 → App shows "팬클럽 가입 후 이용 가능합니다" with CTA button |
| Quota = 0, no coupons | App disables send button → shows "대화 쿠폰 구매" CTA → SC-004 |
| Quota = 0, has coupons | Backend deducts 1 coupon → proceed normally |
| User in multiple fan clubs | Each idol has independent quota counter per user per day |

### Post-Condition
- Messages persisted in DB
- Quota counter updated
- User can see full conversation history on re-entry

---

## SC-004 — Chat Coupon Purchase (채팅 쿠폰 구매)

### Trigger
User's daily chat quota is exhausted and taps "대화 쿠폰 구매".

### Happy Path

```
U   → App: Tap "대화 쿠폰 구매"
App → Backend: GET /products/chat-coupons
Backend → App: [{ sku: 'chat_5', label: '5회 쿠폰', price: ₩1,900 },
                { sku: 'chat_20', label: '20회 쿠폰', price: ₩5,900 }]
App → U: Show product selection sheet

U   → App: Select "20회 쿠폰" → tap "구매하기"

[iOS path]
App → StoreKit 2: Purchase request (productId: 'chat_20')
StoreKit → U: System payment sheet (Face ID / Touch ID)
U → StoreKit: Authenticate
StoreKit → Apple: Process payment
Apple → StoreKit: Return signed Transaction
App → Backend: POST /purchases/verify-iap { receipt: signedTransaction, sku: 'chat_20' }
Backend → Apple: Verify receipt via App Store Server API
Apple → Backend: { valid: true, quantity: 20 }
Backend → DB: Insert purchase_transactions; credit user coupon_balance += 20
Backend → App: { success: true, coupon_balance: 20 }
App → U: "20회 쿠폰이 충전되었습니다" toast; returns to chat screen

[Android path]
App → Google Play Billing: launchBillingFlow (sku: 'chat_20')
... (same verify flow via Google Play Developer API)
```

### Exception Paths

| Condition | Handling |
|-----------|----------|
| Payment cancelled | App dismisses sheet; no DB write |
| Receipt verification failure | Backend logs error; no credit; App shows "결제 오류 — 고객센터 문의" |
| Duplicate receipt | Backend idempotency check → 200 OK with existing balance (no double credit) |

---

## SC-005 — Voting Ticket Purchase & Vote Cast (투표권 구매 · 투표)

### Trigger
User taps "투표하기" on the current audition round banner.

### Happy Path

```
U   → App: Tap audition banner on Home or Audition tab
App → Backend: GET /auditions/active
Backend → App: { audition_id, name, current_round: { id, round_no: 3, ends_at, vote_options: [...idols] } }
App → U: Show current round screen with idol ranking + "투표권 구매" button

[Purchase voting tickets]
U   → App: Tap "투표권 구매"
App → Backend: GET /products/voting-tickets?audition_id=X&round_id=Y
Backend → App: [
    { sku: 'vote_1', label: '1표', price: ₩500 },
    { sku: 'vote_5', label: '5표 패키지', price: ₩2,000 },
    { sku: 'vote_10', label: '10표 패키지 (최대)', price: ₩3,500 }
  ]
  Note: max_per_user_per_round configured by admin; returned as purchase_limit
App → U: Show ticket shop; display "이번 라운드 최대 구매: 10표"

U   → App: Select "5표 패키지" → IAP flow (same as SC-004)
Backend → DB: credit voting_ticket_balances (user_id, round_id, qty += 5)
App → U: "5표가 충전되었습니다"

[Cast votes]
U   → App: Select idol to vote for (예: 아이돌 #42)
App → U: Slider / stepper "몇 표 사용할까요?" (1 ~ 5 available)
U   → App: Select 3 votes → tap "투표하기"

App → Backend: POST /auditions/rounds/:round_id/vote
  { idol_id: 42, vote_count: 3, vote_type: 'ONLINE' }
Backend → DB: Check voting_ticket_balances (user_id, round_id) >= 3 ✓
Backend → DB: Insert votes (user_id, idol_id, round_id, count=3, type=ONLINE, timestamp)
Backend → DB: Decrement voting_ticket_balances by 3
Backend → Redis: ZINCRBY idol_rank:{round_id} 3 idol:42   ← real-time ranking
Backend → App: { success: true, remaining_tickets: 2, idol_current_rank: 7 }
App → U: Confetti animation; show updated ranking; ticket balance updated
```

### Alternative Paths

| Condition | Flow |
|-----------|------|
| Round not active (ended) | Backend 400 → App shows "투표가 종료되었습니다" |
| No tickets remaining | App shows "투표권이 없습니다" → purchase CTA |
| Vote exceeds ticket balance | Backend 400 → App inline error |

---

## SC-006 — Photocard Purchase — Gacha (포토카드 구매)

### Trigger
User taps "포토카드 뽑기" on idol profile or photocard tab.

### Happy Path

```
U   → App: Navigate to Photocard tab → select idol
App → Backend: GET /idols/:id/photocard-sets?active=true
Backend → App: [{ set_id, set_name, idol_id, card_count: 12, price_per_pull: ₩1,500, preview_images: [...3 sample cards blurred] }]
App → U: Show set card with "뽑기" button; display blurred sample cards

U   → App: Tap "뽑기" → IAP purchase flow (sku: 'photocard_pull_1')
Backend → DB: Verify purchase
Backend → SYS: random.pick(1 from 12 cards in set) — server-side RNG
Backend → DB: Insert user_photocards (user_id, photocard_id, acquired_at)
Backend → App: { photocard: { id, name, image_url, rarity } }
App → U: Reveal animation (card flip) → display acquired card
App → U: "내 컬렉션에 추가되었습니다" + "한 번 더?" CTA

[View collection]
U   → App: Tab "내 컬렉션"
App → Backend: GET /users/me/photocards?idol_id=X
Backend → App: [{ photocard_id, card_name, image_url, acquired_at, count_owned }]
App → U: Show grid; owned cards full color, unowned cards silhouette (greyed out)
```

### Business Rule Enforcement
- Server picks the random card — client never controls which card is received (anti-cheat)
- Same card can be pulled multiple times (count_owned tracks duplicates)
- No trading between users (Phase 1 out of scope)

---

## SC-007 — Admin: Idol & Audition Setup (관리자 — 아이돌·오디션 등록)

### Trigger
Platform Admin logs into CMS and registers a new idol or creates an audition program.

### Happy Path — Idol Registration

```
A  → CMS: Login → Dashboard
A  → CMS: Navigate to "아이돌 관리" → "새 아이돌 등록"
CMS → Backend: GET /admin/agencies  (agency dropdown)
A  → CMS: Fill form:
  - Name (예명/본명), Agency (select), Birthday, Debut date
  - Concept tags, Bio (KR), Profile photos (upload)
  - Character traits (성격, 말투, 취미 — used for AI chat persona)
  - Schedule items (방송/콘서트/팬미팅)
CMS → Backend: POST /admin/idols (multipart form)
Backend → S3: Upload photos
Backend → DB: Insert idol record
Backend → DB: Auto-create fan_club record linked to idol (BR-002)
Backend → CMS: { idol_id, fan_club_id, status: ACTIVE }
CMS → A: "아이돌 등록 완료. 팬클럽이 자동 생성되었습니다."
```

### Happy Path — Audition Program Creation

```
A  → CMS: Navigate to "오디션 관리" → "새 오디션 생성"
A  → CMS: Fill:
  - Program name, Description, Start date
  - Participating idols (multi-select from registered idols)
  - Round count (1~10 preliminary + 1 final)
CMS → Backend: POST /admin/auditions
Backend → DB: Insert audition + audition_rounds (10 prelim + 1 final, all status=PENDING)
CMS → A: Audition created; round list shown

[Configure vote types & weights]
A  → CMS: Navigate to round "결선" → "투표 설정"
A  → CMS: Add vote types:
  { type: 'ONLINE',     weight: 0.40 }
  { type: 'SMS',        weight: 0.30 }
  { type: 'POPULARITY', weight: 0.30 }
CMS → Backend: PUT /admin/auditions/:id/rounds/:round_id/vote-config
Backend → DB: Upsert vote_type_configs; validate weights sum = 1.0
Backend → CMS: 200 OK

[Configure voting ticket purchase limits]
A  → CMS: Set per-round purchase limit: max 10 tickets per user per round
CMS → Backend: PUT /admin/auditions/:id/rounds/:round_id/ticket-config
  { max_tickets_per_user: 10, ticket_products: [...skus] }
Backend → DB: Update round config
```

---

## SC-008 — Admin: Audition Round Operation (오디션 회차 운영)

### Trigger
Admin activates a preliminary round or processes results to advance idols.

### Happy Path — Activate Round

```
A  → CMS: Audition detail → Round 3 (status: PENDING) → "투표 시작"
A  → CMS: Set voting window: { start_at: '2026-06-01T09:00', end_at: '2026-06-07T23:59' }
CMS → Backend: POST /admin/auditions/rounds/:id/activate
Backend → DB: Update round status = ACTIVE, set voting window
Backend → SYS: Schedule round-end job at end_at
Backend → FCM: Broadcast push to all followed-idol subscribers "3차 예선 투표 시작!"
CMS → A: Round activated; real-time vote dashboard available

[Real-time monitoring]
A  → CMS: View vote dashboard (auto-refresh 30s or WebSocket)
CMS → Backend: GET /admin/auditions/rounds/:id/stats
Backend → Redis: ZREVRANGE idol_rank:{round_id} 0 -1 WITHSCORES
Backend → CMS: [{ idol_id, name, vote_count_by_type, weighted_score, rank }]
CMS → A: Live ranking table with bar chart
```

### Happy Path — Close Round & Advance Idols

```
SYS → Backend: Scheduled job fires at round end_at
Backend → DB: Update round status = CLOSED
Backend → DB: Calculate final weighted scores:
  score = Σ(vote_count[type] × weight[type]) for each idol
Backend → DB: Rank idols by score; mark top N as ADVANCED (N = admin-configured threshold)
Backend → CMS (WebSocket): Push "Round 3 closed — results ready"

A   → CMS: Review results → tap "결선 진출 확정"
CMS → Backend: POST /admin/auditions/rounds/:id/finalize
Backend → DB: Lock results; set idol_audition_entries.status = ADVANCED / ELIMINATED
Backend → Mobile App (FCM): Broadcast round results push to all users
CMS → A: "결과가 확정되었습니다. 다음 라운드를 설정해주세요."
```

### Final Audition — Weighted Score Calculation

```
Formula:
  final_score(idol) = 
      (online_votes × 0.40) +
      (sms_votes   × 0.30) +
      (popularity_score × 0.30)

  Weights are configurable per round via CMS; must sum to 1.0.
  Backend validates on save: if Σweights ≠ 1.0 → 400 Bad Request.

Example (idol A):
  online_votes = 50,000 × 0.40 = 20,000
  sms_votes    = 30,000 × 0.30 =  9,000
  popularity   = 80,000 × 0.30 = 24,000
  → final_score = 53,000
```

---

## Cross-Scenario State Diagram (크로스 시나리오 상태 흐름)

```
[Guest]
  → SC-001 Register/Login
    → [Authenticated User]
        → SC-002 Browse idols → Like / Follow
        → SC-003 Join Fan Club → [Fan Club Member]
            → Chat (quota check)
                → quota > 0  → send message
                → quota = 0  → SC-004 Buy Coupon → send message
        → SC-005 Buy Voting Ticket → Vote
        → SC-006 Buy Photocard Pull → Reveal card

[Admin]
  → SC-007 Register idol (auto-creates fan club)
  → SC-007 Create audition program
  → SC-008 Activate round → Monitor → Close → Advance idols
```

---

## Payment Architecture Summary (결제 아키텍처 요약)

| Product | Mobile (iOS) | Mobile (Android) | Web/Settlement |
|---------|-------------|-----------------|----------------|
| Chat coupon | App Store IAP (StoreKit 2) | Google Play Billing | Stripe (refund / B2B) |
| Voting ticket | App Store IAP | Google Play Billing | Stripe |
| Photocard pull | App Store IAP | Google Play Billing | Stripe |
| Revenue payout to agencies | — | — | Stripe Connect |

Backend always **server-side verifies** IAP receipts before crediting the user.
Idempotency keys used on all purchase endpoints to prevent double-crediting.
