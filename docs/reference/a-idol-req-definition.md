---
document_id: A-IDOL-REQDEF-1.0.0
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
    description: Initial draft — full requirements definition derived from FR analysis
---

# A-idol — Requirements Definition (요구사항 정의서)

> **Purpose**: Refines FR-xxx items into detailed, testable requirements.
> Each row specifies acceptance criteria, input/output, and constraints used by developers and testers.

---

## 1. Authentication & User Management (인증 / 사용자 관리)

| ID | Requirement | Input | Output | Constraint / Rule | Priority |
|----|-------------|-------|--------|-------------------|----------|
| RD-001 | Social login — Kakao | Kakao OAuth code | JWT access_token (1h TTL) + refresh_token (30d TTL) | OAuth 2.0; store only provider_id + email, never password | P0 |
| RD-002 | Social login — Apple | Apple identity token | Same as RD-001 | Sign In with Apple required for iOS App Store submission | P0 |
| RD-003 | Social login — Google | Google auth code | Same as RD-001 | | P0 |
| RD-004 | Email signup | email, password | Verification email sent; account inactive until verified | Password: bcrypt hash, min 8 chars, 1 uppercase, 1 number | P1 |
| RD-005 | JWT refresh | refresh_token | New access_token | Old refresh_token invalidated (rotation); stored in HttpOnly cookie on web | P0 |
| RD-006 | Profile setup | nickname (2–20 chars), profile_image (optional) | User record updated | Nickname unique across platform; profanity filter applied | P0 |
| RD-007 | Account deletion | Authenticated user request | Soft-delete user + anonymize PII within 30 days | PIPA compliance; purchase history retained for tax (5 years) | P1 |
| RD-008 | Admin login | email + TOTP (2FA) | Admin session JWT (4h TTL) | CMS web only; no social login for admins | P0 |

---

## 2. Idol Profile (아이돌 프로필)

| ID | Requirement | Input | Output | Constraint / Rule | Priority |
|----|-------------|-------|--------|-------------------|----------|
| RD-010 | Idol list (fan side) | page, limit (default 20), optional: search, agency_id | Paginated idol list; each item includes is_liked_by_me, is_followed_by_me | Max 99 active idols; sorted by admin-set display_order | P0 |
| RD-011 | Idol detail | idol_id | Full profile: name, birthday, agency, concept tags, bio, schedule list, photo_gallery, fan_club_id, like_count, follow_count | Soft-deleted idols return 404 | P0 |
| RD-012 | Like idol | idol_id | { liked: true/false, like_count } | Toggle; idempotent; 1 like per user per idol | P0 |
| RD-013 | Follow idol | idol_id | { followed: true/false }; FCM topic subscribed | Toggle; idempotent | P0 |
| RD-014 | Admin: Register idol | See CMS form fields below | idol_id created; fan_club auto-created | Max 99 active idols enforced; agency must exist first | P0 |
| RD-015 | Admin: Edit idol | idol_id + changed fields | Updated idol record | Slug/URL-safe name auto-generated from name | P0 |
| RD-016 | Admin: Idol schedule | idol_id, schedule_type (BROADCAST/CONCERT/FANMEETING/OTHER), title, start_at, end_at, location | Schedule item created | end_at must be > start_at | P1 |

**Admin idol registration fields:**

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| stage_name | string | ✓ | 1–50 chars |
| real_name | string | | 1–50 chars |
| agency_id | FK → agencies | ✓ | Must exist |
| birthday | date | | YYYY-MM-DD; past date |
| debut_date | date | | |
| concept_tags | string[] | | Max 5 tags; each ≤ 20 chars |
| bio_kr | text | | Max 1000 chars |
| profile_photos | image[] | ✓ | Min 1, max 10; JPEG/PNG; max 5MB each |
| character_traits | JSON | | { personality, speech_style, hobbies, catchphrases } — AI chat persona |
| display_order | integer | | Admin-set sort order on fan home |

