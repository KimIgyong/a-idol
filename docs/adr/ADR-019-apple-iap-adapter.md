---
id: ADR-019
title: Apple IAP adapter — StoreKit v2 JWS verification + server-to-server webhooks
status: Accepted
date: 2026-04-23
author: Gray Kim
related_tasks: [T-044, T-046]
related_context: Commerce, Payments
related_decisions: [ADR-015]
---

> **Status history**
> - 2026-04-23 `Proposed` — CTO 단독 작성.
> - 2026-04-23 `Accepted` — CTO self-review 통과. Phase C 재점검 회의
>   (예정: 2026-04-30) PO 비준 대기. 회의에서 반려 시 `Rejected` 또는
>   `Superseded`로 revert.
>
> 이 ADR이 **Accepted** 상태인 이유: 구현(T-046) 일정이 Phase C 블로커
> 1순위이므로 회의 이전에 구현 사전 준비 (Apple Developer Program 가입,
> verifier 인터페이스 TypeScript 골격 작성)가 lock-step으로 가능해야
> 한다. Proposed 상태에서는 의존 작업을 시작하기가 애매.
> PR 리뷰 + ADR-015 activation plan 전환이 여기 달려 있다.

## Context

ADR-015 shipped the Commerce port/adapter with a single active adapter
(`DEV_SANDBOX`) and left Apple / Google / Stripe as rejected stubs. The
Phase C checklist identifies **IAP integration (T-046) as the #1 GA
blocker**. This ADR specifies *how* the Apple adapter plugs into the
existing `CreatePurchaseUseCase` without re-opening its design.

The legal brief ([`docs/legal/youth-payment-limit-brief-ko.md`](../legal/youth-payment-limit-brief-ko.md))
runs in parallel. This adapter's design does not depend on the legal
outcome — per-user monthly caps are a separate concern layered on top
of the same transaction flow — but the code must expose the hooks that a
cap enforcer will plug into.

### What Apple gives us

StoreKit v2 (iOS 15+, targeted for MVP) returns transactions as **JWS
(JSON Web Signature) tokens** rather than the legacy receipt blob. Each
transaction is a compact JWS signed by Apple's current IAP private key.
The public key set rotates and is served from Apple as x5c certificates.

Two information paths reach our server:

1. **Client-driven**: the app sends the JWS to `POST /api/v1/commerce/purchases`
   along with the product SKU (our internal `productId`). This is the
   happy path — the user just bought in-app.
2. **Server-to-server (S2S) notifications v2**: Apple posts JWS events
   to a webhook URL for any transaction state change (refund, revocation,
   subscription renewal, etc.). We register one URL per environment
   (sandbox / production) in App Store Connect.

Both carry a `transactionId` — Apple's stable identifier per purchase —
which maps 1:1 to our `(provider='APPLE_IAP', providerTxId=transactionId)`
UNIQUE key on `purchase_transactions` (R-03 duplicate protection).

## Decision

### 1. Verification = JWS signature check, always

No call to Apple's REST `/verifyReceipt` endpoint. StoreKit v2 JWS is
self-contained — the transaction payload is embedded in the token, and
the only online dependency is Apple's public key set (which we cache).

Implementation via [`jose`](https://github.com/panva/jose) (already
considered in Phase C checklist):

```ts
interface AppleReceiptVerifier {
  /**
   * Verify a StoreKit v2 JWS and return the structured transaction info.
   * Throws DomainError(INVALID_RECEIPT) on signature failure, expiry,
   * or environment mismatch.
   */
  verify(jws: string): Promise<{
    transactionId: string;
    originalTransactionId: string;
    productId: string;        // Apple SKU, must match our `product.sku`
    purchaseDate: Date;
    quantity: number;
    environment: 'Sandbox' | 'Production';
    // surfaced for refund / family-share handling later
    revocationDate?: Date;
    revocationReason?: number;
  }>;
}
```

Key source: Apple publishes the JWKS at `https://appleid.apple.com/auth/keys`
and the IAP signing cert chain is embedded in the JWS's `x5c` header per
RFC 7515 §4.1.6. We validate the chain against Apple's root (`AppleRootCA-G3.cer`,
shipped as a const byte-array).

### 2. Transaction lifecycle — two-phase

The happy path now has two server transitions instead of the SANDBOX
one-shot:

```
client ──POST /purchases(APPLE_IAP, jws)──▶ PENDING row created
                                             │
                                             ▼
                                     verifier.verify(jws)
                                             │
                                 ┌───────────┴───────────┐
                                 │                       │
                              valid                    invalid
                                 │                       │
                                 ▼                       ▼
                           FULFILL inline         markFailed(reason)
                           (as DEV_SANDBOX)        throw 400
                                 │
                                 ▼
                            FULFILLED
```

