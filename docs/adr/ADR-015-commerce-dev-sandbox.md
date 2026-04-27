---
id: ADR-015
title: Commerce MVP is a dev-sandbox port; Apple/Google/Stripe land as adapters
status: Accepted
date: 2026-04-23
author: Gray Kim
related_tasks: [T-044]
related_context: Commerce
related_decisions: [ADR-012]
---

## Context

We need the Commerce surface wired end-to-end before T-062 (vote tickets)
and T-045 (photocards) can ship. But the actual payment rails — Apple IAP
receipt verification, Google Play Billing, Stripe checkout/webhooks — each
require:

- Provider credentials + signed receipt handling (StoreKit v2 JWS, Google
  purchaseToken verification, Stripe webhook signature).
- Real money flowing in staging to exercise refunds.
- Store-side setup (App Store Connect products, Google Console, Stripe
  products/prices) — mostly operational work outside the repo.

None of those are ready. Meanwhile the internal product (`T-041` chat
coupons, soon `T-062` vote tickets) already needs a "buy a thing → balance
goes up" flow, or we can't rehearse M3 on staging.

## Decision

Ship Commerce as a **port/adapter module** with a single active adapter —
`DEV_SANDBOX` — that fulfills purchases inline in the same transaction.
Real providers are defined as stubs (`APPLE_IAP`, `GOOGLE_IAP`, `STRIPE`)
in the `PaymentProvider` enum and explicitly rejected with
`PROVIDER_NOT_SUPPORTED` (HTTP 400) until their adapters are implemented.

### Shape

- **Storage**
  - `PurchaseProduct` — catalog row. `deliveryPayload` JSON is the
    per-kind knob (e.g. `{ couponAmount: 10 }` for CHAT_COUPON).
  - `PurchaseTransaction` — one row per attempted purchase. Status machine
    `PENDING → FULFILLED | FAILED`. `(provider, providerTxId)` is
    uniquely-indexed to satisfy R-03 (duplicate receipt protection).

- **Application**
  - `CreatePurchaseUseCase` — validates, inserts PENDING row, dispatches
    to a `PurchaseFulfiller` that matches the product kind, transitions
    to `FULFILLED`/`FAILED`.
  - `PurchaseFulfiller[]` port — each delivery kind has its own adapter.
    Shipped: `ChatCouponFulfiller` (CHAT_COUPON → `ChatBillingRepository.adjustWallet`).
  - `ListProductsUseCase`, `ListMyTransactionsUseCase`, admin
    `CreateProductUseCase` / `UpdateProductUseCase`.

- **Endpoints**
  - Public: `GET /api/v1/commerce/products`.
  - User: `POST /api/v1/commerce/purchases`, `GET /api/v1/me/purchases`.
  - Admin: `GET/POST/PATCH /api/v1/admin/commerce/products`.

## Consequences

**Positive**

- End-to-end wallet flow works on day one against a free demo user. The
  mobile/CMS chat coupon story (ADR-041 lineage) is demonstrable.
- Adding Apple verification (or Stripe) later is one new class: an
  `ApplePurchaseVerifier` / `StripeWebhookHandler` that flips PENDING →
  FULFILLED once a receipt passes validation. `CreatePurchaseUseCase`
  doesn't change.
- Fulfillment is kind-scoped via the `PurchaseFulfiller[]` port, so
  T-062 (vote ticket grant), T-045 (photocard pack roll), and T-022 paid
  fan club each add one adapter without touching the usecase.

**Negative**

- No real money moves. Any flow tested in DEV_SANDBOX says "fulfilled"
  without the round-trip to a real store — don't treat it as billing
  regression coverage.
- Rate limits for checkout endpoints haven't been tuned. MVP is
  JwtAuthGuard + no throttle; we'll revisit when the real provider has
  real cost.

## Rejected alternatives

1. **Start with Stripe checkout only.** Rejected for MVP because the
   mobile app needs in-app purchase for store submission compliance
   (Apple §3.1.1, Google §Payments). Stripe web is useful for CMS /
   operator top-ups later.

2. **Block all commerce until full IAP verification lands.** Rejected —
   the internal product momentum (vote tickets, photo cards) depends on
   the wallet contract existing now, even if the payment rails land
   later.

3. **Hand-rolled receipt verification inside the usecase.** Rejected
   because provider-specific crypto (StoreKit v2 JWS parsing) should be
   a replaceable adapter, not intertwined with business rules.

## Activation plan

### Apple IAP adapter (T-044 follow-up)