---

## 3. Fan Club (팬클럽)

| ID | Requirement | Input | Output | Constraint / Rule | Priority |
|----|-------------|-------|--------|-------------------|----------|
| RD-020 | Join fan club | fan_club_id | { joined: true, member_count } | One membership per user per fan club; fan club must be active | P0 |
| RD-021 | Leave fan club | fan_club_id | { left: true } | Soft-delete membership; chat history retained | P1 |
| RD-022 | My fan clubs | — | List of joined fan clubs with idol thumbnail + unread message count | | P0 |
| RD-023 | Chat gate check | fan_club_id | 403 if not member | Applied at WebSocket connection and REST fallback | P0 |
| RD-024 | Fan club auto-create | (triggered on idol creation) | fan_club record { id, idol_id, name="{idol_name} 공식 팬클럽" } | 1:1; name editable by admin post-creation | P0 |

---

## 4. Idol Chat (아이돌 채팅)

| ID | Requirement | Input | Output | Constraint / Rule | Priority |
|----|-------------|-------|--------|-------------------|----------|
| RD-030 | Chat init | fan_club_id (via WS connection) | { chat_history[], quota_remaining, coupon_balance, auto_messages_today[] } | History: last 100 messages; member check on connect | P0 |
| RD-031 | Send message | content (text, max 300 chars) | message stored; idol AI reply returned via WS | Quota check before processing; quota = 0 → error WS event | P0 |
| RD-032 | Daily quota enforcement | user_id, idol_id, date=today | quota_remaining | Default 5; resets at 00:00 KST; admin-configurable per idol | P0 |
| RD-033 | Auto-message delivery | Scheduled by SYS (08:00 / 22:00 / 15:00 KST) | WS push + FCM to all fan club members | 3 messages/day max; do NOT decrement quota | P0 |
| RD-034 | Coupon fallback | coupon_balance > 0 when quota = 0 | 1 coupon deducted per user reply; idol reply returned | Coupon deducted AFTER AI reply confirmed, not before | P0 |
| RD-035 | Chat history persist | — | Messages stored indefinitely | Soft-delete on account deletion; admin can wipe per idol | P1 |
| RD-036 | Admin: Set daily quota | idol_id, quota_count (1–99) | Config saved; applies next day | Live change applies from next reset (00:00 KST) | P0 |
| RD-037 | Admin: Set auto-messages | idol_id, message_slot (MORNING/NIGHT/AFTERNOON), content | Auto-message template saved | Max 3 slots; each content max 200 chars | P0 |

---

## 5. Chat Coupon (채팅 쿠폰)

| ID | Requirement | Input | Output | Constraint / Rule | Priority |
|----|-------------|-------|--------|-------------------|----------|
| RD-040 | List coupon products | — | [{ sku, label, quantity, price_krw }] | Products managed in CMS; must be configured in App Store Connect / Google Play Console too | P0 |
| RD-041 | Purchase coupon (IAP) | sku, signed_receipt (iOS) / purchase_token (Android) | { success, coupon_balance } | Server-side receipt verification with Apple/Google APIs; idempotency_key = purchase_token | P0 |
| RD-042 | Coupon balance | user_id | { coupon_balance: integer } | Global balance — not idol-specific; usable across any fan club chat | P0 |

---

## 6. Audition & Voting (오디션 및 투표)