Why inline and not async? Apple's JWS verify is offline after the first
public-key fetch (cached for 24h). There's no observable latency win
from queueing. Keeping verification inline preserves the client UX —
one POST, one definitive answer — matching the DEV_SANDBOX contract.

**CreatePurchaseUseCase does not change.** The verifier is a *new*
dependency injected next to the fulfillers. The usecase gets a
`verifier.verifyForProvider(provider, jws)` call between "create PENDING
row" and "dispatch to fulfiller."

### 3. PENDING state is visible, not just transient

Any verification failure — signature, expiry, env mismatch, duplicate —
still leaves a row in `purchase_transactions` with `status='FAILED'` and
`failedReason` populated. This is deliberate:

- Support can answer "I clicked buy but got an error" by looking up the
  tx row and reading the reason.
- Apple S2S notifications often arrive *before* the client call on slow
  networks. If we see a notification for a `transactionId` we don't
  have, we create the PENDING row from the webhook side (see §4).
- The client's retry-with-same-JWS pattern hits the `(provider,
  providerTxId)` UNIQUE constraint on the second attempt, which we
  already translate to `DUPLICATE_RECEIPT` → 409. The client treats 409
  as "already handled, refetch inventory."

### 4. Webhook handler

New endpoint: `POST /api/v1/webhooks/apple` (public, no auth guard — Apple
signs the body).

```ts
@Public
@Post('webhooks/apple')
async handleAppleNotification(@Body() body: { signedPayload: string }) {
  const notif = await this.verifier.verifyNotification(body.signedPayload);
  // notif contains notificationType, subtype, transactionInfo, etc.
  await this.appleWebhook.handle(notif);  // dispatches by notificationType
  return { ok: true };  // Apple retries on non-2xx — idempotent handler required
}
```

**Notification types we handle in MVP:**

| Type | Action |
|---|---|
| `REFUND` | mark tx `REFUNDED`, call compensating fulfiller to reverse the delivery |
| `REFUND_DECLINED` | log; no state change (Apple declined the user's refund request) |
| `REVOKE` | family-share revocation — same as REFUND |
| `CONSUMPTION_REQUEST` | respond with the user's consumption status (lowest-effort answer acceptable) |
| `TEST` | webhook liveness probe from App Store Connect — respond 200 |

Everything else is logged and ignored (subscriptions aren't in MVP).

**Idempotency** is by `(provider, providerTxId)`. Apple retries with
exponential backoff for ~3 days on non-2xx; every retry carries the
same `transactionId`. Our webhook handler looks up the tx, applies a
state transition idempotently, and returns 200. Repeated notifications
for an already-refunded tx just re-assert `REFUNDED` and exit.

### 5. Compensating fulfillment (refund)

Each existing `PurchaseFulfiller` gains an optional `refund(input)`
method. Kind-by-kind:

| Fulfiller | Refund semantics |
|---|---|
| `ChatCouponFulfiller` | `adjustWallet({delta: -couponAmount, reason: 'REFUND'})`. Balance allowed to go negative; user can't send chat until it recovers, and a follow-up support action can zero out. |
| `VoteTicketFulfiller` | `grant({amount: -ticketAmount})` — path through `adjustGlobal` with negative delta. Errors cleanly if balance is already 0 (wrote ledger says "refund attempted on empty wallet"). Same for `grantRound` with negative. |
| `PhotocardPackFulfiller` | **Do not revoke cards.** Refund is monetary; the user keeps the pulled cards but does not keep the money. This is how gacha refunds universally work and aligns with Apple's own docs on "consumable vs non-consumable." Ledger a `REFUND` row with `delta: 0, memo: 'monetary_refund'` so audit shows the event. |

The compensating call runs inside a `$transaction` that flips the tx
to `REFUNDED`. Failure propagates — Apple retries the webhook, and
we try again next attempt.

### 6. Environment switching

One credential bundle per env:
- **Sandbox**: verifier accepts JWS with `environment: 'Sandbox'`, uses
  the App Store Connect sandbox team ID.
- **Production**: accepts `environment: 'Production'` only.

Reject cross-env JWS with `INVALID_RECEIPT` — this prevents a malicious
client from using a sandbox-generated receipt against production.

Config: `APPLE_IAP_ENV=sandbox|production` in env. The same codebase
runs both; we pick the expected environment at boot via `AppConfig`.

### 7. Public key caching

- Fetch `AppleRootCA-G3.cer` once at build time and bundle (never network).
- Fetch the JWS `x5c` chain each verify call; the chain is in the
  token itself, so the only online concern is the root-to-intermediate
  trust chain (verified offline against the bundled root).
- Apple rotates signing keys yearly-ish. Our code verifies the chain,
  not a pinned `kid`, so rotation is transparent.

## Consequences

**Positive**

- Implementation estimate holds at 8–12 days for Apple (original ADR-015
  plan). Most of that is setup / test devices / App Store Connect
  provisioning — the actual code is ~500 LOC split across verifier,
  webhook handler, and fulfiller refund methods.
- Zero change to `CreatePurchaseUseCase` — ADR-015's "new class, same
  usecase" promise held.
- `(provider, providerTxId)` UNIQUE already does R-03 duplicate
  protection; no new constraint needed.
- Webhook idempotency is a natural consequence of the DB unique index,
  not a separate mechanism.

**Negative**

- JWS verification is offline — good for speed, bad if someone MITMs
  our build pipeline and replaces `AppleRootCA-G3.cer`. Mitigation:
  check the root cert hash at startup against a hard-coded constant
  (deferred follow-up).
- Gacha refund leaves cards in inventory. Users who refund a photocard
  pack, then complain "you took my money but kept the cards" — the
  inverse is "you took the cards but refunded the money." Apple IAP
  refund is *user-initiated against Apple*, and Apple already dealt with
  the "bought by minor without consent" category. Our stance: follow
  Apple's categorization.
- Family-share revocations (one user pays, family member uses) arrive as
  REVOKE. We treat them as refunds — the family member's inventory is
  debited. If the family member doesn't have enough balance (already
  consumed coupons), the wallet goes negative. Acceptable for MVP;
  document in Support FAQ.
- One codebase runs both sandbox and prod, distinguished only by config.
  An env config mistake means prod accepts sandbox JWS (security hole).
  Mitigation: fail-fast at boot if `APPLE_IAP_ENV` unset.

## Rejected alternatives

1. **Call Apple's `/verifyReceipt` REST** — legacy StoreKit 1 path.
   Rejected: deprecated for new apps, adds 200ms/request latency on
   the client's critical path, requires a shared secret stored
   server-side.

2. **Queue verification via BullMQ** — makes the `/purchases` endpoint
   return immediately with `status: PENDING`, verify async. Rejected:
   adds an "optimistic purchase" UX surface (client shows "processing…"
   for a couple seconds) with no real latency win, and doubles the
   state machine. Only worth it if verification were expensive (it
   isn't — cached JWKS lookup is sub-ms).

3. **Unified verifier across providers** — one class handles Apple /
   Google / Stripe with a polymorphic interface. Rejected per ADR-015's
   "provider-specific crypto should be a replaceable adapter" — Google
   Play's purchaseToken validation and Stripe's webhook signatures look
   nothing like Apple's JWS, and forcing a common interface makes all
   three harder to reason about.

4. **Revoke photocards on refund** — flip `UserPhotocard` rows to
   soft-deleted. Rejected per §5 above; follows industry and Apple
   categorization. Also creates a weird failure mode where a user can
   refund → screenshot empty inventory → dispute about "why was I
   charged then not delivered."

## Activation plan

### Phase 1 — Verifier + happy path (≈ 4 days)

1. `AppleReceiptVerifier` interface + `JoseAppleReceiptVerifier` impl using `jose`.
2. Unit tests: signed fixtures (captured from sandbox), expired JWS,
   environment mismatch, tampered payload, wrong product SKU.
3. Extend `CreatePurchaseUseCase` input to optionally accept
   `receiptJws` when `provider === 'APPLE_IAP'`; existing SANDBOX path
   untouched.
4. Remove APPLE_IAP from the `PROVIDER_NOT_SUPPORTED` branch.

### Phase 2 — Webhook (≈ 3 days)

5. `POST /api/v1/webhooks/apple` endpoint with body signature verify.
6. `AppleWebhookHandler.handle(notif)` dispatches by notificationType.
7. REFUND handler → tx.markRefunded + fulfiller.refund().
8. Idempotency E2E: replay the same notification 3× and assert one
   REFUNDED state + one ledger row per fulfiller (not three).

### Phase 3 — Refund fulfillment (≈ 2 days)

9. `PurchaseFulfiller.refund(input)` added to the port (optional
   method; DEV_SANDBOX provides default no-op).
10. `ChatCouponFulfiller.refund` — `adjustWallet({delta: -N})`.
11. `VoteTicketFulfiller.refund` — handles both global and round via
    `consumed.source` stored on the original transaction's
    `deliverySnapshot`.
12. `PhotocardPackFulfiller.refund` — ledger row only, no inventory change.

### Phase 4 — Environment + ops (≈ 3 days)

13. `APPLE_IAP_ENV` config + fail-fast boot check.
14. App Store Connect registration: product catalog (one SKU per
    `purchase_products.sku`), sandbox webhook URL (`…/api/v1/webhooks/apple`),
    production webhook URL.
15. Sandbox E2E: real iPhone → sandbox Apple ID → purchase → webhook
    → refund via Settings → webhook → REFUNDED.
16. Runbook entry: "Apple IAP outage — how to tell, how to recover."

Total: **~12 days** of development time. External blockers (Apple
Developer Program provisioning, App Store Connect product approval,
sandbox tester device setup) may push calendar to 3 weeks.
See [`apple-developer-program-checklist-ko.md`](../ops/apple-developer-program-checklist-ko.md)
for the step-by-step external-procedure checklist; code Phases 1–3 are
designed to run fully in parallel with the enrollment.

## Follow-ups (explicitly out of scope for this ADR)

- **Google Play Billing adapter** — same structural shape, different
  crypto (`GooglePlayDeveloperAPI.purchases.products.get`). Own ADR
  when Google takes priority.
- **Stripe adapter** — for CMS/operator top-ups. Webhook signature via
  `Stripe-Signature` header, not in MVP.
- **Subscription products** — `FAN_CLUB_SUBSCRIPTION` kind is defined
  but no fulfiller. Subscriptions need renewal-on-notification logic
  that's separate from consumables; defer until ADR-012 paid fan club
  activation.
- **Youth monthly payment cap** enforcement — depends on the legal
  brief outcome. Regardless of outcome, the hook point is a middleware
  running between tx.create() and verifier.verify(), checking
  month-to-date sum for users under 18. Design ADR separately when
  legal opinion lands.

## Status of implementation

- **Phase 1 pre-work — landed 2026-04-23** (port + stub + error +
  placeholder test + schema mapping):
  - `AppleReceiptVerifier` port + `AppleTransactionInfo` type +
    `StubAppleReceiptVerifier` in
    `packages/backend/src/modules/commerce/application/apple-iap-interfaces.ts`.
  - `INVALID_RECEIPT` error code added; `AppExceptionFilter` maps to
    HTTP 400.
  - 2 port-contract unit tests (`apple-iap-interfaces.spec.ts`).
  - Stub throws `INVALID_RECEIPT` unconditionally → current runtime
    behavior for APPLE_IAP unchanged (`CreatePurchaseUseCase` still
    rejects via the `PROVIDER_NOT_SUPPORTED` branch).
  - **Schema**: `purchase_products.apple_product_id` (VARCHAR(120),
    nullable, unique) — migration `20260423231038_apple_product_id`.
    Seed populates 7 MVP SKUs per Apple Developer Program checklist §4
    mapping table (`group.amoeba.aidol.<sku>` convention; bundle prefix
    is a placeholder until Apple Team is confirmed).
  - Integration test `seed-contract.spec.ts` TC-SEED-005 verifies the
    7-entry mapping survives seed / migration drift.
- **Phase 1 remaining work** (awaiting `jose` install approval — see
  [`dependency-approval-jose-ko.md`](../ops/dependency-approval-jose-ko.md)):
  - `pnpm add jose --filter @a-idol/backend` — explicit deps decision.
  - `JoseAppleReceiptVerifier` in `infrastructure/` using
    `jose.compactVerify` + bundled `AppleRootCA-G3.cer`.
  - TC-IAP-003..006 — valid JWS / expired / cross-env / tampered cases
    using a test key pair (real Apple fixtures come with sandbox
    device tests in Phase 4).
  - **`CreatePurchaseBody.receiptJws`** — **landed 2026-04-23** (≤ 8 KB,
    optional, threaded through `CreatePurchaseUseCase.execute` as an
    unused passthrough). Mobile can ship its IAP integration without a
    later DTO break. Integration-tested: TC-COMM-005 (DEV_SANDBOX
    ignores), TC-COMM-006 (APPLE_IAP still rejects via
    PROVIDER_NOT_SUPPORTED), TC-COMM-007 (> 8 KB → 400).
  - `CreatePurchaseUseCase` accepts the verifier for the APPLE_IAP
    branch; remove APPLE_IAP from `PROVIDER_NOT_SUPPORTED`.
- **Unchanged (no schema / port changes needed)**:
  - Prisma `PurchaseTransaction` (`provider`, `providerTxId`, `status`,
    `fulfilledAt`, `failedReason`, `deliverySnapshot`).
  - `(provider, providerTxId)` UNIQUE — R-03 duplicate protection.
- **Port `refund()` method** still pending — ADR-019 Phase 3.