**Full spec: [ADR-019](ADR-019-apple-iap-adapter.md) — accepted 2026-04-23 (CTO self-review; PO 비준 Phase C 재점검 회의 대기).**
Summary of the four-phase rollout:

1. `AppleReceiptVerifier` service that verifies StoreKit v2 JWS against
   Apple's public keys (offline against bundled root cert; no
   `/verifyReceipt` REST call).
2. `POST /api/v1/commerce/purchases` with `provider: 'APPLE_IAP'` and
   `receiptJws` → transaction row created as PENDING → verified inline
   → fulfilled inline (no queue — JWS verify is sub-ms).
3. Webhook endpoint (`POST /api/v1/webhooks/apple`) receives signed
   server-to-server notifications, dispatched by type (REFUND / REVOKE
   / CONSUMPTION_REQUEST / TEST). Idempotent via the existing
   `(provider, providerTxId)` UNIQUE.
4. Refunds: `REFUND` / `REVOKE` → tx flipped to REFUNDED + compensating
   `PurchaseFulfiller.refund(input)` call. Kind-specific semantics
   (coupon/ticket deduct; photocards keep inventory — industry
   standard for gacha refunds).

### Google Play Billing adapter
Same shape as Apple with `GoogleReceiptVerifier` and a Real-Time
Developer Notification webhook.

### Stripe adapter
`POST /api/v1/commerce/purchases { provider: 'STRIPE' }` returns a
`checkoutSessionUrl`. Stripe webhook receives `checkout.session.completed`
→ verifies signature → fulfill. Useful for CMS/operator tools that can't
use IAP.

### Fulfiller expansion
- `VoteTicketFulfiller` for T-062 — **shipped 2026-04-23**. Grants
  N tickets to a user-global `VoteTicketBalance` row (not round-scoped
  — ticket packs are round-agnostic). Balance changes go through the
  atomic `VoteTicketRepository.grant/consumeOne/refundOne` which writes
  a `VoteTicketLedger` row in the same `$transaction`. On vote cast,
  `CastTicketVoteUseCase` consumes one ticket, applies `ticketWeight`
  to the Redis leaderboard, and refunds the ticket if the ZINCRBY
  fails. Empty balance → `NOT_ENOUGH_TICKETS` (HTTP 402).
- `PhotocardPackFulfiller` for T-045 — **shipped 2026-04-23**. Rolls
  `deliveryPayload.count` templates from `deliveryPayload.setId`, weighted
  by each active template's `dropWeight`. Inserts one `UserPhotocard` row
  per pick in the repository's `$transaction`. Exposed `GET /api/v1/me/photocards`
  for inventory and `GET /api/v1/photocards/sets/:id` for set preview. Admin
  CRUD lives under `/api/v1/admin/photocards/sets`. Unit-tested with a seeded
  PRNG (distribution within ±2.5pp over 20k trials, zero-weight templates
  never pick). **Probability disclosure**: see ADR-016 — the set preview
  endpoint returns `dropPercent` per template (computed server-side from
  `dropWeight`) so the shop can publish exact rates.
- `FanClubSubscriptionFulfiller` for paid fan clubs (ADR-012 activation)
  — creates/renews a `Subscription` row and auto-joins the user to the
  club.

## Status of implementation

- Prisma: `PurchaseProduct`, `PurchaseTransaction`, three enums + migration.
- Shared DTOs + 6 error codes.
- Backend `modules/commerce/` with Clean Arch layering:
  - Ports: `ProductRepository`, `TransactionRepository`, `PurchaseFulfiller`.
  - Adapters: `PrismaProductRepository`, `PrismaTransactionRepository`,
    `ChatCouponFulfiller` (→ `ChatBillingRepository`).
  - Usecases: List/Create/UpdateProduct, CreatePurchase, ListMyTransactions.
  - Controllers: `CommerceController` (public + user) + `AdminCommerceController`
    (admin+operator).
- Seed: 3 chat coupon SKUs + 2 vote ticket SKUs + 2 photocard pack SKUs
  (`chat-coupon-10/30/100`, `vote-ticket-10/50`, `photocard-pack-5/10`).
- ChatModule exports `CHAT_BILLING_REPOSITORY`, VoteModule exports
  `VOTE_TICKET_REPOSITORY`, PhotocardModule exports `PHOTOCARD_REPOSITORY`
  so the respective fulfillers can inject them.

Only `DEV_SANDBOX` is accepted by `CreatePurchaseUseCase`; other providers
throw `PROVIDER_NOT_SUPPORTED`.