| ID | Requirement | Input | Output | Constraint / Rule | Priority |
|----|-------------|-------|--------|-------------------|----------|
| RD-050 | Active audition | — | { audition_id, name, current_round, ends_at, top_idols[] } | One audition active at a time; if none active, return null | P0 |
| RD-051 | Round detail | round_id | { round_no, type (PRELIM/FINAL), vote_types[], ranking[], ends_at, user_ticket_balance } | Ranking from Redis ZSET; refreshed every 30s or via WS | P0 |
| RD-052 | Purchase voting ticket (IAP) | sku, receipt, round_id | { ticket_balance_for_round } | Tickets are round-specific; unused tickets expire when round closes | P0 |
| RD-053 | Cast vote | round_id, idol_id, vote_count, vote_type | { success, remaining_tickets, idol_rank } | round must be ACTIVE; vote_count ≤ user ticket balance for round; vote_type must match round config | P0 |
| RD-054 | Vote ranking (fan view) | round_id | [{ idol_id, name, thumbnail, vote_count, rank, rank_delta }] | rank_delta = change since last 1h snapshot; from Redis | P0 |
| RD-055 | Vote history (user) | user_id | [{ round_id, idol_id, vote_count, vote_type, voted_at }] | Paginated; 30 per page | P1 |
| RD-056 | Admin: Create audition | name, description, start_date, participating_idol_ids[] | audition + rounds (PENDING) created | At least 2 idols required; max 99 | P0 |
| RD-057 | Admin: Activate round | round_id, start_at, end_at | round status = ACTIVE | Only 1 round ACTIVE per audition at a time | P0 |
| RD-058 | Admin: Configure vote weights | round_id, [{ vote_type, weight }] | Config saved | Σweights must = 1.0 (±0.001 tolerance); validated server-side | P0 |
| RD-059 | Admin: Close round + calculate | round_id | { ranked_idols[], advanced_idol_ids[] } | Auto-triggered by scheduler at end_at; admin confirms advancement | P0 |
| RD-060 | Admin: Ticket purchase limits | round_id, max_per_user | Config saved | Default: 10 per user per round | P0 |
| RD-061 | Weighted score formula | vote records for round | final_score = Σ(vote_count[type] × weight[type]) | Computed at round close; stored in idol_audition_entries.final_score | P0 |

---

## 7. Photocard (포토카드)

| ID | Requirement | Input | Output | Constraint / Rule | Priority |
|----|-------------|-------|--------|-------------------|----------|
| RD-070 | Photocard sets by idol | idol_id | [{ set_id, name, card_count=12, price_per_pull, preview_images[] }] | Only ACTIVE sets returned to fans | P0 |
| RD-071 | Pull photocard (gacha) | set_id, signed receipt | { photocard: { id, name, image_url, rarity } } | Server-side crypto.randomInt(0,11); same card can be re-pulled | P0 |
| RD-072 | My collection | user_id, optional idol_id | [{ photocard_id, idol_id, card_name, image_url, rarity, count_owned, acquired_at }] | All 12 slots shown; unowned cards have image_url=null (client renders silhouette) | P0 |
| RD-073 | Admin: Create set | idol_id, set_name, 12 × { card_name, image, rarity (COMMON/RARE/EPIC) } | set created with 12 photocard records | Exactly 12 cards required; images uploaded to S3 | P0 |
| RD-074 | Admin: Set price | set_id, price_krw | Updated; must match IAP product price | | P0 |
| RD-075 | Social share (Instagram) | photocard_id | Deep-link URL / share sheet opened | Phase 1: native share sheet; Instagram account link = Phase 2 | P1 |

---

## 8. Statistics — Admin CMS (통계 — 관리자)

| ID | Requirement | Input | Output | Constraint / Rule | Priority |
|----|-------------|-------|--------|-------------------|----------|
| RD-080 | Vote stats per round | round_id | Table: idol × vote_type × count × weighted_score + chart data | Exportable as CSV | P0 |
| RD-081 | Platform DAU/MAU | date_range | { dau[], mau[], new_users[], retention_d7 } | Rolling 30-day window default | P1 |
| RD-082 | Photocard revenue | date_range, optional idol_id | { gross_revenue, net_revenue (after store cut), pulls_count, per_set_breakdown } | Store cut: iOS 30%, Android 30% (15% for small business tier) | P1 |
| RD-083 | Chat coupon stats | date_range | { coupons_sold, revenue, coupons_used, avg_per_user } | | P1 |
| RD-084 | Export CSV | any stats endpoint | CSV file download | Max date range: 1 year | P2 |

---

## 9. Non-Functional Requirements — Detail (비기능 요구사항 상세)

| ID | Category | Requirement | Measurement | Priority |
|----|----------|-------------|-------------|----------|
| NFR-001 | Performance | API p95 response ≤ 300ms | Monitored via APM (e.g., Datadog) | P0 |
| NFR-002 | Performance | Vote ranking Redis read ≤ 50ms | ZREVRANGE on Redis sorted set | P0 |
| NFR-003 | Scalability | WebSocket: handle 10,000 concurrent connections | NestJS + Socket.io cluster mode | P0 |
| NFR-004 | Scalability | Vote write throughput: 1,000 votes/sec at peak | Redis pipeline + async DB write | P0 |
| NFR-005 | Security | All endpoints require valid JWT (except /auth/*) | NestJS Auth Guard | P0 |
| NFR-006 | Security | Rate limit: POST /auth/* → 10 req/min/IP | Redis token bucket | P0 |
| NFR-007 | Security | Rate limit: POST /auditions/*/vote → 20 req/min/user | Redis per-user limiter | P0 |
| NFR-008 | Privacy | PII fields (email, name) encrypted at rest | PostgreSQL column-level encryption | P0 |
| NFR-009 | Availability | 99.5% monthly uptime | Measured by uptime monitor | P0 |
| NFR-010 | Mobile | Cold start ≤ 3s (React Native) | Profiled on mid-range Android device | P1 |
| NFR-011 | Mobile | App bundle size ≤ 50MB (initial download) | Hermes engine + code splitting | P1 |
| NFR-012 | Payment | IAP receipt verified within 5s | Measured from purchase confirm to credit | P0 |

---

## 10. API Endpoint Summary (API 엔드포인트 요약)

### Fan Mobile API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/kakao | Kakao social login |
| POST | /auth/apple | Apple social login |
| POST | /auth/refresh | JWT refresh |
| GET | /idols | Idol list (paginated) |
| GET | /idols/:id | Idol detail |
| POST | /idols/:id/like | Like toggle |
| POST | /idols/:id/follow | Follow toggle |
| GET | /fan-clubs/:id | Fan club info |
| POST | /fan-clubs/:id/join | Join fan club |
| GET | /chat/:fan_club_id/init | Chat init (history + quota) |
| WS | /chat | WebSocket chat gateway |
| GET | /products/chat-coupons | Coupon product list |
| POST | /purchases/verify-iap | Verify IAP receipt + credit |
| GET | /auditions/active | Active audition + current round |
| GET | /auditions/rounds/:id | Round detail + ranking |
| POST | /auditions/rounds/:id/vote | Cast vote |
| GET | /idols/:id/photocard-sets | Photocard sets |
| POST | /photocards/pull | Pull photocard (after IAP verify) |
| GET | /users/me/photocards | My collection |
| GET | /users/me | My profile |
| PUT | /users/me/profile | Update profile |

### Admin CMS API (prefix: /admin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | /admin/agencies | Agency CRUD |
| GET/POST | /admin/idols | Idol list / create |
| PUT | /admin/idols/:id | Idol update |
| PUT | /admin/idols/:id/chat-config | Chat quota + auto-messages |
| GET/POST | /admin/auditions | Audition list / create |
| PUT | /admin/auditions/rounds/:id/activate | Activate round |
| PUT | /admin/auditions/rounds/:id/vote-config | Weight config |
| POST | /admin/auditions/rounds/:id/finalize | Close + calculate |
| GET/POST | /admin/photocard-sets | Photocard set CRUD |
| GET | /admin/stats/votes | Vote statistics |
| GET | /admin/stats/revenue | Revenue statistics |
| GET | /admin/stats/users | User statistics |
